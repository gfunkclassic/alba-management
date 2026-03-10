import React, { useState, useEffect } from 'react';
import { History, Loader } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import LeaveDetailModal from '../modals/LeaveDetailModal';
import { canApprove } from '../../utils/roleUtils';

const ACTION_LABEL = {
    APPROVE: '승인',
    REJECT: '반려',
};
const ACTION_COLOR = {
    APPROVE: 'text-[#5d6c4a]',
    REJECT: 'text-[#a65d57]',
};
const STAGE_LABEL = {
    TEAM: '1차 (팀)',
    FINAL: '2차 (최종)',
};

export default function AdminApprovalHistory() {
    const { userProfile } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailTarget, setDetailTarget] = useState(null);

    const formatNote = (note) => {
        if (!note) return null;
        const cleaned = note.replace(/^\[FINAL_APPROVER 대행\]\s*|^FINAL_APPROVER 대행$/, '');
        return cleaned.trim() === '' ? null : cleaned;
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            // approvals 컬렉션 최신 50개 가져오기
            const q = query(collection(db, 'approvals'), orderBy('acted_at', 'desc'), limit(50));
            const snap = await getDocs(q);
            const rawApprovals = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // 관련된 사용자 정보 (신청자, 승인자) 캐싱 및 매핑
            const userCache = {};
            const getUserName = async (uid) => {
                if (!uid) return '-';
                if (userCache[uid]) return userCache[uid];
                try {
                    const uSnap = await getDoc(doc(db, 'users', uid));
                    const name = uSnap.exists() ? uSnap.data().name : uid;
                    userCache[uid] = name;
                    return name;
                } catch {
                    return uid;
                }
            };

            const enriched = await Promise.all(rawApprovals.map(async (appr) => {
                // leave_request 정보 가져오기 (신청자 확인용)
                let applicantName = '-';
                let reqType = '-';
                let reqDate = '-';
                let fullRequest = null;
                try {
                    const reqSnap = await getDoc(doc(db, 'leave_requests', appr.leave_request_id));
                    if (reqSnap.exists()) {
                        const reqData = reqSnap.data();
                        applicantName = await getUserName(reqData.user_id);
                        reqType = reqData.type;
                        reqDate = reqData.date;
                        fullRequest = { id: reqSnap.id, ...reqData, _userName: applicantName };
                    }
                } catch (e) { console.warn('req fetch fail', e); }

                const actorName = await getUserName(appr.actor_user_id);
                // 대행 승인인 경우 원래 승인자(팀장) 이름도 가져옴
                let proxyForName = null;
                if (appr.delegation_from_user_id) {
                    proxyForName = await getUserName(appr.delegation_from_user_id);
                }

                return {
                    ...appr,
                    _applicantName: applicantName,
                    _reqType: reqType,
                    _reqDate: reqDate,
                    _actorName: actorName,
                    _proxyForName: proxyForName,
                    _fullRequest: fullRequest,
                };
            }));

            setHistory(enriched);
        } catch (error) {
            console.error('승인 내역 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canApprove(userProfile?.roleGroup)) {
            loadHistory();
        }
    }, [userProfile]);

    if (!userProfile) return null;
    if (!canApprove(userProfile.roleGroup)) return null;

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] mt-8">
            <LeaveDetailModal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} request={detailTarget} />

            <div className="flex items-center justify-between p-4 border-b-2 border-[#c5c0b0]">
                <h3 className="font-bold text-[#3d472f] flex items-center gap-2">
                    <History size={18} className="text-[#5d6c4a]" /> 최근 승인/반려 내역 (50건)
                </h3>
                <button onClick={loadHistory} className="text-xs text-[#5d6c4a] font-bold border border-[#b8c4a0] px-2 py-1 hover:bg-[#e8e4d4]">새로고침</button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#e8e4d4] text-xs font-bold text-[#5d6c4a] uppercase">
                        <tr>
                            <th className="p-3 pl-4 text-left">처리 일시</th>
                            <th className="p-3 text-left">신청자</th>
                            <th className="p-3 text-left">연차일 및 유형</th>
                            <th className="p-3 text-center">단계</th>
                            <th className="p-3 text-center">결과</th>
                            <th className="p-3 text-left">처리자 (메모)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebe8db]">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader size={16} className="animate-spin mx-auto text-[#9a9585]" /></td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-[#9a9585] text-xs">최근 승인 내역이 없습니다.</td></tr>
                        ) : history.map((item) => (
                            <tr key={item.id} className="hover:bg-[#f4f5eb]">
                                <td className="p-3 pl-4 text-xs text-[#7a7565] whitespace-nowrap">
                                    {new Date(item.acted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-3 font-bold text-[#3d472f] whitespace-nowrap">
                                    {item._fullRequest ? (
                                        <button onClick={() => setDetailTarget(item._fullRequest)} className="hover:underline text-left">{item._applicantName}</button>
                                    ) : (
                                        item._applicantName
                                    )}
                                </td>
                                <td className="p-3 text-xs whitespace-nowrap">
                                    <span className="font-mono bg-[#e8e4d4] px-1 mr-1">{item._reqDate}</span>
                                    <span className="text-[#7a7565]">
                                        {item._reqType === 'FULL' ? '연차' : item._reqType === 'HALF_AM' ? '오전반차' : item._reqType === 'HALF_PM' ? '오후반차' : item._reqType}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 border ${item.stage === 'FINAL' ? 'border-[#3d6b5e] text-[#3d6b5e]' : 'border-[#5d6c4a] text-[#5d6c4a]'}`}>
                                        {STAGE_LABEL[item.stage] || item.stage}
                                    </span>
                                </td>
                                <td className={`p-3 text-center font-bold whitespace-nowrap ${ACTION_COLOR[item.action]}`}>
                                    {ACTION_LABEL[item.action] || item.action}
                                </td>
                                <td className="p-3 text-xs">
                                    <div className="font-bold text-[#3d472f]">
                                        {item._actorName}
                                        {item._proxyForName && <span className="font-normal text-[#9a9585]"> ({item._proxyForName} 대행)</span>}
                                    </div>
                                    {item.note && formatNote(item.note) && (
                                        <div className="text-[#7a7565] mt-0.5 truncate max-w-[200px]" title={formatNote(item.note)}>
                                            {formatNote(item.note)}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
