import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmModal } from '../modals/DialogModals';
import LeaveDetailModal from '../modals/LeaveDetailModal';

const DEDUCTION = { FULL: 1.0, HALF_AM: 0.5, HALF_PM: 0.5 };

function RejectModal({ title, onConfirm, onCancel }) {
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-[#f5f3e8] border-2 border-[#8d5a4d] w-full max-w-sm p-6">
                <h3 className="font-bold text-[#3d472f] mb-3">{title || '반려 사유 입력'}</h3>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="반려 사유를 입력해주세요 (필수)" rows={3}
                    className="w-full p-2 border border-[#d4cfbf] bg-[#faf8f0] text-sm resize-none outline-none focus:border-[#8d5a4d] mb-3" />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="flex-1 py-2 border border-[#d4cfbf] text-xs font-bold text-[#5a5545] hover:bg-[#f5f3e8]">취소</button>
                    <button onClick={() => onConfirm(note.trim())} disabled={!note.trim()} className="flex-1 py-2 bg-[#8d5a4d] border-2 border-[#7a4d40] text-xs font-bold text-white hover:bg-[#7a4d40] disabled:opacity-40 disabled:cursor-not-allowed">반려 확정</button>
                </div>
            </div>
        </div>
    );
}

export default function CEOApprovalInbox() {
    const {
        getCEOApprovalRequests, ceoApproveLeaveRequest, ceoRejectLeaveRequest,
        getMyActiveGivenCEODelegation,
    } = useAuth();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [confirmApproveTarget, setConfirmApproveTarget] = useState(null);
    const [detailTarget, setDetailTarget] = useState(null);
    const [errors, setErrors] = useState({});
    const [showDone, setShowDone] = useState(false);
    const [activeGivenCEODelegation, setActiveGivenCEODelegation] = useState(null);

    useEffect(() => {
        getMyActiveGivenCEODelegation().then(setActiveGivenCEODelegation).catch(() => {});
    }, []);

    const pending = requests.filter(r => r.status === 'CEO_PENDING');
    const done = requests.filter(r => r.status !== 'CEO_PENDING');

    const load = useCallback(async () => {
        setLoading(true);
        setErrors({});
        try {
            const data = await getCEOApprovalRequests();
            setRequests(data);
        } catch (e) { console.error('[DEBUG CEOInbox] load error:', e); }
        finally { setLoading(false); }
    }, [getCEOApprovalRequests]);

    useEffect(() => { load(); }, [load]);

    const handleApprove = (req) => setConfirmApproveTarget(req);

    const executeApprove = async () => {
        const req = confirmApproveTarget;
        setConfirmApproveTarget(null);
        if (!req) return;

        setProcessing(req.id);
        setErrors(e => ({ ...e, [req.id]: null }));
        try {
            await ceoApproveLeaveRequest(req.id);
            await load();
        } catch (err) {
            setErrors(e => ({ ...e, [req.id]: err.message }));
        } finally { setProcessing(null); }
    };

    const handleReject = (req) => setRejectTarget(req);
    const confirmReject = async (note) => {
        setProcessing(rejectTarget.id);
        setRejectTarget(null);
        try {
            await ceoRejectLeaveRequest(rejectTarget.id, rejectTarget.user_id, rejectTarget.date, rejectTarget.type, note);
            await load();
        } catch (e) { alert('처리 실패: ' + e.message); }
        finally { setProcessing(null); }
    };

    return (
        <div className="bg-[#f5f3e8] border border-[#d4cfbf]">
            {rejectTarget && (
                <RejectModal
                    title={'최종 반려 사유 입력'}
                    onConfirm={confirmReject}
                    onCancel={() => setRejectTarget(null)}
                />
            )}
            <LeaveDetailModal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} request={detailTarget} />

            <ConfirmModal
                isOpen={!!confirmApproveTarget}
                onClose={() => setConfirmApproveTarget(null)}
                onConfirm={executeApprove}
                title={'대표 최종 승인'}
                message={
                    confirmApproveTarget
                        ? `${confirmApproveTarget._userName}님의 ${confirmApproveTarget.date} 신청을 최종 승인하시겠습니까?\\n잔여 연차 ${DEDUCTION[confirmApproveTarget.type]}일이 차감됩니다.`
                        : ''
                }
                confirmText="승인하기"
                cancelText="취소"
            />

            {/* 헤더 */}
            <div className="p-4 border-b border-[#d4cfbf] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-[#5d6c4a]" />
                    <span className="font-bold text-[#3d472f] text-sm">
                        대표 최종 결재함
                    </span>
                    {pending.length > 0 && (
                        <span className="text-[10px] font-black text-white px-2 py-0.5 bg-[#5d6c4a]">
                            {pending.length}건 대기
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="border border-[#d4cfbf] p-1.5 text-[#5a5545] hover:bg-[#f5f3e8]">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* 대기 중 테이블 */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#f5f3e8] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="p-3 pl-4 text-left">신청자</th>
                            <th className="p-3 text-center">팀</th>
                            <th className="p-3 text-center">날짜</th>
                            <th className="p-3 text-center">유형</th>
                            <th className="p-3 text-left">사유</th>
                            <th className="p-3 text-center">신청일</th>
                            <th className="p-3 text-center">처리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebe8db]">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center"><Loader size={16} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                        ) : pending.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-xs text-[#9a9585]">
                                <span>대표님 결재를 대기 중인 연차 신청이 없습니다.</span>
                            </td></tr>
                        ) : pending.map(req => (
                            <tr key={req.id} className="hover:bg-[#fdfdf9] cursor-pointer transition-colors"
                                onClick={() => setDetailTarget(req)}>
                                <td className="p-3 pl-4">
                                    <p className="font-bold text-[#3d472f]">{req._userName}</p>
                                </td>
                                <td className="p-3 text-center">
                                    <span className="text-xs bg-[#e8e4d4] px-2 py-0.5 font-bold text-[#5a5545]">{req.team_id || '-'}</span>
                                </td>
                                <td className="p-3 text-center font-bold text-[#5d6c4a]">{req.date}</td>
                                <td className="p-3 text-center">
                                    <span className="text-xs bg-[#e8ebd8] text-[#5d6c4a] font-bold px-2 py-0.5">
                                        {req.type === 'FULL' ? '연차' : req.type === 'HALF_AM' ? '오전반차' : '오후반차'}
                                    </span>
                                </td>
                                <td className="p-3 text-[#5a5545] text-xs max-w-[150px] truncate" title={req.reason}>
                                    {req.reason || '-'}
                                </td>
                                <td className="p-3 text-center text-[10px] text-[#7a7565]">
                                    {req.created_at?.slice(0, 10)}
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                    {errors[req.id] && (
                                        <div className="text-[10px] text-[#8d5a4d] font-bold mb-1 break-all bg-[#f5ebe7] p-1 border border-[#cba79c]">
                                            {errors[req.id]}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                        {processing === req.id ? (
                                            <Loader size={14} className="animate-spin text-[#a78049]" />
                                        ) : activeGivenCEODelegation ? (
                                            <span className="inline-flex flex-col items-center text-[10px] font-bold px-2 py-1 bg-[#f5f1e3] border border-[#a78049] text-[#7a5a1a]">
                                                <span>{activeGivenCEODelegation._toName} 위임 중</span>
                                                <span className="text-[9px] font-normal mt-0.5">{activeGivenCEODelegation.start_date} ~ {activeGivenCEODelegation.end_date}</span>
                                            </span>
                                        ) : (
                                            <>
                                                <button onClick={() => handleApprove(req)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] text-[10px] font-bold hover:bg-[#4a5639] transition-colors whitespace-nowrap">
                                                    <CheckCircle size={11} /> 승인
                                                </button>
                                                <button onClick={() => handleReject(req)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#faf8f0] border border-[#cba79c] text-[#8d5a4d] text-[10px] font-bold hover:bg-[#f5ebe7] transition-colors whitespace-nowrap">
                                                    <XCircle size={11} /> 반려
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 처리 완료 건 접기/펼치기 */}
            {!loading && done.length > 0 && (
                <div className="border-t border-[#d4cfbf]">
                    <button
                        onClick={() => setShowDone(v => !v)}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-[#7a7565] hover:bg-[#eeece0] flex items-center gap-2 transition-colors">
                        <span>{showDone ? '▲' : '▼'}</span>
                        <span>처리 완료 {done.length}건</span>
                    </button>
                    {showDone && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#f5f3e8] text-xs font-bold text-[#5d6c4a] uppercase">
                                    <tr>
                                        <th className="p-3 pl-4 text-left">신청자</th>
                                        <th className="p-3 text-center">팀</th>
                                        <th className="p-3 text-center">날짜</th>
                                        <th className="p-3 text-center">유형</th>
                                        <th className="p-3 text-left">사유</th>
                                        <th className="p-3 text-center">신청일</th>
                                        <th className="p-3 text-center">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ebe8db]">
                                    {done.map(req => (
                                        <tr key={req.id} className="opacity-60 hover:opacity-80 hover:bg-[#fdfdf9] cursor-pointer transition-all"
                                            onClick={() => setDetailTarget(req)}>
                                            <td className="p-3 pl-4">
                                                <p className="font-bold text-[#3d472f]">{req._userName}</p>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-xs bg-[#e8e4d4] px-2 py-0.5 font-bold text-[#5a5545]">{req.team_id || '-'}</span>
                                            </td>
                                            <td className="p-3 text-center font-bold text-[#5d6c4a]">{req.date}</td>
                                            <td className="p-3 text-center">
                                                <span className="text-xs bg-[#e8ebd8] text-[#5d6c4a] font-bold px-2 py-0.5">
                                                    {req.type === 'FULL' ? '연차' : req.type === 'HALF_AM' ? '오전반차' : '오후반차'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[#5a5545] text-xs max-w-[150px] truncate" title={req.reason}>
                                                {req.reason || '-'}
                                            </td>
                                            <td className="p-3 text-center text-[10px] text-[#7a7565]">
                                                {req.created_at?.slice(0, 10)}
                                            </td>
                                            <td className="p-3 text-center">
                                                {req.status === 'FINAL_APPROVED' ? (
                                                    <span className="text-[10px] font-bold px-2 py-1 bg-[#3d6b5e] text-white">최종 승인 완료</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-2 py-1 bg-[#8d5a4d] text-white">반려됨</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
