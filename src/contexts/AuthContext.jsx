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
    deleteUser,
    getAuth,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, collection, query, where, getDocs, getDocsFromServer, addDoc, orderBy, runTransaction, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, functions, httpsCallable } from '../firebase';
import { normalizeProfile } from '../utils/roleUtils';

// Cloud Functions 참조
const fnApproveTeamLeave = httpsCallable(functions, 'approveTeamLeave');
const fnApproveFinalLeave = httpsCallable(functions, 'approveFinalLeave');
const fnAdminApproveUser = httpsCallable(functions, 'adminApproveUser');
const fnApproveCEOLeave = httpsCallable(functions, 'approveCEOLeave');

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
                        setUserProfile(normalizeProfile({ uid: user.uid, ...profileSnap.data() }));
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
    const approveUser = async (uid, { role, roleGroup, position, team_id }) => {
        // role: 하위호환용 (ALBA, TEAM_APPROVER 등)
        // roleGroup: 새 권한 구조 ('employee', 'manager' 등)
        // 둘 중 하나만 있어도 저장 (어댑터가 보완)
        const finalRoleGroup = roleGroup || role; // role이 이미 roleGroup값일 수 있음
        await updateDoc(doc(db, 'users', uid), {
            status: 'ACTIVE',
            role: finalRoleGroup,         // 하위호환
            roleGroup: finalRoleGroup,    // 새 권한
            ...(position ? { position } : {}),
            team_id,
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
    const updateUserRoleAndTeam = async (uid, roleGroup, team_id, position, contact_email) => {
        await updateDoc(doc(db, 'users', uid), {
            role: roleGroup,        // 하위호환
            roleGroup,              // 새 권한
            ...(position !== undefined ? { position } : {}),
            // 표시용 이메일: 비어있으면 필드 제거, 있으면 저장
            ...(contact_email !== undefined ? { contact_email: contact_email || null } : {}),
            team_id,
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
    const createUser = async ({ name, email, role, roleGroup, position, contact_email, team_id }) => {
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

        let userCred;
        try {
            // 1) Firebase Auth 계정 생성 (보조 앱 → 관리자 세션 무영향)
            userCred = await createUserWithEmailAndPassword(secondaryAuth, email, '123456');
            const newUid = userCred.user.uid;

            // 2) Firestore에 프로필 문서 생성
            try {
                await setDoc(doc(db, 'users', newUid), {
                    uid: newUid,
                    name,
                    email,
                    // 표시용 이메일: 로그인 식별자와 다를 수 있음 (선택적)
                    ...(contact_email && contact_email !== email ? { contact_email } : {}),
                    role: roleGroup || role,        // 하위호환
                    roleGroup: roleGroup || role,   // 새 권한
                    ...(position ? { position } : {}),
                    team_id: team_id || null,
                    is_temp_password: true,
                    created_at: new Date().toISOString(),
                    created_by: adminUser.uid,
                });
            } catch (firestoreErr) {
                // Firestore 저장 실패 → Auth 계정 rollback (반쪽 생성 방지)
                console.error('[createUser] Firestore users/{uid} 저장 실패. Auth 계정 rollback 시도:', {
                    uid: newUid,
                    code: firestoreErr?.code,
                    message: firestoreErr?.message,
                });
                try {
                    // 보조 Auth에 방금 생성된 사용자가 로그인 상태이므로 deleteUser 가능
                    await deleteUser(userCred.user);
                    console.warn('[createUser] Auth 계정 rollback 완료 (uid=' + newUid + ')');
                } catch (rollbackErr) {
                    // rollback 실패 — 수동 정리 필요. 메인 admin 세션에는 영향 없음.
                    console.error('[createUser] Auth 계정 rollback 실패. Firebase Console에서 수동 삭제 필요:', {
                        uid: newUid,
                        email,
                        code: rollbackErr?.code,
                        message: rollbackErr?.message,
                    });
                }
                throw firestoreErr;
            }

            return newUid;
        } finally {
            // 보조 앱 정리 (성공/실패/롤백 무관, 메인 auth 세션 무영향)
            try { await deleteApp(secondaryApp); } catch (cleanupErr) {
                console.warn('[createUser] secondary app cleanup 실패(무시):', cleanupErr?.message);
            }
        }
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

    // 연차 신청 (ALBA) — 중복 체크 포함 + 카페 팀 skipTeamApproval 처리
    // dates[]: 복수 날짜 배열 (FULL 연속 신청) / date: 단일 날짜 문자열 (하위호환)
    const submitLeaveRequest = async ({
        dates, date, type, reason = '',
        team_approver_uid = null,
        team_approver_name = '',
        team_approver_email = '',
        approval_line_version = 'V1_TEAM_BASED',
    }) => {
        // dates[] 우선 사용, 없으면 단일 date를 배열로 변환 (하위호환)
        const appliedDates = dates ?? (date ? [date] : []);
        if (appliedDates.length === 0) throw new Error('날짜를 선택해주세요.');

        // HALF 반차: 저장 직전 단일 날짜 재검증
        if ((type === 'HALF_AM' || type === 'HALF_PM') && appliedDates.length !== 1) {
            throw new Error('반차는 단일 날짜만 신청 가능합니다.');
        }

        const uid = auth.currentUser.uid;
        const startDate = appliedDates[0];
        const endDate   = appliedDates[appliedDates.length - 1];

        // day_count: FULL=선택된 평일 수, HALF=0.5 고정
        const DAY_COUNT_MAP = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };
        const dayCount = type === 'FULL'
            ? appliedDates.length
            : (DAY_COUNT_MAP[type] ?? 1.0);

        // 중복 체크: 해당 user의 활성 신청 전체를 조회해 날짜 교차 확인
        // applied_dates 배열 신규 형식 + 구 date 단일 필드 모두 처리
        const ACTIVE_STATUSES = ['SUBMITTED', 'TEAM_APPROVED', 'FINAL_PENDING', 'CEO_PENDING'];
        const activeQ = query(collection(db, 'leave_requests'), where('user_id', '==', uid));
        const activeSnap = await getDocs(activeQ);
        const activeDateSet = new Set();
        activeSnap.docs
            .filter(d => ACTIVE_STATUSES.includes(d.data().status))
            .forEach(d => {
                const data = d.data();
                if (data.applied_dates?.length) {
                    data.applied_dates.forEach(ad => activeDateSet.add(ad));
                } else if (data.date) {
                    activeDateSet.add(data.date);
                }
            });
        const dupDate = appliedDates.find(d => activeDateSet.has(d));
        if (dupDate) {
            throw new Error(`DUPLICATE: ${dupDate}에 이미 신청한 연차가 있습니다.`);
        }

        const now = new Date().toISOString();
        const profileSnap = await getDoc(doc(db, 'users', uid));
        const teamId = profileSnap.data()?.team_id || '';

        // 팀별 설정: skipTeamApproval이 true인 팀(예: 카페)은 바로 TEAM_APPROVED로 저장
        let initialStatus = 'SUBMITTED';
        try {
            const configSnap = await getDoc(doc(db, 'settings', 'team_approval_config'));
            if (configSnap.exists()) {
                const teamConfig = configSnap.data()?.teams?.[teamId];
                if (teamConfig?.skipTeamApproval === true) {
                    initialStatus = 'TEAM_APPROVED';
                }
            }
        } catch (ce) {
            console.warn('team_approval_config 조회 실패 (기본 SUBMITTED 사용):', ce.message);
        }

        const docRef = await addDoc(collection(db, 'leave_requests'), {
            user_id: uid,
            team_id: teamId,
            date: startDate,          // 하위호환: 시작일 저장
            applied_dates: appliedDates,
            start_date: startDate,
            end_date: endDate,
            day_count: dayCount,
            type,
            reason,
            status: initialStatus,
            created_at: now,
            updated_at: now,
            // PR-Approver-1: V2 1차 승인자 선택 정보 (V1은 null/빈문자)
            team_approver_uid: team_approver_uid || null,
            team_approver_name: team_approver_name || '',
            team_approver_email: team_approver_email || '',
            approval_line_version: approval_line_version || 'V1_TEAM_BASED',
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
    // 정렬 정책:
    //  1) 진행 중(SUBMITTED/TEAM_APPROVED/FINAL_PENDING/CEO_PENDING) → 종료(FINAL_APPROVED/REJECTED/CANCELLED) 순
    //  2) 각 그룹 내부: created_at 최신순 → updated_at → date fallback
    //  3) Firestore Timestamp/ISO 문자열/undefined 혼재 안전 처리
    const getMyLeaveRequests = async (year = null) => {
        const uid = auth.currentUser.uid;
        let q = query(collection(db, 'leave_requests'), where('user_id', '==', uid));
        const snap = await getDocsFromServer(q);
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (year) results = results.filter(r => r.date?.startsWith(String(year)));

        const ACTIVE_STATUSES = new Set(['SUBMITTED', 'TEAM_APPROVED', 'FINAL_PENDING', 'CEO_PENDING']);
        // Firestore Timestamp 객체 / ISO 문자열 / undefined 를 모두 비교 가능한 number(ms)로 정규화.
        // 비교 키 부재 시 0 반환 → 최후순위로 밀림.
        const toMs = (v) => {
            if (!v) return 0;
            if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
            if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
            if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
            if (v instanceof Date) return v.getTime();
            return 0;
        };
        const rankWithin = (r) => toMs(r.created_at) || toMs(r.updated_at) || toMs(r.date);
        return results.sort((a, b) => {
            const aActive = ACTIVE_STATUSES.has(a.status) ? 1 : 0;
            const bActive = ACTIVE_STATUSES.has(b.status) ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive; // 진행 중 우선
            const diff = rankWithin(b) - rankWithin(a);
            if (diff !== 0) return diff;
            // 동률 fallback: date 문자열 내림차순 (기존 동작 호환)
            return (b.date || '').localeCompare(a.date || '');
        });
    };

    // 잔여 연차 조회 (ALBA)
    const getMyLeaveBalance = async (year = new Date().getFullYear()) => {
        const uid = auth.currentUser.uid;
        const snap = await getDocFromServer(doc(db, 'leave_balance', `${uid}_${year}`));
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
        const teamId = profileSnap.data()?.team_id || '';

        // PR-Approver-1: 이중 조회 — (1) team_approver_uid == 나 (V2 신규), (2) team_id == 내 팀 (V1 레거시)
        // Firestore OR query 미사용 — 두 번 조회 후 클라이언트에서 dedup + 필터링
        const reqMap = new Map();
        try {
            const q1 = query(collection(db, 'leave_requests'), where('team_approver_uid', '==', uid));
            const s1 = await getDocsFromServer(q1);
            s1.docs.forEach(d => reqMap.set(d.id, { id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('getTeamLeaveRequests query1(uid) 실패:', e?.message);
        }
        if (teamId) {
            try {
                const q2 = query(collection(db, 'leave_requests'), where('team_id', '==', teamId));
                const s2 = await getDocsFromServer(q2);
                s2.docs.forEach(d => {
                    if (!reqMap.has(d.id)) reqMap.set(d.id, { id: d.id, ...d.data() });
                });
            } catch (e) {
                console.warn('getTeamLeaveRequests query2(team_id) 실패:', e?.message);
            }
        }

        // V2(team_approver_uid 존재): 나에게 지정된 것만 / V1(필드 없음 또는 null): 같은 team_id만
        const reqs = [...reqMap.values()].filter(r => {
            const isV2ForMe = r.team_approver_uid && r.team_approver_uid === uid;
            const isLegacy = !r.team_approver_uid && teamId && r.team_id === teamId;
            return isV2ForMe || isLegacy;
        });

        // 신청자 추가 정보
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid2 => {
            try {
                const u = await getDoc(doc(db, 'users', uid2));
                if (u.exists()) userMap[uid2] = u.data().name;
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
        const q = query(collection(db, 'leave_requests'), where('status', 'in', ['TEAM_APPROVED', 'FINAL_PENDING', 'FINAL_APPROVED', 'REJECTED']));
        const snap = await getDocsFromServer(q);
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

    // 최종 승인 (FINAL_APPROVER 또는 위임 수임자) → Cloud Function 호출
    // delegatedForUid: 대결 시 슬롯 주인(실장) uid, 직접 처리 시 null
    const finalApproveLeaveRequest = async (reqId, delegatedForUid = null) => {
        const payload = { reqId, action: 'APPROVE' };
        if (delegatedForUid) payload.delegatedForUid = delegatedForUid;
        const result = await fnApproveFinalLeave(payload);
        if (!result.data.success) throw new Error('승인 처리 중 오류가 발생했습니다.');
    };

    // 최종 반려 (FINAL_APPROVER 또는 위임 수임자) → Cloud Function 호출
    const finalRejectLeaveRequest = async (reqId, _requestorUid, _date, _leaveType, note = '', delegatedForUid = null) => {
        const payload = { reqId, action: 'REJECT', note };
        if (delegatedForUid) payload.delegatedForUid = delegatedForUid;
        const result = await fnApproveFinalLeave(payload);
        if (!result.data.success) throw new Error('반려 처리 중 오류가 발생했습니다.');
    };

    // ─── PHASE 4.5: CEO APPROVAL (최종 확정) ──────────────

    // 대표 대기(CEO_PENDING) 상태 조회
    const getCEOApprovalRequests = async () => {
        const q = query(collection(db, 'leave_requests'), where('status', 'in', ['CEO_PENDING', 'FINAL_APPROVED', 'REJECTED']));
        const snap = await getDocsFromServer(q);
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
        const result = reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
        return result;
    };

    const ceoApproveLeaveRequest = async (reqId, delegatedForUid = null) => {
        const payload = { reqId, action: 'APPROVE' };
        if (delegatedForUid) payload.delegatedForUid = delegatedForUid;
        const result = await fnApproveCEOLeave(payload);
        if (!result.data.success) throw new Error('대표 최종 승인 처리 중 오류가 발생했습니다.');
    };

    const ceoRejectLeaveRequest = async (reqId, _requestorUid, _date, _leaveType, note = '', delegatedForUid = null) => {
        const payload = { reqId, action: 'REJECT', note };
        if (delegatedForUid) payload.delegatedForUid = delegatedForUid;
        const result = await fnApproveCEOLeave(payload);
        if (!result.data.success) throw new Error('대표 반려 처리 중 오류가 발생했습니다.');
    };

    // 나에게 온 활성 대표 위임 (수임자 기준)
    const getMyActiveCEODelegation = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const snap = await getDocFromServer(doc(db, 'ceo_delegations', uid));
            if (!snap.exists()) return null;
            const d = snap.data();
            if (!d.is_active || d.start_date > today || d.end_date < today) return null;
            const fromSnap = await getDoc(doc(db, 'users', d.from_user_id));
            return { ...d, _fromName: fromSnap.data()?.name || d.from_user_id };
        } catch (e) { console.error('[CEO#ERR]', e?.code, e?.message, e); return null; }
    };

    // 내가 내보낸 활성 대표 위임 (대표 기준)
    const getMyActiveGivenCEODelegation = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const q = query(collection(db, 'ceo_delegations'), where('from_user_id', '==', uid));
            const snap = await getDocsFromServer(q);
            const active = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(d => d.is_active && d.start_date <= today && d.end_date >= today);
            if (!active) return null;
            const toSnap = await getDoc(doc(db, 'users', active.to_user_id));
            return { ...active, _toName: toSnap.data()?.name || active.to_user_id };
        } catch (e) { console.error('[activeGivenCEODelegation]', e); return null; }
    };

    // 수임자용 대표 위임 요청 조회 (CEO_PENDING 중 미처리 건)
    const getCEODelegateeRequests = async () => {
        const q = query(collection(db, 'leave_requests'), where('status', '==', 'CEO_PENDING'));
        const snap = await getDocsFromServer(q);
        const reqs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(r => !r.ceo_decision);
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try { const u = await getDoc(doc(db, 'users', uid)); if (u.exists()) userMap[uid] = u.data().name; } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
    };

    // ─── PHASE 5: DELEGATION + PROXY APPROVAL ──────────────────

    // 위임 생성 (TEAM_APPROVER 전용) — ID = to_user_id
    const createDelegation = async ({ toUserId, startDate, endDate }) => {
        const uid = auth.currentUser.uid;
        const fromSnap = await getDoc(doc(db, 'users', uid));
        const toSnap = await getDoc(doc(db, 'users', toUserId));
        if (!toSnap.exists()) throw new Error('수임자를 찾을 수 없습니다.');
        // 수임자는 팀관리자(manager)만 가능
        if (toSnap.data()?.roleGroup !== 'manager') throw new Error('위임 수임자는 팀관리자만 가능합니다.');
        const fromTeam = fromSnap.data()?.team_id;
        await setDoc(doc(db, 'delegations', toUserId), {
            from_user_id: uid,
            to_user_id: toUserId,
            team_id: fromTeam,   // 위임자(from)의 팀 기준 — 대행 결재 범위
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

    // 내가 현재 활성 상태로 준 위임 (진행 중인 건 1개)
    const getMyActiveGivenDelegation = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const q = query(collection(db, 'delegations'), where('from_user_id', '==', uid));
            const snap = await getDocsFromServer(q);
            console.log('[activeGivenDelegation] uid:', uid, 'today:', today, 'docs:', snap.docs.length);
            snap.docs.forEach(d => console.log('[activeGivenDelegation] doc:', d.id, JSON.stringify(d.data())));
            const active = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(d => d.is_active && d.start_date <= today && d.end_date >= today);
            console.log('[activeGivenDelegation] active result:', active ?? null);
            if (!active) return null;
            const toSnap = await getDoc(doc(db, 'users', active.to_user_id));
            return { ...active, _toName: toSnap.data()?.name || active.to_user_id };
        } catch (e) { console.error('[activeGivenDelegation] error:', e); return null; }
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

    // 내가 내보낸 활성 실장 대결 위임 (원 결재자 기준)
    const getMyActiveGivenSeniorDelegation = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const q = query(collection(db, 'senior_delegations'), where('from_user_id', '==', uid));
            const snap = await getDocsFromServer(q);
            const active = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(d => d.is_active && d.start_date <= today && d.end_date >= today);
            if (!active) return null;
            const toSnap = await getDoc(doc(db, 'users', active.to_user_id));
            return { ...active, _toName: toSnap.data()?.name || active.to_user_id };
        } catch (e) { console.error('[activeGivenSeniorDelegation]', e); return null; }
    };

    // 나에게 온 활성 실장 대결 위임
    const getMyActiveSeniorDelegation = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;
        const today = new Date().toISOString().slice(0, 10);
        try {
            const snap = await getDocFromServer(doc(db, 'senior_delegations', uid));
            if (!snap.exists()) return null;
            const d = snap.data();
            if (!d.is_active || d.start_date > today || d.end_date < today) return null;
            const fromSnap = await getDoc(doc(db, 'users', d.from_user_id));
            return { ...d, _fromName: fromSnap.data()?.name || d.from_user_id };
        } catch (e) { console.error('[senior delegation read]', e?.code, e?.message); return null; }
    };

    // 실장 대결 수임자용 — TEAM_APPROVED/FINAL_PENDING 중 fromUserUid 슬롯 미처리 건 조회
    const getSeniorDelegateeRequests = async (fromUserUid) => {
        const q = query(collection(db, 'leave_requests'), where('status', 'in', ['TEAM_APPROVED', 'FINAL_PENDING']));
        const snap = await getDocsFromServer(q);
        const reqs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(r => !r.final_approvals?.[fromUserUid]);
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const userMap = {};
        await Promise.all(userIds.map(async uid => {
            try { const u = await getDoc(doc(db, 'users', uid)); if (u.exists()) userMap[uid] = u.data().name; } catch { }
        }));
        return reqs
            .map(r => ({ ...r, _userName: userMap[r.user_id] || r.user_id }))
            .sort((a, b) => b.created_at?.localeCompare(a.created_at));
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
        // Phase 4.5
        getCEOApprovalRequests, ceoApproveLeaveRequest, ceoRejectLeaveRequest,
        getMyActiveCEODelegation, getMyActiveGivenCEODelegation, getCEODelegateeRequests,
        // Phase 5: Delegation + Proxy
        createDelegation, revokeDelegation,
        getMyActiveGivenDelegation, getMyDelegationsGiven, getMyActiveReceivedDelegation,
        getMyActiveSeniorDelegation, getMyActiveGivenSeniorDelegation, getSeniorDelegateeRequests,
        proxyTeamApprove, proxyTeamReject,
        getAllSubmittedRequests, getTeamLeaveRequestsForDelegatee,
        // Phase 1 Enhanced: Self-Registration + Status Management
        selfRegister, getPendingUsers, approveUser, rejectUser, suspendUser,
        // Phase 1.5: Dynamic Teams + Quick Edit
        teams, addTeam, removeTeam, updateTeamName, updateUserRoleAndTeam,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
