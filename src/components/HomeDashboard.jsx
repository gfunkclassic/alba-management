import React from 'react';
import { Users, Wallet, Calendar, FileText, ChevronRight, Download, AlertTriangle, Clock, CheckSquare, CheckCircle } from 'lucide-react';

// 운영 콘솔 톤: 카드/아이콘 색상을 한 자리에서 관리. 기본은 muted olive/neutral, 경고는 약한 amber/brick
const TONE = {
    default: 'bg-[#5d6c4a]',   // muted olive — 재직 인원 등 정보성
    money:   'bg-[#5a6878]',   // muted slate — 금액/문서
    warning: 'bg-[#a78049]',   // muted amber — 주의/대기
    danger:  'bg-[#8d5a4d]',   // muted brick — 미가입/위험
};

export default function HomeDashboard({ stats, payrollMonth, users, lastConfirmed, pendingApprovalCount = 0, userRoleGroup, onNavigate, onDownloadLaborSubmission }) {
    const isApprover = userRoleGroup === 'approver_senior' || userRoleGroup === 'approver_final';
    const lcMonth = lastConfirmed?.month || null;
    const lcTotal = lastConfirmed?.total || 0;
    const insuranceNeeded = stats.insuranceNeeded || 0;
    const lowLeaveCount = stats.lowLeaveCount || 0;

    const cards = [
        {
            label: '재직 인원',
            value: `${stats.totalActive || 0}명`,
            sub: `퇴사 ${stats.totalResigned || 0}명`,
            icon: <Users size={16} />, tone: TONE.default,
            action: () => onNavigate('HR'),
        },
        {
            label: '확정 급여',
            value: lcMonth ? `₩${lcTotal.toLocaleString()}` : '-',
            sub: lcMonth ? `${lcMonth} 확정 기준` : '확정 급여 데이터 없음',
            icon: <Wallet size={16} />, tone: TONE.money,
            action: () => onNavigate('PAYROLL'),
        },
        ...(isApprover ? [{
            label: '연차 결재 필요',
            value: `${pendingApprovalCount}건`,
            sub: pendingApprovalCount > 0 ? '결재 대기' : '대기 없음',
            icon: <CheckSquare size={16} />, tone: TONE.warning,
            action: () => onNavigate('APPROVALS'),
        }] : [{
            label: '연차 소진 필요',
            value: `${lowLeaveCount}명`,
            sub: lowLeaveCount > 0 ? '잔여 3일 이하' : '잔여 여유 있음',
            icon: <Calendar size={16} />, tone: TONE.warning,
            action: () => onNavigate('LEAVE'),
        }]),
        {
            label: '4대보험 미가입',
            value: `${insuranceNeeded}명`,
            sub: insuranceNeeded > 0 ? '가입 필요' : '가입 필요 없음',
            icon: <AlertTriangle size={16} />, tone: insuranceNeeded > 0 ? TONE.danger : TONE.default,
            action: () => onNavigate('HR', 'INSURANCE_NEEDED'),
        },
    ];

    // 계약갱신 임박 직원 (14일 이내)
    const renewalSoon = (users || []).filter(u => {
        if (!u.renewalDate || u.resignDate) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const rd = new Date(u.renewalDate); rd.setHours(0, 0, 0, 0);
        const diff = (rd - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 14;
    }).slice(0, 5);

    // 최근 입사 직원 (30일 이내)
    const recentHires = (users || []).filter(u => {
        if (!u.startDate || u.resignDate) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sd = new Date(u.startDate); sd.setHours(0, 0, 0, 0);
        const diff = (today - sd) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    }).slice(0, 5);

    const hasApprovalPending = isApprover && pendingApprovalCount > 0;
    const hasRenewal = renewalSoon.length > 0;
    const hasInsurance = insuranceNeeded > 0;
    const hasAttention = hasApprovalPending || hasRenewal || hasInsurance;

    // 공통 클래스 토큰
    const SECTION_TITLE = 'text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide';
    const CARD_BORDER = 'border border-[#d4cfbf]';

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* 인사말 */}
            <div>
                <h2 className="text-base font-bold text-[#3d472f]">페플 아르바이트 관리</h2>
                <p className="text-xs text-[#7a7565] mt-1">{payrollMonth} 기준 운영 현황</p>
            </div>

            {/* 핵심 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {cards.map((card, i) => (
                    <button
                        key={i}
                        onClick={card.action}
                        className={`bg-[#faf8f0] ${CARD_BORDER} p-4 text-left hover:border-[#5d6c4a] hover:bg-[#f5f3e8] transition-colors group flex flex-col min-h-[112px]`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`${card.tone} text-[#f5f3e8] p-1.5 rounded`}>{card.icon}</span>
                            <ChevronRight size={14} className="text-[#c5c0b0] group-hover:text-[#5d6c4a]" />
                        </div>
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase tracking-wide">{card.label}</p>
                        <p className="text-lg font-black text-[#3d472f] mt-0.5 leading-tight">{card.value}</p>
                        <p className="text-[10px] text-[#9a9585] mt-auto pt-1">{card.sub}</p>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 빠른 실행 + 다운로드 */}
                <div className="space-y-3">
                    <h3 className={SECTION_TITLE}>빠른 실행</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: '급여정산', desc: '월별 급여 계산', tab: 'PAYROLL' },
                            { label: '연차관리', desc: '연차 현황/조정', tab: 'LEAVE' },
                            { label: '수정이력', desc: '감사 로그', tab: 'EDIT_LOGS' },
                            { label: '인력관리', desc: '직원 정보 관리', tab: 'HR' },
                        ].map((qa, i) => (
                            <button
                                key={i}
                                onClick={() => onNavigate(qa.tab)}
                                className={`bg-[#faf8f0] ${CARD_BORDER} px-3 py-2.5 text-left hover:bg-[#f5f3e8] hover:border-[#b8c4a0] transition-colors min-h-[58px] flex flex-col justify-center`}
                            >
                                <p className="text-xs font-bold text-[#3d472f]">{qa.label}</p>
                                <p className="text-[10px] text-[#9a9585] mt-0.5">{qa.desc}</p>
                            </button>
                        ))}
                    </div>
                    {onDownloadLaborSubmission && (
                        <div className={`bg-[#faf8f0] ${CARD_BORDER} p-3 flex items-center justify-between`}>
                            <div>
                                <p className="text-xs font-bold text-[#3d472f]">노무사 제출용 다운로드</p>
                                <p className="text-[10px] text-[#9a9585] mt-0.5">{payrollMonth} 급여명세서</p>
                            </div>
                            <button
                                onClick={onDownloadLaborSubmission}
                                className="bg-[#5d6c4a] text-[#f5f3e8] px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:bg-[#4a5639]"
                            >
                                <Download size={14} /> 다운로드
                            </button>
                        </div>
                    )}
                </div>

                {/* 확인 필요한 업무 */}
                <div className="space-y-3">
                    <h3 className={SECTION_TITLE}>확인 필요한 업무</h3>

                    {/* 연차 결재 대기 (결재권자 전용, N>0) */}
                    {hasApprovalPending && (
                        <button
                            type="button"
                            onClick={() => onNavigate('APPROVALS')}
                            className="w-full text-left bg-[#f5f1e3] border border-[#c9a66a] p-3 hover:bg-[#ede7d2] transition-colors"
                        >
                            <p className="text-xs font-bold text-[#7a5a1a] flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1.5"><CheckSquare size={12} /> 연차 결재 대기 {pendingApprovalCount}건</span>
                                <ChevronRight size={12} />
                            </p>
                            <p className="text-[10px] text-[#9a9585] mt-1">클릭하면 연차결재 화면으로 이동합니다.</p>
                        </button>
                    )}

                    {/* 계약갱신 임박 */}
                    {hasRenewal && (
                        <button
                            type="button"
                            onClick={() => onNavigate('HR', 'RENEWAL_NEEDED')}
                            className={`w-full text-left bg-[#faf8f0] ${CARD_BORDER} p-3 hover:border-[#a78049] hover:bg-[#f5f1e3] transition-colors`}
                        >
                            <p className="text-xs font-bold text-[#7a5a1a] mb-2 flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1.5"><Clock size={12} /> 계약갱신 임박 ({renewalSoon.length}명)</span>
                                <ChevronRight size={12} />
                            </p>
                            {renewalSoon.map((u, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                    <span className="text-[#3d472f] font-bold">{u.name} <span className="font-normal text-[#9a9585]">{u.team}</span></span>
                                    <span className="text-[#7a5a1a]">{u.renewalDate}</span>
                                </div>
                            ))}
                        </button>
                    )}

                    {/* 4대보험 미가입 */}
                    {hasInsurance && (
                        <button
                            type="button"
                            onClick={() => onNavigate('HR', 'INSURANCE_NEEDED')}
                            className="w-full text-left bg-[#f5ebe7] border border-[#cba79c] p-3 hover:bg-[#eddfd9] transition-colors"
                        >
                            <p className="text-xs font-bold text-[#8d5a4d] flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> 4대보험 미가입 {insuranceNeeded}명</span>
                                <ChevronRight size={12} />
                            </p>
                            <p className="text-[10px] text-[#9a9585] mt-1">클릭하면 인력관리에서 미가입 대상만 표시합니다.</p>
                        </button>
                    )}

                    {/* 빈 상태 */}
                    {!hasAttention && (
                        <div className={`bg-[#faf8f0] ${CARD_BORDER} p-3 flex items-center gap-2 text-xs text-[#7a7565]`}>
                            <CheckCircle size={14} className="text-[#9a9585]" />
                            <span>현재 확인이 필요한 항목이 없습니다.</span>
                        </div>
                    )}

                    {/* 최근 입사 (정보 표시) */}
                    {recentHires.length > 0 && (
                        <div className={`bg-[#faf8f0] ${CARD_BORDER} p-3`}>
                            <p className="text-xs font-bold text-[#5d6c4a] mb-2 flex items-center gap-1.5"><Users size={12} /> 최근 입사 ({recentHires.length}명)</p>
                            {recentHires.map((u, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                    <span className="text-[#3d472f] font-bold">{u.name} <span className="font-normal text-[#9a9585]">{u.team}</span></span>
                                    <span className="text-[#5d6c4a]">{u.startDate}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
