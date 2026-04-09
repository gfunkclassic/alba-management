import React, { useState } from 'react';
import { Search, RotateCcw, Monitor, Users, Briefcase, Wallet, Calendar, AlertTriangle, FileText, UserMinus, Check, Edit, Trash2 } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';
import { ConfirmModal } from './modals/DialogModals';

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
    maskPII = false, roleMode = 'ADMIN', onDeleteUser
}) {
    const [deleteTargetUser, setDeleteTargetUser] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | ALBA | STAFF

    const displayData = typeFilter === 'ALL' ? filteredData
        : typeFilter === 'ALBA' ? filteredData.filter(u => (u.employmentType || u.position || '아르바이트') === '아르바이트')
        : filteredData.filter(u => (u.employmentType || u.position || '아르바이트') !== '아르바이트');

    return (
        <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="전체 인원" value={`${stats.totalActive}명`} icon={<Users size={20} className="text-[#5d6c4a]" />} />
                <StatCard title="4대보험 미가입" value={`${stats.insuranceNeeded}명`} icon={<AlertTriangle size={20} className="text-[#a65d57]" />} danger={stats.insuranceNeeded > 0} />
                <StatCard title="계약 갱신 요망 (14일 이내)" value={`${stats.needRenewal}명`} icon={<RotateCcw size={20} className="text-[#d8973c]" />} warning={stats.needRenewal > 0} />
                <StatCard title="총 예상 급여" value={`₩${stats.totalWage.toLocaleString()}`} sub="실제 근무 기록 기준" icon={<Wallet size={20} className="text-[#5d6c4a]" />} />
            </section>

            <section className="bg-[#f5f3e8] p-4 border-2 border-[#c5c0b0] flex flex-wrap gap-4 items-center mt-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                    <input type="text" placeholder="이름, 연락처 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none" />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm font-bold text-[#5a5545] outline-none">
                    <option value="ALL">전체 상태</option>
                    <option value="RENEWAL_NEEDED">계약 갱신 임박</option>
                    <option value="INSURANCE_NEEDED">4대보험 미가입</option>
                </select>
                <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm font-bold text-[#5a5545] outline-none">
                    {Object.keys(teamCounts).map(team => (<option key={team} value={team}>{team} ({teamCounts[team]})</option>))}
                </select>
                {/* 고용유형 필터 */}
                <div className="flex bg-[#e8e4d4] border-2 border-[#c5c0b0]">
                    {[{ key: 'ALL', label: '전체' }, { key: 'ALBA', label: '아르바이트' }, { key: 'STAFF', label: '직원/계약직' }].map(f => (
                        <button key={f.key} onClick={() => setTypeFilter(f.key)} className={`px-3 py-1.5 text-xs font-bold transition ${typeFilter === f.key ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#d4dcc0]'} ${f.key !== 'ALL' ? 'border-l border-[#c5c0b0]' : ''}`}>{f.label}</button>
                    ))}
                </div>
                {/* 재직/퇴사 필터 */}
                <div className="flex bg-[#e8e4d4] border-2 border-[#c5c0b0]">
                    <button onClick={() => setViewMode('ACTIVE')} className={`px-3 py-1.5 text-xs font-bold transition ${viewMode === 'ACTIVE' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#d4dcc0]'}`}>재직</button>
                    <button onClick={() => setViewMode('RESIGNED')} className={`px-3 py-1.5 text-xs font-bold border-l border-[#c5c0b0] transition ${viewMode === 'RESIGNED' ? 'bg-[#a65d57] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#e6d0ce]'}`}>퇴사</button>
                    <button onClick={() => setViewMode('ALL')} className={`px-3 py-1.5 text-xs font-bold border-l border-[#c5c0b0] transition ${viewMode === 'ALL' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#d4dcc0]'}`}>전체</button>
                </div>
            </section>

            <div className="flex flex-col lg:flex-row gap-4 mt-4">
                <div className="flex-1 bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-[#e8e4d4] sticky top-0 z-10 border-b-2 border-[#c5c0b0] text-[10px] font-bold text-[#5d6c4a] uppercase tracking-wider">
                                {typeFilter === 'STAFF' ? (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">부서</th><th className="p-2.5 text-left">직급</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">진급일</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                ) : typeFilter === 'ALBA' ? (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">팀</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">계약갱신</th><th className="p-2.5 text-center">근무시간</th><th className="p-2.5 text-right">시급</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                ) : (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">유형</th><th className="p-2.5 text-left">팀/부서</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">상태</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                )}
                            </thead>
                            <tbody className="text-sm divide-y divide-[#ebe8db]">
                                {displayData.map(user => {
                                    const eType = user.employmentType || user.position || '아르바이트';
                                    const isAlba = eType === '아르바이트';
                                    const insured = user.insuranceStatus;
                                    return (
                                        <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f4f5eb] transition-colors text-xs ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                            <td className="p-2.5 pl-3 text-[#7a7565]">{user.gender}</td>
                                            <td className="p-2.5 font-bold text-[#3d472f]">{user.name}</td>
                                            {typeFilter === 'STAFF' ? (
                                                <>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.jobTitle || '-'}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#a65d57]">✗</span>}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.promotionDate || '-'}</td>
                                                </>
                                            ) : typeFilter === 'ALBA' ? (
                                                <>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#a65d57]">✗</span>}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.renewalDate || '-'}</td>
                                                    <td className="p-2.5 text-center text-[#5a5545]">{user.checkIn}~{user.checkOut}</td>
                                                    <td className="p-2.5 text-right font-bold text-[#3d472f]">₩{(user.wage || 0).toLocaleString()}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2.5"><span className={`px-1.5 py-0.5 text-[10px] font-bold border ${isAlba ? 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]' : 'bg-[#D6E4F0] text-[#2F5597] border-[#a0b8d0]'}`}>{eType}</span></td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#a65d57]">✗</span>}</td>
                                                    <td className="p-2.5">
                                                        {user.resignDate ? <span className="text-[10px] font-bold text-[#a65d57]">퇴사</span> : <span className="text-[10px] font-bold text-[#5d6c4a]">재직</span>}
                                                    </td>
                                                </>
                                            )}
                                            <td className="p-2.5 pr-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={(e) => openUserForm(user, e)} className="p-1 bg-[#e8e4d4] text-[#5d6c4a] hover:bg-[#d4dcc0] border border-[#c5c0b0]" title='수정'><Edit size={12} /></button>
                                                    {!user.resignDate && <button onClick={(e) => openResignModal(user, e)} className="p-1 bg-[#f8f0ef] text-[#a65d57] hover:bg-[#f0e5e4] border border-[#dcc0bc]" title='퇴사'><UserMinus size={12} /></button>}
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTargetUser(user); }} className="p-1 bg-[#f8f0ef] text-[#a65d57] hover:bg-[#a65d57] hover:text-[#f8f0ef] border border-[#a65d57] transition-colors" title='삭제'><Trash2 size={12} /></button>
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
            <ConfirmModal
                isOpen={!!deleteTargetUser}
                onClose={() => setDeleteTargetUser(null)}
                onConfirm={() => {
                    if (deleteTargetUser) {
                        onDeleteUser(deleteTargetUser.id);
                        setDeleteTargetUser(null);
                    }
                }}
                title="직원 삭제 확인"
                message={deleteTargetUser ? `[${deleteTargetUser.name}] 직원을 목록에서 완전히 삭제하시겠습니까?\n모든 기록이 함께 제거될 수 있습니다.` : ''}
                isDanger={true}
                confirmText="삭제"
            />
        </>
    );
}
