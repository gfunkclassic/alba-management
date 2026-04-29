import React from 'react';
import { Users, UserMinus, Calendar, Edit, Briefcase, CalendarCheck, AlertTriangle } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';

// 시각 클래스 토큰 (LeaveView 내부 한정 — 새 파일/유틸 분리 안 함)
const CARD_BASE = 'bg-[#faf8f0] border border-[#d4cfbf]';
const SECTION_TITLE = 'text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2 pb-1 border-b border-[#d4cfbf]';

export default function LeaveView({
    users, viewMode, setViewMode, filteredData,
    selectedUser, handleSelectUser, calculateLeave,
    openModal, setAdjustUser
}) {
    return (
        <div className="flex flex-col lg:flex-row gap-4">
            <div className={`flex-1 ${CARD_BASE} overflow-hidden`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[#d4cfbf] bg-[#faf8f0]">
                    <StatCard title="전체 인원" value={`${users.length}명`} icon={<Users size={20} className="text-[#5d6c4a]" />} onClick={() => setViewMode('ALL')} active={viewMode === 'ALL'} />
                    <StatCard title="재직 인원" value={`${users.filter(u => !u.resignDate).length}명`} icon={<Briefcase size={20} className="text-[#5d6c4a]" />} onClick={() => setViewMode('ACTIVE')} active={viewMode === 'ACTIVE'} />
                    <StatCard title="연차 소진 필요 (<3일)" value={`${users.filter(u => !u.resignDate && calculateLeave(u).remaining <= 3).length}명`} icon={<CalendarCheck size={20} className="text-[#8d5a4d]" />} danger />
                    <StatCard title="퇴사 인원" value={`${users.filter(u => u.resignDate).length}명`} icon={<UserMinus size={20} className="text-[#7a7565]" />} onClick={() => setViewMode('RESIGNED')} active={viewMode === 'RESIGNED'} />
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                            <tr>
                                <th className="p-3 pl-4 text-left">직원 정보</th>
                                <th className="p-3 text-center">근속 연수</th>
                                <th className="p-3 text-center">총 발생연차</th>
                                <th className="p-3 text-center">사용 연차</th>
                                <th className="p-3 text-center">조정 연차</th>
                                <th className="p-3 text-center">잔여 연차</th>
                                <th className="p-3 pr-4 text-right">상세</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-[#ebe8db] [&_td]:align-middle">
                            {filteredData.map(user => {
                                const leave = calculateLeave(user);
                                const isLow = leave.remaining <= 3;
                                return (
                                    <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f5f3e8] transition-colors ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 flex items-center justify-center font-bold text-xs ${user.resignDate ? 'bg-[#c5c0b0] text-[#f5f3e8]' : 'bg-[#5d6c4a] text-[#f5f3e8]'}`}>
                                                    {user.name[0]}
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${user.resignDate ? 'text-[#9a9585]' : 'text-[#3d472f]'}`}>{user.name}</p>
                                                    <p className="text-[10px] text-[#7a7565]">{user.startDate} 입사</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-[#5a5545]"><span className="font-mono bg-[#f5f3e8] border border-[#d4cfbf] px-1">{leave.yearsWorked}년</span></td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{leave.totalEarned}일</td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{Number.isInteger(leave.usedLeave) ? leave.usedLeave : leave.usedLeave.toFixed(1)}일</td>
                                        <td className="p-3 text-center"><span className={`font-bold ${leave.adjustment >= 0 ? 'text-[#5d6c4a]' : 'text-[#8d5a4d]'}`}>{leave.adjustment >= 0 ? '+' : ''}{leave.adjustment}일</span></td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-bold border ${isLow ? 'bg-[#f5ebe7] text-[#8d5a4d] border-[#cba79c]' : 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]'}`}>
                                                {leave.remaining}일
                                            </span>
                                        </td>
                                        <td className="p-3 pr-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setAdjustUser(user); openModal('adjust'); }} className="p-1 px-2 text-xs bg-[#faf8f0] text-[#5d6c4a] hover:bg-[#f5f3e8] font-bold flex items-center gap-1 border border-[#d4cfbf]"><Edit size={12} />조정</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={`w-full lg:w-80 ${CARD_BASE} flex flex-col`}>
                {selectedUser ? (
                    <div className="flex flex-col h-full">
                        <div className="p-4 bg-[#5d6c4a] border-b border-[#3d472f]">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight">{selectedUser.name}</h2>
                            </div>
                            <p className="text-[#d4dcc0] text-sm font-bold">{selectedUser.team} | {selectedUser.startDate}</p>
                            {selectedUser.resignDate && (<p className="text-xs text-[#f5f3e8] mt-1 bg-[#8d5a4d] inline-block px-2 py-0.5 border border-[#7a4d40]">퇴사: {selectedUser.resignDate}</p>)}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <div>
                                <h3 className={SECTION_TITLE}>근무 정보</h3>
                                <InfoRow label="근속기간" value={`${calculateLeave(selectedUser).yearsWorked}년 (${calculateLeave(selectedUser).monthsWorked}개월)`} />
                            </div>
                            <div>
                                <h3 className={SECTION_TITLE}>연차 현황</h3>
                                {(() => {
                                    const leave = calculateLeave(selectedUser);
                                    return (<>
                                        <InfoRow label="1년 미만 발생" value={`${leave.firstYearLeave}일`} />
                                        <InfoRow label="법정 연차 발생" value={`${leave.annualLeave}일`} />
                                        <InfoRow label="이월 연차 반영" value={`${leave.carryover + leave.firstYearCarryover}일`} />
                                        <InfoRow label="임의 조정" value={`${leave.adjustment > 0 ? '+' : ''}${leave.adjustment}일`} />
                                        <div className="border-t border-[#d4cfbf] my-2 pt-2"></div>
                                        <InfoRow label="총 사용 연차" value={`${Number.isInteger(leave.usedLeave) ? leave.usedLeave : leave.usedLeave.toFixed(1)}일`} />
                                        {leave.absenceCount > 0 && (<InfoRow icon={<AlertTriangle size={14} className="text-[#a78049]" />} label="결근" value={`${leave.absenceCount}일`} />)}
                                    </>);
                                })()}
                            </div>
                            <div className="bg-[#e8ebd8] p-4 border border-[#b8c4a0]">
                                <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2">잔여 연차</h3>
                                <div className="flex justify-between items-end">
                                    {(() => {
                                        const remaining = calculateLeave(selectedUser).remaining;
                                        const tone = remaining <= 0 ? 'text-[#8d5a4d]'
                                            : remaining <= 3 ? 'text-[#a78049]'
                                            : 'text-[#5d6c4a]';
                                        return <span className={`text-2xl font-black ${tone}`}>{remaining}일</span>;
                                    })()}
                                </div>
                            </div>
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
