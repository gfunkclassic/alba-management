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

        if (actor.role === 'TEAM_APPROVER') {
            if (actor.team_id !== leaveReq.team_id) {
                throw new HttpsError('permission-denied', '본인 팀의 신청만 처리할 수 있습니다.');
            }
        } else if (actor.role === 'FINAL_APPROVER') {
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
            tx.update(reqRef, { status: newStatus, updated_at: now });
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
                const finalApprovers = await db.collection('users').where('role', '==', 'FINAL_APPROVER').get();
                await Promise.all(finalApprovers.docs.map(fa =>
                    sendNotification(fa.id, 'LEAVE_TEAM_APPROVED', {
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
        if (actor.role !== 'FINAL_APPROVER') throw new HttpsError('permission-denied', '최종 관리자만 처리할 수 있습니다.');

        const reqRef = db.collection('leave_requests').doc(reqId);
        const now = nowISO();

        let leaveReq;
        await db.runTransaction(async (tx) => {
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists) throw new HttpsError('not-found', '연차 신청을 찾을 수 없습니다.');
            leaveReq = reqSnap.data();

            if (leaveReq.status !== 'TEAM_APPROVED') {
                throw new HttpsError('failed-precondition', `현재 상태(${leaveReq.status})에서는 최종 승인을 할 수 없습니다. 팀 승인 후 최종 승인이 가능합니다.`);
            }

            const deduction = action === 'APPROVE' ? (DEDUCTION_MAP[leaveReq.type] ?? 1.0) : 0;
            const year = leaveReq.date?.slice(0, 4);
            let balRef, balSnap;

            // 모든 READ 작업을 먼저 수행
            if (action === 'APPROVE') {
                if (!year) throw new Error('연차 날짜 정보가 없습니다.');
                balRef = db.collection('leave_balance').doc(`${leaveReq.user_id}_${year}`);
                balSnap = await tx.get(balRef);

                const total = balSnap.exists ? (balSnap.data().total_days ?? 0) : 0;
                const used = balSnap.exists ? (balSnap.data().used_days ?? 0) : 0;
                const remaining = total - used;
                if (remaining < deduction) {
                    throw new HttpsError('failed-precondition', `잔여 연차 부족: 잔여 ${remaining}일 / 차감 필요 ${deduction}일`);
                }
            }

            // 모든 WRITE 작업을 그 이후에 수행
            const newStatus = action === 'APPROVE' ? 'FINAL_APPROVED' : 'REJECTED';
            tx.update(reqRef, { status: newStatus, updated_at: now });

            if (action === 'APPROVE') {
                const used = balSnap.exists ? (balSnap.data().used_days ?? 0) : 0;
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

        try {
            const notifType = action === 'APPROVE' ? 'LEAVE_FINAL_APPROVED' : 'LEAVE_REJECTED';
            await sendNotification(leaveReq.user_id, notifType, {
                leave_request_id: reqId,
                date: leaveReq.date,
                type: leaveReq.type,
                actor_name: actor.name,
                note: note || '',
            });
        } catch (ne) {
            console.warn('알림 발송 실패 (무시됨):', ne.message);
        }

        const newStatus = action === 'APPROVE' ? 'FINAL_APPROVED' : 'REJECTED';
        return { success: true, newStatus };
    } catch (error) {
        console.error('approveFinalLeave ERROR:', error);
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
