import React, { useMemo } from 'react';
import { Users, UserMinus, Calendar, Edit, Briefcase, AlertTriangle } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';

// 시각 클래스 토큰 (LeaveView 내부 한정 — 새 파일/유틸 분리 안 함)
const CARD_BASE = 'bg-[#faf8f0] border border-[#d4cfbf]';
const SECTION_TITLE = 'text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2 pb-1 border-b border-[#d4cfbf]';

// 숫자 표시 helper — 정수면 N일, 소수점이면 1자리
const fmtDays = (n) => {
    const v = Number(n);
    if (!isFinite(v)) return '0일';
    return Number.isInteger(v) ? `${v}일` : `${v.toFixed(1)}일`;
};

const isAlba = (u) =>
    (u.employmentType || u.position) === '아르바이트';

// baseline 우선 표시값 산출 — baseline이 있고 baseline_type === 'cumulative_from_start_date'이면 baseline 값 사용
// 없거나 형식이 맞지 않으면 기존 calculateLeave 결과를 그대로 fallback으로 사용
const getDisplayLeave = (user, leaveBalancesByEmployeeId, calculateLeave) => {
    const fallback = calculateLeave(user);
    const balance = leaveBalancesByEmployeeId?.[String(user.id)];
    if (!balance) return { mode: 'fallback', leave: fallback, balance: null };
    if (balance.baseline_type !== 'cumulative_from_start_date') {
        return { mode: 'fallback', leave: fallback, balance };
    }
    const totalEarned = Number(balance.total_days ?? 0);
    const usedLeave = Number(balance.used_days ?? 0);
    const remaining = totalEarned - usedLeave;
    return {
        mode: 'baseline',
        leave: {
            yearsWorked: fallback.yearsWorked,
            monthsWorked: fallback.monthsWorked,
            firstYearLeave: fallback.firstYearLeave,
            firstYearCarryover: fallback.firstYearCarryover,
            annualLeave: fallback.annualLeave,
            carryover: fallback.carryover,
            usedLeave,
            adjustment: 0,         // baseline 모드: 중복 보정 방지 — 조정값 미반영 (조정은 우측 패널/별도 정책)
            totalEarned,
            remaining,
            absenceCount: fallback.absenceCount,
        },
        balance,
    };
};

export default function LeaveView({
    users, viewMode, setViewMode, filteredData,
    selectedUser, handleSelectUser, calculateLeave,
    leaveBalancesByEmployeeId,
    openModal, setAdjustUser
}) {
    // ─── 상단 카드용 집계 (LeaveView 내부에서만 안전하게 계산) ──
    const activeAlba = useMemo(() => users.filter(u => !u.resignDate && isAlba(u)), [users]);
    const resigned = useMemo(() => users.filter(u => u.resignDate), [users]);

    // 팀별 재직 아르바이트 인원 — team(또는 team_id/department) 우선순위로 키 결정
    const teamCounts = useMemo(() => {
        const m = new Map();
        for (const u of activeAlba) {
            const key = u.team || u.team_id || u.department || '미지정';
            m.set(key, (m.get(key) || 0) + 1);
        }
        // 표시 순서: 인원 많은 팀 우선 + 동일 시 팀명 사전순
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    }, [activeAlba]);

    const handleThisMonthLeaveClick = () => {
        // 캘린더 팝업은 다음 PR에서 연결 — 이번 PR은 placeholder 안내만
        window.alert('이번 달 연차 캘린더는 다음 단계에서 연결 예정입니다.');
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            <div className={`flex-1 ${CARD_BASE} overflow-hidden`}>
                {/* ── 상단 카드: 재직 아르바이트 / 팀별 인원 / 이번 달 연차 / 퇴사 인원 ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[#d4cfbf] bg-[#faf8f0]">
                    <StatCard
                        title="재직 아르바이트"
                        value={`${activeAlba.length}명`}
                        icon={<Briefcase size={20} className="text-[#5d6c4a]" />}
                        onClick={() => setViewMode('ACTIVE')}
                        active={viewMode === 'ACTIVE'}
                    />

                    {/* 팀별 인원 — 단일 카드 안에 chip 형태 compact 표시 */}
                    <div className={`p-3 ${CARD_BASE}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={16} className="text-[#5d6c4a]" />
                            <span className="text-[11px] font-bold text-[#7a7565] uppercase tracking-wide">팀별 현황</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {teamCounts.length === 0 ? (
                                <span className="text-[11px] text-[#9a9585]">데이터 없음</span>
                            ) : (
                                teamCounts.map(([team, count]) => (
                                    <span key={team} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-[#f5f3e8] text-[#5d6c4a] border border-[#d4cfbf]">
                                        {team} <span className="text-[#3d472f]">{count}</span>
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <StatCard
                        title="이번 달 연차"
                        value="-"
                        icon={<Calendar size={20} className="text-[#a78049]" />}
                        onClick={handleThisMonthLeaveClick}
                    />

                    <StatCard
                        title="퇴사 인원"
                        value={`${resigned.length}명`}
                        icon={<UserMinus size={20} className="text-[#7a7565]" />}
                        onClick={() => setViewMode('RESIGNED')}
                        active={viewMode === 'RESIGNED'}
                    />
                </div>

                {/* ── 인원 목록 ── */}
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                            <tr>
                                <th className="p-3 pl-4 text-left">직원 정보</th>
                                <th className="p-3 text-center">소속</th>
                                <th className="p-3 text-center">근속</th>
                                <th className="p-3 text-center">총 발생연차</th>
                                <th className="p-3 text-center">사용 연차</th>
                                <th className="p-3 text-center">잔여 연차</th>
                                <th className="p-3 pr-4 text-right">연차 조정</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-[#ebe8db] [&_td]:align-middle">
                            {filteredData.map(user => {
                                const { leave } = getDisplayLeave(user, leaveBalancesByEmployeeId, calculateLeave);
                                const isLow = leave.remaining <= 3;
                                const teamLabel = user.team || user.team_id || user.department || '-';
                                return (
                                    <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f5f3e8] transition-colors ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 flex items-center justify-center font-bold text-xs ${user.resignDate ? 'bg-[#c5c0b0] text-[#f5f3e8]' : 'bg-[#5d6c4a] text-[#f5f3e8]'}`}>
                                                    {user.name[0]}
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${user.resignDate ? 'text-[#9a9585]' : 'text-[#3d472f]'}`}>
                                                        {user.name}
                                                    </p>
                                                    <p className="text-[10px] text-[#7a7565]">{user.startDate} 입사</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-[#5a5545]">
                                            <span className="text-xs font-bold bg-[#f5f3e8] border border-[#d4cfbf] px-2 py-0.5">{teamLabel}</span>
                                        </td>
                                        <td className="p-3 text-center text-[#5a5545]"><span className="font-mono bg-[#f5f3e8] border border-[#d4cfbf] px-1">{leave.yearsWorked}년</span></td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{fmtDays(leave.totalEarned)}</td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{fmtDays(leave.usedLeave)}</td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-bold border ${isLow ? 'bg-[#f5ebe7] text-[#8d5a4d] border-[#cba79c]' : 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]'}`}>
                                                {fmtDays(leave.remaining)}
                                            </span>
                                        </td>
                                        <td className="p-3 pr-4 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setAdjustUser(user); openModal('adjust'); }}
                                                className="px-3 py-1.5 text-xs bg-[#faf8f0] text-[#5d6c4a] hover:bg-[#f5f3e8] font-bold inline-flex items-center gap-1 border border-[#d4cfbf]"
                                            >
                                                <Edit size={12} /> 연차 조정
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── 우측 상세 패널 ── */}
            <div className={`w-full lg:w-80 ${CARD_BASE} flex flex-col`}>
                {selectedUser ? (
                    <div className="flex flex-col h-full">
                        <div className="p-4 bg-[#5d6c4a] border-b border-[#3d472f]">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight">{selectedUser.name}</h2>
                            </div>
                            <p className="text-[#d4dcc0] text-sm font-bold">{selectedUser.team || selectedUser.team_id || selectedUser.department || '-'} | {selectedUser.startDate}</p>
                            {selectedUser.resignDate && (<p className="text-xs text-[#f5f3e8] mt-1 bg-[#8d5a4d] inline-block px-2 py-0.5 border border-[#7a4d40]">퇴사: {selectedUser.resignDate}</p>)}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {(() => {
                                const { mode, leave, balance } = getDisplayLeave(selectedUser, leaveBalancesByEmployeeId, calculateLeave);
                                const isBaseline = mode === 'baseline';
                                return (
                                    <>
                                        <div>
                                            <h3 className={SECTION_TITLE}>근무 정보</h3>
                                            <InfoRow label="근속기간" value={`${leave.yearsWorked}년 (${leave.monthsWorked}개월)`} />
                                        </div>
                                        {isBaseline ? (
                                            <>
                                                <div className="bg-[#fdf6e3] border border-[#d8c490] p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-[#a06820] uppercase tracking-wider">입사일 기준 누적 연차로 관리 중</span>
                                                    </div>
                                                    <p className="text-[10px] text-[#7a5a1a] leading-relaxed">
                                                        {balance?.system_start_date || '2026-05-08'} 기준 입사일부터 누적 발생/사용/잔여 연차 기준값이 반영되었습니다.
                                                        {balance?.pre_system_used_days !== undefined && (
                                                            <><br />프로그램 사용 전 사용분: {fmtDays(balance.pre_system_used_days)}</>
                                                        )}
                                                        {balance?.baseline_calculated_total_days !== undefined && (
                                                            <><br />계산상 발생연차: {fmtDays(balance.baseline_calculated_total_days)} (운영 기준 선반영 포함)</>
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h3 className={SECTION_TITLE}>연차 현황</h3>
                                                    <InfoRow label="누적 총 발생" value={fmtDays(leave.totalEarned)} />
                                                    <InfoRow label="누적 사용" value={fmtDays(leave.usedLeave)} />
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                <h3 className={SECTION_TITLE}>연차 현황</h3>
                                                <InfoRow label="1년 미만 발생" value={fmtDays(leave.firstYearLeave)} />
                                                <InfoRow label="법정 연차 발생" value={fmtDays(leave.annualLeave)} />
                                                <InfoRow label="이월 연차 반영" value={fmtDays(leave.carryover + leave.firstYearCarryover)} />
                                                <InfoRow label="임의 조정" value={`${leave.adjustment > 0 ? '+' : ''}${leave.adjustment}일`} />
                                                <div className="border-t border-[#d4cfbf] my-2 pt-2"></div>
                                                <InfoRow label="총 사용 연차" value={fmtDays(leave.usedLeave)} />
                                                {leave.absenceCount > 0 && (<InfoRow icon={<AlertTriangle size={14} className="text-[#a78049]" />} label="결근" value={`${leave.absenceCount}일`} />)}
                                            </div>
                                        )}
                                        <div className="bg-[#e8ebd8] p-4 border border-[#b8c4a0]">
                                            <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2">잔여 연차</h3>
                                            <div className="flex justify-between items-end">
                                                {(() => {
                                                    const remaining = leave.remaining;
                                                    const tone = remaining <= 0 ? 'text-[#8d5a4d]'
                                                        : remaining <= 3 ? 'text-[#a78049]'
                                                            : 'text-[#5d6c4a]';
                                                    return <span className={`text-2xl font-black ${tone}`}>{fmtDays(remaining)}</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="p-4 border-t border-[#d4cfbf] bg-[#faf8f0]">
                            <button onClick={() => { setAdjustUser(selectedUser); openModal('adjust'); }} className="w-full py-3 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border border-[#3d472f] flex justify-center items-center gap-2"><Edit size={16} /> 연차 조정</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#9a9585] p-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-[#f5f3e8] flex items-center justify-center mb-3 border border-[#d4cfbf]">
                            <Users size={28} className="text-[#9a9585]" />
                        </div>
                        <p className="text-sm font-bold text-[#7a7565] mb-1">직원 상세</p>
                        <p className="text-xs text-[#9a9585] leading-relaxed">왼쪽 목록에서 직원을 선택하면<br />근속·연차 현황·잔여 연차를 확인할 수 있습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
