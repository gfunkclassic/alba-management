import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TYPE_LABEL = { FULL: '연차', HALF_AM: '오전반차', HALF_PM: '오후반차' };
const TYPE_COLOR = { FULL: 'bg-[#5d6c4a] text-[#f5f3e8]', HALF_AM: 'bg-[#4a6070] text-[#f5f3e8]', HALF_PM: 'bg-[#4a6070] text-[#f5f3e8]' };
const teamColor = { '카페': 'bg-[#d8973c]', '생산기획': 'bg-[#5d6c4a]', 'QC': 'bg-[#4a6070]', 'ER': 'bg-[#a65d57]', 'LM': 'bg-[#7a7565]' };

function RejectModal({ onConfirm, onCancel }) {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-[#f5f3e8] border-2 border-[#a65d57] w-full max-w-sm p-6">
                <h3 className="font-bold text-[#3d472f] mb-3">위임 반려 사유</h3>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="사유 (선택)" rows={3}
                    className="w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm resize-none outline-none focus:border-[#a65d57] mb-3" />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="flex-1 py-2 border-2 border-[#c5c0b0] text-xs font-bold text-[#5a5545] hover:bg-[#e8e4d4]">취소</button>
                    <button onClick={() => onConfirm(note)} className="flex-1 py-2 bg-[#a65d57] border-2 border-[#7a3f3a] text-xs font-bold text-white hover:bg-[#7a3f3a]">반려 확정</button>
                </div>
            </div>
        </div>
    );
}

/**
 * DelegateApprovalInbox — 수임자(ALBA)가 위임 기간 동안 사용하는 팀 승인함
 * delegation: { from_user_id, _fromName, team_id, start_date, end_date }
 */
export default function DelegateApprovalInbox({ delegation }) {
    const { getTeamLeaveRequestsForDelegatee, proxyTeamApprove, proxyTeamReject } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [errors, setErrors] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setErrors({});
        try {
            const data = await getTeamLeaveRequestsForDelegatee(delegation.team_id);
            setRequests(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [getTeamLeaveRequestsForDelegatee, delegation.team_id]);

    useEffect(() => { load(); }, [load]);

    const handleApprove = async (req) => {
        if (!window.confirm(`${req._userName}님의 ${req.date} 신청을 위임 승인하시겠습니까?`)) return;
        setProcessing(req.id);
        try {
            await proxyTeamApprove(req.id, req.user_id, req.date, req.type, delegation.from_user_id, false);
            await load();
        } catch (e) {
            setErrors(err => ({ ...err, [req.id]: e.message }));
        } finally { setProcessing(null); }
    };

    const handleReject = (req) => setRejectTarget(req);
    const confirmReject = async (note) => {
        setProcessing(rejectTarget.id);
        setRejectTarget(null);
        try {
            await proxyTeamReject(rejectTarget.id, rejectTarget.user_id, rejectTarget.date, rejectTarget.type, note, delegation.from_user_id, false);
            await load();
        } catch (e) { alert('처리 실패: ' + e.message); }
        finally { setProcessing(null); }
    };

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
            {rejectTarget && <RejectModal onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />}
            <div className="p-4 border-b-2 border-[#c5c0b0] flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-[#d8973c]" />
                        <span className="font-bold text-[#3d472f] text-sm">위임 승인함 — {delegation.team_id} 팀</span>
                    </div>
                    <p className="text-[10px] text-[#9a9585] mt-0.5">{delegation._fromName} 관리자 위임 · {delegation.start_date} ~ {delegation.end_date}</p>
                </div>
                <button onClick={load} className="border-2 border-[#c5c0b0] p-1.5 text-[#5a5545] hover:bg-[#e8e4d4]"><RefreshCw size={13} /></button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#e8e4d4] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="p-3 pl-4 text-left">신청자</th>
                            <th className="p-3 text-center">날짜</th>
                            <th className="p-3 text-center">유형</th>
                            <th className="p-3 text-left">사유</th>
                            <th className="p-3 text-center">처리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebe8db]">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center"><Loader size={14} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-xs text-[#9a9585]">대기 중인 신청이 없습니다.</td></tr>
                        ) : requests.map(req => (
                            <React.Fragment key={req.id}>
                                <tr className="hover:bg-[#f4f5eb]">
                                    <td className="p-3 pl-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-[#5d6c4a] text-[#f5f3e8] text-[10px] font-bold flex items-center justify-center shrink-0">{req._userName?.[0] || '?'}</div>
                                            <span className="font-bold text-[#3d472f] text-xs">{req._userName}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono text-xs font-bold text-[#3d472f]">{req.date}</td>
                                    <td className="p-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 ${TYPE_COLOR[req.type]}`}>{TYPE_LABEL[req.type]}</span>
                                    </td>
                                    <td className="p-3 text-xs text-[#7a7565] max-w-[100px] truncate">{req.reason || '-'}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex gap-1 justify-center">
                                            <button onClick={() => handleApprove(req)} disabled={!!processing}
                                                className="flex items-center gap-1 px-2 py-1 bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] text-[10px] font-bold hover:bg-[#4a5639] disabled:opacity-50">
                                                {processing === req.id ? <Loader size={10} className="animate-spin" /> : <CheckCircle size={11} />} 승인
                                            </button>
                                            <button onClick={() => handleReject(req)} disabled={!!processing}
                                                className="flex items-center gap-1 px-2 py-1 bg-[#a65d57] border border-[#7a3f3a] text-white text-[10px] font-bold hover:bg-[#7a3f3a] disabled:opacity-50">
                                                <XCircle size={11} /> 반려
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {errors[req.id] && (
                                    <tr><td colSpan={5} className="px-4 pb-2">
                                        <div className="flex items-center gap-2 bg-[#f8f0ef] border border-[#dcc0bc] px-3 py-2 text-xs text-[#a65d57]">
                                            <AlertCircle size={11} /><span className="font-bold">{errors[req.id]}</span>
                                        </div>
                                    </td></tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
