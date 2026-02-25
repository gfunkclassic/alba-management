import React from 'react';
import { Search, RotateCcw, Monitor, Users, Briefcase, Wallet, Calendar, AlertTriangle, FileText, UserMinus, Check, Edit } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';

export default function HRView({
    stats,
    teamCounts,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    filterTeam, setFilterTeam,
    filterStatus, setFilterStatus,
    filteredData,
    selectedUser, handleSelectUser,
    calculateMonthlyWage, payrollMonth,
    openModal, openUserForm, openResignModal,
    maskPII = false, roleMode = 'ADMIN'
}) {
    return (
        <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="전체 직원" value={`${stats.totalActive}명`} icon={<Users size={20} className="text-[#5d6c4a]" />} />
                <StatCard title="4대보험 미가입" value={`${stats.insuranceNeeded}명`} icon={<AlertTriangle size={20} className="text-[#a65d57]" />} danger={stats.insuranceNeeded > 0} />
                <StatCard title="계약 갱신 요망 (14일 이내)" value={`${stats.needRenewal}명`} icon={<RotateCcw size={20} className="text-[#d8973c]" />} warning={stats.needRenewal > 0} />
                <StatCard title="총 예상 급여" value={`₩${stats.totalWage.toLocaleString()}`} sub="실제 근무 기록 기준" icon={<Wallet size={20} className="text-[#5d6c4a]" />} />
            </section>

            <section className="bg-[#f5f3e8] p-4 border-2 border-[#c5c0b0] mt-4">
                <h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-3 flex items-center gap-2"><Briefcase size={14} /> 팀별 현황</h3>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(teamCounts).map(([team, count]) => (
                        <button
                            key={team}
                            onClick={() => setFilterTeam(team)}
                            className={`px-3 py-1.5 text-xs font-bold border-2 transition-colors ${filterTeam === team ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]' : 'bg-[#e8e4d4] text-[#7a7565] border-[#c5c0b0] hover:border-[#5d6c4a]'}`}
                        >
                            {team} <span className="ml-1 opacity-70">({count})</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="bg-[#f5f3e8] p-4 border-2 border-[#c5c0b0] flex flex-wrap gap-4 items-center mt-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                    <input type="text" placeholder="직원 검색 (이름, 연락처)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none" />
                </div>
                <div className="flex gap-2">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm font-bold text-[#5a5545] outline-none">
                        <option value="ALL">전체 상태</option>
                        <option value="RENEWAL_NEEDED">계약 갱신 임박 (14일 내)</option>
                        <option value="INSURANCE_NEEDED">4대보험 미가입</option>
                    </select>
                    <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm font-bold text-[#5a5545] border-none outline-none">
                        {Object.keys(teamCounts).map(team => (<option key={team} value={team}>{team} ({teamCounts[team]})</option>))}
                    </select>
                </div>
                <div className="flex bg-[#e8e4d4] border-2 border-[#c5c0b0]">
                    <button onClick={() => setViewMode('ACTIVE')} className={`px-4 py-2 text-xs font-bold transition ${viewMode === 'ACTIVE' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#d4dcc0]'}`}>재직자</button>
                    <button onClick={() => setViewMode('RESIGNED')} className={`px-4 py-2 text-xs font-bold border-l-2 border-[#c5c0b0] transition ${viewMode === 'RESIGNED' ? 'bg-[#a65d57] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#e6d0ce]'}`}>퇴사자</button>
                    <button onClick={() => setViewMode('ALL')} className={`px-4 py-2 text-xs font-bold transition flex items-center ${viewMode === 'ALL' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#d4dcc0]'}`}>전체</button>
                </div>
            </section>

            <div className="flex flex-col lg:flex-row gap-4 mt-4">
                <div className="flex-1 bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-[#e8e4d4] sticky top-0 z-10 border-b-2 border-[#c5c0b0] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                                <tr>
                                    <th className="p-3 pl-4 text-left">직원 정보</th>
                                    <th className="p-3 text-left">계약 현황</th>
                                    <th className="p-3 text-left">근무/급여 조건</th>
                                    <th className="p-3 text-left">상태 관리</th>
                                    <th className="p-3 pr-4 text-right">빠른 실행</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-[#ebe8db]">
                                {filteredData.map(user => {
                                    const isRenewalTarget = user.renewalDate && user.renewalDate !== '신규' && !user.resignDate && ((new Date(user.renewalDate) - new Date()) / (1000 * 60 * 60 * 24)) >= 0 && ((new Date(user.renewalDate) - new Date()) / (1000 * 60 * 60 * 24)) <= 14;
                                    return (
                                        <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f4f5eb] transition-colors ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                            <td className="p-3 pl-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg border-2 ${user.resignDate ? 'bg-[#e8e4d4] text-[#9a9585] border-[#c5c0b0]' : 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]'}`}>
                                                        {user.name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-[#3d472f] text-base group-hover:text-[#5d6c4a] transition-colors">{user.name} <span className="text-xs font-normal text-[#7a7565] ml-1">{user.gender}</span></p>
                                                        <p className="text-xs font-bold text-[#9a9585] flex items-center gap-1"><Briefcase size={12} />{user.team} | {user.position}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <p className="text-[#5a5545] font-medium"><span className="text-[#9a9585] text-xs">입사:</span> {user.startDate}</p>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {user.insuranceStatus ? <span className="inline-flex items-center w-fit text-xs font-bold text-[#5d6c4a]"><Check size={12} className="mr-1" />4대보험 ({user.insuranceDate})</span> : <span className="inline-flex items-center w-fit text-xs font-bold text-[#a65d57]"><AlertTriangle size={12} className="mr-1" />3.3% 공제</span>}
                                                </div>
                                            </td>
                                            <td className="p-3"><p className="font-semibold text-[#4a4535]">₩{user.wage.toLocaleString()}</p><p className="text-xs text-[#9a9585]">{user.workDays} 근무</p></td>
                                            <td className="p-3">
                                                <div className="flex gap-1 flex-wrap">
                                                    {isRenewalTarget && <span className="px-1.5 py-0.5 bg-[#fcf4dc] text-[#a67c00] border border-[#e5c07b] text-[10px] font-bold animate-pulse">갱신임박</span>}
                                                    {!user.insuranceStatus && !user.resignDate && <span className="px-1.5 py-0.5 bg-[#f8f0ef] text-[#a65d57] border border-[#dcc0bc] text-[10px] font-bold">보험미가입</span>}
                                                    {user.resignDate && <span className="px-1.5 py-0.5 bg-[#f8f0ef] text-[#a65d57] border border-[#dcc0bc] text-[10px] font-bold">퇴사</span>}
                                                </div>
                                            </td>
                                            <td className="p-3 pr-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    {roleMode !== 'VIEWER' && <button onClick={(e) => openUserForm(user, e)} className="p-1.5 bg-[#e8e4d4] text-[#5d6c4a] hover:bg-[#d4dcc0] title='정보 수정'"><Edit size={14} /></button>}
                                                    {!user.resignDate && roleMode === 'ADMIN' && (
                                                        <button onClick={(e) => openResignModal(user, e)} className="p-1.5 bg-[#f8f0ef] text-[#a65d57] hover:bg-[#f0e5e4] title='퇴사 처리'"><UserMinus size={14} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="w-full lg:w-80 bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md flex flex-col h-[700px]">
                    {selectedUser ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 bg-[#5d6c4a] border-b-2 border-[#3d472f]">
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight">{selectedUser.name}</h2>
                                    <span className={`px-2 py-0.5 text-xs font-bold border-2 ${selectedUser.resignDate ? 'bg-[#a65d57] border-[#8b4d47] text-[#f5f3e8]' : 'bg-[#d4dcc0] border-[#b8c4a0] text-[#3d472f]'}`}>
                                        {selectedUser.resignDate ? '퇴사' : '재직중'}
                                    </span>
                                </div>
                                <p className="text-[#d4dcc0] text-sm font-bold flex items-center gap-2"><Briefcase size={14} /> {selectedUser.team} | {selectedUser.position}</p>
                                {selectedUser.resignDate && (
                                    <div className="mt-3 p-3 bg-[#8b4d47] border-l-4 border-[#3d3929] text-xs">
                                        <div className="font-bold text-[#f5f3e8]">퇴사일: {selectedUser.resignDate}</div>
                                        {selectedUser.resignReason && <div className="mt-1 text-[#dcc0bc]">사유: {selectedUser.resignReason}</div>}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div><h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2">Contact & Info</h3>
                                    <div className="bg-[#faf8f0] p-3 border-2 border-[#e8e4d4] space-y-2">
                                        <InfoRow label="연락처" value={maskPII ? '***-****-****' : selectedUser.phone} />
                                        <InfoRow label="주민가명" value={maskPII ? '******-*******' : `${selectedUser.rrn?.substring(0, 8)}******`} />
                                        <InfoRow label="계좌" value={maskPII ? `${selectedUser.bank} ***-***-******` : `${selectedUser.bank} ${selectedUser.account}`} />
                                    </div>
                                </div>
                                <div><h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2">Employment</h3>
                                    <div className="bg-[#faf8f0] p-3 border-2 border-[#e8e4d4] space-y-2">
                                        <InfoRow icon={<Calendar size={14} />} label="입사일" value={selectedUser.startDate} />
                                        <InfoRow icon={<Monitor size={14} />} label="근무시간" value={`${selectedUser.checkIn} - ${selectedUser.checkOut}`} />
                                        <InfoRow icon={<Wallet size={14} />} label="시급" value={`₩${selectedUser.wage.toLocaleString()}`} />
                                        <InfoRow icon={<RotateCcw size={14} />} label="Renew By" value={selectedUser.renewalDate} />
                                    </div>
                                </div>
                                {selectedUser.resignDate && (
                                    <div className="bg-[#f8f0ef] p-4 border-2 border-[#dcc0bc]">
                                        <h3 className="text-xs font-bold text-[#a65d57] uppercase mb-2">퇴사 정보</h3>
                                        <InfoRow icon={<Calendar size={14} />} label="퇴사일" value={selectedUser.resignDate} />
                                        <InfoRow icon={<FileText size={14} />} label="사유" value={selectedUser.resignReason || '미기재'} />
                                    </div>
                                )}
                                <div className="bg-[#e8ebd8] p-4 border-2 border-[#b8c4a0]">
                                    <h3 className="text-xs font-bold text-[#5d6c4a] uppercase mb-2 flex items-center justify-between">
                                        Payroll Est.
                                        <span className="text-[10px] bg-[#5d6c4a] text-[#f5f3e8] px-1.5 py-0.5">{selectedUser.insuranceStatus ? '세전' : '3.3%공제'}</span>
                                    </h3>
                                    {(() => {
                                        const wage = calculateMonthlyWage(selectedUser, payrollMonth);
                                        if (selectedUser.insuranceStatus) {
                                            return (
                                                <>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[#7a7565] text-xs font-bold">월 기본급 (예상)</span>
                                                        <span className="text-[#3d472f] font-mono font-bold">₩{wage.estimated.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t-2 border-[#d4dcc0]">
                                                        <span className="text-[#5d6c4a] text-sm font-black">실적 합계</span>
                                                        <span className="text-[#2d3721] font-black text-lg">₩{wage.actual.toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-[10px] text-[#7a7565] text-right mt-1">4대보험 공제는 노무사 산정 후 확정</p>
                                                </>
                                            );
                                        } else {
                                            return (
                                                <>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[#7a7565] text-xs font-bold">월 기본급 (예상)</span>
                                                        <span className="text-[#3d472f] font-mono font-bold">₩{wage.estimated.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[#7a7565] text-xs font-bold">실적 합계</span>
                                                        <span className="text-[#3d472f] font-mono font-bold">₩{wage.actual.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[#a65d57] mt-1 mb-2">
                                                        <span className="text-xs font-bold">- 3.3% 공제</span>
                                                        <span className="font-mono font-bold">-₩{wage.strictDeduction.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t-2 border-[#d4dcc0]">
                                                        <span className="text-[#5d6c4a] text-sm font-black">실지급액</span>
                                                        <span className="text-[#2d3721] font-black text-lg">₩{wage.strictFinalPayout.toLocaleString()}</span>
                                                    </div>
                                                </>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                            <div className="p-4 border-t-2 border-[#e8e4d4] bg-[#faf8f0]">
                                <button onClick={() => openModal('calendar')} className="w-full py-3 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f] flex justify-center items-center gap-2"><Calendar size={16} /> 근태 관리 열기</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[#9a9585] p-8 text-center"><Users size={48} className="mb-4 opacity-20" /><p className="text-sm font-medium">직원을 선택하여<br />상세 정보를 확인하세요</p></div>
                    )}
                </div>
            </div>
        </>
    );
}
