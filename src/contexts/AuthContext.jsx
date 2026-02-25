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
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

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

    // 로그인
    const login = async (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
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
    const sendNotification = async (toUserId, type, payload) => {
        await addDoc(collection(db, 'notifications'), {
            to_user_id: toUserId,
            type,
            payload,
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

    // 연차 승인 (TEAM_APPROVER)
    const approveLeaveRequest = async (reqId, requestorUid, date, leaveType) => {
        const now = new Date().toISOString();
        const actorUid = auth.currentUser.uid;
        // status 변경
        await updateDoc(doc(db, 'leave_requests', reqId), {
            status: 'TEAM_APPROVED',
            updated_at: now,
        });
        // approvals 로그
        await addDoc(collection(db, 'approvals'), {
            leave_request_id: reqId,
            stage: 'TEAM',
            action: 'APPROVE',
            actor_user_id: actorUid,
            acted_at: now,
            note: '',
            delegation_from_user_id: null,
        });
        // 신청자에게 알림
        const actorSnap = await getDoc(doc(db, 'users', actorUid));
        await sendNotification(requestorUid, 'LEAVE_TEAM_APPROVED', {
            leave_request_id: reqId,
            date,
            type: leaveType,
            actor_name: actorSnap.data()?.name,
        });
    };

    // 연차 반려 (TEAM_APPROVER)
    const rejectLeaveRequest = async (reqId, requestorUid, date, leaveType, note = '') => {
        const now = new Date().toISOString();
        const actorUid = auth.currentUser.uid;
        await updateDoc(doc(db, 'leave_requests', reqId), {
            status: 'REJECTED',
            updated_at: now,
        });
        await addDoc(collection(db, 'approvals'), {
            leave_request_id: reqId,
            stage: 'TEAM',
            action: 'REJECT',
            actor_user_id: actorUid,
            acted_at: now,
            note,
            delegation_from_user_id: null,
        });
        const actorSnap = await getDoc(doc(db, 'users', actorUid));
        await sendNotification(requestorUid, 'LEAVE_REJECTED', {
            leave_request_id: reqId,
            date,
            type: leaveType,
            actor_name: actorSnap.data()?.name,
            note,
        });
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

    const value = {
        currentUser, userProfile, loading,
        login, logout, changePassword, createUser,
        getUsersByTeam, getAllUsers,
        // Leave 2단계
        submitLeaveRequest, cancelLeaveRequest,
        getMyLeaveRequests, getMyLeaveBalance,
        setLeaveBalance, getAllLeaveBalances,
        // Phase 3: Approval + Notification
        getTeamLeaveRequests, approveLeaveRequest, rejectLeaveRequest,
        sendNotification, getMyNotifications, markNotificationRead,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
