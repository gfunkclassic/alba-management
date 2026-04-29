import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Users, Loader, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TYPE_LABEL = { FULL: '연차', HALF_AM: '오전반차', HALF_PM: '오후반차' };
const STATUS_LABEL = { SUBMITTED: '승인대기', CANCELLED: '취소됨' };
const STATUS_COLOR = { SUBMITTED: 'bg-[#a78049] text-white', CANCELLED: 'bg-[#c5c0b0] text-[#5a5545]' };

function BalanceRow({ user, balance, year, onSave }) {
    const [total, setTotal] = useState(balance?.total_days ?? 0);
    const [used, setUsed] = useState(balance?.used_days ?? 0);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const remaining = total - used;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(user.uid, year, Number(total), Number(used));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) { alert('저장 실패: ' + e.message); }
        finally { setSaving(false); }
    };

    return (
        <tr className="hover:bg-[#f5f3e8] border-b border-[#ebe8db]">
            <td className="p-3 pl-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold flex items-center justify-center">{user.name?.[0]}</div>
                    <div>
                        <p className="font-bold text-[#3d472f] text-sm">{user.name}</p>
                        <p className="text-[10px] text-[#9a9585]">{user.team_id}</p>
                    </div>
                </div>
            </td>
            <td className="p-3">
                <div className="flex items-center gap-1">
                    <input type="number" min="0" max="30" step="0.5" value={total} onChange={e => setTotal(parseFloat(e.target.value) || 0)}
                        className="w-16 p-1.5 border border-[#d4cfbf] bg-[#faf8f0] text-sm text-center focus:border-[#5d6c4a] outline-none" />
                    <span className="text-xs text-[#9a9585]">일</span>
                </div>
            </td>
            <td className="p-3">
                <div className="flex items-center gap-1">
                    <input type="number" min="0" max={total} step="0.5" value={used} onChange={e => setUsed(parseFloat(e.target.value) || 0)}
                        className="w-16 p-1.5 border border-[#d4cfbf] bg-[#faf8f0] text-sm text-center focus:border-[#5d6c4a] outline-none" />
                    <span className="text-xs text-[#9a9585]">일</span>
                </div>
            </td>
            <td className="p-3 text-center">
                <span className={`font-bold text-sm ${remaining <= 0 ? 'text-[#8d5a4d]' : remaining <= 3 ? 'text-[#a78049]' : 'text-[#5d6c4a]'}`}>{remaining}일</span>
            </td>
            <td className="p-3 text-center">
                <button onClick={handleSave} disabled={saving}
                    className={`px-3 py-1.5 text-xs font-bold border-2 flex items-center gap-1 mx-auto transition-colors ${saved ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#5d6c4a] border-[#3d472f] text-[#f5f3e8] hover:bg-[#4a5639]'}`}>
                    {saving ? <Loader size={12} className="animate-spin" /> : saved ? <><Check size={12} /> 저장됨</> : <><Save size={12} /> 저장</>}
                </button>
            </td>
        </tr>
    );
}

export default function LeaveBalanceManager({ users }) {
    const { setLeaveBalance, getAllLeaveBalances } = useAuth();
    const [year, setYear] = useState(new Date().getFullYear());
    const [balances, setBalances] = useState({}); // keyed by user_id
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('BALANCE'); // 'BALANCE' | 'REQUESTS'

    const loadBalances = async () => {
        setLoading(true);
        try {
            const data = await getAllLeaveBalances(year);
            const map = {};
            data.forEach(b => { map[b.user_id] = b; });
            setBalances(map);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadBalances(); }, [year]);

    const activeUsers = users.filter(u => !u.resignDate);
    const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

    return (
        <div className="space-y-4">
            {/* 탭 + 연도 */}
            <div className="flex items-center justify-between">
                <div className="flex border-2 border-[#3d472f] bg-[#f5f3e8]">
                    {[{ key: 'BALANCE', label: '잔여 관리' }, { key: 'REQUESTS', label: '신청 내역' }].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-4 py-2 text-xs font-bold border-r border-[#c5c0b0] last:border-0 transition-colors ${tab === t.key ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#5a5545] hover:bg-[#f5f3e8]'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-[#d4cfbf] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none">
                        {years.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <button onClick={loadBalances} className="border border-[#d4cfbf] p-1.5 text-[#5a5545] hover:bg-[#f5f3e8]"><RefreshCw size={14} /></button>
                </div>
            </div>

            {tab === 'BALANCE' && (
                <div className="bg-[#f5f3e8] border border-[#d4cfbf]">
                    <div className="p-4 border-b border-[#d4cfbf] flex items-center gap-2">
                        <Settings size={16} className="text-[#5d6c4a]" />
                        <span className="font-bold text-[#3d472f] text-sm">연차 잔여 수동 관리 — {year}년</span>
                        <span className="text-xs text-[#9a9585] ml-2">총 부여 / 사용 입력 후 저장</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#f5f3e8] text-xs font-bold text-[#5d6c4a] uppercase">
                                <tr>
                                    <th className="p-3 pl-4 text-left">직원</th>
                                    <th className="p-3 text-left">총 부여</th>
                                    <th className="p-3 text-left">사용</th>
                                    <th className="p-3 text-center">잔여</th>
                                    <th className="p-3 text-center">저장</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center"><Loader size={16} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                                ) : activeUsers.map(user => (
                                    <BalanceRow key={user.uid} user={user} balance={balances[user.uid]} year={year} onSave={setLeaveBalance} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
