import React, { useState, useEffect } from 'react';
import { List, X, ChevronDown, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmModal } from '../modals/DialogModals';
import LeaveDetailModal from '../modals/LeaveDetailModal';
import { formatAppliedDates } from '../../utils/leaveUtils';

const TYPE_LABEL = { FULL: '연차', HALF_AM: '오전반차', HALF_PM: '오후반차' };
const TYPE_COLOR = {
    FULL: 'bg-[#5d6c4a] text-[#f5f3e8]',
    HALF_AM: 'bg-[#4a6070] text-[#f5f3e8]',
    HALF_PM: 'bg-[#4a6070] text-[#f5f3e8]',
};
const STATUS_LABEL = {
    SUBMITTED: '승인대기(팀)',
    TEAM_APPROVED: '승인대기(실장)',
    FINAL_PENDING: '승인대기(실장)',
    CEO_PENDING: '승인대기(대표)',
    FINAL_APPROVED: '최종승인',
    REJECTED: '반려됨',
    CANCELLED: '취소됨'
};
const STATUS_COLOR = {
    SUBMITTED: 'bg-[#d8973c] text-white',
    TEAM_APPROVED: 'bg-[#7a8c5f] text-white',
    FINAL_PENDING: 'bg-[#5d6c4a] text-white',
    CEO_PENDING: 'bg-[#4a6070] text-white',
    FINAL_APPROVED: 'bg-[#3d6b5e] text-white',
    REJECTED: 'bg-[#a65d57] text-white',
    CANCELLED: 'bg-[#c5c0b0] text-[#5a5545]',
};

export default function LeaveHistoryList({ refreshKey }) {
    const { getMyLeaveRequests, cancelLeaveRequest, userProfile } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [cancelling, setCancelling] = useState(null); // reqId
    const [confirmCancel, setConfirmCancel] = useState(null); // reqId for modal
    const [detailTarget, setDetailTarget] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getMyLeaveRequests(filterYear);
            setRequests(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [filterYear, refreshKey]);

    const requestCancel = (reqId) => {
        setConfirmCancel(reqId);
    };

    const executeCancel = async () => {
        if (!confirmCancel) return;
        setCancelling(confirmCancel);
        try {
            await cancelLeaveRequest(confirmCancel);
            await load();
        } catch (e) { alert('취소 실패: ' + e.message); }
        finally {
            setCancelling(null);
            setConfirmCancel(null);
        }
    };

    const filtered = filterStatus === 'ALL' ? requests : requests.filter(r => r.status === filterStatus);
    const years = [new Date().getFullYear(), new Date().getFullYear() - 1];

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
            <div className="p-4 border-b-2 border-[#c5c0b0] flex flex-wrap gap-2 items-center justify-between">
                <h3 className="font-bold text-[#3d472f] flex items-center gap-2">
                    <List size={18} className="text-[#5d6c4a]" /> 신청 내역
                </h3>
                <div className="flex gap-2">
                    <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                        {years.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                        <option value="ALL">전체</option>
                        <option value="SUBMITTED">승인대기(팀)</option>
                        <option value="TEAM_APPROVED">승인대기(실장)</option>
                        <option value="FINAL_PENDING">승인진행중</option>
                        <option value="CEO_PENDING">승인대기(대표)</option>
                        <option value="FINAL_APPROVED">최종승인</option>
                        <option value="REJECTED">반려됨</option>
                        <option value="CANCELLED">취소됨</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                    <thead className="bg-[#e8e4d4] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="px-3 py-2 pl-4 text-left whitespace-nowrap">날짜</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">유형</th>
                            <th className="px-3 py-2 text-left">사유</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">상태</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">취소</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebe8db]">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center"><Loader size={16} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                        ) : filtered.map(req => (
                            <tr key={req.id} onClick={() => setDetailTarget({ ...req, _userName: req._userName || userProfile?.name })} className={`hover:bg-[#f4f5eb] cursor-pointer ${req.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
                                <td className="px-3 py-2 pl-4 font-bold text-[#3d472f] font-mono whitespace-nowrap text-xs">
                                    {formatAppliedDates(req.applied_dates, req.date)}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block leading-tight ${TYPE_COLOR[req.type] || 'bg-[#e8e4d4] text-[#5a5545]'}`}>
                                        {TYPE_LABEL[req.type] || req.type}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-[#7a7565]"><span className="line-clamp-1">{req.reason || '-'}</span></td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block leading-tight ${STATUS_COLOR[req.status] || 'bg-[#e8e4d4]'}`}>
                                        {STATUS_LABEL[req.status] || req.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                    {req.status === 'SUBMITTED' ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); requestCancel(req.id); }}
                                            disabled={cancelling === req.id}
                                            className="text-[#a65d57] hover:bg-[#f8f0ef] p-1 rounded border border-[#dcc0bc] text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                            {cancelling === req.id ? <Loader size={12} className="animate-spin" /> : <X size={14} />}
                                        </button>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-[#9a9585] text-xs">신청 내역이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {filtered.length > 0 && (
                <div className="p-3 border-t border-[#e8e4d4] text-right text-xs text-[#9a9585]">
                    총 {filtered.length}건 | 대기 {filtered.filter(r => r.status === 'SUBMITTED').length}건 | 취소 {filtered.filter(r => r.status === 'CANCELLED').length}건
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmCancel}
                onClose={() => setConfirmCancel(null)}
                onConfirm={executeCancel}
                title="연차 취소"
                message="해당 연차 신청을 취소하시겠습니까?\n취소된 연차는 내역에만 남고 사용 일수에 반영되지 않습니다."
                confirmText="신청 취소"
                cancelText="돌아가기"
                isDanger={true}
            />

            <LeaveDetailModal
                isOpen={!!detailTarget}
                onClose={() => setDetailTarget(null)}
                request={detailTarget}
            />
        </div>
    );
}
