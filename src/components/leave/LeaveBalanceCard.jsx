import React from 'react';
import { Sun, AlertCircle } from 'lucide-react';

export default function LeaveBalanceCard({ balance, loading }) {
    if (loading) {
        return (
            <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-6 animate-pulse">
                <div className="h-4 bg-[#e8e4d4] rounded w-24 mb-4" />
                <div className="h-8 bg-[#e8e4d4] rounded w-16" />
            </div>
        );
    }

    const remaining = (balance?.total_days ?? 0) - (balance?.used_days ?? 0);
    const total = balance?.total_days ?? 0;
    const used = balance?.used_days ?? 0;
    const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-6">
            <div className="flex items-center gap-2 mb-4">
                <Sun size={18} className="text-[#5d6c4a]" />
                <h3 className="font-bold text-[#3d472f]">연차 잔여 현황</h3>
                <span className="text-[10px] text-[#9a9585] ml-auto">{balance?.year ?? new Date().getFullYear()}년</span>
            </div>

            {total === 0 ? (
                <div className="flex items-center gap-2 text-xs text-[#9a9585] py-2">
                    <AlertCircle size={14} />
                    <span>관리자가 아직 연차를 배정하지 않았습니다.</span>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: '총 부여', value: `${total}일`, color: 'text-[#3d472f]' },
                            { label: '사용', value: `${used}일`, color: 'text-[#d8973c]' },
                            { label: '잔여', value: `${remaining}일`, color: remaining <= 3 ? 'text-[#a65d57]' : 'text-[#5d6c4a]' },
                        ].map(item => (
                            <div key={item.label} className="text-center bg-[#faf8f0] border border-[#e8e4d4] p-3">
                                <p className="text-[10px] font-bold text-[#7a7565] mb-1">{item.label}</p>
                                <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    {/* 사용 비율 바 */}
                    <div className="h-2 bg-[#e8e4d4] rounded overflow-hidden">
                        <div
                            className={`h-2 rounded transition-all ${percent >= 80 ? 'bg-[#a65d57]' : 'bg-[#5d6c4a]'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-[#9a9585] mt-1 text-right">{percent.toFixed(0)}% 사용</p>
                </>
            )}
        </div>
    );
}
