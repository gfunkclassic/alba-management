import React, { useState } from 'react';
import { CalendarPlus, AlertCircle, Check, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const LEAVE_TYPES = [
    { value: 'FULL', label: '연차 (1일)', days: 1, color: 'bg-[#5d6c4a] text-[#f5f3e8]' },
    { value: 'HALF_AM', label: '오전 반차 (0.5일)', days: 0.5, color: 'bg-[#4a6070] text-[#f5f3e8]' },
    { value: 'HALF_PM', label: '오후 반차 (0.5일)', days: 0.5, color: 'bg-[#4a6070] text-[#f5f3e8]' },
];

export default function LeaveRequestForm({ onSubmitted, userProfile }) {
    const { submitLeaveRequest, getUsersByTeam, sendNotification, getAllUsers } = useAuth();
    const today = new Date().toISOString().slice(0, 10);
    const [date, setDate] = useState('');
    const [type, setType] = useState('FULL');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!date) { setResult({ success: false, message: '날짜를 선택해주세요.' }); return; }
        if (!reason.trim()) { setResult({ success: false, message: '사유를 입력해주세요.' }); return; }
        setResult(null);
        setLoading(true);
        try {
            await submitLeaveRequest({ date, type, reason });
            setResult({ success: true, message: `${date} ${LEAVE_TYPES.find(t => t.value === type)?.label} 신청이 완료되었습니다.` });

            // 알림 발송: 팀 승인자 및 최종 관리자 모두에게 발송
            try {
                const allUsers = await getAllUsers();
                const notifyPromises = [];

                if (userProfile?.team_id) {
                    const teamApprovers = allUsers.filter(u => u.team_id === userProfile.team_id && u.roleGroup === 'manager');
                    teamApprovers.forEach(ap => {
                        notifyPromises.push(sendNotification(ap.uid, 'LEAVE_SUBMITTED', {
                            user_name: userProfile.name,
                            date, type,
                        }));
                    });
                }

                await Promise.all(notifyPromises);
            } catch (ne) { console.warn('알림 발송 실패:', ne); }

            setDate('');
            setReason('');
            onSubmitted?.(type);
        } catch (err) {
            const isDuplicate = err.message?.startsWith('DUPLICATE');
            setResult({
                success: false,
                message: isDuplicate ? '해당 날짜에 이미 신청한 연차가 있습니다. 취소 후 재신청 가능합니다.' : '신청 중 오류가 발생했습니다: ' + err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none";

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-5">
            <h3 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2">
                <CalendarPlus size={18} className="text-[#5d6c4a]" /> 연차 신청
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* 날짜 */}
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">신청 날짜 *</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        min={today}
                        required
                        className={inputCls}
                    />
                </div>

                {/* 유형 */}
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">연차 유형 *</label>
                    <div className="grid grid-cols-1 gap-1.5">
                        {LEAVE_TYPES.map(lt => (
                            <button
                                key={lt.value}
                                type="button"
                                onClick={() => setType(lt.value)}
                                className={`px-3 py-2.5 text-sm font-bold text-left border-2 flex justify-between items-center transition-colors ${type === lt.value ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]' : 'bg-[#f5f3e8] text-[#5a5545] border-[#c5c0b0] hover:border-[#5d6c4a]'}`}
                            >
                                <span>{lt.label}</span>
                                {type === lt.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 사유 */}
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">사유 *</label>
                    <input
                        type="text"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="사유를 입력해주세요 (필수)"
                        className={inputCls}
                        required
                    />
                </div>

                {result && (
                    <div className={`flex items-start gap-2 p-3 border ${result.success ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#f8f0ef] border-[#dcc0bc] text-[#a65d57]'}`}>
                        {result.success ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                        <p className="text-xs font-bold">{result.message}</p>
                    </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? <Loader size={16} className="animate-spin" /> : <><CalendarPlus size={16} /> 신청하기</>}
                </button>
            </form>
        </div>
    );
}
