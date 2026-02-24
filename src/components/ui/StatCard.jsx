// src/components/ui/StatCard.jsx
import React from 'react';

export default function StatCard({ title, value, sub, icon, color = "bg-[#f5f3e8]", onClick, active }) {
    return (
        <div onClick={onClick} className={`${color} relative p-5 border-2 transition-all duration-200 cursor-pointer rounded-none group ${active ? 'border-[#5d6c4a] ring-2 ring-[#5d6c4a] shadow-md transform -translate-y-0.5 bg-[#e8ebd8]' : 'border-[#c5c0b0] hover:border-[#5d6c4a] hover:bg-[#e8e4d4]'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-bold text-[#6b7b54] uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-2xl font-black text-[#3d472f]">{value}</h3>
                    {sub && <p className="text-[10px] text-[#7a7565] mt-1">{sub}</p>}
                </div>
                <div className={`p-2 rounded-none border ${active ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]' : 'bg-[#e8e4d4] text-[#5d6c4a] border-[#c5c0b0] group-hover:bg-[#d4dcc0]'}`}>{icon}</div>
            </div>
        </div>
    );
}
