import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmModal } from '../modals/DialogModals';
import AdminApprovalHistory from './AdminApprovalHistory';
import LeaveDetailModal from '../modals/LeaveDetailModal';

const TYPE_LABEL = { FULL: '연차', HALF_AM: '오전반차', HALF_PM: '오후반차' };
const TYPE_COLOR = { FULL: 'bg-[#5d6c4a] text-[#f5f3e8]', HALF_AM: 'bg-[#4a6070] text-[#f5f3e8]', HALF_PM: 'bg-[#4a6070] text-[#f5f3e8]' };
const DEDUCTION = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };
const TEAM_COLOR = { '카페': 'bg-[#d8973c]', '생산기획': 'bg-[#5d6c4a]', 'QC': 'bg-[#4a6070]', 'ER': 'bg-[#a65d57]', 'LM': 'bg-[#7a7565]' };
const STATUS_LABEL = { SUBMITTED: '승인대기(팀)', TEAM_APPROVED: '1차승인', FINAL_PENDING: '최종대기', CEO_PENDING: '승인대기(대표)', FINAL_APPROVED: '최종승인', REJECTED: '반려', CANCELLED: '취소' };
const STATUS_COLOR = {
    SUBMITTED: 'bg-[#d8973c] text-white',
    TEAM_APPROVED: 'bg-[#7a8c5f] text-white',
    FINAL_PENDING: 'bg-[#5d6c4a] text-white',
    CEO_PENDING: 'bg-[#4a6070] text-white',
    FINAL_APPROVED: 'bg-[#3d6b5e] text-white',
    REJECTED: 'bg-[#a65d57] text-white',
    CANCELLED: 'bg-[#c5c0b0] text-[#5a5545]',
};

function RejectModal({ title, onConfirm, onCancel }) {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-[#f5f3e8] border-2 border-[#a65d57] w-full max-w-sm p-6">
                <h3 className="font-bold text-[#3d472f] mb-3">{title || '반려 사유 입력'}</h3>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="반려 사유를 입력해주세요 (필수)" rows={3}
                    className="w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm resize-none outline-none focus:border-[#a65d57] mb-3" />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="flex-1 py-2 border-2 border-[#c5c0b0] text-xs font-bold text-[#5a5545] hover:bg-[#e8e4d4]">취소</button>
                    <button onClick={() => onConfirm(note.trim())} disabled={!note.trim()} className="flex-1 py-2 bg-[#a65d57] border-2 border-[#7a3f3a] text-xs font-bold text-white hover:bg-[#7a3f3a] disabled:opacity-40 disabled:cursor-not-allowed">반려 확정</button>
                </div>
            </div>
        </div>
    );
}

export default function FinalApprovalInbox() {
    const {
        getAllTeamApprovedRequests, finalApproveLeaveRequest, finalRejectLeaveRequest,
        getAllSubmittedRequests, proxyTeamApprove, proxyTeamReject,
    } = useAuth();

    // mode: 'FINAL' = 최종 승인 (TEAM_APPROVED), 'PROXY' = 팀 대행 (SUBMITTED)
    const [mode, setMode] = useState('FINAL');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [confirmApproveTarget, setConfirmApproveTarget] = useState(null);
    const [detailTarget, setDetailTarget] = useState(null);
    const [errors, setErrors] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setErrors({});
        try {
            const data = mode === 'FINAL'
                ? await getAllTeamApprovedRequests()
                : await getAllSubmittedRequests();
            setRequests(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [mode, getAllTeamApprovedRequests, getAllSubmittedRequests]);

    useEffect(() => { load(); }, [load]);

    const handleApprove = (req) => setConfirmApproveTarget(req);

    const executeApprove = async () => {
        const req = confirmApproveTarget;
        setConfirmApproveTarget(null);
        if (!req) return;

        const isFinal = mode === 'FINAL';
        setProcessing(req.id);
        setErrors(e => ({ ...e, [req.id]: null }));
        try {
            if (isFinal) {
                await finalApproveLeaveRequest(req.id, req.user_id, req.date, req.type);
            } else {
                await proxyTeamApprove(req.id, req.user_id, req.date, req.type, null, true);
            }
            await load();
        } catch (err) {
            setErrors(e => ({ ...e, [req.id]: err.message }));
        } finally { setProcessing(null); }
    };

    const handleReject = (req) => setRejectTarget(req);
    const confirmReject = async (note) => {
        const isFinal = mode === 'FINAL';
        setProcessing(rejectTarget.id);
        setRejectTarget(null);
        try {
            if (isFinal) {
                await finalRejectLeaveRequest(rejectTarget.id, rejectTarget.user_id, rejectTarget.date, rejectTarget.type, note);
            } else {
                await proxyTeamReject(rejectTarget.id, rejectTarget.user_id, rejectTarget.date, rejectTarget.type, note, null, true);
            }
            await load();
        } catch (e) { alert('처리 실패: ' + e.message); }
        finally { setProcessing(null); }
    };

    const isFinalMode = mode === 'FINAL';
    const approveLabel = isFinalMode ? '승인' : '팀 대행 승인';
    const pendingCount = isFinalMode
        ? requests.filter(r => r.status === 'TEAM_APPROVED' || r.status === 'FINAL_PENDING').length
        : requests.filter(r => r.status === 'SUBMITTED').length;

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
            {rejectTarget && (
                <RejectModal
                    title={isFinalMode ? '최종 반려 사유 입력' : '팀 대행 반려 사유 입력'}
                    onConfirm={confirmReject}
                    onCancel={() => setRejectTarget(null)}
                />
            )}
            <LeaveDetailModal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} request={detailTarget} />

            <ConfirmModal
                isOpen={!!confirmApproveTarget}
                onClose={() => setConfirmApproveTarget(null)}
                onConfirm={executeApprove}
                title={isFinalMode ? '승인' : '팀 대행 승인'}
                message={
                    confirmApproveTarget
                        ? (isFinalMode
                            ? `${confirmApproveTarget._userName}님의 ${confirmApproveTarget.date} 신청을 승인하시겠습니까?`
                            : `${confirmApproveTarget._userName}님의 ${confirmApproveTarget.date} 신청을 팀 승인 대행 처리하시겠습니까?`)
                        : ''
                }
                confirmText="승인하기"
                cancelText="취소"
            />

            {/* 헤더 + 모드 토글 */}
            <div className="p-4 border-b-2 border-[#c5c0b0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-[#5d6c4a]" />
                    <span className="font-bold text-[#3d472f] text-sm">
                        {isFinalMode ? '승인함 (실장)' : '팀 승인 대행함'}
                    </span>
                    {pendingCount > 0 && (
                        <span className={`text-[10px] font-black text-white px-2 py-0.5 ${isFinalMode ? 'bg-[#5d6c4a]' : 'bg-[#d8973c]'}`}>
                            {pendingCount}건 대기
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* 모드 토글 */}
                    <div className="flex border-2 border-[#3d472f] bg-[#f5f3e8]">
                        {[
                            { key: 'FINAL', label: '승인' },
                            { key: 'PROXY', label: '팀 대행' },
                        ].map(m => (
                            <button key={m.key} onClick={() => setMode(m.key)}
                                className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${mode === m.key ? 'bg-[#3d472f] text-[#f5f3e8]' : 'text-[#5a5545] hover:bg-[#e8e4d4]'}`}>
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={load} className="border-2 border-[#c5c0b0] p-1.5 text-[#5a5545] hover:bg-[#e8e4d4]">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* PROXY 모드 안내 */}
            {mode === 'PROXY' && (
                <div className="px-4 py-2 bg-[#fdf6e3] border-b border-[#e8d8a0] text-[10px] text-[#a06820] font-bold">
                    ⚡ 팀 관리자 부재 시 대행 승인 모드 — approvals 로그에 "FINAL_APPROVER 대행"으로 기록됩니다.
                </div>
            )}

            {/* 테이블 */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#e8e4d4] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="p-3 pl-4 text-left">신청자</th>
                            <th className="p-3 text-center">팀</th>
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
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-xs text-[#9a9585]">
                                {isFinalMode
                                    ? <span>팀 승인 완료된 대기 신청이 없습니다.<br /><span className="text-[#a65d57] font-bold mt-1 inline-block">💡 새로운 신청은 [팀 대행] 탭에서 확인하세요.</span></span>
                                    : 'SUBMITTED 상태 신청이 없습니다.'}
                            </td></tr>
                        ) : requests.map(req => (
                            <React.Fragment key={req.id}>
                                <tr className="hover:bg-[#f4f5eb]">
                                    <td className="p-3 pl-4">
                                        <button onClick={() => setDetailTarget(req)} className="flex items-center gap-2 hover:bg-[#e8e4d4] p-1 rounded transition-colors group">
                                            <div className="w-6 h-6 bg-[#5d6c4a] text-[#f5f3e8] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {req._userName?.[0] || '?'}
                                            </div>
                                            <span className="font-bold text-[#3d472f] text-xs group-hover:underline">{req._userName}</span>
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 text-white ${TEAM_COLOR[req.team_id] || 'bg-[#7a7565]'}`}>{req.team_id}</span>
                                    </td>
                                    <td className="p-3 text-center font-mono text-xs font-bold text-[#3d472f]">{req.date}</td>
                                    <td className="p-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 ${TYPE_COLOR[req.type]}`}>
                                            {TYPE_LABEL[req.type]}{isFinalMode ? ` (${DEDUCTION[req.type]}일)` : ''}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs text-[#7a7565] whitespace-pre-wrap word-break">{req.reason || '-'}</td>
                                    <td className="p-3 text-center text-xs text-[#9a9585]">{req.created_at?.slice(0, 10)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 ${STATUS_COLOR[req.status] || 'bg-[#e8e4d4] text-[#5a5545]'}`}>
                                            {STATUS_LABEL[req.status] || req.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        {(isFinalMode ? (req.status === 'TEAM_APPROVED' || req.status === 'FINAL_PENDING') : req.status === 'SUBMITTED') ? (
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => setConfirmApproveTarget(req)} className="flex items-center gap-1 bg-[#5d6c4a] text-white px-2 py-1 text-xs hover:bg-[#4a5639] transition-colors"><CheckCircle size={12} /> {approveLabel}</button>
                                                <button onClick={() => setRejectTarget(req)} className="flex items-center gap-1 bg-[#a65d57] text-white px-2 py-1 text-xs hover:bg-[#8b4d47] transition-colors"><XCircle size={12} /> 반려</button>
                                            </div>
                                        ) : req.status === 'REJECTED' ? (
                                            <div className="text-left text-[10px] text-[#a65d57] space-y-0.5">
                                                <div className="font-bold">{req.rejected_by_name || req.ceo_decision?.name || (req.final_approvals ? (Object.values(req.final_approvals).find(v => v.status === 'REJECTED')?.name || null) : null) || '-'}</div>
                                                <div className="text-[#7a7565] break-all whitespace-pre-wrap">{req.rejected_reason !== undefined ? (req.rejected_reason || '(사유 없음)') : (req.ceo_decision?.note || (req.final_approvals ? (Object.values(req.final_approvals).find(v => v.status === 'REJECTED')?.note || '') : '') || '(사유 없음)')}</div>
                                            </div>
                                        ) : '-'}
                                    </td>
                                </tr>
                                {errors[req.id] && (
                                    <tr>
                                        <td colSpan={7} className="px-4 pb-2">
                                            <div className="flex items-center gap-2 bg-[#f8f0ef] border border-[#dcc0bc] px-3 py-2 text-xs text-[#a65d57]">
                                                <AlertCircle size={12} className="shrink-0" />
                                                <span className="font-bold">{errors[req.id]}</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 결재 기록 내역 */}
            <AdminApprovalHistory />
        </div>
    );
}
