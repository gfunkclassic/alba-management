import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Building, Wallet, Search, Download, AlertCircle, Lock, Unlock, ChevronDown, CheckCircle, AlertTriangle, RotateCcw, Eye, X } from 'lucide-react';

// 상태 표시 토큰 (의미: DRAFT=대기/amber, CONFIRMED=확정/olive, AMENDING=정정/brick)
// 키/조건은 그대로 유지하고 색상만 muted earth 팔레트로 정렬
const STATUS_CONFIG = {
    DRAFT: { label: '작성중', color: 'bg-[#a78049]', text: 'text-[#f5f3e8]', border: 'border-[#7a5a1a]', dot: 'bg-[#f5f3e8]' },
    REVIEW: { label: '작성중', color: 'bg-[#a78049]', text: 'text-[#f5f3e8]', border: 'border-[#7a5a1a]', dot: 'bg-[#f5f3e8]' }, // 호환용: REVIEW → DRAFT처럼 표시
    CONFIRMED: { label: '확정', color: 'bg-[#5d6c4a]', text: 'text-[#f5f3e8]', border: 'border-[#3d472f]', dot: 'bg-[#d4dcc0]' },
    AMENDING: { label: '정정중', color: 'bg-[#8d5a4d]', text: 'text-[#f5f3e8]', border: 'border-[#7a4d40]', dot: 'bg-[#f5f3e8]' },
};

const STATUS_FLOW = ['DRAFT', 'CONFIRMED'];

// REVIEW는 기존 데이터 호환을 위해 DRAFT와 동일하게 취급
const ALLOWED_TRANSITIONS = {
    DRAFT: ['CONFIRMED'],
    REVIEW: ['CONFIRMED'], // 호환: 기존 REVIEW 데이터도 CONFIRMED로 전이 가능
    CONFIRMED: ['AMENDING'],
    AMENDING: ['CONFIRMED'],
};

// 시각 클래스 토큰 (PayrollView 내부 한정 — 새 파일/유틸 분리 안 함)
const CARD_BASE = 'bg-[#faf8f0] border border-[#d4cfbf]';
const INNER_CARD = 'bg-[#f5f3e8] border border-[#d4cfbf]';
const INPUT_BASE = 'border border-[#d4cfbf] bg-[#faf8f0] text-sm text-[#5a5545] focus:border-[#5d6c4a] outline-none';

export default function PayrollView({
    users, calculateMonthlyWage, onDownloadInsured, onDownloadFreelancer, onDownloadTemplate,
    onDownloadLaborSubmission,
    payrollMonth, onMonthChange, payrollStatus, onStatusChange, onOpenDetail
}) {
    const [mode, setMode] = useState('INSURED'); // 'INSURED' or 'FREELANCER'
    const [searchTerm, setSearchTerm] = useState('');
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [amendReason, setAmendReason] = useState('');
    const [showAmendDialog, setShowAmendDialog] = useState(false);

    const currentStatus = payrollStatus?.[payrollMonth] || 'DRAFT';
    const statusCfg = STATUS_CONFIG[currentStatus];
    const isLocked = currentStatus === 'CONFIRMED';

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (u.resignDate) return false;
            const matchesSearch = u.name.includes(searchTerm);
            const matchesMode = mode === 'INSURED' ? u.insuranceStatus : !u.insuranceStatus;
            return matchesSearch && matchesMode;
        });
    }, [users, mode, searchTerm]);

    const summary = useMemo(() => {
        let totalCount = 0;
        let recordCount = 0;
        const totalAmount = filteredUsers.reduce((sum, u) => {
            const wage = calculateMonthlyWage(u, payrollMonth);
            totalCount++;
            if (wage.hasRecord) recordCount++;
            const amt = wage.hasRecord ? (mode === 'INSURED' ? wage.actual : wage.strictFinalPayout) : 0;
            return sum + amt;
        }, 0);
        const totalDeduction = filteredUsers.reduce((sum, u) => {
            const wage = calculateMonthlyWage(u, payrollMonth);
            if (!wage.hasRecord) return sum;
            return sum + (mode === 'INSURED' ? 0 : wage.strictDeduction);
        }, 0);
        return { totalCount, recordCount, totalAmount, totalDeduction };
    }, [filteredUsers, calculateMonthlyWage, mode, payrollMonth]);

    const handleStatusChange = (newStatus) => {
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) return;
        // CONFIRMED → AMENDING: 사유 입력 다이얼로그 표시
        if (currentStatus === 'CONFIRMED' && newStatus === 'AMENDING') {
            setAmendReason('');
            setShowAmendDialog(true);
            setShowStatusMenu(false);
            return;
        }
        onStatusChange?.(payrollMonth, newStatus);
        setShowStatusMenu(false);
    };

    const handleAmendConfirm = () => {
        if (!amendReason.trim()) return;
        onStatusChange?.(payrollMonth, 'AMENDING', amendReason.trim());
        setShowAmendDialog(false);
        setAmendReason('');
    };

    return (
        <div className="space-y-4">
            {/* ── 월 선택 헤더 ── */}
            <div className="border border-[#3d472f] p-4 flex items-center justify-between gap-4 bg-[#5d6c4a]">
                <div className="flex items-center gap-3">
                    <button onClick={() => onMonthChange(-1)} className="p-1.5 hover:opacity-80 text-[#f5f3e8] border border-[#3d472f]">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-black tracking-tight min-w-[120px] text-center text-[#f5f3e8]">
                        {payrollMonth.replace('-', '.')}
                    </h2>
                    <button onClick={() => onMonthChange(1)} className="p-1.5 hover:opacity-80 text-[#f5f3e8] border border-[#3d472f]">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 모드 토글 */}
                <div className={`md:col-span-2 ${CARD_BASE} p-1 flex`}>
                    <button
                        onClick={() => setMode('INSURED')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'INSURED' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#f5f3e8]'}`}
                    >
                        <Building size={16} /> 4대보험 (노무사 산정)
                    </button>
                    <button
                        onClick={() => setMode('FREELANCER')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'FREELANCER' ? 'bg-[#5d6c4a] text-[#f5f3e8]' : 'text-[#7a7565] hover:bg-[#f5f3e8]'}`}
                    >
                        <Wallet size={16} /> 3.3% 공제 (본사 지급)
                    </button>
                </div>
                {/* 합계 카드 (slate 톤 — 금액/요약) */}
                <div className="bg-[#5d6c4a] p-4 text-[#f5f3e8] flex flex-col justify-center border border-[#3d472f]">
                    <span className="text-[11px] text-[#d4dcc0] font-bold uppercase tracking-wide mb-1">{mode === 'INSURED' ? '실제 근무 기준 총액 (세전)' : '실제 근무 기준 지급 총액'}</span>
                    <div className="flex justify-between items-end">
                        <span className="text-xl font-black">{summary.recordCount}/{summary.totalCount}명</span>
                        <span className="text-lg font-bold opacity-80">₩{summary.totalAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* 검색 + 다운로드 바 */}
            <section className={`${CARD_BASE} p-3 flex flex-wrap justify-between items-center gap-3`}>
                <div className="relative flex-1 max-w-md min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                    <input
                        type="text"
                        placeholder="이름 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 ${INPUT_BASE}`}
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className="flex items-center border border-[#d4cfbf] bg-[#faf8f0]">
                        <select id="templateTeamSelect" defaultValue="전체" className="bg-transparent text-[#3d472f] text-sm font-bold px-2 py-2 outline-none cursor-pointer">
                            <option value="전체">전체</option>
                            {[...new Set(users.filter(u => !u.resignDate).map(u => u.team).filter(Boolean))].sort().map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => onDownloadTemplate(document.getElementById('templateTeamSelect').value)}
                            className="text-[#3d472f] px-3 py-2 text-sm font-bold flex items-center gap-1.5 hover:bg-[#f5f3e8] border-l border-[#d4cfbf]"
                        >
                            <Download size={16} /> 근태 양식
                        </button>
                    </div>
                    {mode === 'INSURED' && (
                        <button
                            onClick={onDownloadLaborSubmission}
                            className="bg-[#5a6878] text-[#f5f3e8] px-4 py-2 text-sm font-bold border border-[#475463] flex items-center gap-2 hover:bg-[#475463]"
                        >
                            <Download size={16} /> 노무사 제출용
                        </button>
                    )}
                    <button
                        onClick={mode === 'INSURED' ? onDownloadInsured : onDownloadFreelancer}
                        className="bg-[#5d6c4a] text-[#f5f3e8] px-4 py-2 text-sm font-bold border border-[#3d472f] flex items-center gap-2 hover:bg-[#4a5639]"
                    >
                        <Download size={16} /> {mode === 'INSURED' ? '상세 내역' : '지급 요청용 엑셀'}
                    </button>
                </div>
            </section>

            {/* 급여 테이블 */}
            <div className={`${CARD_BASE} overflow-hidden`}>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                            <tr>
                                <th className="p-3 pl-4 text-left">직원 정보</th>
                                <th className="p-3 text-left">계좌 정보</th>
                                {mode === 'INSURED' ? (
                                    <>
                                        <th className="p-3 text-center">근무일수</th>
                                        <th className="p-3 text-right">실 근무시간</th>
                                        <th className="p-3 text-right">연장시간</th>
                                        <th className="p-3 text-right pr-4">실적 급여(세전) <span className="opacity-50 normal-case font-normal">클릭↗</span></th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-3 text-right">실적 총액</th>
                                        <th className="p-3 text-right text-[#8d5a4d]">3.3% 공제</th>
                                        <th className="p-3 text-right pr-4">실지급액 <span className="opacity-50 normal-case font-normal">클릭↗</span></th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-[#ebe8db] [&_td]:align-middle">
                            {filteredUsers.map(user => {
                                const wage = calculateMonthlyWage(user, payrollMonth);
                                return (
                                    <tr key={user.id} className="hover:bg-[#f5f3e8] transition-colors">
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 flex items-center justify-center bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold">{user.name[0]}</div>
                                                <div><p className="font-bold text-[#3d472f]">{user.name}</p><p className="text-xs text-[#9a9585]">{user.team}</p></div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <p className="font-bold text-[#5a5545]">{user.bank}</p>
                                            <p className="text-xs text-[#7a7565] font-mono">{user.account}</p>
                                        </td>
                                        {mode === 'INSURED' ? (
                                            <>
                                                <td className="p-3 text-center text-[#5a5545]">{user.workDays}</td>
                                                <td className="p-3 text-right text-[#5a5545]">{wage.hasRecord ? `${wage.totalActualHours}h` : '-'}</td>
                                                <td className="p-3 text-right text-[#a78049] font-bold">{wage.hasRecord && wage.totalActualOvertime > 0 ? `+${wage.totalActualOvertime}h` : '-'}</td>
                                                <td className="p-3 text-right pr-4">
                                                    {wage.hasRecord ? (
                                                        <button
                                                            onClick={() => onOpenDetail?.(user)}
                                                            className="font-bold text-[#5d6c4a] hover:text-[#3d472f] hover:underline underline-offset-2 flex items-center gap-1 ml-auto"
                                                        >
                                                            ₩{wage.actual.toLocaleString()}
                                                            <Eye size={12} className="opacity-50" />
                                                        </button>
                                                    ) : '-'}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-3 text-right text-[#5a5545]">{wage.hasRecord ? `₩${wage.actual.toLocaleString()}` : '-'}</td>
                                                <td className="p-3 text-right text-[#8d5a4d]">{wage.hasRecord ? `₩${wage.strictDeduction.toLocaleString()}` : '-'}</td>
                                                <td className="p-3 text-right pr-4">
                                                    {wage.hasRecord ? (
                                                        <button
                                                            onClick={() => onOpenDetail?.(user)}
                                                            className="font-black text-[#3d472f] hover:text-[#5d6c4a] hover:underline underline-offset-2 flex items-center gap-1 ml-auto"
                                                        >
                                                            ₩{wage.strictFinalPayout.toLocaleString()}
                                                            <Eye size={12} className="opacity-50" />
                                                        </button>
                                                    ) : '-'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan={mode === 'INSURED' ? 6 : 5} className="p-10 text-center text-[#9a9585] text-sm">해당 유형의 대상자가 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 안내 (성공/확정 톤 — olive 계열 유지, border 한 줄) */}
            <div className="bg-[#e8ebd8] p-4 border border-[#b8c4a0] text-xs text-[#5d6c4a] flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {mode === 'INSURED' ? (
                    <p><strong>노무사 전달 안내:</strong> 4대보험 가입자는 위 <strong>실제 근무 기록</strong>을 바탕으로 산출된 급여 내역입니다. 급여 금액을 클릭하면 날짜별 상세 산출 근거를 확인할 수 있습니다.</p>
                ) : (
                    <p><strong>본사 지급 안내:</strong> 3.3% 공제 대상자는 <strong>실제 근무 기록</strong>을 기준으로 산출된 <strong>실지급액</strong>입니다. 실지급액을 클릭하면 날짜별 내역을 확인할 수 있습니다.</p>
                )}
            </div>

            {/* 상태 UI 제거됨 — 내부 호환용 상태 로직은 유지 */}
        </div>
    );
}
