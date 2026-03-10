import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserMinus, Plus, Calendar, Loader, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function DelegationManager() {
    const { userProfile, getMyDelegationsGiven, createDelegation, revokeDelegation, getUsersByTeam } = useAuth();
    const [delegations, setDelegations] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ toUserId: '', startDate: '', endDate: '' });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const today = new Date().toISOString().slice(0, 10);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [delegs, members] = await Promise.all([
                getMyDelegationsGiven(),
                getUsersByTeam(userProfile?.team_id),
            ]);
            setDelegations(delegs);
            // 본인 제외한 팀원
            setTeamMembers(members.filter(m => m.uid !== userProfile?.uid));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [getMyDelegationsGiven, getUsersByTeam, userProfile?.team_id, userProfile?.uid]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setResult(null);
        if (!form.toUserId || !form.startDate || !form.endDate) {
            setResult({ success: false, message: '모든 항목을 입력해주세요.' });
            return;
        }
        if (form.startDate > form.endDate) {
            setResult({ success: false, message: '종료일이 시작일보다 앞일 수 없습니다.' });
            return;
        }
        setSubmitting(true);
        try {
            await createDelegation({ toUserId: form.toUserId, startDate: form.startDate, endDate: form.endDate });
            setResult({ success: true, message: '위임이 생성되었습니다.' });
            setForm({ toUserId: '', startDate: '', endDate: '' });
            await load();
        } catch (e) {
            setResult({ success: false, message: '위임 실패: ' + e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevoke = async (toUserId, toName) => {
        if (!window.confirm(`${toName}에 대한 위임을 종료하시겠습니까?`)) return;
        try {
            await revokeDelegation(toUserId);
            await load();
        } catch (e) { alert('종료 실패: ' + e.message); }
    };

    const isExpired = (d) => d.end_date < today;
    const isUpcoming = (d) => d.start_date > today;
    const isOngoing = (d) => d.start_date <= today && d.end_date >= today;

    const statusBadge = (d) => {
        if (!d.is_active) return { label: '해제됨', cls: 'bg-[#c5c0b0] text-[#5a5545]' };
        if (isExpired(d)) return { label: '기간 종료', cls: 'bg-[#e8e4d4] text-[#7a7565]' };
        if (isUpcoming(d)) return { label: '예정', cls: 'bg-[#d8973c] text-white' };
        return { label: '위임 중', cls: 'bg-[#5d6c4a] text-white' };
    };

    const inputCls = "w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none";

    return (
        <div className="space-y-4">
            {/* 위임 생성 폼 */}
            <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-5">
                <h3 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2">
                    <Plus size={16} className="text-[#5d6c4a]" /> 새 위임 생성 ({userProfile?.team_id} 팀)
                </h3>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-[#7a7565] block mb-1">수임자 (같은 팀) *</label>
                        <select value={form.toUserId} onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))} className={inputCls}>
                            <option value="">-- 팀원 선택</option>
                            {teamMembers.map(m => (
                                <option key={m.uid} value={m.uid}>{m.name} ({m.position || (m.roleGroup === 'manager' ? '팀 관리자' : '아르바이트')})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[#7a7565] block mb-1">시작일 *</label>
                        <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} min={today} className={inputCls} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[#7a7565] block mb-1">종료일 *</label>
                        <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} min={form.startDate || today} className={inputCls} />
                    </div>
                    <div className="md:col-span-3">
                        {result && (
                            <div className={`flex items-center gap-2 p-2.5 mb-3 border text-xs font-bold ${result.success ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#f8f0ef] border-[#dcc0bc] text-[#a65d57]'}`}>
                                {result.success ? <Check size={13} /> : <AlertCircle size={13} />}
                                {result.message}
                            </div>
                        )}
                        <button type="submit" disabled={submitting} className="w-full bg-[#5d6c4a] border-2 border-[#3d472f] text-[#f5f3e8] py-2 text-sm font-bold hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {submitting ? <Loader size={14} className="animate-spin" /> : <><UserCheck size={15} /> 위임 생성</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* 위임 목록 */}
            <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
                <div className="p-4 border-b-2 border-[#c5c0b0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-[#5d6c4a]" />
                        <span className="font-bold text-[#3d472f] text-sm">내가 만든 위임 목록</span>
                    </div>
                    <button onClick={load} className="border-2 border-[#c5c0b0] p-1.5 text-[#5a5545] hover:bg-[#e8e4d4]"><RefreshCw size={13} /></button>
                </div>
                <div className="divide-y divide-[#ebe8db]">
                    {loading ? (
                        <div className="p-6 text-center"><Loader size={14} className="animate-spin mx-auto text-[#9a9585]" /></div>
                    ) : delegations.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#9a9585]">생성한 위임이 없습니다.</div>
                    ) : delegations.map(d => {
                        const badge = statusBadge(d);
                        return (
                            <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-[#f4f5eb]">
                                <div className="w-8 h-8 bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold flex items-center justify-center shrink-0">
                                    {d._toName?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[#3d472f] text-sm">{d._toName || d.to_user_id}</p>
                                    <p className="text-[10px] text-[#9a9585]">{d.start_date} ~ {d.end_date}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                                {d.is_active && !isExpired(d) && (
                                    <button onClick={() => handleRevoke(d.to_user_id, d._toName)} className="text-[10px] font-bold px-2 py-1 border-2 border-[#a65d57] text-[#a65d57] hover:bg-[#f8f0ef] flex items-center gap-1">
                                        <UserMinus size={11} /> 종료
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
