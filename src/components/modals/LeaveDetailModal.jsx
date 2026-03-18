import React, { useState, useEffect } from 'react';
import { X, History, Loader, AlertTriangle, User } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ACTION_LABEL = { APPROVE: '승인', REJECT: '반려' };
const ACTION_COLOR = { APPROVE: 'text-[#5d6c4a]', REJECT: 'text-[#a65d57]' };
const STAGE_LABEL = { TEAM: '1차 (팀)', FINAL: '2차 (최종)' };
const TYPE_LABEL = { FULL: '연차', HALF_AM: '반차(오전)', HALF_PM: '반차(오후)' };

export default function LeaveDetailModal({ isOpen, onClose, request }) {
    const [history, setHistory] = useState([]);
    const [finalApproversList, setFinalApproversList] = useState([]);
    const [teamApprover, setTeamApprover] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !request) return;

        const loadDetails = async () => {
            setLoading(true);
            try {
                const targetRequestId = request.leave_request_id || request.id;
                const q = query(
                    collection(db, 'approvals'),
                    where('leave_request_id', '==', targetRequestId),
                    orderBy('acted_at', 'desc')
                );
                const snap = await getDocs(q);

                const faSnap = await getDocs(query(collection(db, 'users'), where('roleGroup', 'in', ['approver_senior', 'approver_final']), where('status', '==', 'ACTIVE')));
                const faList = faSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
                setFinalApproversList(faList);

                if (request.team_id) {
                    const taSnap = await getDocs(query(collection(db, 'users'), where('roleGroup', '==', 'manager'), where('team_id', '==', request.team_id), where('status', '==', 'ACTIVE')));
                    const taList = taSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
                    setTeamApprover(taList[0] || null);
                } else {
                    setTeamApprover(null);
                }

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

                const enriched = await Promise.all(snap.docs.map(async d => {
                    const data = d.data();
                    const actorName = await getUserName(data.actor_user_id);
                    let proxyForName = null;
                    if (data.delegation_from_user_id) {
                        proxyForName = await getUserName(data.delegation_from_user_id);
                    }
                    return { id: d.id, ...data, _actorName: actorName, _proxyForName: proxyForName };
                }));

                setHistory(enriched);
            } catch (err) {
                console.error('상세 내역 로드 실패', err);
            } finally {
                setLoading(false);
            }
        };

        loadDetails();
    }, [isOpen, request]);

    const formatNote = (note) => {
        if (!note) return null;
        const cleaned = note.replace(/^\[FINAL_APPROVER 대행\]\s*|^FINAL_APPROVER 대행$/, '');
        return cleaned.trim() === '' ? null : cleaned;
    };

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border-2 border-[#a65d57] overflow-hidden">
                <div className="flex justify-between items-center p-4 bg-[#a65d57] text-[#f5f3e8]">
                    <h2 className="text-sm font-black flex items-center gap-2">
                        <User size={16} /> 신청 상세 정보
                    </h2>
                    <button onClick={onClose} className="hover:text-[#e8d5b5] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-6 text-[#3d472f]">
                    {/* 기본 신청 정보 */}
                    <div className="bg-[#e8e4d4] p-4 rounded-lg border border-[#c5c0b0]">
                        <h3 className="text-xs font-bold text-[#5d6c4a] mb-3 uppercase">신청 내역</h3>
                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <div>
                                <span className="text-xs text-[#7a7565] block mb-0.5">신청자</span>
                                <span className="font-bold">{request._userName || request.user_id}</span>
                            </div>
                            <div>
                                <span className="text-xs text-[#7a7565] block mb-0.5">소속 팀</span>
                                <span className="font-bold">{request.team_id || '-'}</span>
                            </div>
                            <div>
                                <span className="text-xs text-[#7a7565] block mb-0.5">날짜</span>
                                <span className="font-mono font-bold">{request.date}</span>
                            </div>
                            <div>
                                <span className="text-xs text-[#7a7565] block mb-0.5">유형</span>
                                <span className="font-bold">{TYPE_LABEL[request.type] || request.type}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-[#7a7565] block mb-0.5">사유</span>
                                <span className="font-medium whitespace-pre-wrap">{request.reason || '-'}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-[#7a7565] block mb-0.5">신청 일시</span>
                                <span className="text-xs font-mono">{request.created_at ? new Date(request.created_at).toLocaleString('ko-KR') : '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 반려 정보 — REJECTED 상태일 때만 표시 */}
                    {request.status === 'REJECTED' && (() => {
                        // 새 snake_case 필드 우선, 없으면 기존 필드에서 fallback (구 데이터 호환)
                        const byName = request.rejected_by_name
                            || request.ceo_decision?.name
                            || (request.final_approvals
                                ? (Object.values(request.final_approvals).find(v => v.status === 'REJECTED')?.name || null)
                                : null)
                            || '-';
                        const reason = request.rejected_reason !== undefined
                            ? request.rejected_reason
                            : (request.ceo_decision?.note
                                || (request.final_approvals
                                    ? (Object.values(request.final_approvals).find(v => v.status === 'REJECTED')?.note || '')
                                    : ''));
                        const stageMap = { TEAM: '1차 (팀)', FINAL: '2차 (실장)', CEO: '3차 (대표)' };
                        const stage = request.rejected_stage
                            || (request.ceo_decision?.status === 'REJECTED' ? 'CEO'
                                : (request.final_approvals && Object.values(request.final_approvals).some(v => v.status === 'REJECTED') ? 'FINAL'
                                    : 'TEAM'));
                        const at = request.rejected_at
                            || request.ceo_decision?.acted_at
                            || (request.final_approvals
                                ? (Object.values(request.final_approvals).find(v => v.status === 'REJECTED')?.acted_at || null)
                                : null);
                        return (
                            <div className="bg-[#f8f0ef] border border-[#dcc0bc] rounded-lg p-4">
                                <h3 className="text-xs font-bold text-[#a65d57] mb-3 uppercase">반려 정보</h3>
                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                    <div>
                                        <span className="text-xs text-[#7a7565] block mb-0.5">반려자</span>
                                        <span className="font-bold text-[#a65d57]">{byName}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-[#7a7565] block mb-0.5">반려 단계</span>
                                        <span className="font-bold">{stageMap[stage] || stage}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-[#7a7565] block mb-0.5">반려 사유</span>
                                        <span className="font-medium whitespace-pre-wrap">{reason || '(사유 없음)'}</span>
                                    </div>
                                    {at && (
                                        <div className="col-span-2">
                                            <span className="text-xs text-[#7a7565] block mb-0.5">반려 일시</span>
                                            <span className="text-xs font-mono">{new Date(at).toLocaleString('ko-KR')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 결재선 요약 (Naver Works Style) */}
                    <div className="bg-white rounded-lg border border-[#c5c0b0] overflow-x-auto">
                        <div className="bg-[#f0e8d5] px-3 py-2 border-b border-[#c5c0b0]">
                            <h3 className="text-xs font-bold text-[#5a5545]">결재선 요약</h3>
                        </div>
                        <div className="flex bg-[#faf8f0] min-w-[500px]">
                            <div className="w-12 bg-[#e8e4d4] flex items-center justify-center font-bold text-xs text-[#5a5545] border-r border-[#d4dcc0] shrink-0">결재</div>

                            {/* 1차: 팀 결재 */}
                            <div className="flex-1 flex flex-col items-center justify-center p-3 bg-white border-r border-[#d4dcc0] hover:bg-[#f9f9f9] transition-colors relative">
                                <span className="text-[10px] text-[#7a7565] mb-2 font-bold whitespace-nowrap">
                                    {request.status === 'REJECTED' && !request.final_approvals && !request.ceo_decision ? '결재 / 반려'
                                        : (request.status !== 'SUBMITTED' && request.status !== 'CANCELLED') ? '결재 / 승인' : '결재 / 대기'}
                                </span>
                                <div className="h-12 w-12 border rounded-full flex items-center justify-center mb-2 relative"
                                    style={{ borderColor: (request.status !== 'SUBMITTED' && request.status !== 'CANCELLED') ? '#d8ceb8' : '#ebe8db' }}>
                                    {(request.status !== 'SUBMITTED' && request.status !== 'CANCELLED' && request.status !== 'REJECTED') ? (
                                        <div className="text-[#a65d57] font-black text-[9px] leading-tight border-2 border-[#a65d57] rounded-full p-1.5 w-10 h-10 flex flex-col justify-center transform -rotate-12 bg-white shadow-sm opacity-90">
                                            <span>{teamApprover ? teamApprover.name.substring(0, 3) : '팀장'}</span>
                                            <span className="border-t border-[#a65d57] mt-0.5 pt-0.5">승인</span>
                                        </div>
                                    ) : (request.status === 'REJECTED' && !request.final_approvals && !request.ceo_decision) ? (
                                        <span className="text-[#a65d57] font-black text-xs tracking-tighter">반려됨</span>
                                    ) : (
                                        <span className="text-[#c5c0b0] font-black text-xs">NO 결재</span>
                                    )}
                                </div>
                                <span className="text-xs font-black text-[#8b4d47]">{teamApprover ? teamApprover.name : '팀 관리자'}</span>
                            </div>

                            {/* 2차: 병렬 결재 (실장) */}
                            {finalApproversList.map(fa => {
                                const approval = request.final_approvals?.[fa.uid];
                                return (
                                    <div key={fa.uid} className="flex-1 p-3 flex flex-col items-center justify-center bg-white border-r border-[#d4dcc0] hover:bg-[#f9f9f9] transition-colors relative">
                                        <span className="text-[10px] text-[#7a7565] mb-2 font-bold whitespace-nowrap">
                                            {approval?.status === 'APPROVED' ? '병렬 결재 / 승인'
                                                : approval?.status === 'REJECTED' ? '병렬 결재 / 반려' : '병렬 결재 / 대기'}
                                        </span>

                                        <div className="h-12 w-12 border rounded-full flex items-center justify-center mb-2 relative"
                                            style={{ borderColor: approval?.status === 'APPROVED' ? '#d8ceb8' : '#ebe8db' }}>
                                            {approval?.status === 'APPROVED' ? (
                                                <div className="text-[#a65d57] font-black text-[9px] leading-tight border-2 border-[#a65d57] rounded-full p-1.5 w-10 h-10 flex flex-col justify-center transform -rotate-12 bg-white shadow-sm opacity-90">
                                                    <span>{fa.name.substring(0, 3)}</span>
                                                    <span className="border-t border-[#a65d57] mt-0.5 pt-0.5">승인</span>
                                                </div>
                                            ) : approval?.status === 'REJECTED' ? (
                                                <span className="text-[#a65d57] font-black text-xs tracking-tighter">반려됨</span>
                                            ) : (
                                                <span className="text-[#c5c0b0] font-black text-xs">NO 결재</span>
                                            )}
                                        </div>
                                        <span className="text-xs font-black text-[#5d6c4a]">{fa.name}</span>
                                    </div>
                                );
                            })}

                            {/* 3차: 최종 결재 (CEO) */}
                            <div className="flex-1 p-3 flex flex-col items-center justify-center bg-white hover:bg-[#f9f9f9] transition-colors relative">
                                <span className="text-[10px] text-[#7a7565] mb-2 font-bold whitespace-nowrap">
                                    {request.ceo_decision?.status === 'APPROVED' ? '결재 / 승인'
                                        : request.ceo_decision?.status === 'REJECTED' ? '결재 / 반려' : '결재 / 대기'}
                                </span>

                                <div className="h-12 w-12 border rounded-full flex items-center justify-center mb-2 relative"
                                    style={{ borderColor: request.ceo_decision?.status === 'APPROVED' ? '#d8ceb8' : '#ebe8db' }}>
                                    {request.ceo_decision?.status === 'APPROVED' ? (
                                        <div className="text-[#a65d57] font-black text-[9px] leading-tight border-2 border-[#a65d57] rounded-full p-1.5 w-10 h-10 flex flex-col justify-center transform -rotate-12 bg-white shadow-sm opacity-90">
                                            <span>{request.ceo_decision.name?.substring(0, 3) || '대표님'}</span>
                                            <span className="border-t border-[#a65d57] mt-0.5 pt-0.5">승인</span>
                                        </div>
                                    ) : request.ceo_decision?.status === 'REJECTED' ? (
                                        <span className="text-[#a65d57] font-black text-xs tracking-tighter">반려됨</span>
                                    ) : (
                                        <span className="text-[#c5c0b0] font-black text-xs">NO 결재</span>
                                    )}
                                </div>
                                <span className="text-xs font-black text-[#3d472f]">강일훈(대표)</span>
                            </div>
                        </div>
                    </div>

                    {/* 처리 이력 */}
                    <div>
                        <h3 className="text-xs font-bold text-[#5d6c4a] mb-3 flex items-center gap-2 uppercase">
                            <History size={14} /> 처리 내역
                        </h3>

                        {loading ? (
                            <div className="py-8 text-center"><Loader size={20} className="animate-spin mx-auto text-[#9a9585]" /></div>
                        ) : history.length === 0 ? (
                            <div className="bg-[#f0e8d5] p-6 text-center rounded-lg border border-[#e0d6bd]">
                                <AlertTriangle size={24} className="mx-auto text-[#d8973c] mb-2" />
                                <p className="text-sm font-bold text-[#7a7565]">아직 처리된 내역이 없습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((item, idx) => (
                                    <div key={item.id} className="relative pl-6">
                                        {/* 타임라인 점/선 */}
                                        <div className="absolute left-2 top-2 bottom-[-12px] w-0.5 bg-[#c5c0b0]"></div>
                                        <div className={`absolute left-[3px] top-2 w-2.5 h-2.5 rounded-full border-2 border-[#f5f3e8] z-10 ${item.action === 'APPROVE' ? 'bg-[#5d6c4a]' : 'bg-[#a65d57]'}`}></div>
                                        {idx === history.length - 1 && <div className="absolute left-[3px] top-4 bottom-0 w-2.5 bg-[#f5f3e8] z-0"></div>}

                                        <div className="bg-white p-3 rounded shadow-sm border border-[#e8d5b5]">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.stage === 'FINAL' ? 'bg-[#3d6b5e] text-white' : 'bg-[#5d6c4a] text-white'}`}>
                                                        {STAGE_LABEL[item.stage] || item.stage}
                                                    </span>
                                                    <span className={`font-black text-xs ${ACTION_COLOR[item.action]}`}>
                                                        {ACTION_LABEL[item.action] || item.action}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-[#9a9585] font-mono">
                                                    {new Date(item.acted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="text-xs">
                                                <span className="font-bold text-[#3d472f]">처리자: </span>
                                                {item._actorName}
                                                {item._proxyForName && <span className="text-[#a06820]"> ({item._proxyForName} 대행)</span>}
                                            </div>

                                            {item.note && formatNote(item.note) && (
                                                <div className="mt-2 text-xs bg-[#f4f5eb] p-2 border border-[#d4dcc0] rounded text-[#5a5545] whitespace-pre-wrap">
                                                    <span className="font-bold text-[#7a7565] block mb-1">코멘트/사유:</span>
                                                    {formatNote(item.note)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
