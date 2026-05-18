// scripts/audit-payroll-fallback.mjs
//
// READ-ONLY payroll fallback 영향 범위 audit 스크립트.
//
// 목적:
//   src/App.jsx 의 calculateMonthlyWage 내부 fallback(processDateStr 의 else 분기)
//   이 실제 직원별 실근무시간 / actual 급여(기본+OT) / 주휴 / dailyBreakdown
//   에 어느 정도 영향을 주는지 read-only 로만 수치 비교.
//
// 1차 대상자 (사용자 지시):
//   - LM001 이태호  (연차 3일 케이스)
//   - LM003 허지윤  (정상근무 기준값)
//   - LM009 이윤정  (연차 1일 + 오후 반차 1일 케이스)
//
// 1차 대상월 (사용자 지시):
//   2026-04
//
// 안전 규약:
//   - getDoc / getDocs / collection / doc 만 사용.
//   - setDoc / addDoc / updateDoc / deleteDoc / writeBatch / runTransaction
//     import 0건 / 호출 0건. (절대 금지)
//   - 실제 데이터 변경 일체 없음. deploy / commit / push / PR 없음.
//   - 비밀번호는 stdin 비표시 입력.
//   - Firebase config 는 src/firebase.js 재사용.
//   - 실행 admin 은 sys_admin / approver_final 권한 권장.
//
// 출력 허용 필드:
//   employees: id / name / team / external_employee_id / workHours / workDays
//              / checkIn / checkOut / startDate / resignDate
//   attendance: date / checkIn / checkOut / reason / overtime / isRecorded
//
// 출력 금지 필드:
//   wage / previousWage / wageIncreaseDate / bank / account / rrn / phone
//   / email / address / insuranceStatus 등 — 이번 audit 출력에서 제외.
//
// 주의:
//   - 이 스크립트는 정답 계산이 아니라 "현재 fallback 영향 분석" 입니다.
//   - 연차/반차 인정시간 자동 가산은 actual 에 포함하지 않습니다.
//   - 연차 인정시간 후보 / 반차 인정시간 후보는 별도 컬럼으로만 표시합니다.
//
// 실행:
//   node scripts/audit-payroll-fallback.mjs
//   (실행 후 admin email + password 프롬프트가 표시됩니다)

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../src/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 대상 ────────────────────────────────────────────────────────
// 실행 방식:
//   기본(특정 사번): node scripts/audit-payroll-fallback.mjs
//   전직원 audit:    node scripts/audit-payroll-fallback.mjs --all
//   대상 월 변경:    node scripts/audit-payroll-fallback.mjs --month=2026-04
const argv = process.argv.slice(2);
const SCAN_ALL_ACTIVE = argv.includes('--all');
const monthArg = argv.find(a => a.startsWith('--month='));
const TARGET_EXTERNAL_IDS = ['LM001', 'LM003', 'LM009']; // --all 미사용 시
const TARGET_MONTH = monthArg ? monthArg.split('=')[1] : '2026-04'; // YYYY-MM

// ─── 입력 helper ─────────────────────────────────────────────────
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

// ─── 허용 필드 추출 ─────────────────────────────────────────────
const EMP_ALLOWED = ['id', 'name', 'team', 'external_employee_id', 'workHours', 'workDays', 'checkIn', 'checkOut', 'startDate', 'resignDate'];
function pickEmp(raw) {
    const out = {};
    for (const k of EMP_ALLOWED) out[k] = raw?.[k];
    return out;
}

// ─── 날짜 유틸 ───────────────────────────────────────────────────
function isValidYmd(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function dowOf(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
}
function monthDates(ym) {
    const [y, m] = ym.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const arr = [];
    for (let i = 1; i <= days; i++) {
        arr.push(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return arr;
}

// ─── calculateDailyWage 모사 (App.jsx:203-232) ───────────────────
function calculateDailyHours(start, end, overtime = 0) {
    if (!start || !end) return { hours: 0, regularHours: 0, actualOvertime: 0 };
    const norm = (t) => {
        if (!t) return '00:00';
        let s = String(t).replace(/\s/g, '');
        if (s.includes('시')) s = `${parseInt(s).toString().padStart(2, '0')}:00`;
        const p = s.split(':');
        if (p.length >= 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
        return s;
    };
    const startT = new Date(`2000-01-01T${norm(start)}`);
    let endT = new Date(`2000-01-01T${norm(end)}`);
    if (isNaN(startT.getTime()) || isNaN(endT.getTime())) return { hours: 0, regularHours: 0, actualOvertime: 0 };
    if (endT < startT) endT.setDate(endT.getDate() + 1);
    let minutes = (endT - startT) / 60000;
    const breakStart = new Date('2000-01-01T13:00:00');
    const breakEnd = new Date('2000-01-01T14:00:00');
    if (startT <= breakStart && endT >= breakEnd) minutes -= 60;
    const total = Math.max(0, minutes / 60);
    const ot = Math.min(Number(overtime) || 0, total);
    return { hours: total, regularHours: total - ot, actualOvertime: ot };
}

// ─── 단일 직원 audit ────────────────────────────────────────────
function auditOne(emp, recordsMap, targetMonth) {
    const dates = monthDates(targetMonth);

    // A. records 현황
    const allKeys = Object.keys(recordsMap);
    const monthKeys = allKeys.filter(k => k.startsWith(targetMonth + '-') || k.startsWith(targetMonth.replace('-', '-') + '-'));
    const validMonthKeys = allKeys.filter(k => isValidYmd(k) && k.startsWith(targetMonth + '-'));
    const abnormalKeys = allKeys.filter(k => !isValidYmd(k));

    let weekdayWithRecord = 0, weekdayNoRecord = 0;
    let weekendWithRecord = 0, weekendNoRecord = 0;
    for (const ymd of dates) {
        const dow = dowOf(ymd);
        const isWeekend = (dow === 0 || dow === 6);
        const hasRec = !!recordsMap[ymd];
        if (isWeekend) { hasRec ? weekendWithRecord++ : weekendNoRecord++; }
        else { hasRec ? weekdayWithRecord++ : weekdayNoRecord++; }
    }

    // B/C. fallback 포함 vs 제외 계산 (이번 달 + 주차 보정용 전월 일부 — 단순화 위해 이번 달만 비교)
    let inc_hours = 0, exc_hours = 0;
    let inc_break_rows = 0, exc_break_rows = 0;
    let fallback_days = 0, fallback_hours_added = 0;
    const dailyBreakdownInc = [];
    const dailyBreakdownExc = [];

    // 주별 시간 (월요일 기준)
    const weeklyInc = {}, weeklyExc = {};
    const weekKey = (ymd) => {
        const [y, m, d] = ymd.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dow = dt.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(y, m - 1, d + diff);
        return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    };

    const inStart = emp.startDate || '';
    const outResign = emp.resignDate || '';

    for (const ymd of dates) {
        if (inStart && ymd < inStart) continue;
        if (outResign && ymd > outResign) continue;
        const dow = dowOf(ymd);
        const isWeekday = (dow >= 1 && dow <= 5);
        const rec = recordsMap[ymd];

        // fallback 포함 (현재 calculateMonthlyWage 동작)
        let incCheckIn = null, incCheckOut = null, incOT = 0, incReason = '', incIsRecorded = false;
        if (rec) {
            incCheckIn = rec.checkIn; incCheckOut = rec.checkOut; incOT = rec.overtime || 0;
            incReason = rec.reason || ''; incIsRecorded = true;
        } else if (isWeekday) {
            incCheckIn = emp.checkIn; incCheckOut = emp.checkOut; incOT = 0;
            incReason = ''; incIsRecorded = false;
        }
        const incDaily = calculateDailyHours(incCheckIn, incCheckOut, incOT);
        inc_hours += incDaily.hours;
        const wk = weekKey(ymd);
        weeklyInc[wk] = (weeklyInc[wk] || 0) + incDaily.hours;
        dailyBreakdownInc.push({
            date: ymd, dow, isRecorded: incIsRecorded,
            checkIn: incCheckIn || '', checkOut: incCheckOut || '',
            reason: incReason, overtime: incOT,
            hours: Math.round(incDaily.hours * 100) / 100,
        });
        if (!rec && isWeekday) {
            fallback_days++;
            fallback_hours_added += incDaily.hours;
        }

        // fallback 제외 (records 있는 날만 계산)
        let excCheckIn = null, excCheckOut = null, excOT = 0, excReason = '';
        if (rec) {
            excCheckIn = rec.checkIn; excCheckOut = rec.checkOut; excOT = rec.overtime || 0;
            excReason = rec.reason || '';
        }
        const excDaily = calculateDailyHours(excCheckIn, excCheckOut, excOT);
        exc_hours += excDaily.hours;
        weeklyExc[wk] = (weeklyExc[wk] || 0) + excDaily.hours;
        if (rec) {
            dailyBreakdownExc.push({
                date: ymd, dow, isRecorded: true,
                checkIn: excCheckIn || '', checkOut: excCheckOut || '',
                reason: excReason, overtime: excOT,
                hours: Math.round(excDaily.hours * 100) / 100,
            });
        }
    }

    // 주별 15h 이상 여부 비교 (※ 로직 모사 불완전 — 전월 주차 보정 미포함, 결근 reason 미반영)
    const weekRows = [];
    const allWeekKeys = new Set([...Object.keys(weeklyInc), ...Object.keys(weeklyExc)]);
    for (const wk of [...allWeekKeys].sort()) {
        const hInc = Math.round((weeklyInc[wk] || 0) * 100) / 100;
        const hExc = Math.round((weeklyExc[wk] || 0) * 100) / 100;
        weekRows.push({
            week_mon: wk,
            hours_inc: hInc,
            hours_exc: hExc,
            ge15_inc: hInc >= 15,
            ge15_exc: hExc >= 15,
            holiday_change: (hInc >= 15) !== (hExc >= 15),
        });
    }

    // 인정시간 후보 (참고용 — actual 미반영)
    const workHoursNum = Number(emp.workHours) || 0;
    let annualDays = 0, halfDays = 0;
    let halfActualHoursSum = 0;
    const annualSamples = [], halfSamples = [], normalSamples = [], weekendSamples = [];
    for (const ymd of validMonthKeys) {
        const r = recordsMap[ymd];
        const reason = String(r?.reason || '').trim();
        const isAnnual = reason.includes('연차') && !reason.includes('반차');
        const isHalf = reason.includes('반차');
        const dow = dowOf(ymd);
        if (isAnnual) {
            annualDays++;
            if (annualSamples.length < 3) annualSamples.push({ date: ymd, reason, checkIn: r.checkIn || '', checkOut: r.checkOut || '' });
        } else if (isHalf) {
            halfDays++;
            const h = calculateDailyHours(r.checkIn, r.checkOut, r.overtime).hours;
            halfActualHoursSum += h;
            if (halfSamples.length < 3) halfSamples.push({ date: ymd, reason, checkIn: r.checkIn || '', checkOut: r.checkOut || '', actualHours: Math.round(h * 100) / 100 });
        } else {
            if (dow === 0 || dow === 6) {
                if (weekendSamples.length < 3) weekendSamples.push({ date: ymd, dow, reason, checkIn: r.checkIn || '', checkOut: r.checkOut || '' });
            } else {
                if (normalSamples.length < 3) normalSamples.push({ date: ymd, dow, reason, checkIn: r.checkIn || '', checkOut: r.checkOut || '' });
            }
        }
    }
    const fallbackSamples = dailyBreakdownInc.filter(r => !r.isRecorded && r.hours > 0).slice(0, 5);

    return {
        target_external_id: emp.external_employee_id,
        emp_id: emp.id,
        name: emp.name,
        team: emp.team,
        workHours_field: emp.workHours,
        workDays_field: emp.workDays,
        checkIn_field: emp.checkIn,
        checkOut_field: emp.checkOut,
        startDate: emp.startDate || '',
        resignDate: emp.resignDate || '',

        // A. records 현황
        records_total: allKeys.length,
        records_valid_month: validMonthKeys.length,
        records_abnormal_keys: abnormalKeys,
        weekday_with_record: weekdayWithRecord,
        weekday_no_record: weekdayNoRecord,
        weekend_with_record: weekendWithRecord,
        weekend_no_record: weekendNoRecord,

        // B/C
        fallback_days,
        fallback_hours_added: Math.round(fallback_hours_added * 100) / 100,
        totalHours_with_fallback: Math.round(inc_hours * 100) / 100,
        totalHours_without_fallback: Math.round(exc_hours * 100) / 100,
        totalHours_diff: Math.round((inc_hours - exc_hours) * 100) / 100,

        // D. dailyBreakdown 비교
        breakdown_rows_with_fallback: dailyBreakdownInc.length,
        breakdown_rows_without_fallback: dailyBreakdownExc.length,
        sample_fallback_rows: fallbackSamples,
        sample_annual_rows: annualSamples,
        sample_half_rows: halfSamples,
        sample_normal_rows: normalSamples,
        sample_weekend_rows: weekendSamples,

        // E. 주휴 영향 (로직 모사 불완전: 전월 주차 보정 / 결근 reason 미반영)
        weekly_compare: weekRows,
        holiday_weeks_changed: weekRows.filter(w => w.holiday_change).length,
        weekly_note: '로직 모사 불완전 — 전월 주차 보정 / 결근 reason 박탈 / target month 귀속(목요일 기준) 미반영. 변화 가능성 신호로만 해석.',

        // F. 인정시간 후보 (참고용 — actual 미반영)
        annual_days_in_month: annualDays,
        half_days_in_month: halfDays,
        recognition_candidate_annual_hours: Math.round(workHoursNum * annualDays * 100) / 100,
        recognition_candidate_half_hours_total: Math.round(
            Math.max(0, halfDays * workHoursNum - halfActualHoursSum) * 100
        ) / 100,
        recognition_note: 'actual 미반영. workHours × 연차일수 / max(0, workHours - 반차 actual) 후보.',
    };
}

// ─── main ────────────────────────────────────────────────────────
(async () => {
    console.log('[audit-payroll-fallback] READ-ONLY payroll fallback 영향 분석');
    if (SCAN_ALL_ACTIVE) {
        console.log('  모드: --all (재직자 전원)');
    } else {
        console.log(`  대상 외부 사번: ${TARGET_EXTERNAL_IDS.join(', ')}`);
    }
    console.log(`  대상 월: ${TARGET_MONTH}`);
    console.log('  ※ 코드/Firestore 수정 없음. 분석 결과만 출력.\n');

    const adminEmail = (await questionPlain('admin email: ')).trim();
    if (!adminEmail) { console.error('email이 비어 있습니다.'); process.exit(1); }
    const adminPassword = await questionHidden('admin password (숨김 입력): ');
    if (!adminPassword) { console.error('password가 비어 있습니다.'); process.exit(1); }

    console.log('\n[audit] 로그인 중...');
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('[audit] 로그인 성공');

    console.log('\n[audit] employees 조회 (read-only)...');
    const empSnap = await getDocs(collection(db, 'employees'));
    const allEmps = empSnap.docs.map(d => pickEmp({ ...d.data(), id: d.data().id ?? d.id }));
    console.log(`  employees 총 ${allEmps.length}건`);

    // 재직자 (resignDate 없거나 미래)
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeEmps = allEmps.filter(e => !e.resignDate || e.resignDate === '' || e.resignDate > todayStr);
    console.log(`  재직자 ${activeEmps.length}명`);

    let targets;
    if (SCAN_ALL_ACTIVE) {
        // --all: 재직자 전원 대상 (external_employee_id 없어도 emp.id 로 read)
        targets = activeEmps.map(emp => ({
            ext: String(emp.external_employee_id || '').toUpperCase() || `(no-ext id=${emp.id})`,
            emp,
        }));
    } else {
        targets = TARGET_EXTERNAL_IDS.map(ext => {
            const found = activeEmps.find(e => String(e.external_employee_id || '').toUpperCase() === ext);
            return { ext, emp: found || null };
        });
        const missing = targets.filter(t => !t.emp);
        if (missing.length > 0) {
            console.error(`[audit] 대상 미발견: ${missing.map(m => m.ext).join(', ')}`);
            console.error('       external_employee_id 매칭 실패. 백필 상태 확인 필요.');
        }
    }

    const results = [];
    for (const { ext, emp } of targets) {
        if (!emp) {
            results.push({ target_external_id: ext, error: 'employee not found' });
            continue;
        }
        if (!SCAN_ALL_ACTIVE) {
            console.log(`\n[audit] attendance read: external=${ext} emp_id=${emp.id} name=${emp.name}`);
        }
        const attRef = doc(db, 'attendance', String(emp.id));
        const attSnap = await getDoc(attRef);
        const records = attSnap.exists() ? (attSnap.data().records || {}) : {};
        if (!SCAN_ALL_ACTIVE) console.log(`  records keys: ${Object.keys(records).length}`);
        const r = auditOne(emp, records, TARGET_MONTH);
        results.push(r);
    }

    // --all 모드 전용: fallback 영향 직원만 추출 + 정렬
    if (SCAN_ALL_ACTIVE) {
        const affected = results.filter(r => !r.error && (r.fallback_days || 0) > 0);
        const unaffected = results.filter(r => !r.error && (r.fallback_days || 0) === 0);

        console.log('\n══════════════════════════════════════════════════════════════');
        console.log(`  --all 요약: fallback 영향 ${affected.length}명 / 영향 없음 ${unaffected.length}명 (총 ${results.length}명)`);
        console.log('══════════════════════════════════════════════════════════════');

        // 영향 받는 직원 (fallback 시간 큰 순)
        affected.sort((a, b) => (b.fallback_hours_added || 0) - (a.fallback_hours_added || 0));
        if (affected.length > 0) {
            console.log('\n── fallback 영향 직원 (시간 감소 큰 순) ──');
            console.table(affected.map(r => ({
                external: r.target_external_id,
                name: r.name,
                team: r.team,
                workH: r.workHours_field,
                rec_wd: r.weekday_with_record,
                fb_days: r.fallback_days,
                fb_h: r.fallback_hours_added,
                H_inc: r.totalHours_with_fallback,
                H_exc: r.totalHours_without_fallback,
                H_diff: r.totalHours_diff,
                annual: r.annual_days_in_month,
                half: r.half_days_in_month,
            })));
        } else {
            console.log('\n  → fallback 영향 직원 없음 ✓');
        }

        // 영향 없는 직원 (간략)
        console.log('\n── fallback 영향 없는 직원 (참고용) ──');
        console.table(unaffected.map(r => ({
            external: r.target_external_id,
            name: r.name,
            team: r.team,
            rec_wd: r.weekday_with_record,
            H_inc: r.totalHours_with_fallback,
        })));
    }

    // 콘솔 요약 표
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  대상자 요약');
    console.log('══════════════════════════════════════════════════════════════');
    console.table(results.filter(r => !r.error).map(r => ({
        external: r.target_external_id,
        name: r.name,
        wd_rec: r.weekday_with_record,
        wd_nor: r.weekday_no_record,
        fb_days: r.fallback_days,
        fb_h: r.fallback_hours_added,
        H_inc: r.totalHours_with_fallback,
        H_exc: r.totalHours_without_fallback,
        H_diff: r.totalHours_diff,
        annual: r.annual_days_in_month,
        half: r.half_days_in_month,
        hol_chg: r.holiday_weeks_changed,
    })));

    // 주별 변화
    for (const r of results) {
        if (r.error) continue;
        console.log(`\n  [${r.target_external_id} ${r.name}] 주별 시간 변화 (※ ${r.weekly_note})`);
        console.table(r.weekly_compare);
    }

    // 비정상 key
    for (const r of results) {
        if (r.error) continue;
        if (r.records_abnormal_keys.length > 0) {
            console.log(`\n  [${r.target_external_id} ${r.name}] 비정상 records key (${r.records_abnormal_keys.length}건):`);
            console.log(`    ${JSON.stringify(r.records_abnormal_keys)}`);
        }
    }

    // JSON dump
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const outPath = path.join(outDir, `audit-payroll-fallback-${TARGET_MONTH}-${ts}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
        scanned_at: new Date().toISOString(),
        target_month: TARGET_MONTH,
        target_external_ids: TARGET_EXTERNAL_IDS,
        results,
    }, null, 2), 'utf8');
    console.log(`\n[audit] JSON dump 저장: ${outPath}`);

    await signOut(auth);
    console.log('[audit] 종료 — 데이터 변경 없음 (read-only)');
    process.exit(0);
})().catch((e) => {
    console.error('[audit] 실패:', e?.code || '', e?.message || e);
    process.exit(2);
});
