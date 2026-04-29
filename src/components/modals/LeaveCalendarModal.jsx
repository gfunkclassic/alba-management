import React, { useState } from 'react';
import { Sun, X, ChevronLeft, ChevronRight, Edit } from 'lucide-react';

// 연차 유형 설정 — value, label, 환산 일수, 색상
const LEAVE_TYPES = [
    { value: '연차', label: '연차 (1일)', days: 1, color: 'bg-[#5d6c4a] text-[#f5f3e8]' },
    { value: '반차(오전)', label: '반차 — 오전 (0.5일)', days: 0.5, color: 'bg-[#5a6878] text-[#f5f3e8]' },
    { value: '반차(오후)', label: '반차 — 오후 (0.5일)', days: 0.5, color: 'bg-[#5a6878] text-[#f5f3e8]' },
    { value: '시간차', label: '시간차 (직접 입력)', days: null, color: 'bg-[#c65911] text-[#f5f3e8]' },
    { value: '결근', label: '결근', days: 0, color: 'bg-[#8d5a4d] text-[#f5f3e8]' },
];

// 유형에 따른 배지 색상
const getBadgeColor = (type) => {
    const t = LEAVE_TYPES.find(lt => lt.value === type);
    return t ? t.color : 'bg-[#7a7565] text-[#f5f3e8]';
};

export default function LeaveCalendarModal({ users, leaveRecords, onClose, onAddLeave, onDeleteLeave }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedUser, setSelectedUser] = useState('');
    const [leaveType, setLeaveType] = useState('연차');
    const [hoursInput, setHoursInput] = useState(1); // 시간차 입력용

    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

    const moveMonth = (offset) => { setViewDate(new Date(viewYear, viewMonth + offset, 1)); setSelectedDate(null); };
    const handleDayClick = (day) => { setSelectedDate(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); };

    const handleAddLeave = () => {
        if (selectedDate && selectedUser) {
            // 시간차는 "시간차(Xh)" 형태로 저장
            const typeToSave = leaveType === '시간차' ? `시간차(${hoursInput}h)` : leaveType;
            onAddLeave(selectedUser, selectedDate, typeToSave);
            setSelectedUser('');
        }
    };

    // 해당 날짜에 연차 사용한 직원 목록
    const getLeavesForDate = (dateStr) => {
        return Object.entries(leaveRecords).flatMap(([userId, records]) => {
            const user = users.find(u => u.id === parseInt(userId));
            return Object.entries(records)
                .filter(([date]) => date === dateStr)
                .map(([date, type]) => ({ userId: parseInt(userId), userName: user?.name || '알수없음', type, date }));
        });
    };

    // 연차 유형 → 일수 환산
    const calcDays = (type, hours = 1) => {
        if (type?.startsWith('시간차')) {
            const match = type.match(/(\d+\.?\d*)h/);
            return match ? Math.round((parseFloat(match[1]) / 8) * 10) / 10 : 0;
        }
        const t = LEAVE_TYPES.find(lt => lt.value === type);
        return t?.days ?? 1;
    };

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-[#3d472f]">
                <div className="p-4 bg-[#5d6c4a] text-[#f5f3e8] flex justify-between items-center border-b-2 border-[#3d472f]">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2"><Sun size={20} /> ▶ 연차 사용 캘린더</h3>
                        <div className="flex gap-3 mt-1">
                            {LEAVE_TYPES.map(lt => (
                                <span key={lt.value} className={`text-[9px] px-1.5 py-0.5 font-bold ${lt.color}`}>{lt.value}{lt.days !== null ? ` (${lt.days}일)` : ''}</span>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-[#f5f3e8] hover:bg-[#f5f3e8] p-1.5 border-2 border-[#3d472f] text-[#3d472f]"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#e8e4d4]">
                    {/* Calendar */}
                    <div className="md:col-span-2 bg-[#f5f3e8] p-4 border border-[#d4cfbf]">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => moveMonth(-1)} className="p-1 hover:bg-[#f5f3e8] text-[#5a5545] border border-[#c5c0b0]"><ChevronLeft size={20} /></button>
                            <h2 className="text-lg font-black text-[#3d472f] tracking-tight">{viewYear}.{String(viewMonth + 1).padStart(2, '0')}</h2>
                            <button onClick={() => moveMonth(1)} className="p-1 hover:bg-[#f5f3e8] text-[#5a5545] border border-[#c5c0b0]"><ChevronRight size={20} /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-[#c5c0b0] border border-[#d4cfbf]">
                            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (<div key={d} className={`text-center py-2 text-xs font-bold bg-[#e8e4d4] ${i === 0 ? 'text-[#8d5a4d]' : i === 6 ? 'text-[#5a6878]' : 'text-[#5a5545]'}`}>{d}</div>))}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (<div key={`empty-${i}`} className="h-20 bg-[#faf8f0]"></div>))}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
                                const isToday = isCurrentMonth && today.getDate() === day;
                                const leavesOnDay = getLeavesForDate(dateStr);
                                return (
                                    <button key={day} onClick={() => handleDayClick(day)} className={`h-20 p-1 text-left transition relative flex flex-col bg-[#f5f3e8] hover:bg-[#e8ebd8] ${isToday ? 'ring-2 ring-inset ring-[#5d6c4a]' : ''} ${selectedDate === dateStr ? 'bg-[#e8ebd8] ring-2 ring-inset ring-[#5d6c4a]' : ''}`}>
                                        <span className={`text-xs font-bold ${dayOfWeek === 0 ? 'text-[#8d5a4d]' : (dayOfWeek === 6 ? 'text-[#5a6878]' : 'text-[#7a7565]')} ${isToday ? '!text-[#5d6c4a]' : ''}`}>{day}</span>
                                        <div className="flex-1 overflow-y-auto mt-1 space-y-0.5">
                                            {leavesOnDay.slice(0, 3).map((leave, idx) => (
                                                <div key={idx} className={`text-[8px] px-1 py-0.5 truncate font-bold ${getBadgeColor(leave.type)}`}>
                                                    {leave.userName} <span className="opacity-80">{leave.type?.startsWith('반차') ? '반' : leave.type?.startsWith('시간차') ? '시' : ''}</span>
                                                </div>
                                            ))}
                                            {leavesOnDay.length > 3 && <div className="text-[9px] text-[#7a7565] font-bold">+{leavesOnDay.length - 3}명</div>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="bg-[#f5f3e8] p-5 border border-[#d4cfbf] flex flex-col">
                        <h4 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2 pb-2 border-b-2 border-[#e8e4d4]"><Edit size={16} className="text-[#5d6c4a]" /> 연차 등록</h4>
                        {selectedDate ? (
                            <div className="space-y-3 flex-1 flex flex-col">
                                <div className="bg-[#e8e4d4] p-3 border border-[#d4cfbf]"><p className="text-sm font-bold text-[#5d6c4a]">{selectedDate}</p></div>

                                {/* 직원 선택 */}
                                <div>
                                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">직원 선택</label>
                                    <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full p-2 border border-[#d4cfbf] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none">
                                        <option value="">선택하세요</option>
                                        {users.filter(u => !u.resignDate).map(user => (<option key={user.id} value={user.id}>{user.name} ({user.team})</option>))}
                                    </select>
                                </div>

                                {/* 유형 선택 */}
                                <div>
                                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">연차 유형</label>
                                    <div className="grid grid-cols-1 gap-1">
                                        {LEAVE_TYPES.map(lt => (
                                            <button
                                                key={lt.value}
                                                onClick={() => setLeaveType(lt.value)}
                                                className={`px-2 py-2 text-xs font-bold text-left border-2 transition-colors flex justify-between items-center ${leaveType === lt.value ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]' : 'bg-[#f5f3e8] text-[#5a5545] border-[#c5c0b0] hover:border-[#5d6c4a]'}`}
                                            >
                                                <span>{lt.label}</span>
                                                {leaveType === lt.value && <span className="text-[10px] opacity-70">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 시간차: 시간 입력 */}
                                {leaveType === '시간차' && (
                                    <div className="bg-[#faf8f0] p-3 border-2 border-[#c65911]/30">
                                        <label className="text-[10px] font-bold text-[#c65911] block mb-1">사용 시간 입력</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" min="0.5" max="7" step="0.5" value={hoursInput} onChange={e => setHoursInput(parseFloat(e.target.value) || 1)} className="flex-1 p-1.5 border-2 border-[#c65911]/30 bg-[#f5f3e8] text-sm focus:border-[#c65911] outline-none" />
                                            <span className="text-xs text-[#7a7565]">시간 = {Math.round((hoursInput / 8) * 10) / 10}일 차감</span>
                                        </div>
                                    </div>
                                )}

                                <button onClick={handleAddLeave} disabled={!selectedUser} className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed border-2 border-[#3d472f]">등록하기</button>

                                {/* 해당 날 현황 */}
                                <div className="mt-2 flex-1 overflow-y-auto">
                                    <p className="text-[10px] font-bold text-[#7a7565] mb-2">해당일 현황</p>
                                    <div className="space-y-1">
                                        {getLeavesForDate(selectedDate).map((leave, idx) => {
                                            const days = calcDays(leave.type);
                                            return (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-[#e8e4d4] border border-[#c5c0b0]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-[#3d472f]">{leave.userName}</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 font-bold ${getBadgeColor(leave.type)}`}>{leave.type}</span>
                                                        <span className="text-[9px] text-[#7a7565]">-{days}일</span>
                                                    </div>
                                                    <button onClick={() => onDeleteLeave(leave.userId, leave.date)} className="text-[#8d5a4d] hover:bg-[#f5ebe7] p-1"><X size={14} /></button>
                                                </div>
                                            );
                                        })}
                                        {getLeavesForDate(selectedDate).length === 0 && <p className="text-xs text-[#9a9585] text-center py-4">등록된 연차가 없습니다.</p>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-[#9a9585] text-sm flex flex-col items-center justify-center flex-1"><Sun size={48} className="mb-4 text-[#c5c0b0]" /><p>날짜를 선택하여<br />연차를 등록하세요.</p></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
