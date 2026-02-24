import React, { useState } from 'react';
import { Edit, X } from 'lucide-react';

export default function AdjustLeaveModal({ user, onClose, onSave, currentAdjustment }) {
    const [adjustment, setAdjustment] = useState(currentAdjustment || 0);
    const [reason, setReason] = useState('');

    const handleSubmit = (e) => { e.preventDefault(); onSave(user.id, parseFloat(adjustment), reason); };

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] shadow-lg w-full max-w-sm overflow-hidden border-2 border-[#3d472f]">
                <div className="p-4 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#5d6c4a]">
                    <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2"><Edit size={18} /> ▶ 연차 조정</h3>
                    <button onClick={onClose} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#e8e4d4]">
                    <div className="bg-[#f5f3e8] p-3 border-2 border-[#c5c0b0]"><p className="text-sm font-bold text-[#3d472f]">{user.name}</p><p className="text-xs text-[#7a7565]">{user.team}</p></div>
                    <div><label className="text-xs font-bold text-[#5d6c4a] block mb-1">조정 일수</label><input type="number" step="0.5" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" placeholder="양수: 추가, 음수: 차감" /></div>
                    <div><label className="text-xs font-bold text-[#5d6c4a] block mb-1">사유</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm h-20 resize-none focus:border-[#5d6c4a] outline-none" placeholder="조정 사유를 입력하세요" /></div>
                    <div className="pt-4 border-t-2 border-[#c5c0b0] flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-[#f5f3e8] text-[#5a5545] font-bold text-sm hover:bg-[#e0ddd0] border-2 border-[#c5c0b0]">취소</button>
                        <button type="submit" className="px-6 py-2 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f]">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
