import React, { useState, useEffect, useCallback } from 'react';
import { Users, Clock, UserCheck, LogOut, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import NotificationBell from '../notifications/NotificationBell';
import LeaveApprovalInbox from '../leave/LeaveApprovalInbox';
import DelegationManager from '../leave/DelegationManager';

const TABS = [
    { key: 'INBOX', label: '승인함', icon: <Clock size={15} /> },
    { key: 'DELEGATION', label: '위임 관리', icon: <UserCheck size={15} /> },
    { key: 'MEMBERS', label: '팀원 목록', icon: <Users size={15} /> },
];

export default function TeamApproverView() {
    const { userProfile, logout, getUsersByTeam } = useAuth();
    const [profile, setProfile] = useState(userProfile);
    const [tab, setTab] = useState('INBOX');
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = onSnapshot(doc(db, 'users', userProfile.uid), snap => {
            if (snap.exists()) setProfile({ uid: snap.id, ...snap.data() });
        });
        return unsub;
    }, [userProfile?.uid]);

    const loadMembers = useCallback(async () => {
        if (!profile?.team_id) return;
        setMembersLoading(true);
        try {
            const data = await getUsersByTeam(profile.team_id);
            setMembers(data.filter(u => u.uid !== profile.uid));
        } catch (e) { console.error(e); }
        finally { setMembersLoading(false); }
    }, [profile?.team_id, getUsersByTeam]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    const teamColor = { '카페': 'bg-[#d8973c]', '생산기획': 'bg-[#5d6c4a]', 'QC': 'bg-[#4a6070]', 'ER': 'bg-[#a65d57]', 'LM': 'bg-[#7a7565]' };

    return (
        <div className="min-h-screen bg-[#e8e4d4]">
            <header className="bg-[#3d472f] border-b-2 border-[#2d3721] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#5d6c4a] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] font-black text-sm">A</div>
                    <span className="text-[#f5f3e8] font-bold text-sm">아르바이트 관리</span>
                    <span className={`text-[10px] text-white font-bold px-2 py-0.5 ${teamColor[profile?.team_id] || 'bg-[#7a7565]'}`}>{profile?.team_id} 관리자</span>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell userId={profile?.uid} onNavigate={() => setTab('INBOX')} />
                    <span className="text-[#b8c4a0] text-xs">{profile?.name}</span>
                    <button onClick={logout} className="flex items-center gap-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-xs"><LogOut size={14} /> 로그아웃</button>
                </div>
            </header>

            <div className="bg-[#f5f3e8] border-b-2 border-[#c5c0b0] flex">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${tab === t.key ? 'border-[#5d6c4a] text-[#5d6c4a]' : 'border-transparent text-[#7a7565] hover:text-[#5a5545]'}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <main className="max-w-5xl mx-auto p-5 space-y-4">
                {tab === 'INBOX' && <LeaveApprovalInbox />}
                {tab === 'DELEGATION' && <DelegationManager />}
                {tab === 'MEMBERS' && (
                    <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
                        <div className="p-4 border-b-2 border-[#c5c0b0] flex items-center gap-2">
                            <Users size={16} className="text-[#5d6c4a]" />
                            <span className="font-bold text-[#3d472f] text-sm">{profile?.team_id} 팀원 목록</span>
                            <span className="text-xs text-[#9a9585] ml-2">{members.length}명</span>
                        </div>
                        <div className="divide-y divide-[#ebe8db]">
                            {membersLoading ? (
                                <div className="p-6 text-center"><Loader size={14} className="animate-spin mx-auto text-[#9a9585]" /></div>
                            ) : members.length === 0 ? (
                                <p className="p-6 text-center text-xs text-[#9a9585]">팀원이 없습니다.</p>
                            ) : members.map(m => (
                                <div key={m.uid} className="flex items-center gap-3 p-4 hover:bg-[#f4f5eb]">
                                    <div className="w-9 h-9 bg-[#5d6c4a] text-[#f5f3e8] flex items-center justify-center font-bold">{m.name?.[0]}</div>
                                    <div className="flex-1">
                                        <p className="font-bold text-[#3d472f] text-sm">{m.name}</p>
                                        <p className="text-[10px] text-[#9a9585]">{m.email}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 font-bold ${m.is_temp_password ? 'bg-[#f8f0ef] text-[#a65d57]' : 'bg-[#e8ebd8] text-[#5d6c4a]'}`}>
                                        {m.is_temp_password ? '비번 변경 필요' : '정상'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
