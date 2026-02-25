import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Loader } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

const TYPE_LABEL = {
    LEAVE_SUBMITTED: '📋 연차 신청 접수',
    LEAVE_TEAM_APPROVED: '✅ 연차 팀 승인',
    LEAVE_FINAL_APPROVED: '🌟 연차 최종 승인',
    LEAVE_REJECTED: '❌ 연차 반려',
};
const TYPE_COLOR = {
    LEAVE_SUBMITTED: 'border-l-[#d8973c]',
    LEAVE_TEAM_APPROVED: 'border-l-[#5d6c4a]',
    LEAVE_FINAL_APPROVED: 'border-l-[#3d6b5e]',
    LEAVE_REJECTED: 'border-l-[#a65d57]',
};

function timeAgo(isoStr) {
    if (!isoStr) return '';
    const diff = (Date.now() - new Date(isoStr)) / 1000;
    if (diff < 60) return '방금';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
}

export default function NotificationBell({ userId }) {
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!userId) return;
        const q = query(
            collection(db, 'notifications'),
            where('to_user_id', '==', userId),
            orderBy('created_at', 'desc')
        );
        const unsub = onSnapshot(q, snap => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, err => console.error('notification listen err:', err));
        return unsub;
    }, [userId]);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const unread = notifications.filter(n => !n.is_read).length;
    const recent = notifications.slice(0, 10);

    const markRead = async (notifId) => {
        try {
            await updateDoc(doc(db, 'notifications', notifId), { is_read: true });
        } catch (e) { console.error(e); }
    };

    const markAllRead = async () => {
        const unreadList = notifications.filter(n => !n.is_read);
        await Promise.all(unreadList.map(n => markRead(n.id)));
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-1.5 text-[#b8c4a0] hover:text-[#f5f3e8] transition-colors"
                title="알림"
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[#a65d57] text-white text-[10px] font-black flex items-center justify-center px-0.5">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-[#f5f3e8] border-2 border-[#3d472f] shadow-xl z-50">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#c5c0b0] bg-[#e8e4d4]">
                        <span className="font-bold text-[#3d472f] text-xs">알림 {unread > 0 && <span className="text-[#a65d57]">({unread})</span>}</span>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button onClick={markAllRead} className="text-[10px] text-[#5d6c4a] hover:text-[#3d472f] font-bold flex items-center gap-1">
                                    <CheckCheck size={11} /> 모두 읽음
                                </button>
                            )}
                            <button onClick={() => setOpen(false)}><X size={14} className="text-[#7a7565] hover:text-[#3d472f]" /></button>
                        </div>
                    </div>

                    {/* 알림 목록 */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#ebe8db]">
                        {recent.length === 0 ? (
                            <p className="p-6 text-center text-xs text-[#9a9585]">알림이 없습니다.</p>
                        ) : recent.map(n => (
                            <div
                                key={n.id}
                                onClick={() => !n.is_read && markRead(n.id)}
                                className={`flex items-start gap-3 px-4 py-3 border-l-4 cursor-pointer transition-colors ${TYPE_COLOR[n.type] || 'border-l-[#c5c0b0]'} ${n.is_read ? 'opacity-50' : 'hover:bg-[#f4f5eb]'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[#3d472f]">{TYPE_LABEL[n.type] || n.type}</p>
                                    <p className="text-[10px] text-[#7a7565] mt-0.5 truncate">
                                        {n.payload?.user_name && `${n.payload.user_name} · `}
                                        {n.payload?.date} {n.payload?.type === 'FULL' ? '연차' : n.payload?.type === 'HALF_AM' ? '오전반차' : n.payload?.type === 'HALF_PM' ? '오후반차' : ''}
                                    </p>
                                    <p className="text-[10px] text-[#9a9585]">{timeAgo(n.created_at)}</p>
                                </div>
                                {!n.is_read && <div className="w-2 h-2 bg-[#a65d57] rounded-full mt-1 shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
