import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Loader, RefreshCw, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmModal } from '../modals/DialogModals';
import AdminApprovalHistory from './AdminApprovalHistory';

const TYPE_LABEL = { FULL: '연차', HALF_AM: '오전반차', HALF_PM: '오후반차' };
const TYPE_COLOR = { FULL: 'bg-[#5d6c4a] text-[#f5f3e8]', HALF_AM: 'bg-[#4a6070] text-[#f5f3e8]', HALF_PM: 'bg-[#4a6070] text-[#f5f3e8]' };
const STATUS_LABEL = { SUBMITTED: '승인대기', TEAM_APPROVED: '1차승인', FINAL_PENDING: '최종대기', CEO_PENDING: '승인대기(대표)', FINAL_APPROVED: '최종승인', REJECTED: '반려', CANCELLED: '취소' };
const STATUS_COLOR = {
    SUBMITTED: 'bg-[#d8973c] text-white',
    TEAM_APPROVED: 'bg-[#7a8c5f] text-white',
    FINAL_PENDING: 'bg-[#5d6c4a] text-white',
    CEO_PENDING: 'bg-[#4a6070] text-white',
    FINAL_APPROVED: 'bg-[#3d6b5e] text-white',
    REJECTED: 'bg-[#a65d57] text-white',
    CANCELLED: 'bg-[#c5c0b0] text-[#5a5545]',
};

function RejectModal({ onConfirm, onCancel }) {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-[#f5f3e8] border-2 border-[#a65d57] w-full max-w-sm p-6">
                <h3 className="font-bold text-[#3d472f] mb-3">반려 사유 입력</h3>
                <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="반려 사유를 입력해주세요 (필수)"
                    rows={3}
                    className="w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm resize-none outline-none focus:border-[#a65d57] mb-3"
                />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="flex-1 py-2 border-2 border-[#c5c0b0] text-xs font-bold text-[#5a5545] hover:bg-[#e8e4d4]">취소</button>
                    <button onClick={() => onConfirm(note.trim())} disabled={!note.trim()} className="flex-1 py-2 bg-[#a65d57] border-2 border-[#7a3f3a] text-xs font-bold text-white hover:bg-[#7a3f3a] disabled:opacity-40 disabled:cursor-not-allowed">반려 확정</button>
                </div>
            </div>
        </div>
    );
}

export default function LeaveApprovalInbox({ activeGivenDelegation = null }) {
    const { getTeamLeaveRequests, approveLeaveRequest, rejectLeaveRequest } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('SUBMITTED');
    const [processing, setProcessing] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [confirmApproveTarget, setConfirmApproveTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTeamLeaveRequests();
            setRequests(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [getTeamLeaveRequests]);

    useEffect(() => { load(); }, [load]);

    const filtered = filterStatus === 'ALL' ? requests : requests.filter(r => r.status === filterStatus);

    const handleApprove = (req) => setConfirmApproveTarget(req);

    const executeApprove = async () => {
        const req = confirmApproveTarget;
        setConfirmApproveTarget(null);
        if (!req) return;
        setProcessing(req.id);
        try {
            await approveLeaveRequest(req.id, req.user_id, req.date, req.type);
            await load();
        } catch (e) { alert('처리 실패: ' + e.message); }
        finally { setProcessing(null); }
    };

    const handleReject = (req) => setRejectTarget(req);
    const confirmReject = async (note) => {
        setProcessing(rejectTarget.id);
        setRejectTarget(null);
        try {
            await rejectLeaveRequest(rejectTarget.id, rejectTarget.user_id, rejectTarget.date, rejectTarget.type, note);
            await load();
        } catch (e) { alert('처리 실패: ' + e.message); }
        finally { setProcessing(null); }
    };

    const pendingCount = requests.filter(r => r.status === 'SUBMITTED').length;

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
            {rejectTarget && <RejectModal onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />}
            <ConfirmModal
                isOpen={!!confirmApproveTarget}
                onClose={() => setConfirmApproveTarget(null)}
                onConfirm={executeApprove}
                title="승인 확인"
                message={confirmApproveTarget
                    ? `${confirmApproveTarget._userName || confirmApproveTarget.user_id.slice(0, 6)}님의 ${confirmApproveTarget.date} ${TYPE_LABEL[confirmApproveTarget.type] || ''} 신청을 승인하시겠습니까?`
                    : ''}
                confirmText="승인하기"
                cancelText="취소"
            />

            <div className="p-4 border-b-2 border-[#c5c0b0] flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={18} className="text-[#5d6c4a]" />
                    <span className="font-bold text-[#3d472f] text-sm">팀 승인함</span>
                    {pendingCount > 0 && (
                        <span className="bg-[#d8973c] text-white text-[10px] font-black px-2 py-0.5">{pendingCount}건 대기</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                        <option value="ALL">전체</option>
                        <option value="SUBMITTED">승인대기(팀)</option>
                        <option value="TEAM_APPROVED">1차 승인</option>
                        <option value="FINAL_PENDING">최종 대기</option>
                        <option value="FINAL_APPROVED">최종 승인</option>
                        <option value="REJECTED">반려</option>
                    </select>
                    <button onClick={load} className="border-2 border-[#c5c0b0] p-1.5 text-[#5a5545] hover:bg-[#e8e4d4]">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#e8e4d4] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="p-3 pl-4 text-left">신청자</th>
                            <th className="p-3 text-center">날짜</th>
                            <th className="p-3 text-center">유형</th>
                            <th className="p-3 text-left">사유</th>
                            <th className="p-3 text-center">신청일</th>
                            <th className="p-3 text-center">상태</th>
                            <th className="p-3 text-center">처리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebe8db]">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center"><Loader size={16} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                        ) : filtered.map(req => (
                            <tr key={req.id} className={`hover:bg-[#f4f5eb] ${req.status !== 'SUBMITTED' ? 'opacity-60' : ''}`}>
                                <td className="p-3 pl-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-[#5d6c4a] text-[#f5f3e8] text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {req._userName?.[0] || '?'}
                                        </div>
                                        <span className="font-bold text-[#3d472f] text-xs">{req._userName || req.user_id.slice(0, 6)}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-center font-mono text-xs font-bold text-[#3d472f]">{req.date}</td>
                                <td className="p-3 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 ${TYPE_COLOR[req.type]}`}>{TYPE_LABEL[req.type]}</span>
                                </td>
                                <td className="p-3 text-xs text-[#7a7565] max-w-[120px] truncate">{req.reason || '-'}</td>
                                <td className="p-3 text-center text-xs text-[#9a9585]">{req.created_at?.slice(0, 10)}</td>
                                <td className="p-3 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 ${STATUS_COLOR[req.status]}`}>
                                        {STATUS_LABEL[req.status]}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    {req.status === 'SUBMITTED' ? (
                                        activeGivenDelegation ? (
                                            <span className="text-[10px] font-bold px-2 py-1 bg-[#fdf6e3] border border-[#d8973c] text-[#a06820]">
                                                {activeGivenDelegation._toName} 위임 중
                                            </span>
                                        ) : (
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={() => handleApprove(req)} disabled={!!processing}
                                                    className="flex items-center gap-1 px-2 py-1 bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] text-[10px] font-bold hover:bg-[#4a5639] disabled:opacity-50">
                                                    {processing === req.id ? <Loader size={10} className="animate-spin" /> : <CheckCircle size={12} />} 승인
                                                </button>
                                                <button onClick={() => handleReject(req)} disabled={!!processing}
                                                    className="flex items-center gap-1 px-2 py-1 bg-[#a65d57] border border-[#7a3f3a] text-white text-[10px] font-bold hover:bg-[#7a3f3a] disabled:opacity-50">
                                                    <XCircle size={12} /> 반려
                                                </button>
                                            </div>
                                        )
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-[#9a9585] text-xs">해당하는 신청이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {filtered.length > 0 && (
                <div className="p-3 border-t border-[#e8e4d4] text-right text-xs text-[#9a9585]">
                    총 {filtered.length}건
                </div>
            )}

            {/* 결재 기록 내역 */}
            <AdminApprovalHistory />
        </div>
    );
}
