const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// ─────────────────────────────────────────────────────────────
// 공통 헬퍼
// ─────────────────────────────────────────────────────────────

async function getUserProfile(uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) throw new HttpsError('not-found', '사용자 프로필을 찾을 수 없습니다.');
    return { uid, ...snap.data() };
}

async function sendNotification(toUserId, type, data) {
    await db.collection('notifications').add({
        to_user_id: toUserId,
        type,
        data,
        is_read: false,
        created_at: new Date().toISOString(),
    });
}

function nowISO() {
    return new Date().toISOString();
}

const DEDUCTION_MAP = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };

// ─────────────────────────────────────────────────────────────
// 1. approveTeamLeave — 팀 승인 / 반려 (팀장, 수임자, 최종관리자 대행)
// ─────────────────────────────────────────────────────────────
exports.approveTeamLeave = onCall({ region: 'asia-northeast3' }, async (req) => {
    try {
        if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

        const { reqId, action, note } = req.data;
        if (!reqId || !action) throw new HttpsError('invalid-argument', 'reqId, action 필드가 필요합니다.');
        if (!['APPROVE', 'REJECT'].includes(action)) throw new HttpsError('invalid-argument', 'action은 APPROVE 또는 REJECT이어야 합니다.');

        const actorUid = req.auth.uid;
        const actor = await getUserProfile(actorUid);

        const reqRef = db.collection('leave_requests').doc(reqId);
        const reqSnap = await reqRef.get();
        if (!reqSnap.exists) throw new HttpsError('not-found', '연차 신청을 찾을 수 없습니다.');
        const leaveReq = reqSnap.data();

        if (leaveReq.status !== 'SUBMITTED') {
            throw new HttpsError('failed-precondition', `현재 상태(${leaveReq.status})에서는 팀 승인 처리를 할 수 없습니다.`);
        }

        let isFinalProxy = false;
        let delegationFromUserId = null;

        // 하위호환: role(구버전) 또는 roleGroup(신버전) 모두 허용
        const isTeamApprover = actor.role === 'TEAM_APPROVER' || actor.roleGroup === 'manager';
        const isFinalApproverActor = actor.role === 'FINAL_APPROVER' || actor.roleGroup === 'approver_senior' || actor.roleGroup === 'approver_final';

        if (isTeamApprover) {
            if (actor.team_id !== leaveReq.team_id) {
                throw new HttpsError('permission-denied', '본인 팀의 신청만 처리할 수 있습니다.');
            }
        } else if (isFinalApproverActor) {
            isFinalProxy = true;
        } else {
            const delSnap = await db.collection('delegations').doc(actorUid).get();
            if (!delSnap.exists) throw new HttpsError('permission-denied', '승인 권한이 없습니다.');
            const del = delSnap.data();
            const today = new Date().toISOString().slice(0, 10);
            if (!del.is_active || del.team_id !== leaveReq.team_id || today < del.start_date || today > del.end_date) {
                throw new HttpsError('permission-denied', '유효한 위임 권한이 없습니다.');
            }
            delegationFromUserId = del.from_user_id;
        }

        const now = nowISO();
        const newStatus = action === 'APPROVE' ? 'TEAM_APPROVED' : 'REJECTED';
        const noteText = isFinalProxy
            ? (note ? `[FINAL_APPROVER 대행] ${note}` : 'FINAL_APPROVER 대행')
            : (note || '');

        await db.runTransaction(async (tx) => {
            const freshSnap = await tx.get(reqRef);
            if (freshSnap.data().status !== 'SUBMITTED') {
                throw new HttpsError('failed-precondition', '이미 처리된 신청입니다.');
            }
            const teamUpdate = { status: newStatus, updated_at: now };
            if (action === 'REJECT') {
                teamUpdate.rejected_by_uid = actorUid;
                teamUpdate.rejected_by_name = actor.name;
                teamUpdate.rejected_reason = noteText || '';
                teamUpdate.rejected_stage = 'TEAM';
                teamUpdate.rejected_at = now;
            }
            tx.update(reqRef, teamUpdate);
            tx.create(db.collection('approvals').doc(), {
                leave_request_id: reqId,
                stage: 'TEAM',
                action,
                actor_user_id: actorUid,
                acted_at: now,
                note: noteText,
                delegation_from_user_id: delegationFromUserId,
            });
        });

        try {
            const notifType = action === 'APPROVE' ? 'LEAVE_TEAM_APPROVED' : 'LEAVE_REJECTED';
            await sendNotification(leaveReq.user_id, notifType, {
                leave_request_id: reqId,
                date: leaveReq.date,
                type: leaveReq.type,
                actor_name: actor.name,
                note: noteText,
            });
            if (action === 'APPROVE') {
                const requesterSnap = await db.collection('users').doc(leaveReq.user_id).get();
                // 하위호환: role(구버전) + roleGroup(신버전) 양쪽에서 최종승인자 조회
                const [finalByRole, finalByRoleGroup] = await Promise.all([
                    db.collection('users').where('role', '==', 'FINAL_APPROVER').get(),
                    db.collection('users').where('roleGroup', 'in', ['approver_senior', 'approver_final']).get(),
                ]);
                const finalApproverIds = new Set();
                finalByRole.docs.forEach(d => finalApproverIds.add(d.id));
                finalByRoleGroup.docs.forEach(d => finalApproverIds.add(d.id));
                await Promise.all([...finalApproverIds].map(fid =>
                    sendNotification(fid, 'LEAVE_TEAM_APPROVED', {
                        leave_request_id: reqId,
                        user_name: requesterSnap.data()?.name,
                        date: leaveReq.date,
                        type: leaveReq.type,
                        actor_name: actor.name,
                    })
                ));
            }
        } catch (ne) {
            console.warn('알림 발송 실패 (무시됨):', ne.message);
        }

        return { success: true, newStatus };
    } catch (error) {
        console.error('approveTeamLeave ERROR:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || '내부 서버 오류가 발생했습니다.');
    }
});

// ─────────────────────────────────────────────────────────────
// 2. approveFinalLeave — 최종 승인 / 반려 + 잔여 차감 (트랜잭션)
// ─────────────────────────────────────────────────────────────
exports.approveFinalLeave = onCall({ region: 'asia-northeast3' }, async (req) => {
    try {
        if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

        const { reqId, action, note } = req.data;
        if (!reqId || !action) throw new HttpsError('invalid-argument', 'reqId, action 필드가 필요합니다.');
        if (!['APPROVE', 'REJECT'].includes(action)) throw new HttpsError('invalid-argument', 'action은 APPROVE 또는 REJECT이어야 합니다.');

        const actorUid = req.auth.uid;
        const actor = await getUserProfile(actorUid);
        // 하위호환: role(구버전) 또는 roleGroup(신버전) 모두 허용
        const isActorFinalApprover = actor.role === 'FINAL_APPROVER' || actor.roleGroup === 'approver_senior' || actor.roleGroup === 'approver_final';
        if (!isActorFinalApprover) throw new HttpsError('permission-denied', '최종 관리자(실장/대표)만 처리할 수 있습니다.');

        const reqRef = db.collection('leave_requests').doc(reqId);
        const now = nowISO();

        // 1. 활성화된 모든 최종 관리자(실장) 목록. role(구버전) + roleGroup(신버전) 병합
        const [snapByRole, snapByRoleGroup, reqPreSnap] = await Promise.all([
            db.collection('users').where('role', '==', 'FINAL_APPROVER').where('status', '==', 'ACTIVE').get(),
            db.collection('users').where('roleGroup', 'in', ['approver_senior', 'approver_final']).where('status', '==', 'ACTIVE').get(),
            reqRef.get(), // 팀 ID 사전 조회
        ]);
        if (!reqPreSnap.exists) throw new HttpsError('not-found', '연차 신청을 찾을 수 없습니다.');
        const leaveReqTeamId = reqPreSnap.data()?.team_id || '';

        const approverMap = new Map();
        snapByRole.docs.forEach(d => approverMap.set(d.id, { uid: d.id, name: d.data().name }));
        snapByRoleGroup.docs.forEach(d => approverMap.set(d.id, { uid: d.id, name: d.data().name }));
        // 대표(approver_final)는 실장 병렬 결재 대상에서 제외 (CEO 단계는 별도 처리)
        const requiredApprovers = [...approverMap.values()].filter(a => {
            const snap = snapByRoleGroup.docs.find(d => d.id === a.uid);
            if (snap && snap.data().roleGroup === 'approver_final') return false;
            return true;
        });
        if (requiredApprovers.length === 0) {
            throw new HttpsError('failed-precondition', '설정된 최종 결재자(실장)가 없습니다.');
        }

        // 팀별 설정에서 seniorApprovalMinCount 조회 (기본값: 1명 승인 시 통과)
        let seniorApprovalMinCount = 1;
        try {
            const configSnap = await db.collection('settings').doc('team_approval_config').get();
            if (configSnap.exists) {
                const teamConfig = configSnap.data()?.teams?.[leaveReqTeamId];
                if (teamConfig?.seniorApprovalMinCount != null) {
                    seniorApprovalMinCount = teamConfig.seniorApprovalMinCount;
                }
            }
        } catch (ce) {
            console.warn('team_approval_config 조회 실패 (기본값 1 사용):', ce.message);
        }

        let leaveReq;
        let isFullyResolved = false;
        let finalStatus = '';

        await db.runTransaction(async (tx) => {
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists) throw new HttpsError('not-found', '연차 신청을 찾을 수 없습니다.');
            leaveReq = reqSnap.data();

            if (!['TEAM_APPROVED', 'FINAL_PENDING'].includes(leaveReq.status)) {
                throw new HttpsError('failed-precondition', `현재 상태(${leaveReq.status})에서는 결재를 진행할 수 없습니다.`);
            }

            const currentApprovals = leaveReq.final_approvals || {};

            // 이미 내가 결재했는지 확인
            if (currentApprovals[actorUid] && leaveReq.status === 'FINAL_PENDING') {
                throw new HttpsError('already-exists', '이미 결재하셨습니다.');
            }

            let newFinalApprovals = { ...currentApprovals };

            if (action === 'REJECT') {
                // 한 명이라도 반려하면 즉시 전체 신청을 REJECTED 처리
                newFinalApprovals[actorUid] = { status: 'REJECTED', acted_at: now, note: note || '', name: actor.name };
                finalStatus = 'REJECTED';
                isFullyResolved = true;

                tx.update(reqRef, {
                    status: finalStatus,
                    updated_at: now,
                    final_approvals: newFinalApprovals,
                    rejected_by_uid: actorUid,
                    rejected_by_name: actor.name,
                    rejected_reason: note || '',
                    rejected_stage: 'FINAL',
                    rejected_at: now,
                });
            } else {
                // 승인 처리
                newFinalApprovals[actorUid] = { status: 'APPROVED', acted_at: now, note: note || '', name: actor.name };

                // seniorApprovalMinCount명 이상 승인 시 CEO_PENDING으로 전환 (기본값: 1명)
                const approvedCount = requiredApprovers.filter(fa => newFinalApprovals[fa.uid]?.status === 'APPROVED').length;
                const minReached = approvedCount >= seniorApprovalMinCount;

                if (minReached) {
                    finalStatus = 'CEO_PENDING';
                    isFullyResolved = true;

                    tx.update(reqRef, {
                        status: finalStatus,
                        updated_at: now,
                        final_approvals: newFinalApprovals
                    });
                } else {
                    finalStatus = 'FINAL_PENDING';
                    isFullyResolved = false;

                    tx.update(reqRef, {
                        status: finalStatus,
                        updated_at: now,
                        final_approvals: newFinalApprovals
                    });
                }
            }

            // 공통 로깅
            tx.create(db.collection('approvals').doc(), {
                leave_request_id: reqId,
                stage: 'FINAL',
                action,
                actor_user_id: actorUid,
                acted_at: now,
                note: note || '',
                delegation_from_user_id: null,
            });
        });

        // 3. 알림 발송 (전체 완료된 경우만 신청자에게 발송)
        if (isFullyResolved) {
            try {
                const notifType = finalStatus === 'CEO_PENDING' ? 'LEAVE_CEO_PENDING' : 'LEAVE_REJECTED';
                await sendNotification(leaveReq.user_id, notifType, {
                    leave_request_id: reqId,
                    date: leaveReq.date,
                    type: leaveReq.type,
                    actor_name: actor.name,
                    note: note || (finalStatus === 'CEO_PENDING' ? '실장 결재 완료 (대표 대기)' : '반려됨'),
                });
            } catch (ne) {
                console.warn('알림 발송 실패 (무시됨):', ne.message);
            }
        }

        return { success: true, newStatus: finalStatus, isFullyResolved };
    } catch (error) {
        console.error('approveFinalLeave ERROR:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || '내부 서버 오류가 발생했습니다.');
    }
});

// ─────────────────────────────────────────────────────────────
// 2.5. approveCEOLeave — 대표님 최종 승인 / 반려 + 잔여 차감 (트랜잭션)
// ─────────────────────────────────────────────────────────────
exports.approveCEOLeave = onCall({ region: 'asia-northeast3' }, async (req) => {
    try {
        if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

        const { reqId, action, note } = req.data;
        if (!reqId || !action) throw new HttpsError('invalid-argument', 'reqId, action 필드가 필요합니다.');
        if (!['APPROVE', 'REJECT'].includes(action)) throw new HttpsError('invalid-argument', 'action은 APPROVE 또는 REJECT이어야 합니다.');

        const actorUid = req.auth.uid;
        const actor = await getUserProfile(actorUid);
        // 하위호환: role(구버전 SUPER_ADMIN/VIEWER) 또는 roleGroup(신버전 approver_final) 모두 허용
        const isCEO = actor.role === 'SUPER_ADMIN' || actor.role === 'VIEWER' || actor.roleGroup === 'approver_final';
        if (!isCEO) throw new HttpsError('permission-denied', '대표(최고관리자) 권한이 필요합니다.');

        const reqRef = db.collection('leave_requests').doc(reqId);
        const now = nowISO();

        let leaveReq;
        let finalStatus = '';

        await db.runTransaction(async (tx) => {
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists) throw new HttpsError('not-found', '연차 신청을 찾을 수 없습니다.');
            leaveReq = reqSnap.data();

            if (leaveReq.status !== 'CEO_PENDING') {
                throw new HttpsError('failed-precondition', `현재 상태(${leaveReq.status})에서는 대표 결재를 진행할 수 없습니다.`);
            }

            if (action === 'REJECT') {
                finalStatus = 'REJECTED';
                tx.update(reqRef, {
                    status: finalStatus,
                    updated_at: now,
                    ceo_decision: { status: 'REJECTED', acted_at: now, note: note || '', name: actor.name },
                    rejected_by_uid: actorUid,
                    rejected_by_name: actor.name,
                    rejected_reason: note || '',
                    rejected_stage: 'CEO',
                    rejected_at: now,
                });
            } else {
                finalStatus = 'FINAL_APPROVED';

                // 연차 차감 로직 수행
                const deduction = DEDUCTION_MAP[leaveReq.type] ?? 1.0;
                const year = leaveReq.date?.slice(0, 4);
                if (!year) throw new Error('연차 날짜 정보가 없습니다.');

                const balRef = db.collection('leave_balance').doc(`${leaveReq.user_id}_${year}`);
                const balSnap = await tx.get(balRef);

                const total = balSnap.exists ? (balSnap.data().total_days ?? 0) : 0;
                const used = balSnap.exists ? (balSnap.data().used_days ?? 0) : 0;
                const remaining = total - used;
                if (remaining < deduction) {
                    throw new HttpsError('failed-precondition', `잔여 연차 부족: 잔여 ${remaining}일 / 차감 필요 ${deduction}일`);
                }

                tx.update(reqRef, {
                    status: finalStatus,
                    updated_at: now,
                    ceo_decision: { status: 'APPROVED', acted_at: now, note: note || '', name: actor.name }
                });

                if (balSnap.exists) {
                    tx.update(balRef, { used_days: used + deduction, updated_at: now });
                } else {
                    tx.set(balRef, {
                        user_id: leaveReq.user_id,
                        year: Number(year),
                        total_days: 0,
                        used_days: deduction,
                        updated_at: now,
                    });
                }
            }

            // 공통 로깅
            tx.create(db.collection('approvals').doc(), {
                leave_request_id: reqId,
                stage: 'CEO',
                action,
                actor_user_id: actorUid,
                acted_at: now,
                note: note || '',
                delegation_from_user_id: null,
            });
        });

        // 알림 발송 (신청자에게 발송)
        try {
            const notifType = finalStatus === 'FINAL_APPROVED' ? 'LEAVE_FINAL_APPROVED' : 'LEAVE_REJECTED';
            await sendNotification(leaveReq.user_id, notifType, {
                leave_request_id: reqId,
                date: leaveReq.date,
                type: leaveReq.type,
                actor_name: actor.name,
                note: note || (finalStatus === 'FINAL_APPROVED' ? '대표님 최종 승인 완료' : '대표 반려됨'),
            });
        } catch (ne) {
            console.warn('알림 발송 실패 (무시됨):', ne.message);
        }

        return { success: true, newStatus: finalStatus };
    } catch (error) {
        console.error('approveCEOLeave ERROR:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || '내부 서버 오류가 발생했습니다.');
    }
});

// ─────────────────────────────────────────────────────────────
// 3. adminApproveUser — 사용자 승인 및 역할 지정
// ─────────────────────────────────────────────────────────────
exports.adminApproveUser = onCall({ region: 'asia-northeast3' }, async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

    const actorUid = req.auth.uid;
    const actor = await getUserProfile(actorUid);
    if (actor.role !== 'FINAL_APPROVER') throw new HttpsError('permission-denied', '최종 관리자만 처리할 수 있습니다.');

    const { uid, role, team_id, action } = req.data;
    if (!uid || !action) throw new HttpsError('invalid-argument', 'uid, action 필드가 필요합니다.');

    const validActions = ['APPROVE', 'REJECT', 'SUSPEND'];
    if (!validActions.includes(action)) throw new HttpsError('invalid-argument', `action은 ${validActions.join(', ')} 중 하나여야 합니다.`);

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError('not-found', '사용자를 찾을 수 없습니다.');

    const now = nowISO();
    const updates = { updated_at: now };

    if (action === 'APPROVE') {
        if (!role) throw new HttpsError('invalid-argument', 'APPROVE 시 role 필드가 필요합니다.');
        updates.status = 'ACTIVE';
        updates.role = role;
        if (team_id) updates.team_id = team_id;
    } else if (action === 'REJECT') {
        updates.status = 'REJECTED';
    } else if (action === 'SUSPEND') {
        updates.status = 'SUSPENDED';
    }

    await userRef.update(updates);

    // 승인 알림
    if (action === 'APPROVE') {
        try {
            await sendNotification(uid, 'USER_APPROVED', { role, team_id });
        } catch (ne) {
            console.warn('승인 알림 실패 (무시됨):', ne.message);
        }
    }

    return { success: true, action, uid };
});

// ─────────────────────────────────────────────────────────────
// 임시 개발용 패스워드 일괄 변경 함수 (테스트 완료 후 삭제 요망)
// ─────────────────────────────────────────────────────────────
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');

exports.devBulkSetPasswords = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
    try {
        const auth = getAuth();
        const results = [];

        // 1. Set fmj@fairplay142.com as FINAL_APPROVER
        const fmjSnap = await db.collection('users').where('email', '==', 'fmj@fairplay142.com').get();
        if (!fmjSnap.empty) {
            const doc = fmjSnap.docs[0];
            await doc.ref.update({ role: 'FINAL_APPROVER' });
            results.push('Updated fmj@fairplay142.com to FINAL_APPROVER');
        }

        // 2. Set or create admin_test2@fairplay142.com as FINAL_APPROVER
        const admin2Snap = await db.collection('users').where('email', '==', 'admin_test2@fairplay142.com').get();
        if (!admin2Snap.empty) {
            const doc = admin2Snap.docs[0];
            await doc.ref.update({ role: 'FINAL_APPROVER' });
            results.push('Updated admin_test2@fairplay142.com to FINAL_APPROVER');
        } else {
            try {
                const userRecord = await auth.createUser({
                    email: 'admin_test2@fairplay142.com',
                    password: 'password123',
                    displayName: '테스트실장'
                });
                await db.collection('users').doc(userRecord.uid).set({
                    user_id: userRecord.uid,
                    email: 'admin_test2@fairplay142.com',
                    name: '테스트실장',
                    role: 'FINAL_APPROVER',
                    status: 'ACTIVE',
                    created_at: new Date().toISOString()
                });
                results.push('Created admin_test2@fairplay142.com as FINAL_APPROVER');
            } catch (authErr) {
                results.push('Error creating admin_test2: ' + authErr.message);
            }
        }

        // 3. Set or create ceo@fairplay142.com as SUPER_ADMIN
        const ceoSnap = await db.collection('users').where('email', '==', 'ceo@fairplay142.com').get();
        if (!ceoSnap.empty) {
            const doc = ceoSnap.docs[0];
            await doc.ref.update({ role: 'SUPER_ADMIN' });
            results.push('Updated ceo@fairplay142.com to SUPER_ADMIN');
        } else {
            try {
                const userRecord = await auth.createUser({
                    email: 'ceo@fairplay142.com',
                    password: 'password123',
                    displayName: '대표(테스트)'
                });
                await db.collection('users').doc(userRecord.uid).set({
                    user_id: userRecord.uid,
                    email: 'ceo@fairplay142.com',
                    name: '대표(테스트)',
                    role: 'SUPER_ADMIN',
                    status: 'ACTIVE',
                    created_at: new Date().toISOString()
                });
                results.push('Created ceo@fairplay142.com as SUPER_ADMIN');
            } catch (authErr) {
                results.push('Error creating ceo: ' + authErr.message);
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
