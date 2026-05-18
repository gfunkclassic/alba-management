import React, { useMemo } from 'react';
import { X, Calendar, Clock, TrendingUp, AlertCircle, ChevronRight, Printer } from 'lucide-react';

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
    const weeklyLogs = wage?.weeklyLogsList || [];
    const isNonInsured = !user.insuranceStatus;
    const won = (v) => `₩${Number(v || 0).toLocaleString()}`;

    return (
        <>
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4 print:hidden">
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
                    <div className="flex items-center gap-2 print:hidden">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#5d6c4a] bg-[#d4dcc0] hover:bg-[#e8ecd8] border border-[#3d472f]"
                        >
                            <Printer size={14} /> 출력
                        </button>
                        <button onClick={onClose} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={22} /></button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-0 border-b border-[#d4cfbf] shrink-0">
                    <div className="p-3 text-center border-r-2 border-[#c5c0b0]">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">근무일수</p>
                        <p className="text-xl font-black text-[#3d472f]">{summary.worked}일</p>
                    </div>
                    <div className="p-3 text-center border-r-2 border-[#c5c0b0]">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">급여 인정시간</p>
                        <p className="text-xl font-black text-[#3d472f]">{Math.round((wage?.totalRegularHours ?? wage?.totalActualHours ?? 0) * 10) / 10}h</p>
                    </div>
                    <div className="p-3 text-center">
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase mb-1">연장시간</p>
                        <p className="text-xl font-black text-[#8d5a4d]">+{Math.round((wage?.totalActualOvertime || 0) * 10) / 10}h</p>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto print:overflow-visible print:max-h-none print:flex-none">
                    {!hasRecord ? (
                        <div className="flex flex-col items-center justify-center h-40 text-[#9a9585]">
                            <AlertCircle size={32} className="mb-2 opacity-40" />
                            <p className="text-sm">이 달의 근무 기록이 없습니다</p>
                            <p className="text-xs mt-1">계약 기본값 기준 예상 급여입니다</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] print:static">
                                <tr>
                                    <th className="p-2.5 text-left font-bold text-[#5d6c4a] uppercase">날짜</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">출근</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">퇴근</th>
                                    <th className="p-2.5 text-center font-bold text-[#5d6c4a] uppercase">급여인정</th>
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
                                            {(row.regularHours ?? row.hours ?? 0) > 0 ? `${row.regularHours ?? row.hours}h` : <span className="text-[#c5c0b0]">—</span>}
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

        {/* ───── 인쇄 전용 A4 급여명세서 (화면 비표시) ───── */}
        <div data-print-payslip className="hidden print:block text-[#222] text-[8px] leading-tight">
            <h1 className="text-center text-[14px] font-bold mb-1">{ty}. {parseInt(tm)}월 급여명세서</h1>

            {/* 상단: 직원정보 + 급여요약 압축 */}
            <table className="w-full border-collapse mb-1">
                <tbody>
                    <tr>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">이름</td><td className="border border-[#999] px-1 py-[1px]">{user.name}</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">부서</td><td className="border border-[#999] px-1 py-[1px]">{user.team || ''}</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">급여월</td><td className="border border-[#999] px-1 py-[1px]">{ty}. {parseInt(tm)}월</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">시급</td><td className="border border-[#999] px-1 py-[1px]">{won(user.wage)}</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">입사일</td><td className="border border-[#999] px-1 py-[1px]">{user.startDate || '-'}</td>
                    </tr>
                    <tr>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">근무일수</td><td className="border border-[#999] px-1 py-[1px]">{summary.worked}일</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">총 근무시간</td><td className="border border-[#999] px-1 py-[1px]">{Math.round((wage?.totalRegularHours ?? wage?.totalActualHours ?? 0) * 10) / 10}h</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">야근시간</td><td className="border border-[#999] px-1 py-[1px]">{Math.round((wage?.totalActualOvertime || 0) * 10) / 10}h</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">총 급여</td><td className="border border-[#999] px-1 py-[1px] font-bold" colSpan={3}>{won(wage?.actual)}</td>
                    </tr>
                    <tr>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">일반급여</td><td className="border border-[#999] px-1 py-[1px]">{won(wage?.baseOnlyPay)}</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">야근수당</td><td className="border border-[#999] px-1 py-[1px]">{won(wage?.totalOvertimePay)}</td>
                        <td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">주휴수당</td><td className="border border-[#999] px-1 py-[1px]">{won(wage?.actualHolidayPay)}</td>
                        {isNonInsured
                            ? <><td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">3.3% 공제</td><td className="border border-[#999] px-1 py-[1px]">-{won(wage?.strictDeduction)}</td><td className="border border-[#999] bg-[#eee] px-1 py-[1px] font-bold">실지급액</td><td className="border border-[#999] px-1 py-[1px] font-bold">{won(wage?.strictFinalPayout)}</td></>
                            : <td className="border border-[#999]" colSpan={4}></td>}
                    </tr>
                </tbody>
            </table>

            {/* 주차별 주휴수당 요약 (압축) */}
            {weeklyLogs.length > 0 && (
                <table className="w-full border-collapse mb-1">
                    <thead>
                        <tr className="bg-[#eee]"><th className="border border-[#999] px-1 py-[1px] text-left" colSpan={4}>주차별 주휴수당</th></tr>
                        <tr className="bg-[#f3f3f3]">
                            <th className="border border-[#999] px-1 py-[1px]">주차</th>
                            <th className="border border-[#999] px-1 py-[1px]">총시간</th>
                            <th className="border border-[#999] px-1 py-[1px]">근무일</th>
                            <th className="border border-[#999] px-1 py-[1px]">주휴수당</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeklyLogs.map((w, i) => (
                            <tr key={i}>
                                <td className="border border-[#ccc] px-1 py-[1px] text-center">{w.weekStr}</td>
                                <td className="border border-[#ccc] px-1 py-[1px] text-center">{Math.round(w.totalHours * 10) / 10}h</td>
                                <td className="border border-[#ccc] px-1 py-[1px] text-center">{w.daysWorked}일</td>
                                <td className="border border-[#ccc] px-1 py-[1px] text-right">{w.holidayPay > 0 ? won(w.holidayPay) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* 상세 근무 내역 (전체 폭) */}
            <p className="font-bold mb-0.5">상세 근무 내역</p>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-[#eee]">
                        <th className="border border-[#999] px-1 py-[0.5px] text-center w-[14%]">날짜</th>
                        <th className="border border-[#999] px-1 py-[0.5px] text-center w-[8%]">요일</th>
                        <th className="border border-[#999] px-1 py-[0.5px] text-center w-[12%]">근무</th>
                        <th className="border border-[#999] px-1 py-[0.5px] text-center w-[12%]">야근</th>
                        <th className="border border-[#999] px-1 py-[0.5px] text-left">비고</th>
                    </tr>
                </thead>
                <tbody>
                    {breakdown.map(row => (
                        <tr key={row.date}>
                            <td className="border border-[#ccc] px-1 py-[0.5px] text-center">{row.date.slice(5)}</td>
                            <td className="border border-[#ccc] px-1 py-[0.5px] text-center">{getDayLabel(row.date)}</td>
                            <td className="border border-[#ccc] px-1 py-[0.5px] text-center">{(row.regularHours ?? row.hours ?? 0) > 0 ? `${row.regularHours ?? row.hours}h` : '-'}</td>
                            <td className="border border-[#ccc] px-1 py-[0.5px] text-center">{row.overtimeHours > 0 ? `${row.overtimeHours}h` : '-'}</td>
                            <td className="border border-[#ccc] px-1 py-[0.5px]">{row.reason || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mt-1 text-[7.5px] text-[#555]">※ 주휴수당은 주차별 근무 기준에 따라 산정되었습니다.</p>
        </div>
        </>
    );
}
