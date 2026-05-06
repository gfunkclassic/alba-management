import React, { useState, useEffect, useCallback } from 'react';
import { User, Calendar, Clock, Sun, List, LogOut, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, onSnapshot, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import LeaveBalanceCard from '../leave/LeaveBalanceCard';
import LeaveRequestForm from '../leave/LeaveRequestForm';
import LeaveHistoryList from '../leave/LeaveHistoryList';
import NotificationBell from '../notifications/NotificationBell';
import DelegateApprovalInbox from '../leave/DelegateApprovalInbox';
import { getLegalAnnualLeave, getFirstYearLeave } from '../../utils/leaveUtils';
import { getDaysBetween } from '../../utils/dateUtils';

export default function AlbaView() {
    const { userProfile, logout, getMyLeaveBalance, getMyLeaveRequests, getMyActiveReceivedDelegation } = useAuth();
    const [profile, setProfile] = useState(userProfile);
    const [tab, setTab] = useState('INFO');
    const [balance, setBalance] = useState(null);
    const [pendingDeduction, setPendingDeduction] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeDelegation, setActiveDelegation] = useState(null);
    const [estimatedLeave, setEstimatedLeave] = useState(null);

    // 실시간 프로필
    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = onSnapshot(doc(db, 'users', userProfile.uid), (snap) => {
            if (snap.exists()) setProfile({ uid: snap.id, ...snap.data() });
        });
        return unsub;
    }, [userProfile?.uid]);

    // 활성 수임 위임 조회
    useEffect(() => {
        getMyActiveReceivedDelegation().then(setActiveDelegation).catch(() => setActiveDelegation(null));
    }, []);

    // 입사일 기준 예상 연차 (표시용 fallback) — 신청 가능 일수 계산에는 영향 없음
    // 1순위: userProfile.employee_id 직접 조회 (PR #92 신규 구조)
    // 2순위: 본인 이메일 매칭(기존 fallback, employee_id 없는 계정 호환)
    useEffect(() => {
        const email = (userProfile?.email || '').trim().toLowerCase();
        const employeeId = userProfile?.employee_id ? String(userProfile.employee_id).trim() : '';
        if (!email && !employeeId) { setEstimatedLeave(null); return; }
        let cancelled = false;
        (async () => {
            try {
                let emp = null;
                // 1) employee_id 직접 조회
                if (employeeId) {
                    const docSnap = await getDoc(doc(db, 'employees', employeeId));
                    if (cancelled) return;
                    if (docSnap.exists()) emp = docSnap.data();
                }
                // 2) fallback: 이메일 매칭
                if (!emp && email) {
                    const q = query(collection(db, 'employees'), where('email', '==', email), limit(1));
                    const snap = await getDocs(q);
                    if (cancelled) return;
                    if (!snap.empty) emp = snap.docs[0].data();
                }
                if (!emp) { setEstimatedLeave(null); return; }
                const startDate = emp?.startDate;
                if (!startDate) { setEstimatedLeave(null); return; }
                const today = new Date();
                const start = new Date(startDate);
                if (isNaN(start.getTime())) { setEstimatedLeave(null); return; }
                const yearsWorked = getDaysBetween(start, today) / 365;
                let totalDays = 0;
                let basis = '';
                if (yearsWorked < 1) {
                    // 결근/조정 미반영 단순 추정 — absences = {}
                    totalDays = getFirstYearLeave(startDate, today, {});
                    basis = '1년 미만 월차 (입사일 기준 단순 예상, 결근/조정 미반영)';
                } else {
                    totalDays = Math.floor(getLegalAnnualLeave(yearsWorked));
                    basis = '법정 연차 (입사일 기준 단순 예상)';
                }
                setEstimatedLeave({
                    totalDays,
                    yearsWorked: Math.floor(yearsWorked * 10) / 10,
                    startDate,
                    basis,
                    isEstimated: true,
                });
            } catch (e) {
                // 매칭 실패는 표시 영향 없음 — fallback은 단순 미표시
                console.warn('[AlbaView] employees 매칭 실패(예상 연차 미표시):', e?.message);
                if (!cancelled) setEstimatedLeave(null);
            }
        })();
        return () => { cancelled = true; };
    }, [userProfile?.email, userProfile?.employee_id]);

    // 잔여 연차 로드 + 진행 중 신청 pending 차감 계산
    const DEDUCTION_MAP = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };
    const PENDING_STATUSES = ['SUBMITTED', 'TEAM_APPROVED', 'FINAL_PENDING', 'CEO_PENDING'];
    const loadBalance = useCallback(async () => {
        setBalanceLoading(true);
        try {
            const year = new Date().getFullYear();
            const [bal, reqs] = await Promise.all([
                getMyLeaveBalance(year),
                getMyLeaveRequests(year),
            ]);
            setBalance(bal);
            const pending = reqs
                .filter(r => PENDING_STATUSES.includes(r.status))
                .reduce((sum, r) => {
                    // day_count 있으면 우선 사용, 없으면 type 기준 fallback (구 데이터 호환)
                    if (r.day_count !== undefined) return sum + r.day_count;
                    return sum + (DEDUCTION_MAP[r.type] ?? 1.0);
                }, 0);
            setPendingDeduction(pending);
        } catch (e) { console.error(e); }
        finally { setBalanceLoading(false); }
    }, [getMyLeaveBalance, getMyLeaveRequests]);

    useEffect(() => { loadBalance(); }, [loadBalance, refreshKey]);

    const teamColor = { '카페': 'bg-[#d8973c]', '생산기획': 'bg-[#5d6c4a]', 'QC': 'bg-[#4a6070]', 'ER': 'bg-[#a65d57]', 'LM': 'bg-[#7a7565]' };

    const TABS = [
        { key: 'INFO', label: '내 정보', icon: <User size={15} /> },
        { key: 'REQUEST', label: '연차 신청', icon: <Calendar size={15} /> },
        { key: 'HISTORY', label: '신청 내역', icon: <List size={15} /> },
        // 활성 위임이 있으면 탭 추가
        ...(activeDelegation ? [{ key: 'DELEGATE', label: '위임 승인함', icon: <UserCheck size={15} />, badge: true }] : []),
    ];

    return (
        <div className="min-h-screen bg-[#e8e4d4]">
            <header className="bg-[#3d472f] border-b-2 border-[#2d3721] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#5d6c4a] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] font-black text-sm">A</div>
                    <span className="text-[#f5f3e8] font-bold text-sm">아르바이트 관리</span>
                    {activeDelegation && (
                        <span className="text-[10px] bg-[#d8973c] text-white font-bold px-2 py-0.5">위임 승인 중</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell userId={profile?.uid} onNavigate={(destination) => setTab(destination === 'APPROVALS' ? 'DELEGATE' : destination)} />
                    <span className="text-[#b8c4a0] text-xs">{profile?.name}</span>
                    <button onClick={logout} className="flex items-center gap-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-xs"><LogOut size={14} /> 로그아웃</button>
                </div>
            </header>

            {/* 탭 네비게이션 */}
            <div className="bg-[#f5f3e8] border-b-2 border-[#c5c0b0] flex">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-colors relative ${tab === t.key ? 'border-[#5d6c4a] text-[#5d6c4a] bg-[#f5f3e8]' : 'border-transparent text-[#7a7565] hover:text-[#5a5545]'}`}>
                        {t.icon} {t.label}
                        {t.badge && <span className="absolute top-1 right-1 w-2 h-2 bg-[#d8973c] rounded-full" />}
                    </button>
                ))}
            </div>

            <main className="max-w-2xl mx-auto p-5 space-y-4">
                {/* 내 정보 */}
                {tab === 'INFO' && (
                    <>
                        <div className="bg-[#f5f3e8] border-2 border-[#3d472f] overflow-hidden">
                            <div className="bg-[#5d6c4a] p-5 flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#3d472f] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] text-xl font-black">
                                    {profile?.name?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-[#f5f3e8]">{profile?.name}</h2>
                                    <p className="text-[#d4dcc0] text-xs">{profile?.email}</p>
                                </div>
                                <span className={`ml-auto text-white text-xs font-bold px-2 py-1 ${teamColor[profile?.team_id] || 'bg-[#7a7565]'}`}>{profile?.team_id}</span>
                            </div>
                            <div className="p-5 space-y-2.5">
                                {[
                                    { label: '역할', value: '아르바이트', icon: <User size={14} /> },
                                    { label: '소속 팀', value: profile?.team_id, icon: <Calendar size={14} /> },
                                    { label: '등록일', value: profile?.created_at?.slice(0, 10), icon: <Clock size={14} /> },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center gap-3 py-2 border-b border-[#e8e4d4]">
                                        <span className="text-[#5d6c4a]">{row.icon}</span>
                                        <span className="text-xs font-bold text-[#7a7565] w-20">{row.label}</span>
                                        <span className="text-sm font-bold text-[#3d472f]">{row.value}</span>
                                    </div>
                                ))}
                                {activeDelegation && (
                                    <div className="mt-2 p-3 bg-[#fdf6e3] border border-[#d8973c] text-xs">
                                        <p className="font-bold text-[#a06820]">🔑 현재 승인 위임 중</p>
                                        <p className="text-[#7a5a1a] mt-0.5">{activeDelegation._fromName} 관리자 위임 · {activeDelegation.start_date} ~ {activeDelegation.end_date}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <LeaveBalanceCard balance={balance} pendingDeduction={pendingDeduction} loading={balanceLoading} estimatedLeave={estimatedLeave} />
                    </>
                )}

                {/* 연차 신청 */}
                {tab === 'REQUEST' && (
                    <>
                        <LeaveBalanceCard balance={balance} pendingDeduction={pendingDeduction} loading={balanceLoading} estimatedLeave={estimatedLeave} />
                        <LeaveRequestForm onSubmitted={(submittedType, count = 1) => {
                            const DEDUCTION_MAP = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };
                            setPendingDeduction(p => p + (DEDUCTION_MAP[submittedType] ?? 1.0) * count);
                            setRefreshKey(k => k + 1);
                            loadBalance();
                        }} userProfile={profile} balance={balance} pendingDeduction={pendingDeduction} />
                    </>
                )}

                {/* 신청 내역 */}
                {tab === 'HISTORY' && <LeaveHistoryList refreshKey={refreshKey} />}

                {/* 위임 승인함 */}
                {tab === 'DELEGATE' && activeDelegation && (
                    <DelegateApprovalInbox delegation={activeDelegation} />
                )}

            </main>
        </div>
    );
}
