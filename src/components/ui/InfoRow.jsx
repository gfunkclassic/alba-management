// src/components/ui/InfoRow.jsx
import React from 'react';

export default function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-center gap-3 py-1">
            <div className="text-[#9a9585] min-w-[16px]">{icon}</div>
            <div className="flex-1 border-b border-[#ebe8db] pb-1">
                <span className="text-[10px] text-[#9a9585] font-bold uppercase mr-2">{label}</span>
                <span className="text-sm font-medium text-[#4a4535]">{value || '-'}</span>
            </div>
        </div>
    );
}
