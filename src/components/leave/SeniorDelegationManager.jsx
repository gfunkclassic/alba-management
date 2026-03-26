import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserMinus, Plus, Calendar, Loader, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function SeniorDelegationManager() {
    const { currentUser, userProfile, getAllUsers } = useAuth();
    const [delegations, setDelegations] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ toUserId: '', startDate: '', endDate: '' });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const today = new Date().toISOString().slice(0, 10);

    const load = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [delaSnap, allUsers] = await Promise.all([
                getDocs(query(collection(db, 'senior_delegations'), where('from_user_id', '==', currentUser.uid))),
                getAllUsers(),
            ]);

            const userMap = {};
            allUsers.forEach(u => { userMap[u.uid] = u; });

            const enriched = delaSnap.docs
                .map(d => ({ id: d.id, ...d.data(), _toName: userMap[d.data().to_user_id]?.name || d.data().to_user_id }))
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

            setDelegations(enriched);

            // 수임자 후보: 다른 실장(approver_senior)만 가능
            setCandidates(allUsers.filter(u =>
                u.uid !== currentUser.uid &&
                u.roleGroup === 'approver_senior' &&
                u.status === 'ACTIVE'
            ));
        } catch (e) { console.error('위임 목록 로드 실패:', e); }
        finally { setLoading(false); }
    }, [currentUser?.uid, getAllUsers]);

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
            const docRef = doc(db, 'senior_delegations', form.toUserId);
            const existing = await getDoc(docRef);
            if (existing.exists() && existing.data().is_active) {
                setResult({ success: false, message: '이미 해당 수임자에게 활성 위임이 있습니다. 먼저 종료해주세요.' });
                setSubmitting(false);
                return;
            }
            const now = new Date().toISOString();
            await setDoc(docRef, {
                from_user_id: currentUser.uid,
                to_user_id: form.toUserId,
                is_active: true,
                start_date: form.startDate,
                end_date: form.endDate,
                created_at: now,
                updated_at: now,
            });
            setResult({ success: true, message: '대결 위임이 등록되었습니다.' });
            setForm({ toUserId: '', startDate: '', endDate: '' });
            await load();
        } catch (e) {
            setResult({ success: false, message: '등록 실패: ' + e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevoke = async (toUserId, toName) => {
        if (!window.confirm(`${toName}에 대한 대결 위임을 종료하시겠습니까?`)) return;
        try {
            await updateDoc(doc(db, 'senior_delegations', toUserId), {
                is_active: false,
                updated_at: new Date().toISOString(),
            });
            await load();
        } catch (e) { alert('종료 실패: ' + e.message); }
    };

    const statusBadge = (d) => {
        if (!d.is_active) return { label: '해제됨', cls: 'bg-[#c5c0b0] text-[#5a5545]' };
        if (d.end_date < today) return { label: '기간 종료', cls: 'bg-[#e8e4d4] text-[#7a7565]' };
        if (d.start_date > today) return { label: '예정', cls: 'bg-[#d8973c] text-white' };
        return { label: '위임 중', cls: 'bg-[#5d6c4a] text-white' };
    };

    const inputCls = 'w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none';

    return (
        <div className="space-y-4">
            {/* 위임 등록 폼 */}
            <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-5">
                <h3 className="font-bold text-[#3d472f] mb-1 flex items-center gap-2">
                    <Plus size={16} className="text-[#5d6c4a]" /> 실장 대결 위임 등록
                </h3>
                <p className="text-[10px] text-[#7a7565] mb-4">
                    부재 시 지정한 수임자가 <span className="font-bold text-[#3d472f]">{userProfile?.name}</span> 실장 슬롯을 대신 결재합니다.
                </p>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-[#7a7565] block mb-1">수임자 *</label>
                        <select value={form.toUserId} onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))} className={inputCls}>
                            <option value="">-- 수임자 선택</option>
                            {candidates.map(m => (
                                <option key={m.uid} value={m.uid}>
                                    {m.name} ({m.team_id || m.position || '직원'})
                                </option>
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
                        <button type="submit" disabled={submitting}
                            className="w-full bg-[#5d6c4a] border-2 border-[#3d472f] text-[#f5f3e8] py-2 text-sm font-bold hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {submitting ? <Loader size={14} className="animate-spin" /> : <><UserCheck size={15} /> 위임 등록</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* 위임 목록 */}
            <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
                <div className="p-4 border-b-2 border-[#c5c0b0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-[#5d6c4a]" />
                        <span className="font-bold text-[#3d472f] text-sm">내가 등록한 대결 위임 목록</span>
                    </div>
                    <button onClick={load} className="border-2 border-[#c5c0b0] p-1.5 text-[#5a5545] hover:bg-[#e8e4d4]">
                        <RefreshCw size={13} />
                    </button>
                </div>
                <div className="divide-y divide-[#ebe8db]">
                    {loading ? (
                        <div className="p-6 text-center"><Loader size={14} className="animate-spin mx-auto text-[#9a9585]" /></div>
                    ) : delegations.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#9a9585]">등록한 대결 위임이 없습니다.</div>
                    ) : delegations.map(d => {
                        const badge = statusBadge(d);
                        return (
                            <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-[#f4f5eb]">
                                <div className="w-8 h-8 bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold flex items-center justify-center shrink-0">
                                    {d._toName?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[#3d472f] text-sm">{d._toName}</p>
                                    <p className="text-[10px] text-[#9a9585]">{d.start_date} ~ {d.end_date}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                                {d.is_active && d.end_date >= today && (
                                    <button onClick={() => handleRevoke(d.to_user_id, d._toName)}
                                        className="text-[10px] font-bold px-2 py-1 border-2 border-[#a65d57] text-[#a65d57] hover:bg-[#f8f0ef] flex items-center gap-1">
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
