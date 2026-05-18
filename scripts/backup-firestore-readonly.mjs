// scripts/backup-firestore-readonly.mjs
//
// READ-ONLY Firestore 백업 스크립트.
// 데이터 이전 전 안전장치 확보 목적. 운영 컬렉션을 로컬 JSON으로 백업.
//
// 안전 규약:
//   - collection / getDocs 만 사용. (read-only)
//   - setDoc / addDoc / updateDoc / deleteDoc / writeBatch / runTransaction
//     import 0건 / 호출 0건. (절대 금지)
//   - 복원(restore) 기능 없음. write 기능 없음. 데이터 이전 실행 없음.
//   - deploy / commit / push / PR 없음.
//   - 비밀번호는 stdin 비표시 입력 (PowerShell 히스토리 보호).
//   - 백업 JSON / metadata 에 admin email / password 저장 안 함.
//   - Firebase config 는 src/firebase.js 재사용.
//   - 실행 admin 은 sys_admin 또는 approver_final 권한 권장
//     (전체 컬렉션 read 위해).
//
// 실행:
//   node scripts/backup-firestore-readonly.mjs
//   (실행 후 admin email + password 프롬프트가 표시됩니다)
//
// 산출물:
//   backups/firestore/YYYYMMDD-HHMMSS/
//     metadata.json
//     {collectionName}.json ...

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../src/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── 백업 대상 컬렉션 ──────────────────────────────────────────────
// 필수: 존재하지 않거나 비어 있어도 빈 배열로 기록, 오류 중단 없음.
const REQUIRED_COLLECTIONS = [
    'users',
    'employees',
    'attendance',
    'leave_requests',
    'leave_balance',
    'approvals',
    'notifications',
    'attendance_edit_logs',
    'payroll_status',
    'senior_delegations',
    'ceo_delegations',
];

// 추가 후보: 코드에서 존재 여부 미확인. 없으면 missing_or_empty 로 기록.
const OPTIONAL_COLLECTIONS = [
    'settings',
    'work_logs',
    'payroll_logs',
    'employee_accounts',
    'teams',
];

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

// ─── Firestore 특수 타입 → JSON 안전 변환 ──────────────────────────
// Timestamp / DocumentReference / GeoPoint / undefined / 순환참조 안전 처리.
function safeSerialize(value, seen = new WeakSet()) {
    if (value === undefined) return null;
    if (value === null) return null;
    const t = typeof value;
    if (t === 'number' || t === 'string' || t === 'boolean') return value;
    if (t === 'bigint') return value.toString();
    if (t === 'function') return null;

    // Firestore Timestamp (toDate / seconds / nanoseconds)
    if (value && typeof value.toDate === 'function'
        && typeof value.seconds === 'number'
        && typeof value.nanoseconds === 'number') {
        let iso = null;
        try { iso = value.toDate().toISOString(); } catch { iso = null; }
        return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds, iso };
    }
    // JS Date
    if (value instanceof Date) {
        return { __type: 'date', iso: isNaN(value.getTime()) ? null : value.toISOString() };
    }
    // GeoPoint
    if (value && typeof value.latitude === 'number' && typeof value.longitude === 'number'
        && value.constructor && value.constructor.name === 'GeoPoint') {
        return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
    }
    // DocumentReference
    if (value && typeof value.path === 'string' && value.firestore && value.id) {
        return { __type: 'docref', path: value.path };
    }
    // Bytes / Buffer
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Bytes') {
        try { return { __type: 'bytes', base64: value.toBase64?.() ?? null }; } catch { return { __type: 'bytes', base64: null }; }
    }

    if (Array.isArray(value)) {
        return value.map((v) => safeSerialize(v, seen));
    }
    if (t === 'object') {
        if (seen.has(value)) return { __type: 'circular' };
        seen.add(value);
        const out = {};
        for (const k of Object.keys(value)) {
            out[k] = safeSerialize(value[k], seen);
        }
        return out;
    }
    return null;
}

function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ─── 단일 컬렉션 read-only 백업 ────────────────────────────────────
async function backupCollection(name, outDir) {
    const exportedAt = new Date().toISOString();
    try {
        const snap = await getDocs(collection(db, name));
        const documents = snap.docs
            .map((d) => ({ id: d.id, data: safeSerialize(d.data()) }))
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const payload = { collection: name, count: documents.length, exported_at: exportedAt, documents };
        const file = `${name}.json`;
        fs.writeFileSync(path.join(outDir, file), JSON.stringify(payload, null, 2), 'utf8');
        return {
            status: documents.length > 0 ? 'ok' : 'empty',
            count: documents.length,
            file,
        };
    } catch (err) {
        return {
            status: 'error',
            count: 0,
            file: null,
            error: err?.code || err?.message || String(err),
        };
    }
}

// ─── main ─────────────────────────────────────────────────────────
(async () => {
    console.log('[backup-firestore] READ-ONLY Firestore 백업');
    console.log('  목적: 데이터 이전 전 운영 컬렉션 로컬 JSON 백업 (write/restore 없음)\n');

    const adminEmail = (await questionPlain('admin email: ')).trim();
    if (!adminEmail) { console.error('email이 비어 있습니다.'); process.exit(1); }
    const adminPassword = await questionHidden('admin password (숨김 입력): ');
    if (!adminPassword) { console.error('password가 비어 있습니다.'); process.exit(1); }

    console.log('\n[backup] 로그인 중...');
    try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    } catch (err) {
        console.error('[backup] 로그인 실패:', err?.code || err?.message || String(err));
        console.error('[backup] write 없이 종료합니다.');
        process.exit(1);
    }
    console.log('[backup] 로그인 성공');

    const stamp = nowStamp();
    const outDir = path.join(PROJECT_ROOT, 'backups', 'firestore', stamp);
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`[backup] 출력 폴더: backups/firestore/${stamp}/\n`);

    const metaCollections = {};
    const warnings = [];
    let totalDocuments = 0;

    const allTargets = [
        ...REQUIRED_COLLECTIONS.map((n) => ({ name: n, tier: 'required' })),
        ...OPTIONAL_COLLECTIONS.map((n) => ({ name: n, tier: 'optional' })),
    ];

    for (const { name, tier } of allTargets) {
        process.stdout.write(`  - ${name} ... `);
        const result = await backupCollection(name, outDir);
        totalDocuments += result.count;

        if (result.status === 'error') {
            metaCollections[name] = { status: 'error', count: 0, file: null, tier, error: result.error };
            warnings.push(`[${tier}] ${name}: 백업 실패 (${result.error})`);
            console.log(`실패 (${result.error})`);
        } else if (result.status === 'empty') {
            const status = tier === 'optional' ? 'missing_or_empty' : 'empty';
            metaCollections[name] = { status, count: 0, file: result.file, tier };
            if (tier === 'required') warnings.push(`[required] ${name}: 문서 0건 (확인 필요)`);
            console.log(`${status} (0건)`);
        } else {
            metaCollections[name] = { status: 'ok', count: result.count, file: result.file, tier };
            console.log(`ok (${result.count}건)`);
        }
    }

    const metadata = {
        backup_type: 'firestore_readonly_backup',
        created_at: new Date().toISOString(),
        project_id: 'alba-3b27d',
        script: 'scripts/backup-firestore-readonly.mjs',
        write_operations: 0,
        backup_folder: `backups/firestore/${stamp}`,
        collections: metaCollections,
        total_documents: totalDocuments,
        warnings,
        notes: [
            'This backup is read-only.',
            'This script does not restore or modify Firestore data.',
            'admin email / password are NOT stored in any backup file.',
            'Optional collections may be reported as missing_or_empty without error.',
        ],
    };
    fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    // ─── 요약 출력 ───
    console.log('\n──────── 백업 요약 ────────');
    console.log(`출력 폴더 : backups/firestore/${stamp}/`);
    console.log(`총 문서수 : ${totalDocuments}`);
    const okCnt = Object.values(metaCollections).filter((c) => c.status === 'ok').length;
    const emptyCnt = Object.values(metaCollections).filter((c) => c.status === 'empty' || c.status === 'missing_or_empty').length;
    const errCnt = Object.values(metaCollections).filter((c) => c.status === 'error').length;
    console.log(`ok : ${okCnt} / empty(or missing) : ${emptyCnt} / error : ${errCnt}`);
    if (warnings.length > 0) {
        console.log('\n[경고] 아래 항목은 사람이 직접 확인하세요:');
        for (const w of warnings) console.log(`  - ${w}`);
    }
    if (errCnt > 0) {
        console.log('\n[주의] 일부 컬렉션 백업 실패. 전체 성공 아님. metadata.json warnings 확인 필요.');
    }
    console.log('───────────────────────────');

    try { await signOut(auth); } catch { /* noop */ }

    // 실패 컬렉션이 있으면 비정상 종료코드로 (성공처럼 보이지 않게)
    process.exit(errCnt > 0 ? 2 : 0);
})().catch((err) => {
    console.error('[backup] 예기치 못한 오류:', err?.message || String(err));
    process.exit(1);
});
