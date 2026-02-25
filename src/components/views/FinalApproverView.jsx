import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Sun, AlertCircle, Check, X, LogOut, Search, RefreshCw, CheckCircle, Clock, ShieldOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TEAMS, ROLES, ROLE_LABELS } from '../../firebase';
import LeaveBalanceManager from '../leave/LeaveBalanceManager';
import FinalApprovalInbox from '../leave/FinalApprovalInbox';
import NotificationBell from '../notifications/NotificationBell';


function CreateUserPanel({ onCreated }) {
    const { createUser } = useAuth();
    const [form, setForm] = useState({ name: '', email: '', role: 'ALBA', team_id: '카페' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setResult(null);
        setLoading(true);
        try {
            await createUser(form);
            setResult({ success: true, message: `${form.name} (${form.email}) 계정 생성 완료. 초기 비밀번호: 123456` });
            setForm({ name: '', email: '', role: 'ALBA', team_id: '카페' });
            onCreated?.();
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setResult({ success: false, message: '이미 사용 중인 이메일입니다.' });
            } else {
                setResult({ success: false, message: '계정 생성 실패: ' + err.message });
            }
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none";

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-6">
            <h3 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2">
                <UserPlus size={18} className="text-[#5d6c4a]" /> 계정 생성
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">이름 *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="홍길동" className={inputCls} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">이메일 *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="hong@company.com" className={inputCls} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">역할 *</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">팀 *</label>
                    <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} className={inputCls}>
                        {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="md:col-span-2">
                    {result && (
                        <div className={`flex items-start gap-2 p-3 mb-3 border ${result.success ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#f8f0ef] border-[#dcc0bc] text-[#a65d57]'}`}>
                            {result.success ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                            <p className="text-xs font-bold">{result.message}</p>
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-2.5 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {loading ? <div className="w-4 h-4 border-2 border-[#f5f3e8] border-t-transparent rounded-full animate-spin" /> : <><UserPlus size={16} /> 계정 생성 (초기 비밀번호: 123456)</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

function PendingUsersPanel({ onApproved }) {
    const { getPendingUsers, approveUser, rejectUser } = useAuth();
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState({});
    const [selections, setSelections] = useState({}); // uid -> { role, team_id }

    const load = useCallback(async () => {
        setLoading(true);
        try { setPending(await getPendingUsers()); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [getPendingUsers]);

    useEffect(() => { load(); }, [load]);

    const sel = (uid) => selections[uid] || { role: 'ALBA', team_id: '카페' };
    const setSel = (uid, key, val) => setSelections(s => ({ ...s, [uid]: { ...sel(uid), [key]: val } }));

    const handleApprove = async (uid) => {
        setApproving(a => ({ ...a, [uid]: 'approving' }));
        try {
            await approveUser(uid, sel(uid));
            onApproved?.();
            await load();
        } catch (e) { alert('승인 실패: ' + e.message); }
        finally { setApproving(a => ({ ...a, [uid]: null })); }
    };

    const handleReject = async (uid) => {
        if (!window.confirm('가입을 거절하시가습니까?')) return;
        setApproving(a => ({ ...a, [uid]: 'rejecting' }));
        try { await rejectUser(uid); await load(); }
        catch (e) { alert('거절 실패: ' + e.message); }
        finally { setApproving(a => ({ ...a, [uid]: null })); }
    };

    if (!loading && pending.length === 0) return null;

    return (
        <div className="bg-[#fdf6e3] border-2 border-[#d8973c]">
            <div className="p-4 border-b-2 border-[#d8973c] flex items-center gap-2">
                <Clock size={16} className="text-[#d8973c]" />
                <span className="font-bold text-[#7a5a1a] text-sm">가입 요청 관리</span>
                <span className="bg-[#d8973c] text-white text-[10px] font-black px-2 py-0.5">{pending.length}명 대기</span>
            </div>
            <div className="divide-y divide-[#e8d8a0]">
                {loading ? (
                    <div className="p-4 text-xs text-center text-[#9a9585]">조회 중...</div>
                ) : pending.map(u => (
                    <div key={u.uid} className="p-4 flex flex-wrap gap-3 items-center">
                        <div className="flex-1 min-w-[140px]">
                            <p className="font-bold text-[#3d472f] text-sm">{u.name}</p>
                            <p className="text-[10px] text-[#9a9585] font-mono">{u.email}</p>
                            <p className="text-[10px] text-[#9a9585]">신청일: {u.created_at?.slice(0, 10)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <select value={sel(u.uid).role} onChange={e => setSel(u.uid, 'role', e.target.value)}
                                className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#d8973c]">
                                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <select value={sel(u.uid).team_id} onChange={e => setSel(u.uid, 'team_id', e.target.value)}
                                className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#d8973c]">
                                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button onClick={() => handleApprove(u.uid)} disabled={!!approving[u.uid]}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#5d6c4a] border-2 border-[#3d472f] text-[#f5f3e8] text-[10px] font-bold hover:bg-[#4a5639] disabled:opacity-50">
                                <Check size={11} /> 승인
                            </button>
                            <button onClick={() => handleReject(u.uid)} disabled={!!approving[u.uid]}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#a65d57] border-2 border-[#7a3f3a] text-white text-[10px] font-bold hover:bg-[#7a3f3a] disabled:opacity-50">
                                <X size={11} /> 거절
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function FinalApproverView({ onSwitchToHRSystem }) {
    const { userProfile, logout, getAllUsers, suspendUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTeam, setFilterTeam] = useState('전체');
    const [filterRole, setFilterRole] = useState('전체');
    const [activeTab, setActiveTab] = useState('ACCOUNTS');

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data.sort((a, b) => a.name?.localeCompare(b.name)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadUsers(); }, []);

    const filtered = users.filter(u => {
        const matchSearch = u.name?.includes(search) || u.email?.includes(search);
        const matchTeam = filterTeam === '전체' || u.team_id === filterTeam;
        const matchRole = filterRole === '전체' || u.role === filterRole;
        return matchSearch && matchTeam && matchRole;
    });

    const roleLabel = { ALBA: '아르바이트', TEAM_APPROVER: '팀 관리자', FINAL_APPROVER: '최종 관리자' };
    const roleBadge = { ALBA: 'bg-[#e8e4d4] text-[#5a5545]', TEAM_APPROVER: 'bg-[#e8ebd8] text-[#5d6c4a]', FINAL_APPROVER: 'bg-[#f8f0ef] text-[#a65d57]' };

    const TABS = [
        { key: 'ACCOUNTS', label: '계정 관리', icon: <Users size={15} /> },
        { key: 'FINAL', label: '최종 승인함', icon: <CheckCircle size={15} /> },
        { key: 'LEAVE', label: '연차 잔여 관리', icon: <Sun size={15} /> },
    ];

    return (
        <div className="min-h-screen bg-[#e8e4d4]">
            {/* 헤더 */}
            <header className="bg-[#3d472f] border-b-2 border-[#2d3721] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#5d6c4a] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] font-black text-sm">A</div>
                    <span className="text-[#f5f3e8] font-bold text-sm">아르바이트 관리</span>
                    <span className="text-[10px] bg-[#a65d57] text-white font-bold px-2 py-0.5">최종 관리자</span>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell userId={userProfile?.uid} />
                    <span className="text-[#b8c4a0] text-xs">{userProfile?.name}</span>
                    <button onClick={logout} className="flex items-center gap-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-xs"><LogOut size={14} /> 로그아웃</button>
                </div>
            </header>

            {/* 탭 바 */}
            <div className="bg-[#f5f3e8] border-b-2 border-[#c5c0b0] flex items-center">
                <div className="flex flex-1">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === t.key ? 'border-[#5d6c4a] text-[#5d6c4a]' : 'border-transparent text-[#7a7565] hover:text-[#5a5545]'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                {onSwitchToHRSystem && (
                    <button onClick={onSwitchToHRSystem} className="mr-4 text-[10px] bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] px-3 py-1.5 font-bold hover:bg-[#4a5639]">
                        ← 인사급여 시스템
                    </button>
                )}
            </div>

            <main className="max-w-6xl mx-auto p-6 space-y-6">

                {/* ── 계정 관리 ───────────────── */}
                {activeTab === 'ACCOUNTS' && (<>
                    {/* 가입 요청 */}
                    <PendingUsersPanel onApproved={loadUsers} />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: '전체 계정', value: `${users.length}명` },
                            { label: '아르바이트', value: `${users.filter(u => u.role === 'ALBA').length}명` },
                            { label: '팀 관리자', value: `${users.filter(u => u.role === 'TEAM_APPROVER').length}명` },
                            { label: '비번 변경 필요', value: `${users.filter(u => u.is_temp_password).length}명`, danger: true },
                        ].map(card => (
                            <div key={card.label} className={`border-2 p-4 ${card.danger ? 'bg-[#f8f0ef] border-[#dcc0bc]' : 'bg-[#f5f3e8] border-[#c5c0b0]'}`}>
                                <p className="text-xs font-bold text-[#7a7565] mb-1">{card.label}</p>
                                <p className={`text-2xl font-black ${card.danger ? 'text-[#a65d57]' : 'text-[#3d472f]'}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>
                    <CreateUserPanel onCreated={loadUsers} />
                    <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
                        <div className="p-4 border-b-2 border-[#c5c0b0] flex flex-wrap gap-3 items-center justify-between">
                            <h3 className="font-bold text-[#3d472f] flex items-center gap-2"><Users size={18} className="text-[#5d6c4a]" /> 전체 계정 목록</h3>
                            <div className="flex gap-2 flex-wrap">
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/이메일" className="pl-8 pr-3 py-1.5 border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs focus:border-[#5d6c4a] outline-none w-36" />
                                </div>
                                <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                                    <option value="전체">전체 팀</option>
                                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                                    <option value="전체">전체 역할</option>
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                <button onClick={loadUsers} className="flex items-center gap-1 border-2 border-[#c5c0b0] bg-[#f5f3e8] px-2 py-1.5 text-xs text-[#5a5545] hover:bg-[#e8e4d4]">
                                    <RefreshCw size={12} /> 새로고침
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#e8e4d4] sticky top-0 text-xs font-bold text-[#5d6c4a] uppercase">
                                    <tr>
                                        <th className="p-3 pl-4 text-left">이름</th>
                                        <th className="p-3 text-left">이메일</th>
                                        <th className="p-3 text-center">팀</th>
                                        <th className="p-3 text-center">역할</th>
                                        <th className="p-3 text-center">비밀번호</th>
                                        <th className="p-3 text-center">등록일</th>
                                        <th className="p-3 text-center">정지</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ebe8db]">
                                    {loading ? <tr><td colSpan={7} className="p-8 text-center text-[#9a9585] text-xs">불러오는 중...</td></tr>
                                        : filtered.map(u => (
                                            <tr key={u.uid} className={`hover:bg-[#f4f5eb] ${u.status === 'SUSPENDED' ? 'opacity-60' : ''}`}>
                                                <td className="p-3 pl-4 font-bold text-[#3d472f]">{u.name}</td>
                                                <td className="p-3 text-[#5a5545] text-xs font-mono">{u.email}</td>
                                                <td className="p-3 text-center"><span className="text-xs bg-[#e8e4d4] px-2 py-0.5 font-bold text-[#5a5545]">{u.team_id}</span></td>
                                                <td className="p-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                                                <td className="p-3 text-center">
                                                    {u.is_temp_password
                                                        ? <span className="text-xs font-bold text-[#d8973c] flex items-center justify-center gap-1"><AlertCircle size={11} />변경 필요</span>
                                                        : <span className="text-xs text-[#5d6c4a] font-bold flex items-center justify-center gap-1"><Check size={11} />변경 완료</span>}
                                                </td>
                                                <td className="p-3 text-center text-xs text-[#7a7565]">{u.created_at?.slice(0, 10)}</td>
                                                <td className="p-3 text-center">
                                                    {u.status === 'SUSPENDED' ? (
                                                        <button onClick={() => suspendUser(u.uid, false).then(loadUsers)}
                                                            className="text-[9px] font-bold px-2 py-1 border border-[#5d6c4a] text-[#5d6c4a] hover:bg-[#e8ebd8]">
                                                            정지해제
                                                        </button>
                                                    ) : u.role !== 'FINAL_APPROVER' ? (
                                                        <button onClick={() => { if (window.confirm(`${u.name} 계정을 정지하시걌습니까?`)) suspendUser(u.uid, true).then(loadUsers); }}
                                                            className="text-[9px] font-bold px-2 py-1 border border-[#a65d57] text-[#a65d57] hover:bg-[#f8f0ef] flex items-center gap-1 mx-auto">
                                                            <ShieldOff size={10} /> 정지
                                                        </button>
                                                    ) : <span className="text-[10px] text-[#c5c0b0]">-</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[#9a9585] text-xs">해당하는 계정이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>)}

                {/* ── 최종 승인함 ─────────────── */}
                {activeTab === 'FINAL' && <FinalApprovalInbox />}

                {/* ── 연차 잔여 관리 ──────────── */}
                {activeTab === 'LEAVE' && (
                    <LeaveBalanceManager users={users.filter(u => u.role === 'ALBA')} />
                )}

            </main>
        </div>
    );
}
