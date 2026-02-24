import React, { useState, useRef } from 'react';
import { Calendar, Upload, Download, X, ChevronLeft, ChevronRight, Edit, AlertTriangle } from 'lucide-react';

export default function CalendarModal({ user, onClose, attendance, onSave, calculateWage, onFileUpload }) {
    const [viewDate, setViewDate] = useState(() => {
        const dates = Object.keys(attendance);
        if (dates.length > 0) {
            dates.sort();
            const lastDate = new Date(dates[dates.length - 1]);
            if (!isNaN(lastDate.getTime())) return new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
        }
        return new Date();
    });
    const [activeDate, setActiveDate] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({ checkIn: user.checkIn, checkOut: user.checkOut, overtime: 0, reason: '', earlyLeaveReason: '', overtimeReason: '' });
    const [calendarViewMode, setCalendarViewMode] = useState('TIME');
    const modalFileInputRef = useRef(null);

    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const daysInMonthCount = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

    const moveMonth = (offset) => {
        setViewDate(new Date(viewYear, viewMonth + offset, 1));
        setEditMode(false);
        setActiveDate(null);
    };

    const normalizeForInput = (timeStr) => {
        if (!timeStr) return '';
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) { const [h, m] = timeStr.split(':'); return `${h.padStart(2, '0')}:${m}`; }
        if (timeStr.includes('시')) { const clean = timeStr.replace(/[^0-9]/g, ''); return `${clean.padStart(2, '0')}:00`; }
        return timeStr;
    };

    const handleDayClick = (day) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setActiveDate(dateStr);
        const existing = attendance[dateStr] || { checkIn: user.checkIn, checkOut: user.checkOut, overtime: 0, reason: '', earlyLeaveReason: '', overtimeReason: '' };
        setForm({ ...existing, checkIn: normalizeForInput(existing.checkIn), checkOut: normalizeForInput(existing.checkOut), earlyLeaveReason: existing.earlyLeaveReason || '', overtimeReason: existing.overtimeReason || '' });
        setEditMode(true);
    };

    const handleSave = () => { onSave(activeDate, form); setEditMode(false); };

    const handleDownloadPersonal = () => {
        const headers = ["이름", "날짜", "출근", "퇴근", "연장", "사유"];
        const rows = Object.entries(attendance).map(([date, record]) => [user.name, date, record.checkIn, record.checkOut, record.overtime, record.reason]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${user.name}_근태기록.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const estimatedDaily = calculateWage(user.wage, form.checkIn, form.checkOut, form.overtime);
    const totalDailyPay = estimatedDaily.basePay + estimatedDaily.overtimePay;
    const isEarlyLeave = form.checkOut < user.checkOut;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-[#3d472f]">
                <div className="p-4 bg-[#5d6c4a] text-[#f5f3e8] flex justify-between items-center border-b-2 border-[#3d472f]">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2"><Calendar size={20} /> ▶ {user.name} 근태 캘린더</h3>
                        <p className="text-[#d4dcc0] text-xs mt-0.5">[ 계약: {user.checkIn}~{user.checkOut} (휴게 1H 공제) ]</p>
                    </div>
                    <div className="flex gap-2">
                        <input type="file" ref={modalFileInputRef} onChange={onFileUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                        <button onClick={() => modalFileInputRef.current.click()} className="bg-[#f5f3e8] hover:bg-[#e8e4d4] px-3 py-1.5 flex items-center gap-1 text-xs border-2 border-[#3d472f] text-[#3d472f] font-bold"><Upload size={14} /> 업로드</button>
                        <button onClick={handleDownloadPersonal} className="bg-[#f5f3e8] hover:bg-[#e8e4d4] px-3 py-1.5 flex items-center gap-1 text-xs border-2 border-[#3d472f] text-[#3d472f] font-bold"><Download size={14} /> 다운로드</button>
                        <button onClick={onClose} className="bg-[#f5f3e8] hover:bg-[#e8e4d4] p-1.5 border-2 border-[#3d472f] text-[#3d472f]"><X size={18} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#e8e4d4]">
                    <div className="md:col-span-2 bg-[#f5f3e8] p-4 border-2 border-[#c5c0b0]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => moveMonth(-1)} className="p-1 hover:bg-[#e8e4d4] text-[#5a5545] border border-[#c5c0b0]"><ChevronLeft size={20} /></button>
                                <h2 className="text-lg font-black text-[#3d472f] tracking-tight">{viewYear}.{String(viewMonth + 1).padStart(2, '0')}</h2>
                                <button onClick={() => moveMonth(1)} className="p-1 hover:bg-[#e8e4d4] text-[#5a5545] border border-[#c5c0b0]"><ChevronRight size={20} /></button>
                            </div>
                            <div className="flex bg-[#e8e4d4] p-1 border-2 border-[#c5c0b0]">
                                <button onClick={() => setCalendarViewMode('TIME')} className={`px-3 py-1 text-xs font-bold ${calendarViewMode === 'TIME' ? 'bg-[#f5f3e8] text-[#5d6c4a]' : 'text-[#7a7565]'}`}>시간</button>
                                <button onClick={() => setCalendarViewMode('MONEY')} className={`px-3 py-1 text-xs font-bold ${calendarViewMode === 'MONEY' ? 'bg-[#f5f3e8] text-[#5d6c4a]' : 'text-[#7a7565]'}`}>금액</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-[#c5c0b0] border-2 border-[#c5c0b0]">
                            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={`text-center py-2 text-xs font-bold bg-[#e8e4d4] ${i === 0 ? 'text-[#a65d57]' : i === 6 ? 'text-[#4a6070]' : 'text-[#5a5545]'}`}>{d}</div>)}
                            {Array.from({ length: new Date(viewYear, viewMonth, 1).getDay() }).map((_, i) => (<div key={`empty-${i}`} className="h-24 bg-[#faf8f0]"></div>))}
                            {daysInMonth.map(day => {
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const hasData = attendance[dateStr];
                                const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
                                const isToday = isCurrentMonth && today.getDate() === day;
                                const displayCheckIn = hasData ? hasData.checkIn : '';
                                const displayCheckOut = hasData ? hasData.checkOut : '';
                                const displayOvertime = hasData?.overtime || 0;
                                let totalDailyHours = 0, regularHours = 0, dailyWageAmount = 0;
                                const isEarly = hasData && hasData.checkOut && hasData.checkOut < user.checkOut;
                                if (displayCheckIn && displayCheckOut) {
                                    let currentDailyWage = user.wage;
                                    if (user.wageIncreaseDate && user.previousWage && new Date(dateStr) < new Date(user.wageIncreaseDate)) {
                                        currentDailyWage = user.previousWage;
                                    }

                                    const dailyCalc = calculateWage(currentDailyWage, displayCheckIn, displayCheckOut, displayOvertime);
                                    totalDailyHours = dailyCalc.hours; regularHours = dailyCalc.regularHours;
                                    dailyWageAmount = dailyCalc.basePay + dailyCalc.overtimePay;
                                }
                                // 사유 뱃지 생성
                                const badges = [];
                                if (hasData?.reason) {
                                    const r = hasData.reason;
                                    const isAbsence = r.includes('결근');
                                    const isLeave = r.includes('연차');
                                    const color = isAbsence ? 'bg-[#a65d57] text-white' : isLeave ? 'bg-[#4a6070] text-white' : 'bg-[#c65911] text-white';
                                    badges.push({ label: r.length > 4 ? r.substring(0, 4) : r, color });
                                }
                                if (isEarly && hasData?.earlyLeaveReason) {
                                    badges.push({ label: `조퇴:${hasData.earlyLeaveReason.length > 3 ? hasData.earlyLeaveReason.substring(0, 3) : hasData.earlyLeaveReason}`, color: 'bg-[#c65911] text-white' });
                                } else if (isEarly && !hasData?.reason) {
                                    badges.push({ label: '조기퇴근', color: 'bg-[#c65911] text-white' });
                                }
                                if (hasData?.overtimeReason) {
                                    badges.push({ label: `연장:${hasData.overtimeReason.length > 3 ? hasData.overtimeReason.substring(0, 3) : hasData.overtimeReason}`, color: 'bg-[#4a6070] text-white' });
                                }
                                return (
                                    <button key={day} onClick={() => handleDayClick(day)} className={`h-24 p-1.5 text-left transition relative flex flex-col justify-between bg-[#f5f3e8] hover:bg-[#e8ebd8] ${isToday ? 'ring-2 ring-inset ring-[#5d6c4a]' : ''} ${hasData ? 'bg-[#f4f5eb]' : ''} ${activeDate === dateStr ? 'bg-[#e8ebd8] ring-2 ring-inset ring-[#5d6c4a]' : ''}`}>
                                        <div className="flex justify-between items-start w-full">
                                            <span className={`text-xs font-bold ${dayOfWeek === 0 ? 'text-[#a65d57]' : (dayOfWeek === 6 ? 'text-[#4a6070]' : 'text-[#7a7565]')} ${isToday ? '!text-[#5d6c4a]' : ''}`}>{day}</span>
                                            {badges.length > 0 && <div className="flex flex-col gap-px">{badges.map((b, i) => <span key={i} className={`${b.color} text-[7px] font-bold px-1 py-px leading-tight truncate max-w-[60px]`}>{b.label}</span>)}</div>}
                                        </div>
                                        <div className="w-full flex flex-col gap-0.5 mt-auto">
                                            {(displayCheckIn && displayCheckOut) && (
                                                calendarViewMode === 'TIME' ? (
                                                    <div className="text-[10px] font-medium text-[#5a5545] space-y-0.5 leading-tight">
                                                        <div className="flex justify-between"><span>IN</span> <span className="font-bold">{displayCheckIn}</span></div>
                                                        <div className="flex justify-between"><span>OUT</span> <span className="font-bold">{displayCheckOut}</span></div>
                                                        {totalDailyHours > 0 && (<div className="text-right text-[#5d6c4a] font-bold border-t border-[#ebe8db] pt-0.5 mt-0.5">{regularHours}h {displayOvertime > 0 && <span className="text-[#a65d57]">+{displayOvertime}</span>}</div>)}
                                                    </div>
                                                ) : (
                                                    <div className="w-full text-right">
                                                        <div className="text-sm font-black text-[#5d6c4a] -tracking-wide">₩{dailyWageAmount.toLocaleString()}</div>
                                                        {displayOvertime > 0 && <div className="text-[8px] text-[#a65d57] font-bold">특근포함</div>}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="bg-[#f5f3e8] p-5 border-2 border-[#c5c0b0] flex flex-col h-full">
                        <h4 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2 pb-2 border-b-2 border-[#e8e4d4]"><Edit size={16} className="text-[#5d6c4a]" /> 상세 기록 관리</h4>
                        {editMode ? (
                            <div className="space-y-4 flex-1 flex flex-col">
                                <div className="bg-[#e8e4d4] p-3 border-2 border-[#c5c0b0]">
                                    <p className="text-sm font-bold text-[#5d6c4a] flex justify-between items-center mb-2"><span>{activeDate}</span><span className="text-[10px] bg-[#d4dcc0] px-2 py-0.5">Editing</span></p>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div><label className="text-[10px] font-bold text-[#7a7565]">출근</label><input type="time" className="w-full p-1.5 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} /></div>
                                        <div><label className="text-[10px] font-bold text-[#7a7565]">퇴근</label><input type="time" className="w-full p-1.5 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} /></div>
                                    </div>
                                    {isEarlyLeave && <p className="text-[10px] text-[#a65d57] font-medium flex items-center gap-1 mb-2"><AlertTriangle size={10} /> 조기 퇴근</p>}
                                    <div className="mb-2">
                                        <label className="text-[10px] font-bold text-[#7a7565]">연장근무 (시간)</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" step="0.5" className="flex-1 p-1.5 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" value={isNaN(form.overtime) ? '' : form.overtime} onChange={e => setForm({ ...form, overtime: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                                            <span className="text-[10px] text-[#7a7565]">x1.5</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div><label className="text-[10px] font-bold text-[#7a7565]">근태 사유</label><input type="text" className="w-full p-1.5 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" placeholder="결근 / 연차 / 공휴일 등" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
                                        {isEarlyLeave && <div><label className="text-[10px] font-bold text-[#c65911]">조기퇴근 사유</label><input type="text" className="w-full p-1.5 border-2 border-[#c65911]/30 bg-[#f5f3e8] text-sm focus:border-[#c65911] outline-none" placeholder="병원진료, 개인사유 등" value={form.earlyLeaveReason} onChange={e => setForm({ ...form, earlyLeaveReason: e.target.value })} /></div>}
                                        {form.overtime > 0 && <div><label className="text-[10px] font-bold text-[#4a6070]">연장근무 사유</label><input type="text" className="w-full p-1.5 border-2 border-[#4a6070]/30 bg-[#f5f3e8] text-sm focus:border-[#4a6070] outline-none" placeholder="긴급 출하, 재고 정리 등" value={form.overtimeReason} onChange={e => setForm({ ...form, overtimeReason: e.target.value })} /></div>}
                                    </div>
                                </div>
                                <div className="mt-auto pt-4 space-y-2 border-t-2 border-[#e8e4d4]">
                                    <div className="flex justify-between text-xs text-[#7a7565]"><span>기본급 ({estimatedDaily.regularHours}h)</span><span>₩{estimatedDaily.basePay.toLocaleString()}</span></div>
                                    {form.overtime > 0 && (<div className="flex justify-between text-xs text-[#5d6c4a] font-bold"><span>특근수당 ({estimatedDaily.actualOvertime}h)</span><span>+ ₩{estimatedDaily.overtimePay.toLocaleString()}</span></div>)}
                                    <div className="flex justify-between text-base font-black pt-2 border-t-2 border-[#c5c0b0]"><span>합계</span><span className="text-[#5d6c4a]">₩{totalDailyPay.toLocaleString()}</span></div>
                                    <button onClick={handleSave} className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold hover:bg-[#4a5639] border-2 border-[#3d472f] mt-2">저장하기</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-[#9a9585] text-sm flex flex-col items-center justify-center h-full"><Calendar size={48} className="mb-4 text-[#c5c0b0]" /><p>날짜를 클릭하여<br />근무 기록을 수정하세요.</p></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
