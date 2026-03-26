/**
 * create_team_config.js
 * Firestore settings/team_approval_config 초기 데이터 생성 스크립트
 *
 * 실행 전 준비:
 *   1. npm install firebase-admin (functions 외부 루트에서)
 *   2. serviceAccountKey.json 이 프로젝트 루트에 있어야 함
 *
 * 실행:
 *   node create_team_config.js
 *
 * ⚠️ 이 파일은 1회성 스크립트입니다. 실행 후 삭제 또는 .gitignore에 추가하세요.
 *
 * [중요] primaryApproverUids / delegateApproverUids 배열에
 *         실제 Firebase uid를 입력해야 합니다.
 *         Firebase Console → Authentication 또는 Firestore users 컬렉션에서 확인.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'alba-3b27d',
});

const db = admin.firestore();

// ────────────────────────────────────────────────
// 아래 uid 값들을 실제 Firebase uid로 교체하세요.
// Firebase Console → Firestore → users 컬렉션에서
// 각 계정 문서의 uid 필드 또는 문서 ID를 확인하세요.
// ────────────────────────────────────────────────

const TEAM_CONFIG = {
    teams: {
        '카페': {
            skipTeamApproval: true,           // 팀 1차 승인 없이 바로 실장 승인 단계로
            primaryApproverUids: [],          // 팀 승인자 없음
            delegateApproverUids: [],
            seniorApprovalMinCount: 1,        // 실장 중 1명 승인 시 대표 단계 이동
        },
        'LM': {
            skipTeamApproval: false,
            primaryApproverUids: ['LM_노기범_UID_여기에_입력'],
            delegateApproverUids: ['LM_김명철_UID_여기에_입력'],
            seniorApprovalMinCount: 1,
        },
        'ER': {
            skipTeamApproval: false,
            primaryApproverUids: ['ER_정진수_UID_여기에_입력'],
            delegateApproverUids: ['ER_염동일_UID_여기에_입력'],
            seniorApprovalMinCount: 1,
        },
        '생산기획': {
            skipTeamApproval: false,
            primaryApproverUids: ['생산기획_천영균_UID_여기에_입력'],
            delegateApproverUids: ['생산기획_이형주_UID_여기에_입력'],
            seniorApprovalMinCount: 1,
        },
        'QC': {
            skipTeamApproval: false,
            primaryApproverUids: ['QC_장홍선_UID_여기에_입력'],
            delegateApproverUids: ['QC_천영균_UID_여기에_입력'],
            seniorApprovalMinCount: 1,
        },
    },
    updated_at: new Date().toISOString(),
};

async function main() {
    console.log('settings/team_approval_config 문서 생성 중...\n');

    // uid 미입력 경고
    const allUids = Object.values(TEAM_CONFIG.teams).flatMap(t => [
        ...t.primaryApproverUids,
        ...t.delegateApproverUids,
    ]);
    const unsetUids = allUids.filter(uid => uid.includes('_여기에_입력'));
    if (unsetUids.length > 0) {
        console.warn('⚠️  uid가 아직 입력되지 않은 항목이 있습니다:');
        unsetUids.forEach(u => console.warn('   -', u));
        console.warn('\n실제 uid 입력 후 다시 실행하거나, 지금 저장 후 나중에 Firebase Console에서 수정하세요.\n');
    }

    await db.collection('settings').doc('team_approval_config').set(TEAM_CONFIG, { merge: true });

    console.log('✅  settings/team_approval_config 저장 완료:\n');
    console.log(JSON.stringify(TEAM_CONFIG, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error('❌  오류:', err.message);
    process.exit(1);
});
