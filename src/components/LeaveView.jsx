import React from 'react';
import { Users, UserMinus, Calendar, Edit, Briefcase, CalendarCheck, AlertTriangle } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';

export default function LeaveView({
    users, viewMode, setViewMode, filteredData,
    selectedUser, handleSelectUser, calculateLeave,
    openModal, setAdjustUser
}) {
    return (
        <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b-2 border-[#c5c0b0] bg-[#faf8f0]">
                    <StatCard title="전체 인원" value={`${users.length}명`} icon={<Users size={20} />} onClick={() => setViewMode('ALL')} active={viewMode === 'ALL'} />
                    <StatCard title="재직 인원" value={`${users.filter(u => !u.resignDate).length}명`} icon={<Briefcase size={20} />} onClick={() => setViewMode('ACTIVE')} active={viewMode === 'ACTIVE'} />
                    <StatCard title="연차 소진 필요 (<3일)" value={`${users.filter(u => !u.resignDate && calculateLeave(u).remaining <= 3).length}명`} icon={<CalendarCheck size={20} className="text-[#a65d57]" />} danger />
                    <StatCard title="퇴사 인원" value={`${users.filter(u => u.resignDate).length}명`} icon={<UserMinus size={20} />} onClick={() => setViewMode('RESIGNED')} active={viewMode === 'RESIGNED'} />
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#e8e4d4] sticky top-0 z-10 border-b-2 border-[#c5c0b0] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
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
                        <tbody className="text-sm divide-y divide-[#ebe8db]">
                            {filteredData.map(user => {
                                const leave = calculateLeave(user);
                                return (
                                    <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f4f5eb] transition-colors ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
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
                                        <td className="p-3 text-center text-[#5a5545]"><span className="font-mono bg-[#e8e4d4] px-1">{leave.yearsWorked}년</span></td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{leave.totalEarned}일</td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{leave.usedLeave}일</td>
                                        <td className="p-3 text-center"><span className={`font-bold ${leave.adjustment >= 0 ? 'text-[#5d6c4a]' : 'text-[#a65d57]'}`}>{leave.adjustment >= 0 ? '+' : ''}{leave.adjustment}일</span></td>
                                        <td className="p-3 text-center"><span className={`px-2 py-1 text-xs font-bold ${leave.remaining <= 3 ? 'bg-[#f8f0ef] text-[#a65d57] border border-[#dcc0bc]' : 'bg-[#e8ebd8] text-[#5d6c4a] border border-[#b8c4a0]'}`}>{leave.remaining}일</span></td>
                                        <td className="p-3 pr-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setAdjustUser(user); openModal('adjust'); }} className="p-1 px-2 text-xs bg-[#e8e4d4] text-[#5d6c4a] hover:bg-[#d4dcc0] font-bold flex items-center gap-1 border border-[#c5c0b0]"><Edit size={12} />조정</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="w-full lg:w-80 bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md flex flex-col">
                {selectedUser ? (
                    <div className="flex flex-col h-full">
                        <div className="p-6 bg-[#5d6c4a] border-b-2 border-[#3d472f]">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight">{selectedUser.name}</h2>
                            </div>
                            <p className="text-[#d4dcc0] text-sm font-bold">{selectedUser.team} | {selectedUser.startDate}</p>
                            {selectedUser.resignDate && (<p className="text-xs text-[#f8f0ef] mt-1 bg-[#a65d57] inline-block px-2 py-0.5">퇴사: {selectedUser.resignDate}</p>)}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div><h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2 pb-1 border-b-2 border-[#e8e4d4]">근무 정보</h3>
                                <InfoRow label="근속기간" value={`${calculateLeave(selectedUser).yearsWorked}년 (${calculateLeave(selectedUser).monthsWorked}개월)`} />
                            </div>
                            <div><h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2 pb-1 border-b-2 border-[#e8e4d4]">연차 현황</h3>
                                {(() => {
                                    const leave = calculateLeave(selectedUser);
                                    return (<>
                                        <InfoRow label="1년 미만 발생" value={`${leave.firstYearLeave}일`} />
                                        <InfoRow label="법정 연차 발생" value={`${leave.annualLeave}일`} />
                                        <InfoRow label="이월 연차 반영" value={`${leave.carryover + leave.firstYearCarryover}일`} />
                                        <InfoRow label="임의 조정" value={`${leave.adjustment > 0 ? '+' : ''}${leave.adjustment}일`} />
                                        <div className="border-t border-[#e8e4d4] my-2 pt-2"></div>
                                        <InfoRow label="총 사용 연차" value={`${leave.usedLeave}일`} />
                                        {leave.absenceCount > 0 && (<InfoRow icon={<AlertTriangle size={14} />} label="결근" value={`${leave.absenceCount}일`} />)}
                                    </>);
                                })()}
                            </div>
                            <div className="bg-[#e8ebd8] p-4 border-2 border-[#b8c4a0]">
                                <h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2">잔여 연차</h3>
                                <div className="flex justify-between items-end">
                                    <span className="text-2xl font-black text-[#5d6c4a]">{calculateLeave(selectedUser).remaining}일</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t-2 border-[#e8e4d4] bg-[#faf8f0]">
                            <button onClick={() => { setAdjustUser(selectedUser); openModal('adjust'); }} className="w-full py-3 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f] flex justify-center items-center gap-2"><Edit size={16} /> 연차 조정</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#9a9585] p-8 text-center"><Users size={48} className="mb-4 opacity-30" /><p className="text-sm font-medium">직원을 선택하여<br />상세 정보를 확인하세요</p></div>
                )}
            </div>
        </div>
    );
}
