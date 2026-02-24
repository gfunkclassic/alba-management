import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Building, Wallet, Search, Download, AlertCircle } from 'lucide-react';

export default function PayrollView({ users, calculateMonthlyWage, onDownloadInsured, onDownloadFreelancer, onDownloadTemplate, payrollMonth, onMonthChange }) {
    const [mode, setMode] = useState('INSURED'); // 'INSURED' or 'FREELANCER'
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (u.resignDate) return false;
            const matchesSearch = u.name.includes(searchTerm);
            const matchesMode = mode === 'INSURED' ? u.insuranceStatus : !u.insuranceStatus;
            return matchesSearch && matchesMode;
        });
    }, [users, mode, searchTerm]);

    const summary = useMemo(() => {
        let totalCount = 0;
        let recordCount = 0;
        const totalAmount = filteredUsers.reduce((sum, u) => {
            const wage = calculateMonthlyWage(u, payrollMonth);
            totalCount++;
            if (wage.hasRecord) recordCount++;
            const amt = wage.hasRecord ? (mode === 'INSURED' ? wage.actual : wage.strictFinalPayout) : 0;
            return sum + amt;
        }, 0);
        const totalDeduction = filteredUsers.reduce((sum, u) => {
            const wage = calculateMonthlyWage(u, payrollMonth);
            if (!wage.hasRecord) return sum;
            return sum + (mode === 'INSURED' ? 0 : wage.strictDeduction);
        }, 0);
        return { totalCount, recordCount, totalAmount, totalDeduction };
    }, [filteredUsers, calculateMonthlyWage, mode, payrollMonth]);

    return (
        <div className="space-y-4">
            <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => onMonthChange(-1)} className="p-1.5 hover:bg-[#e8e4d4] text-[#5a5545] border border-[#c5c0b0]"><ChevronLeft size={20} /></button>
                    <h2 className="text-xl font-black text-[#3d472f] tracking-tight min-w-[120px] text-center">{payrollMonth.replace('-', '.')}</h2>
                    <button onClick={() => onMonthChange(1)} className="p-1.5 hover:bg-[#e8e4d4] text-[#5a5545] border border-[#c5c0b0]"><ChevronRight size={20} /></button>
                </div>
                <p className="text-xs text-[#7a7565] font-bold">급여 정산 기준월</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-[#f5f3e8] border-2 border-[#3d472f] p-1 flex">
                    <button onClick={() => setMode('INSURED')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'INSURED' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#e8e4d4]'}`}>
                        <Building size={16} /> 4대보험 (노무사 산정)
                    </button>
                    <button onClick={() => setMode('FREELANCER')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'FREELANCER' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#e8e4d4]'}`}>
                        <Wallet size={16} /> 3.3% 공제 (본사 지급)
                    </button>
                </div>
                <div className="bg-[#5d6c4a] p-4 text-[#f5f3e8] flex flex-col justify-center border-2 border-[#3d472f]">
                    <span className="text-xs text-[#d4dcc0] font-bold uppercase mb-1">{mode === 'INSURED' ? '실제 근무 기준 총액 (세전)' : '실제 근무 기준 지급 총액'}</span>
                    <div className="flex justify-between items-end">
                        <span className="text-2xl font-black">{summary.recordCount}/{summary.totalCount}명</span>
                        <span className="text-lg font-bold opacity-80">₩{summary.totalAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <section className="bg-[#f5f3e8] p-4 border-2 border-[#c5c0b0] flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                    <input type="text" placeholder="이름 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none" />
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center border-2 border-[#c5c0b0] bg-[#f5f3e8]">
                        <select id="templateTeamSelect" defaultValue="전체" className="bg-transparent text-[#3d472f] text-sm font-bold px-2 py-2 outline-none cursor-pointer">
                            <option value="전체">전체</option>
                            {[...new Set(users.filter(u => !u.resignDate).map(u => u.team).filter(Boolean))].sort().map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <button onClick={() => onDownloadTemplate(document.getElementById('templateTeamSelect').value)} className="text-[#3d472f] px-3 py-2 text-sm font-bold flex items-center gap-1.5 hover:bg-[#e8e4d4] border-l-2 border-[#c5c0b0]">
                            <Download size={16} /> 근태 양식
                        </button>
                    </div>
                    <button onClick={mode === 'INSURED' ? onDownloadInsured : onDownloadFreelancer} className="bg-[#3d472f] text-[#f5f3e8] px-4 py-2 text-sm font-bold border-2 border-[#2d3721] flex items-center gap-2 hover:bg-[#2d3721]">
                        <Download size={16} /> {mode === 'INSURED' ? '노무사 전달용 엑셀' : '지급 요청용 엑셀'}
                    </button>
                </div>
            </section>

            <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] shadow-md overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#e8e4d4] sticky top-0 z-10 border-b-2 border-[#c5c0b0] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                            <tr>
                                <th className="p-3 pl-4 text-left">직원 정보</th>
                                <th className="p-3 text-left">계좌 정보</th>
                                {mode === 'INSURED' ? (
                                    <>
                                        <th className="p-3 text-center">근무일수</th>
                                        <th className="p-3 text-right">실 근무시간</th>
                                        <th className="p-3 text-right">연장시간</th>
                                        <th className="p-3 text-right pr-4">실적 급여(세전)</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-3 text-right">실적 총액</th>
                                        <th className="p-3 text-right text-[#a65d57]">3.3% 공제</th>
                                        <th className="p-3 text-right pr-4">실지급액</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-[#ebe8db]">
                            {filteredUsers.map(user => {
                                const wage = calculateMonthlyWage(user, payrollMonth);
                                return (
                                    <tr key={user.id} className="hover:bg-[#f4f5eb] transition-colors">
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 flex items-center justify-center bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold">{user.name[0]}</div>
                                                <div><p className="font-bold text-[#3d472f]">{user.name}</p><p className="text-xs text-[#9a9585]">{user.team}</p></div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <p className="font-bold text-[#5a5545]">{user.bank}</p>
                                            <p className="text-xs text-[#7a7565] font-mono">{user.account}</p>
                                        </td>
                                        {mode === 'INSURED' ? (
                                            <>
                                                <td className="p-3 text-center text-[#5a5545]">{user.workDays}</td>
                                                <td className="p-3 text-right text-[#5a5545]">{wage.hasRecord ? `${wage.totalActualHours}h` : '-'}</td>
                                                <td className="p-3 text-right text-[#a65d57] font-bold">{wage.hasRecord && wage.totalActualOvertime > 0 ? `+${wage.totalActualOvertime}h` : '-'}</td>
                                                <td className="p-3 text-right pr-4 font-bold text-[#5d6c4a]">{wage.hasRecord ? `₩${wage.actual.toLocaleString()}` : '-'}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-3 text-right text-[#5a5545]">{wage.hasRecord ? `₩${wage.actual.toLocaleString()}` : '-'}</td>
                                                <td className="p-3 text-right text-[#a65d57]">{wage.hasRecord ? `₩${wage.strictDeduction.toLocaleString()}` : '-'}</td>
                                                <td className="p-3 text-right pr-4 font-black text-[#3d472f]">{wage.hasRecord ? `₩${wage.strictFinalPayout.toLocaleString()}` : '-'}</td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan={6} className="p-10 text-center text-[#9a9585] text-sm">해당 유형의 대상자가 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-[#e8ebd8] p-4 border-2 border-[#b8c4a0] text-xs text-[#5d6c4a] flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {mode === 'INSURED' ? (
                    <p><strong>노무사 전달 안내:</strong> 4대보험 가입자는 위 <strong>실제 근무 기록</strong>을 바탕으로 산출된 급여 내역입니다. 상단의 '엑셀 다운로드'를 통해 근무 기록을 노무사에게 전달하여 <strong>최종 확정 급여</strong>를 산출받으세요.</p>
                ) : (
                    <p><strong>본사 지급 안내:</strong> 3.3% 공제 대상자는 <strong>실제 근무 기록</strong>을 기준으로 산출된 <strong>실지급액</strong>입니다. 근무 기록이 없는 경우 0원으로 표시됩니다. '지급 요청용 엑셀'을 다운로드하여 재무팀에 전달하세요.</p>
                )}
            </div>
        </div>
    );
}
