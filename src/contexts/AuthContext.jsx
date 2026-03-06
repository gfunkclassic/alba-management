import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    createUserWithEmailAndPassword,
    getAuth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, orderBy, runTransaction, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, functions, httpsCallable } from '../firebase';

// Cloud Functions 참조
const fnApproveTeamLeave = httpsCallable(functions, 'approveTeamLeave');
const fnApproveFinalLeave = httpsCallable(functions, 'approveFinalLeave');
const fnAdminApproveUser = httpsCallable(functions, 'adminApproveUser');

const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null); // Firestore 프로필
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState([]); // 동적 팀 목록

    // 팀 목록 실시간 동기화
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'teams'), async (docSnap) => {
            if (docSnap.exists()) {
                setTeams(docSnap.data().list || []);
            } else {
                const initial = ['카페', '생산기획', 'QC', 'ER', 'LM'];
                setTeams(initial);
                try {
                    await setDoc(doc(db, 'settings', 'teams'), { list: initial });
                } catch (e) {
                    // 권한 없는 사용자의 경우 무시
                }
            }
        });
        return unsub;
    }, []);

    // Firebase Auth 상태 감지
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const profileSnap = await getDoc(doc(db, 'users', user.uid));
                    if (profileSnap.exists()) {
                        setUserProfile({ uid: user.uid, ...profileSnap.data() });
                    } else {
                        // Auth는 됐지만 Firestore 문서 없음
                        setUserProfile({ uid: user.uid, _noProfile: true });
                    }
                } catch (err) {
                    console.error('Firestore 프로필 로드 실패:', err);
                    setUserProfile({ uid: user.uid, _noProfile: true });
                }
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    // 로그인 (status 체크 포함)
    const login = async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Firestore에서 status 확인
        try {
            const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
            if (userSnap.exists()) {
                const status = userSnap.data().status;
                if (status === 'PENDING') {
                    await signOut(auth);
                    const err = new Error('PENDING: 아직 관리자 승인 대기 중입니다.');
                    err.code = 'auth/pending';
                    throw err;
                }
                if (status === 'REJECTED') {
                    await signOut(auth);
                    const err = new Error('REJECTED: 가입이 거절되었습니다. 관리자에게 문의하세요.');
                    err.code = 'auth/rejected';
                    throw err;
                }
                if (status === 'SUSPENDED') {
                    await signOut(auth);
                    const err = new Error('SUSPENDED: 계정이 정지되었습니다. 관리자에게 문의하세요.');
                    err.code = 'auth/suspended';
                    throw err;
                }
            }
        } catch (e) {
            if (e.code?.startsWith('auth/')) throw e; // 위에서 throw한 상태 오류
            console.warn('status 확인 실패 (하위 호환):', e);
        }
        return cred;
    };

    // 로그아웃
    const logout = async () => {
        await signOut(auth);
        setUserProfile(null);
    };

    // 비밀번호 변경 (재인증 후)
    const changePassword = async (currentPassword, newPassword) => {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        // Firestore에서 is_temp_password = false
        await updateDoc(doc(db, 'users', currentUser.uid), { is_temp_password: false });
        setUserProfile(prev => ({ ...prev, is_temp_password: false }));
    };

    // 자가등록 (PENDING 상태, 역할/팀 없음)
    const selfRegister = async ({ name, email, password, team_id }) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const now = new Date().toISOString();
        await setDoc(doc(db, 'users', uid), {
            uid,
            name,
            email,
            role: null,
            team_id: team_id || null, // 팀 배정 받음
            status: 'PENDING',
            is_temp_password: false,
            created_at: now,
            updated_at: now,
        });
        // 등록 후 바로 로그아웃 (로그인 불가 상태)
        await signOut(auth);
    };

    // ─── FINAL_APPROVER 계정 관리 ────────────────────────────────

    // PENDING 사용자 목록
    const getPendingUsers = async () => {
        const q = query(collection(db, 'users'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
            .sort((a, b) => a.created_at?.localeCompare(b.created_at));
    };

    // 가입 승인
    const approveUser = async (uid, { role, team_id }) => {
        await updateDoc(doc(db, 'users', uid), {
            status: 'ACTIVE', role, team_id,
            updated_at: new Date().toISOString(),
        });
    };

    // 가입 거절
    const rejectUser = async (uid) => {
        await updateDoc(doc(db, 'users', uid), {
            status: 'REJECTED',
            updated_at: new Date().toISOString(),
        });
    };

    // 계정 정지 / 정지 해제
    const suspendUser = async (uid, suspend = true) => {
        await updateDoc(doc(db, 'users', uid), {
            status: suspend ? 'SUSPENDED' : 'ACTIVE',
            updated_at: new Date().toISOString(),
        });
    };

    // 계정 역할/팀 즉시 수정 (ACTIVE 유저 대상)
    const updateUserRoleAndTeam = async (uid, role, team_id) => {
        await updateDoc(doc(db, 'users', uid), {
            role, team_id,
            updated_at: new Date().toISOString()
        });
    };

    // 팀 관리 로직 (추가/삭제)
    const addTeam = async (teamName) => {
        if (!teamName || teams.includes(teamName)) return;
        await updateDoc(doc(db, 'settings', 'teams'), { list: [...teams, teamName] });
    };

    const removeTeam = async (teamName) => {
        await updateDoc(doc(db, 'settings', 'teams'), { list: teams.filter(t => t !== teamName) });
    };

    const updateTeamName = async (oldName, newName) => {
        if (!newName || teams.includes(newName)) throw new Error('유효하지 않거나 이미 존재하는 팀명입니다.');

        const cleanOld = oldName.trim();
        const cleanNew = newName.trim();

        // 1. Update settings/teams list
        const newList = teams.map(t => t.trim() === cleanOld ? cleanNew : t);
        await updateDoc(doc(db, 'settings', 'teams'), { list: newList });

        const batch = writeBatch(db);
        let updatedCount = 0;

        // 2. Update users
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
            const data = d.data();
            if (data.team_id && data.team_id.trim() === cleanOld) {
                batch.update(d.ref, { team_id: cleanNew, updated_at: new Date().toISOString() });
                updatedCount++;
            }
        });

        // 3. Update leave_requests
        const leaveSnap = await getDocs(collection(db, 'leave_requests'));
        leaveSnap.forEach(d => {
            const data = d.data();
            if (data.team_id && data.team_id.trim() === cleanOld) {
                batch.update(d.ref, { team_id: cleanNew, updated_at: new Date().toISOString() });
                updatedCount++;
            }
        });

        // 4. Update delegations
        const delSnap = await getDocs(collection(db, 'delegations'));
        delSnap.forEach(d => {
            const data = d.data();
            if (data.team_id && data.team_id.trim() === cleanOld) {
                batch.update(d.ref, { team_id: cleanNew, updated_at: new Date().toISOString() });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
        }
    };

    // 계정 생성 (FINAL_APPROVER만 호출 가능 — secondary app 트릭으로 세션 유지)
    const createUser = async ({ name, email, role, team_id }) => {
        const adminUser = auth.currentUser;

        // 보조 Firebase 앱 인스턴스로 계정 생성 (주 세션에 영향 없음)
        const secondaryApp = initializeApp(
            {
                apiKey: "AIzaSyAxQ4Zp_OnKBjHPT-JoU1x54yjC_zJUYG0",
                authDomain: "alba-3b27d.firebaseapp.com",
                projectId: "alba-3b27d",
                storageBucket: "alba-3b27d.firebasestorage.app",
                messagingSenderId: "56462459100",
                appId: "1:56462459100:web:a9a0b51732ff86e0fb3419"
            },
            `secondary-${Date.now()}`
        );
        const secondaryAuth = getAuth(secondaryApp);

        let newUid;
        try {
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, '123456');
            newUid = userCred.user.uid;
        } finally {
            await deleteApp(secondaryApp); // 보조 앱 정리
        }

        // Firestore에 프로필 문서 생성
        await setDoc(doc(db, 'users', newUid), {
            uid: newUid,
            name,
            email,
            role,
            team_id: team_id || null,
            is_temp_password: true,
            created_at: new Date().toISOString(),
            created_by: adminUser.uid,
        });

        return newUid;
    };


    // 팀별 사용자 조회 (TEAM_APPROVER용)
    const getUsersByTeam = async (teamId) => {
        const q = query(collection(db, 'users'), where('team_id', '==', teamId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    };

    // 전체 사용자 조회 (FINAL_APPROVER용)
    const getAllUsers = async () => {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => d.data());
    };

    // ─── LEAVE FUNCTIONS ─────────────────────────────────

    // 연차 신청 (ALBA) — 중복 체크 포함
    const submitLeaveRequest = async ({ date, type, reason = '' }) => {
        const uid = auth.currentUser.uid;
        // 중복 체크: 동일 user_id + date + SUBMITTED
        const dupQ = query(
            collection(db, 'leave_requests'),
            where('user_id', '==', uid),
            where('date', '==', date),
            where('status', '==', 'SUBMITTED')
        );
        const dupSnap = await getDocs(dupQ);
        if (!dupSnap.empty) {
            throw new Error('DUPLICATE: 해당 날짜에 이미 신청한 연차가 있습니다.');
        }
        const now = new Date().toISOString();
        const profileSnap = await getDoc(doc(db, 'users', uid));
        const teamId = profileSnap.data()?.team_id || '';
        const docRef = await addDoc(collection(db, 'leave_requests'), {
            user_id: uid,
            team_id: teamId,
            date,
            type,
            reason,
            status: 'SUBMITTED',
            created_at: now,
            updated_at: now,
        });
        return docRef.id;
    };

    // 연차 취소 (ALBA — SUBMITTED → CANCELLED)
    const cancelLeaveRequest = async (reqId) => {
        await updateDoc(doc(db, 'leave_requests', reqId), {
            status: 'CANCELLED',
            updated_at: new Date().toISOString(),
        });
    };

    // 본인 신청 내역 조회 (ALBA)
    const getMyLeaveRequests = async (year = null) => {
        const uid = auth.currentUser.uid;
        let q = query(collection(db, 'leave_requests'), where('user_id', '==', uid));
        const snap = await getDocs(q);
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (year) results = results.filter(r => r.date?.startsWith(String(year)));
        return results.sort((a, b) => b.date?.localeCompare(a.date));
    };

    // 잔여 연차 조회 (ALBA)
    const getMyLeaveBalance = async (year = new Date().getFullYear()) => {
        const uid = auth.currentUser.uid;
        const snap = await getDoc(doc(db, 'leave_balance', `${uid}_${year}`));
        if (snap.exists()) return snap.data();
        return { user_id: uid, year, total_days: 0, used_days: 0 };
    };

    // 잔여 연차 설정 (FINAL_APPROVER)
    const setLeaveBalance = async (userId, year, totalDays, usedDays) => {
        const docId = `${userId}_${year}`;
        await setDoc(doc(db, 'leave_balance', docId), {
            user_id: userId,
            year,
            total_days: totalDays,
            used_days: usedDays,
            updated_at: new Date().toISOString(),
        }, { merge: true });
    };

    // 전체 연차 잔여 조회 (FINAL_APPROVER)
    const getAllLeaveBalances = async (year = new Date().getFullYear()) => {
        const q = query(collection(db, 'leave_balance'), where('year', '==', year));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // ─── PHASE 3: APPROVAL + NOTIFICATION FUNCTIONS ─────────────────

    // 내부 알림 생성 (helper)
    const sendNotification = async (toUserId, type, data) => {
        await addDoc(collection(db, 'notifications'), {
            to_user_id: toUserId,
            type,
            data,
            is_read: false,
            created_at: new Date().toISOString(),
        });
    };

    // 팀 연차 신청 조회 (TEAM_APPROVER) — 신청자 이름 포함
    const getTeamLeaveRequests = async () => {
        const uid = auth.currentUser.uid;
        const profileSnap = await getDoc(doc(db, 'users', uid));
        const teamId = profileSnap.data()?.team_id;
        if (!teamId) return [];
        const q = query(collection(db, 'leave_requests'), where('team_id', '==', teamId));
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 신청자 추가 정보
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try {
                const u = await getDoc(doc(db, 'users', uid));
                if (u.exists()) userMap[uid] = u.data().name;
            } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // 연차 승인 (TEAM_APPROVER) → Cloud Function 호출
    const approveLeaveRequest = async (reqId) => {
        const result = await fnApproveTeamLeave({ reqId, action: 'APPROVE' });
        if (!result.data.success) throw new Error('팀 승인 처리 중 오류가 발생했습니다.');
    };

    // 연차 반려 (TEAM_APPROVER) → Cloud Function 호출
    const rejectLeaveRequest = async (reqId, _requestorUid, _date, _leaveType, note = '') => {
        const result = await fnApproveTeamLeave({ reqId, action: 'REJECT', note });
        if (!result.data.success) throw new Error('팀 반려 처리 중 오류가 발생했습니다.');
    };

    // 나의 알림 목록
    const getMyNotifications = async () => {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, 'notifications'), where('to_user_id', '==', uid));
        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // 알림 읽음 처리
    const markNotificationRead = async (notifId) => {
        await updateDoc(doc(db, 'notifications', notifId), { is_read: true });
    };

    // ─── PHASE 4: FINAL APPROVAL + AUTO DEDUCTION ──────────────

    const DEDUCTION_MAP = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };

    // 전체 TEAM_APPROVED 요청 조회 (FINAL_APPROVER용)
    const getAllTeamApprovedRequests = async () => {
        const q = query(collection(db, 'leave_requests'), where('status', '==', 'TEAM_APPROVED'));
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 신청자 이름 enrichment
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try {
                const u = await getDoc(doc(db, 'users', uid));
                if (u.exists()) userMap[uid] = u.data().name;
            } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // 최종 승인 (FINAL_APPROVER) → Cloud Function 호출
    const finalApproveLeaveRequest = async (reqId) => {
        const result = await fnApproveFinalLeave({ reqId, action: 'APPROVE' });
        if (!result.data.success) throw new Error('최종 승인 처리 중 오류가 발생했습니다.');
    };

    // 최종 반려 (FINAL_APPROVER) → Cloud Function 호출
    const finalRejectLeaveRequest = async (reqId, _requestorUid, _date, _leaveType, note = '') => {
        const result = await fnApproveFinalLeave({ reqId, action: 'REJECT', note });
        if (!result.data.success) throw new Error('최종 반려 처리 중 오류가 발생했습니다.');
    };

    // ─── PHASE 5: DELEGATION + PROXY APPROVAL ──────────────────

    // 위임 생성 (TEAM_APPROVER 전용) — ID = to_user_id
    const createDelegation = async ({ toUserId, startDate, endDate }) => {
        const uid = auth.currentUser.uid;
        // 수임자 팀 확인
        const fromSnap = await getDoc(doc(db, 'users', uid));
        const toSnap = await getDoc(doc(db, 'users', toUserId));
        if (!toSnap.exists()) throw new Error('수임자를 찾을 수 없습니다.');
        const fromTeam = fromSnap.data()?.team_id;
        const toTeam = toSnap.data()?.team_id;
        if (fromTeam !== toTeam) throw new Error(`위임은 같은 팀(고유 팀)\uc5d0만 가능합니다. (반고: ${toTeam})`);
        await setDoc(doc(db, 'delegations', toUserId), {
            from_user_id: uid,
            to_user_id: toUserId,
            team_id: fromTeam,
            start_date: startDate,
            end_date: endDate,
            is_active: true,
            created_at: new Date().toISOString(),
        });
    };

    // 위임 해제
    const revokeDelegation = async (toUserId) => {
        await updateDoc(doc(db, 'delegations', toUserId), {
            is_active: false,
        });
    };

    // 내가 열살한 위임 목록
    const getMyDelegationsGiven = async () => {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, 'delegations'), where('from_user_id', '==', uid));
        const snap = await getDocs(q);
        const delegs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 수임자 이름
        await Promise.all(delegs.map(async d => {
            try {
                const u = await getDoc(doc(db, 'users', d.to_user_id));
                d._toName = u.exists() ? u.data().name : d.to_user_id;
            } catch { d._toName = d.to_user_id; }
        }));
        return delegs.sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // 나에게 온 활성 위임
    const getMyActiveReceivedDelegation = async () => {
        const uid = auth.currentUser.uid;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const snap = await getDoc(doc(db, 'delegations', uid));
            if (!snap.exists()) return null;
            const d = snap.data();
            if (!d.is_active || d.start_date > today || d.end_date < today) return null;
            // 위임자 이름
            const fromSnap = await getDoc(doc(db, 'users', d.from_user_id));
            return { ...d, _fromName: fromSnap.data()?.name };
        } catch { return null; }
    };

    // 수임자 / FINAL_APPROVER 팀 승인 대행 승인 → Cloud Function 호출
    const proxyTeamApprove = async (reqId, _requestorUid, _date, _leaveType, _delegationFromUserId, _isFinalProxy) => {
        const result = await fnApproveTeamLeave({ reqId, action: 'APPROVE' });
        if (!result.data.success) throw new Error('팀 대행 승인 처리 중 오류가 발생했습니다.');
    };

    // 수임자 / FINAL_APPROVER 팀 대행 반려 → Cloud Function 호출
    const proxyTeamReject = async (reqId, _requestorUid, _date, _leaveType, note, _delegationFromUserId, _isFinalProxy) => {
        const result = await fnApproveTeamLeave({ reqId, action: 'REJECT', note });
        if (!result.data.success) throw new Error('팀 대행 반려 처리 중 오류가 발생했습니다.');
    };

    // 전체 SUBMITTED 요청 (FINAL_APPROVER 대행용)
    const getAllSubmittedRequests = async () => {
        const q = query(collection(db, 'leave_requests'), where('status', '==', 'SUBMITTED'));
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try { const u = await getDoc(doc(db, 'users', uid)); if (u.exists()) userMap[uid] = u.data().name; } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // 수임자용 팀 신청 조회 (team_id로 필터)
    const getTeamLeaveRequestsForDelegatee = async (teamId) => {
        const q = query(collection(db, 'leave_requests'), where('team_id', '==', teamId), where('status', '==', 'SUBMITTED'));
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try { const u = await getDoc(doc(db, 'users', uid)); if (u.exists()) userMap[uid] = u.data().name; } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    const value = {
        currentUser, userProfile, loading,
        login, logout, changePassword, createUser,
        getUsersByTeam, getAllUsers,
        // Leave 2단계
        submitLeaveRequest, cancelLeaveRequest,
        getMyLeaveRequests, getMyLeaveBalance,
        setLeaveBalance, getAllLeaveBalances,
        // Phase 3
        getTeamLeaveRequests, approveLeaveRequest, rejectLeaveRequest,
        sendNotification, getMyNotifications, markNotificationRead,
        // Phase 4
        getAllTeamApprovedRequests, finalApproveLeaveRequest, finalRejectLeaveRequest,
        // Phase 5: Delegation + Proxy
        createDelegation, revokeDelegation,
        getMyDelegationsGiven, getMyActiveReceivedDelegation,
        proxyTeamApprove, proxyTeamReject,
        getAllSubmittedRequests, getTeamLeaveRequestsForDelegatee,
        // Phase 1 Enhanced: Self-Registration + Status Management
        selfRegister, getPendingUsers, approveUser, rejectUser, suspendUser,
        // Phase 1.5: Dynamic Teams + Quick Edit
        teams, addTeam, removeTeam, updateTeamName, updateUserRoleAndTeam,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
