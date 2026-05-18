// scripts/backup-firestore-admin-json.mjs
//
// READ-ONLY Admin SDK Firestore JSON 백업 (가독 검증용).
// Cloud Firestore 관리형 Export(정본, LevelDB)와 별개로,
// 사람이 컬렉션 목록 / 문서 수 / 데이터 구조를 확인하기 위한 보조 백업.
//
// 안전 규약:
//   - read-only 전용. 컬렉션 list + 문서 get 만 사용.
//   - 데이터 변경 API 일절 미사용 / 미import.
//   - Cloud Export / import / restore 호출 없음.
//   - 인증: GOOGLE_APPLICATION_CREDENTIALS 환경변수의 서비스 계정 키 경로 사용
//     (키 경로/내용 하드코딩·출력 금지).
//   - 산출물은 backups/admin-json/<timestamp>/ 에 저장 (gitignore 보호 대상).
//
// 실행 (사용자 승인 후):
//   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\sa-key.json"
//   node scripts/backup-firestore-admin-json.mjs --count-only
//   node scripts/backup-firestore-admin-json.mjs
//
// 옵션:
//   --count-only : 문서 데이터 JSON 저장 없이 컬렉션별 문서 수 / metadata 만 기록
//   --dry-run    : 어떤 컬렉션을 어떤 경로에 저장할지 계획만 출력 (Firestore 조회 없음)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const COUNT_ONLY = args.has('--count-only');
const DRY_RUN = args.has('--dry-run');

// metadata 에 별도 노출할 관심 컬렉션
const FOCUS = ['leave_requests', 'approvals', 'notifications'];

function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ─── Firestore 특수 타입 → JSON 안전 변환 ──────────────────────────
function safeSerialize(value, seen) {
    if (value === undefined || value === null) return null;
    const t = typeof value;
    if (t === 'number' || t === 'string' || t === 'boolean') return value;
    if (t === 'bigint') return value.toString();
    if (t === 'function') return null;

    if (value instanceof Date) {
        return { __type: 'date', iso: isNaN(value.getTime()) ? null : value.toISOString() };
    }
    // Firestore Timestamp (Admin SDK)
    if (value && typeof value.toDate === 'function'
        && typeof value._seconds === 'number') {
        let iso = null;
        try { iso = value.toDate().toISOString(); } catch { iso = null; }
        return { __type: 'timestamp', seconds: value._seconds, nanoseconds: value._nanoseconds ?? 0, iso };
    }
    if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number'
        && typeof value.toDate === 'function') {
        let iso = null;
        try { iso = value.toDate().toISOString(); } catch { iso = null; }
        return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds, iso };
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
    if (Array.isArray(value)) {
        return value.map((v) => safeSerialize(v, seen));
    }
    if (t === 'object') {
        if (seen.has(value)) return { __type: 'circular' };
        seen.add(value);
        const out = {};
        for (const k of Object.keys(value)) out[k] = safeSerialize(value[k], seen);
        return out;
    }
    return null;
}

(async () => {
    const startedAt = new Date().toISOString();
    console.log('[admin-json-backup] READ-ONLY Firestore JSON 백업');
    console.log(`  mode: ${DRY_RUN ? 'dry-run' : COUNT_ONLY ? 'count-only' : 'full'}`);

    const stamp = nowStamp();
    const outDir = path.join(PROJECT_ROOT, 'backups', 'admin-json', stamp);

    if (DRY_RUN) {
        console.log(`  [dry-run] 저장 예정 경로: backups/admin-json/${stamp}/`);
        console.log('  [dry-run] Firestore 조회 없음. 종료.');
        process.exit(0);
    }

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error('[admin-json-backup] GOOGLE_APPLICATION_CREDENTIALS 환경변수가 없습니다.');
        console.error('  서비스 계정 키 경로를 환경변수로 지정 후 다시 실행하세요. (키 경로 하드코딩 금지)');
        process.exit(1);
    }

    try {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } catch (err) {
        console.error('[admin-json-backup] 초기화 실패:', err?.message || String(err));
        process.exit(1);
    }
    const db = admin.firestore();
    const projectId = (admin.app().options?.projectId)
        || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'unknown';

    fs.mkdirSync(outDir, { recursive: true });
    console.log(`  출력 폴더: backups/admin-json/${stamp}/\n`);

    const perCollection = {};
    const errors = [];
    let totalDocuments = 0;
    let collectionNames = [];

    try {
        const cols = await db.listCollections();
        collectionNames = cols.map((c) => c.id).sort();
    } catch (err) {
        console.error('[admin-json-backup] listCollections 실패:', err?.code || err?.message || String(err));
        process.exit(2);
    }

    for (const name of collectionNames) {
        process.stdout.write(`  - ${name} ... `);
        try {
            const snap = await db.collection(name).get();
            const count = snap.size;
            totalDocuments += count;
            perCollection[name] = { status: 'ok', count };

            if (!COUNT_ONLY) {
                const docs = snap.docs
                    .map((d) => ({ id: d.id, data: safeSerialize(d.data(), new WeakSet()) }))
                    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                fs.writeFileSync(
                    path.join(outDir, `${name}.json`),
                    JSON.stringify({ collection: name, count, exported_at: new Date().toISOString(), documents: docs }, null, 2),
                    'utf8'
                );
            }
            console.log(`ok (${count}건)`);
        } catch (err) {
            const e = err?.code || err?.message || String(err);
            perCollection[name] = { status: 'error', count: 0, error: e };
            errors.push(`${name}: ${e}`);
            console.log(`실패 (${e})`);
        }
    }

    const focusCount = (n) => (perCollection[n]?.status === 'ok' ? perCollection[n].count : null);

    const metadata = {
        backup_type: 'firestore_admin_json_readonly',
        backup_started_at: startedAt,
        backup_completed_at: new Date().toISOString(),
        project_id: projectId,
        mode: COUNT_ONLY ? 'count-only' : 'full',
        output_dir: `backups/admin-json/${stamp}`,
        total_collections: collectionNames.length,
        total_documents: totalDocuments,
        collections: collectionNames,
        per_collection_document_count: Object.fromEntries(
            Object.entries(perCollection).map(([k, v]) => [k, v.count])
        ),
        leave_requests_count: focusCount('leave_requests'),
        approvals_count: focusCount('approvals'),
        notifications_count: focusCount('notifications'),
        errors,
        notes: [
            'READ-ONLY backup. No Firestore data was modified.',
            'leave_requests/approvals 0건은 운영 정상 여부 사용자 확인 필요 (데이터 생성/복원 금지).',
            'Service account credentials are NOT stored in any output file.',
        ],
    };
    fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    console.log('\n──────── 백업 요약 ────────');
    console.log(`프로젝트  : ${projectId}`);
    console.log(`컬렉션 수 : ${collectionNames.length}`);
    console.log(`총 문서수 : ${totalDocuments}`);
    for (const fn of FOCUS) console.log(`${fn} : ${focusCount(fn)}`);
    if (errors.length) {
        console.log('\n[경고] 실패 컬렉션:');
        for (const e of errors) console.log(`  - ${e}`);
    }
    console.log('───────────────────────────');

    process.exit(errors.length > 0 ? 2 : 0);
})().catch((err) => {
    console.error('[admin-json-backup] 예기치 못한 오류:', err?.message || String(err));
    process.exit(1);
});
