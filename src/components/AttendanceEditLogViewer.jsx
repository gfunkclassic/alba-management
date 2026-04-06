import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, ChevronDown, ChevronUp, FileText, Clock, User, AlertTriangle } from 'lucide-react';

const FIELD_LABELS = {
    checkIn: '출근',
    checkOut: '퇴근',
    overtime: '연장(h)',
    reason: '사유',
    earlyLeaveReason: '조퇴 사유',
    overtimeReason: '연장 사유'
};

const ROLE_LABELS = {
    sys_admin: '시스템관리자',
    approver_final: '대표',
    approver_senior: '상위결재자',
    manager: '팀장',
    employee: '직원'
};

function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        const yyyy = d.getFullYear();
        const MM = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
    } catch {
        return isoStr;
    }
}

function ChangeBadge({ field, before, after }) {
    const label = FIELD_LABELS[field] || field;
    const bv = before?.[field] ?? '';
    const av = after?.[field] ?? '';
    if (String(bv) === String(av)) return null;
    return (
        <span className="inline-flex items-center gap-1 text-xs bg-[#f5f3e8] border border-[#c5c0b0] px-2 py-0.5 mr-1 mb-1">
            <span className="font-bold text-[#5a5545]">{label}</span>
            <span className="text-[#a65d57] line-through">{bv || '(빈값)'}</span>
            <span className="text-[#3d472f]">→</span>
            <span className="text-[#5d6c4a] font-bold">{av || '(빈값)'}</span>
        </span>
    );
}

export default function AttendanceEditLogViewer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // 필터
    const [searchName, setSearchName] = useState('');
    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Firestore 실시간 구독 - 최근 200건 (edited_at 기준 내림차순)
    useEffect(() => {
        setLoading(true);
        setError(null);

        const colRef = collection(db, 'attendance_edit_logs');
        const q = query(colRef, orderBy('edited_at', 'desc'), limit(200));

        const unsub = onSnapshot(q, (snap) => {
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLogs(items);
            setLoading(false);
        }, (err) => {
            console.error('근태 수정 이력 조회 실패:', err);
            setError('수정 이력을 불러올 수 없습니다. Firestore 규칙 또는 권한을 확인해 주세요.');
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // 클라이언트 필터링
    const filtered = useMemo(() => {
        return logs.filter(log => {
            // 이름 필터
            if (searchName) {
                const term = searchName.toLowerCase();
                const nameMatch = (log.employee_name || '').toLowerCase().includes(term);
                const editorMatch = (log.edited_by_name || '').toLowerCase().includes(term);
                if (!nameMatch && !editorMatch) return false;
            }
            // 월 필터 (대상 날짜 기준)
            if (filterMonth && log.date) {
                const logMonth = log.date.substring(0, 7); // "YYYY-MM"
                if (logMonth !== filterMonth) return false;
            }
            return true;
        });
    }, [logs, searchName, filterMonth]);

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // 월 이동
    const moveMonth = (offset) => {
        setFilterMonth(prev => {
            const [y, m] = prev.split('-').map(Number);
            const d = new Date(y, m - 1 + offset, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-[#5d6c4a] border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-sm text-[#5a5545] font-bold">수정 이력 로딩 중...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[#f8f0ef] border-2 border-[#dcc0bc] p-6 text-center">
                <AlertTriangle className="mx-auto mb-2 text-[#a65d57]" size={24} />
                <p className="text-sm font-bold text-[#a65d57]">{error}</p>
                <p className="text-xs text-[#7a7565] mt-1">admin 권한이 있는 계정으로 로그인되어 있는지 확인해 주세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 헤더 */}
            <div className="bg-[#5d6c4a] p-4 border-2 border-[#3d472f] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FileText size={20} className="text-[#d4dcc0]" />
                    <h2 className="text-lg font-black text-[#f5f3e8]">근태 수정 이력</h2>
                    <span className="text-xs bg-[#3d472f] text-[#b8c4a0] px-2 py-0.5 font-bold">{filtered.length}건</span>
                </div>

                {/* 필터 영역 */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* 월 선택 */}
                    <div className="flex items-center bg-[#3d472f] border border-[#2d3721]">
                        <button onClick={() => moveMonth(-1)} className="px-2 py-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-sm font-bold">◀</button>
                        <span className="px-2 py-1 text-xs font-bold text-[#f5f3e8] min-w-[80px] text-center">{filterMonth}</span>
                        <button onClick={() => moveMonth(1)} className="px-2 py-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-sm font-bold">▶</button>
                    </div>

                    {/* 이름 검색 */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#b8c4a0]" />
                        <input
                            type="text"
                            placeholder="이름 검색"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="pl-7 pr-2 py-1 text-xs bg-[#3d472f] border border-[#2d3721] text-[#f5f3e8] placeholder-[#7a8a6a] outline-none focus:border-[#b8c4a0] w-[120px]"
                        />
                    </div>
                </div>
            </div>

            {/* 목록 */}
            {filtered.length === 0 ? (
                <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-10 text-center">
                    <Clock size={32} className="mx-auto mb-3 text-[#c5c0b0]" />
                    <p className="text-sm font-bold text-[#7a7565]">해당 기간의 수정 이력이 없습니다.</p>
                    <p className="text-xs text-[#a09a88] mt-1">근태 수정 시 자동으로 기록됩니다.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {filtered.map(log => {
                        const isExpanded = expandedId === log.id;
                        return (
                            <div key={log.id} className="bg-[#f5f3e8] border-2 border-[#c5c0b0] hover:border-[#5d6c4a] transition-colors">
                                {/* 요약 행 */}
                                <button
                                    onClick={() => toggleExpand(log.id)}
                                    className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-sm text-[#3d472f]">{log.employee_name || '(이름없음)'}</span>
                                            <span className="text-xs text-[#7a7565] bg-[#e8e4d4] px-1.5 py-0.5 border border-[#c5c0b0]">{log.date || '-'}</span>
                                            <span className="text-xs text-[#5d6c4a]">
                                                {(log.changed_fields || []).map(f => FIELD_LABELS[f] || f).join(', ')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-xs text-[#7a7565]">
                                                <User size={10} className="inline mr-0.5" />
                                                {log.edited_by_name || '(알 수 없음)'}
                                                {log.edited_by_role && (
                                                    <span className="ml-1 text-[#a09a88]">({ROLE_LABELS[log.edited_by_role] || log.edited_by_role})</span>
                                                )}
                                            </span>
                                            <span className="text-xs text-[#a09a88]">{formatDateTime(log.edited_at)}</span>
                                        </div>
                                        {log.edit_reason && (
                                            <p className="text-xs text-[#5a5545] mt-1 truncate max-w-[400px]">
                                                사유: {log.edit_reason}
                                            </p>
                                        )}
                                    </div>
                                    {isExpanded
                                        ? <ChevronUp size={16} className="text-[#7a7565] flex-shrink-0" />
                                        : <ChevronDown size={16} className="text-[#7a7565] flex-shrink-0" />
                                    }
                                </button>

                                {/* 상세 펼침 */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 border-t border-[#e8e4d4]">
                                        <div className="bg-[#e8e4d4] p-3 space-y-3">
                                            {/* 변경 내역 */}
                                            <div>
                                                <p className="text-xs font-bold text-[#5d6c4a] mb-1">변경 내역</p>
                                                <div className="flex flex-wrap">
                                                    {(log.changed_fields || []).map(field => (
                                                        <ChangeBadge key={field} field={field} before={log.before} after={log.after} />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 수정 사유 */}
                                            {log.edit_reason && (
                                                <div>
                                                    <p className="text-xs font-bold text-[#5d6c4a] mb-1">수정 사유</p>
                                                    <p className="text-xs text-[#3d472f] bg-[#f5f3e8] p-2 border border-[#c5c0b0] whitespace-pre-wrap break-words">{log.edit_reason}</p>
                                                </div>
                                            )}

                                            {/* 상세 정보 */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-[#7a7565]">대상 직원</span>
                                                    <p className="font-bold text-[#3d472f]">{log.employee_name || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[#7a7565]">대상 날짜</span>
                                                    <p className="font-bold text-[#3d472f]">{log.date || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[#7a7565]">수정자</span>
                                                    <p className="font-bold text-[#3d472f]">{log.edited_by_name || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[#7a7565]">수정자 역할</span>
                                                    <p className="font-bold text-[#3d472f]">{ROLE_LABELS[log.edited_by_role] || log.edited_by_role || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[#7a7565]">수정 시각</span>
                                                    <p className="font-bold text-[#3d472f]">{formatDateTime(log.edited_at)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[#7a7565]">출처</span>
                                                    <p className="font-bold text-[#3d472f]">{log.source === 'CALENDAR' ? '캘린더 수정' : log.source === 'UPLOAD' ? '일괄 업로드' : log.source || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Before / After 전체 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-xs font-bold text-[#a65d57] mb-1">Before</p>
                                                    <div className="text-xs bg-[#f8f0ef] border border-[#dcc0bc] p-2 space-y-0.5">
                                                        {log.before ? Object.entries(log.before).map(([k, v]) => (
                                                            <div key={k} className="flex gap-1">
                                                                <span className="text-[#7a7565] min-w-[50px]">{FIELD_LABELS[k] || k}:</span>
                                                                <span className="text-[#3d472f]">{v || '(빈값)'}</span>
                                                            </div>
                                                        )) : <span className="text-[#a09a88]">(신규 입력)</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#5d6c4a] mb-1">After</p>
                                                    <div className="text-xs bg-[#f0f5ea] border border-[#b8c4a0] p-2 space-y-0.5">
                                                        {log.after ? Object.entries(log.after).map(([k, v]) => (
                                                            <div key={k} className="flex gap-1">
                                                                <span className="text-[#7a7565] min-w-[50px]">{FIELD_LABELS[k] || k}:</span>
                                                                <span className="text-[#3d472f] font-bold">{v || '(빈값)'}</span>
                                                            </div>
                                                        )) : <span className="text-[#a09a88]">-</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 안내 */}
            <p className="text-xs text-[#a09a88] text-center">
                최근 200건까지 표시됩니다. 조회 전용이며 수정/삭제는 불가합니다.
            </p>
        </div>
    );
}
