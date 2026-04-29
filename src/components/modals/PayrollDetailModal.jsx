import React, { useMemo } from 'react';
import { X, Calendar, Clock, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function PayrollDetailModal({ user, wage, payrollMonth, onClose }) {
    const breakdown = wage?.dailyBreakdown || [];
    const hasRecord = wage?.hasRecord;

    const summary = useMemo(() => {
        const worked = breakdown.filter(d => d.checkIn && d.checkOut);
        const absent = breakdown.filter(d => d.reason?.includes('결근'));
        const leave = breakdown.filter(d => d.reason?.includes('연차'));
        return { worked: worked.length, absent: absent.length, leave: leave.length };
    }, [breakdown]);

    const getDayLabel = (dateStr) => {
        const d = new Date(dateStr);
        return DAY_NAMES[d.getDay()];
    };

    const getDayColor = (dateStr, reason) => {
        const dow = new Date(dateStr).getDay();
        if (reason?.includes('결근')) return 'text-[#8d5a4d]';
        if (reason?.includes('연차')) return 'text-[#5d6c4a]';
        if (dow === 0 || dow === 6) return 'text-[#9a9585]';
        return 'text-[#3d472f]';
    };

    const getRowBg = (dateStr, reason) => {
        if (reason?.includes('결근')) return 'bg-[#fdf4f3]';
        if (reason?.includes('연차')) return 'bg-[#f0f4e8]';
        return '';
    };

    const [ty, tm] = payrollMonth.split('-');

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] w-full max-w-2xl max-h-[90vh] flex flex-col border-2 border-[#3d472f] shadow-2xl">
                {/* Header */}
                <div className="bg-[#5d6c4a] p-4 border-b-2 border-[#3d472f] flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-[#f5f3e8] flex items-center gap-2">
                            <Calendar size={18} />
                            {user.name} — {ty}년 {parseInt(tm)}월 급여 상세
                        </h2>
                        <p className="text-[#d4dcc0] text-xs mt-0.5">{user.team} | 시급 ₩{(user.wage || 0).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={22} /></button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-0 border-b border-[#d4cfbf] shrink-0">
                    <div className="p-3 text-center border-r-2 border-[#c5c0b0]">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">근무일수</p>
                        <p className="text-xl font-black text-[#3d472f]">{summary.worked}일</p>
                    </div>
                    <div className="p-3 text-center border-r-2 border-[#c5c0b0]">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">실 근무시간</p>
                        <p className="text-xl font-black text-[#3d472f]">{Math.round((wage?.totalActualHours || 0) * 10) / 10}h</p>
                    </div>
                    <div className="p-3 text-center">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">연장시간</p>
                        <p className="text-xl font-black text-[#8d5a4d]">+{Math.round((wage?.totalActualOvertime || 0) * 10) / 10}h</p>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {!hasRecord ? (
                        <div className="flex flex-col items-center justify-center h-40 text-[#9a9585]">
                            <AlertCircle size={32} className="mb-2 opacity-40" />
                            <p className="text-sm">이 달의 근무 기록이 없습니다</p>
                            <p className="text-xs mt-1">계약 기본값 기준 예상 급여입니다</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf]">
                                <tr>
                                    <th className="p-2.5 text-left font-bold text-[#5d6c4a] uppercase">날짜</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">출근</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">퇴근</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">실근무</th>
                                    <th className="p-2.5 text-center font-bold text-[#8d5a4d] uppercase">연장</th>
                                    <th className="p-2.5 text-right font-bold text-[#5d6c4a] uppercase pr-4">일급</th>
                                    <th className="p-2.5 text-left font-bold text-[#5d6c4a] uppercase">비고</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ebe8db]">
                                {breakdown.map(row => {
                                    const isDefault = !row.isRecorded && row.checkIn;
                                    const dimText = isDefault ? 'text-[#b0aa98]' : 'text-[#5a5545]';
                                    const dimBold = isDefault ? 'text-[#b0aa98]' : 'text-[#3d472f]';
                                    return (
                                    <tr key={row.date} className={`hover:bg-[#f0f2e4] transition-colors ${getRowBg(row.date, row.reason)}`}>
                                        <td className={`p-2.5 font-bold ${getDayColor(row.date, row.reason)}`}>
                                            {row.date.slice(5)} ({getDayLabel(row.date)})
                                        </td>
                                        <td className={`p-2.5 text-center ${dimText} font-mono`}>
                                            {row.checkIn || <span className="text-[#c5c0b0]">—</span>}
                                        </td>
                                        <td className={`p-2.5 text-center ${dimText} font-mono`}>
                                            {row.checkOut || <span className="text-[#c5c0b0]">—</span>}
                                        </td>
                                        <td className={`p-2.5 text-center ${dimText}`}>
                                            {row.hours > 0 ? `${row.hours}h` : <span className="text-[#c5c0b0]">—</span>}
                                        </td>
                                        <td className="p-2.5 text-center">
                                            {row.overtimeHours > 0
                                                ? <span className="text-[#8d5a4d] font-bold">+{row.overtimeHours}h</span>
                                                : <span className="text-[#c5c0b0]">—</span>}
                                        </td>
                                        <td className={`p-2.5 text-right pr-4 font-bold ${dimBold}`}>
                                            {row.basePay > 0 ? `₩${row.basePay.toLocaleString()}` : <span className="text-[#c5c0b0]">—</span>}
                                        </td>
                                        <td className="p-2.5 text-[#7a7565]">
                                            {isDefault && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold border bg-[#f5f3e8] text-[#b0aa98] border-[#d4d0c4]">기본</span>
                                            )}
                                            {row.reason && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${row.reason.includes('결근') ? 'bg-[#f5ebe7] text-[#8d5a4d] border-[#cba79c]' :
                                                        row.reason.includes('연차') ? 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]' :
                                                            'bg-[#e8e4d4] text-[#7a7565] border-[#c5c0b0]'
                                                    }`}>
                                                    {row.reason}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer: formula summary */}
                <div className="border-t border-[#d4cfbf] bg-[#faf8f0] p-4 shrink-0">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#5a5545]">
                            <span>기본급+연장</span>
                            <span className="bg-[#e8e4d4] px-2 py-0.5 font-mono">₩{(wage?.actualBasePayOnly || 0).toLocaleString()}</span>
                        </div>
                        <ChevronRight size={14} className="text-[#9a9585]" />
                        <div className="flex items-center gap-1.5 font-bold text-[#5d6c4a]">
                            <TrendingUp size={13} />
                            <span>주휴수당</span>
                            <span className="bg-[#e8ebd8] px-2 py-0.5 font-mono">+₩{(wage?.actualHolidayPay || 0).toLocaleString()}</span>
                        </div>
                        <ChevronRight size={14} className="text-[#9a9585]" />
                        <div className="flex items-center gap-1.5 font-black text-[#3d472f] text-sm">
                            <span>세전 합계</span>
                            <span className="bg-[#5d6c4a] text-[#f5f3e8] px-3 py-0.5 font-mono">₩{(wage?.actual || 0).toLocaleString()}</span>
                        </div>
                        {!user.insuranceStatus && (
                            <>
                                <ChevronRight size={14} className="text-[#9a9585]" />
                                <div className="flex items-center gap-1.5 font-bold text-[#8d5a4d]">
                                    <span>3.3% 공제</span>
                                    <span className="bg-[#f5ebe7] text-[#8d5a4d] px-2 py-0.5 font-mono border border-[#cba79c]">-₩{(wage?.strictDeduction || 0).toLocaleString()}</span>
                                </div>
                                <ChevronRight size={14} className="text-[#9a9585]" />
                                <div className="flex items-center gap-1.5 font-black text-[#3d472f] text-sm">
                                    <span>실지급액</span>
                                    <span className="bg-[#3d472f] text-[#f5f3e8] px-3 py-0.5 font-mono">₩{(wage?.strictFinalPayout || 0).toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                    {wage?.weeklyLogsList?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#e8e4d4]">
                            <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-2 flex items-center gap-1"><Clock size={11} /> 주차별 주휴수당 근거</p>
                            <div className="flex flex-wrap gap-2">
                                {wage.weeklyLogsList.map((w, i) => (
                                    <div key={i} className="bg-[#e8e4d4] border border-[#c5c0b0] px-2 py-1 text-[10px]">
                                        <span className="font-bold text-[#5d6c4a]">{w.weekStr}</span>
                                        <span className="text-[#7a7565] ml-2">{Math.round(w.totalHours * 10) / 10}h</span>
                                        {w.holidayPay > 0 && <span className="text-[#5d6c4a] font-bold ml-2">+₩{w.holidayPay.toLocaleString()}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
