// scripts/audit-workhours.mjs
//
// READ-ONLY employees.workHours 점검 스크립트.
// docs/payroll-recognition-design.md §11.2 — users.workHours (실제로는 employees.workHours)
// 가 직원별 1일 계약 인정시간(contractDailyHours) 원천으로 사용 가능한지 검증.
//
// 안전 규약:
//   - getDoc / getDocs / collection / doc / query / where 만 사용.
//   - setDoc / addDoc / updateDoc / deleteDoc / writeBatch / runTransaction
//     import 0건 / 호출 0건. (이번 단계 절대 금지)
//   - 실제 데이터 변경 일체 없음. deploy / commit / push / PR 없음.
//   - 비밀번호는 stdin 비표시 입력 (PowerShell 히스토리 보호).
//   - Firebase config는 src/firebase.js 재사용.
//   - 실행 admin은 sys_admin 또는 approver_final 권한 권장
//     (employees 컬렉션 전체 read 위해).
//
// 출력 필드 (허용 목록 — 그 외 필드는 의도적 미출력):
//   id / name / team / workHours / workDays / checkIn / checkOut
//   / startDate / resignDate / insuranceStatus
//
// 미출력 필드 (개인정보 최소화):
//   bank / account / phone / email / rrn / address
//   / wage / previousWage / wageIncreaseDate / 기타 모든 필드
//
// 실행:
//   node scripts/audit-workhours.mjs
//   (실행 후 admin email + password 프롬프트가 표시됩니다)

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../src/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 입력 helper ───────────────────────────────────────────────────
function questionPlain(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => { rl.close(); resolve(answer); });
    });
}
function questionHidden(prompt) {
    return new Promise((resolve, reject) => {
        process.stdout.write(prompt);
        let buf = '';
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        const onData = (chunk) => {
            for (const ch of chunk) {
                const code = ch.charCodeAt(0);
                if (ch === '\n' || ch === '\r' || code === 4) {
                    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw || false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    return resolve(buf);
                } else if (code === 3) {
                    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw || false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    return reject(new Error('aborted by user'));
                } else if (code === 8 || code === 127) {
                    buf = buf.slice(0, -1);
                } else if (code >= 32) {
                    buf += ch;
                }
            }
        };
        stdin.on('data', onData);
    });
}

// ─── 허용 필드만 추출 (개인정보 최소화) ────────────────────────────
const ALLOWED_FIELDS = ['id', 'name', 'team', 'workHours', 'workDays', 'checkIn', 'checkOut', 'startDate', 'resignDate', 'insuranceStatus'];
function pickAllowed(raw) {
    const out = {};
    for (const k of ALLOWED_FIELDS) out[k] = raw?.[k];
    return out;
}

// ─── workHours 값 분류 ─────────────────────────────────────────────
function classifyWorkHours(wh) {
    if (wh === undefined || wh === null || wh === '') return { tag: '누락', concern: true };
    if (typeof wh === 'string') {
        const n = Number(wh);
        if (Number.isNaN(n)) return { tag: '문자열(파싱불가)', concern: true };
        return { tag: `문자열("${wh}")`, concern: true };
    }
    if (typeof wh !== 'number') return { tag: `비정상타입(${typeof wh})`, concern: true };
    if (wh === 0) return { tag: '0', concern: true };
    if (wh === 8) return { tag: '8 (기본값 의심)', concern: true };
    if (wh === 7) return { tag: '7', concern: false };
    if (Number.isInteger(wh)) return { tag: `${wh} (정수)`, concern: false };
    return { tag: `${wh} (소수)`, concern: false };
}

// ─── checkIn/checkOut 와 workHours 정합성 ──────────────────────────
function parseHM(t) {
    if (!t || typeof t !== 'string') return null;
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function checkInOutConsistency(checkIn, checkOut, workHours) {
    const inM = parseHM(checkIn);
    const outM = parseHM(checkOut);
    if (inM === null || outM === null) return { tag: '시간형식없음', mismatch: null };
    const diffMin = outM - inM;
    if (diffMin <= 0) return { tag: '시간역전', mismatch: true };
    const hoursNoLunch = diffMin / 60;
    const hoursLunch1 = (diffMin - 60) / 60; // 점심 1h 차감 가정
    const wh = Number(workHours) || 0;
    const matchNoLunch = Math.abs(hoursNoLunch - wh) < 0.01;
    const matchLunch1 = Math.abs(hoursLunch1 - wh) < 0.01;
    if (matchLunch1) return { tag: `정합(점심1h 차감 후 ${wh}h)`, mismatch: false };
    if (matchNoLunch) return { tag: `정합(점심 없음 ${wh}h)`, mismatch: false };
    return {
        tag: `불일치(시간차 ${hoursNoLunch.toFixed(2)}h / 점심1h후 ${hoursLunch1.toFixed(2)}h / workHours ${wh}h)`,
        mismatch: true,
    };
}

// ─── main ─────────────────────────────────────────────────────────
(async () => {
    console.log('[audit-workhours] READ-ONLY employees.workHours 점검');
    console.log('  목적: contractDailyHours(직원별 1일 계약 인정시간) 원천으로 사용 가능 여부 검증\n');

    const adminEmail = (await questionPlain('admin email: ')).trim();
    if (!adminEmail) { console.error('email이 비어 있습니다.'); process.exit(1); }
    const adminPassword = await questionHidden('admin password (숨김 입력): ');
    if (!adminPassword) { console.error('password가 비어 있습니다.'); process.exit(1); }

    console.log('\n[audit] 로그인 중...');
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('[audit] 로그인 성공');

    console.log('\n[audit] employees 컬렉션 read-only 조회...');
    const snap = await getDocs(collection(db, 'employees'));
    const raw = snap.docs.map(d => d.data());
    console.log(`  employees 총 ${raw.length}건`);

    // 허용 필드만 추출 (개인정보 최소화)
    const filtered = raw.map(pickAllowed);

    // 재직자만 1차 후보 (resignDate 비어 있거나 미래)
    const today = new Date().toISOString().slice(0, 10);
    const isActive = (e) => !e.resignDate || e.resignDate === '' || e.resignDate > today;
    const active = filtered.filter(isActive);
    const resigned = filtered.filter(e => !isActive(e));
    console.log(`  재직자 ${active.length}건 / 퇴사자 ${resigned.length}건`);

    // team 별 그룹화 + id 정렬
    active.sort((a, b) => {
        const tA = a.team || '';
        const tB = b.team || '';
        if (tA !== tB) return tA.localeCompare(tB);
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    // 분석
    const rows = active.map(e => {
        const cls = classifyWorkHours(e.workHours);
        const cons = checkInOutConsistency(e.checkIn, e.checkOut, e.workHours);
        return {
            id: e.id,
            name: e.name,
            team: e.team,
            workHours: e.workHours,
            workDays: e.workDays,
            checkIn: e.checkIn,
            checkOut: e.checkOut,
            startDate: e.startDate,
            resignDate: e.resignDate || '',
            insuranceStatus: e.insuranceStatus,
            _workHours_tag: cls.tag,
            _concern: cls.concern,
            _consistency: cons.tag,
            _mismatch: cons.mismatch,
        };
    });

    // 콘솔 표 — 재직자 전체
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  재직자 employees.workHours 점검 (${rows.length}건)`);
    console.log('══════════════════════════════════════════════════════════════');
    console.table(rows.map(r => ({
        id: r.id,
        name: r.name,
        team: r.team,
        WH: r.workHours,
        WH_tag: r._workHours_tag,
        WD: r.workDays,
        in: r.checkIn,
        out: r.checkOut,
        ins: r.insuranceStatus ? 'Y' : 'N',
        consistency: String(r._consistency || '').slice(0, 36),
    })));

    // team 별 workHours 분포
    const byTeam = {};
    for (const r of rows) {
        const t = r.team || '(unknown)';
        if (!byTeam[t]) byTeam[t] = {};
        const wh = String(r.workHours);
        byTeam[t][wh] = (byTeam[t][wh] || 0) + 1;
    }
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  team 별 workHours 분포');
    console.log('══════════════════════════════════════════════════════════════');
    for (const [t, dist] of Object.entries(byTeam)) {
        console.log(`  [${t}] ${JSON.stringify(dist)}`);
    }

    // 의심 케이스 별도 출력
    const suspect = rows.filter(r => r._concern || r._mismatch);
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  의심 케이스 (${suspect.length}건)`);
    console.log('══════════════════════════════════════════════════════════════');
    if (suspect.length > 0) {
        console.table(suspect.map(r => ({
            id: r.id,
            name: r.name,
            team: r.team,
            WH: r.workHours,
            WH_tag: r._workHours_tag,
            consistency: String(r._consistency || '').slice(0, 50),
        })));
    } else {
        console.log('  → 의심 케이스 없음');
    }

    // 요약
    const summary = {
        scanned_at: new Date().toISOString(),
        total_employees: raw.length,
        active_count: active.length,
        resigned_count: resigned.length,
        team_distribution: byTeam,
        suspect_count: suspect.length,
        suspect_by_reason: {
            missing: rows.filter(r => r._workHours_tag === '누락').length,
            zero: rows.filter(r => r._workHours_tag === '0').length,
            string_type: rows.filter(r => String(r._workHours_tag).startsWith('문자열')).length,
            default_8_suspect: rows.filter(r => r._workHours_tag.startsWith('8')).length,
            consistency_mismatch: rows.filter(r => r._mismatch === true).length,
        },
    };
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  요약');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(JSON.stringify(summary, null, 2));

    // JSON dump (허용 필드만)
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const outPath = path.join(outDir, `audit-workhours-${ts}.json`);
    // JSON에는 허용 필드만 + 분석 태그
    fs.writeFileSync(outPath, JSON.stringify({
        summary,
        rows: rows.map(r => ({
            id: r.id, name: r.name, team: r.team,
            workHours: r.workHours, workDays: r.workDays,
            checkIn: r.checkIn, checkOut: r.checkOut,
            startDate: r.startDate, resignDate: r.resignDate,
            insuranceStatus: r.insuranceStatus,
            _workHours_tag: r._workHours_tag,
            _consistency: r._consistency,
        })),
    }, null, 2), 'utf8');
    console.log(`\n[audit] JSON dump 저장: ${outPath}`);

    await signOut(auth);
    console.log('[audit] 종료 — 데이터 변경 없음 (read-only)');
    process.exit(0);
})().catch((e) => {
    console.error('[audit] 실패:', e?.code || '', e?.message || e);
    process.exit(2);
});
