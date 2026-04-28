import React from 'react';
import { Users, Wallet, Calendar, FileText, ChevronRight, Download, AlertTriangle, Clock, CheckSquare } from 'lucide-react';

export default function HomeDashboard({ stats, payrollMonth, users, lastConfirmed, pendingApprovalCount = 0, userRoleGroup, onNavigate, onDownloadLaborSubmission }) {
    const isApprover = userRoleGroup === 'approver_senior' || userRoleGroup === 'approver_final';
    const lcMonth = lastConfirmed?.month || null;
    const lcTotal = lastConfirmed?.total || 0;
    const cards = [
        { label: '재직 인원', value: `${stats.totalActive || 0}명`, sub: `퇴사 ${stats.totalResigned || 0}명`, icon: <Users size={20} />, color: 'bg-[#5d6c4a]', action: () => onNavigate('HR') },
        {
            label: '지난달 확정 급여',
            value: lcMonth ? `₩${lcTotal.toLocaleString()}` : '-',
            sub: lcMonth ? `${lcMonth} 확정 기준` : '확정 급여 데이터 없음',
            icon: <Wallet size={20} />, color: 'bg-[#2F5597]',
            action: () => onNavigate('PAYROLL')
        },
        ...(isApprover ? [{
            label: '연차 결재 필요',
            value: `${pendingApprovalCount}건`,
            sub: pendingApprovalCount > 0 ? '결재 대기' : '대기 없음',
            icon: <CheckSquare size={20} />, color: 'bg-[#d8973c]',
            action: () => onNavigate('APPROVALS')
        }] : [{
            label: '연차 소진 필요', value: `${stats.lowLeaveCount || 0}명`, sub: '잔여 3일 이하',
            icon: <Calendar size={20} />, color: 'bg-[#d8973c]', action: () => onNavigate('LEAVE')
        }]),
        { label: '4대보험 미가입', value: `${stats.insuranceNeeded || 0}명`, sub: '가입 필요', icon: <AlertTriangle size={20} />, color: 'bg-[#a65d57]', action: () => onNavigate('HR', 'INSURANCE_NEEDED') },
    ];

    // 계약갱신 임박 직원 (14일 이내)
    const renewalSoon = (users || []).filter(u => {
        if (!u.renewalDate || u.resignDate) return false;
        const today = new Date(); today.setHours(0,0,0,0);
        const rd = new Date(u.renewalDate); rd.setHours(0,0,0,0);
        const diff = (rd - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 14;
    }).slice(0, 5);

    // 최근 입사 직원 (30일 이내)
    const recentHires = (users || []).filter(u => {
        if (!u.startDate || u.resignDate) return false;
        const today = new Date(); today.setHours(0,0,0,0);
        const sd = new Date(u.startDate); sd.setHours(0,0,0,0);
        const diff = (today - sd) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    }).slice(0, 5);

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* 인사말 */}
            <div>
                <h2 className="text-xl font-black text-[#3d472f]">페플 아르바이트 관리</h2>
                <p className="text-sm text-[#7a7565] mt-1">{payrollMonth} 기준 운영 현황</p>
            </div>

            {/* 핵심 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {cards.map((card, i) => (
                    <button key={i} onClick={card.action} className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-4 text-left hover:border-[#5d6c4a] transition-colors group">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`${card.color} text-[#f5f3e8] p-1.5 rounded`}>{card.icon}</span>
                            <ChevronRight size={14} className="text-[#c5c0b0] group-hover:text-[#5d6c4a]" />
                        </div>
                        <p className="text-[10px] font-bold text-[#7a7565] uppercase">{card.label}</p>
                        <p className="text-lg font-black text-[#3d472f] mt-0.5">{card.value}</p>
                        <p className="text-[10px] text-[#9a9585] mt-0.5">{card.sub}</p>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 빠른 실행 + 다운로드 */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[#5d6c4a]">빠른 실행</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: '급여정산', desc: '월별 급여 계산', tab: 'PAYROLL' },
                            { label: '연차관리', desc: '연차 현황/조정', tab: 'LEAVE' },
                            { label: '수정이력', desc: '감사 로그', tab: 'EDIT_LOGS' },
                            { label: '인력관리', desc: '직원 정보 관리', tab: 'HR' },
                        ].map((qa, i) => (
                            <button key={i} onClick={() => onNavigate(qa.tab)} className="bg-[#f5f3e8] border border-[#c5c0b0] px-3 py-2.5 text-left hover:bg-[#e8ebd8] transition-colors">
                                <p className="text-xs font-bold text-[#3d472f]">{qa.label}</p>
                                <p className="text-[10px] text-[#9a9585]">{qa.desc}</p>
                            </button>
                        ))}
                    </div>
                    {onDownloadLaborSubmission && (
                        <div className="bg-[#e8ebd8] border border-[#b8c4a0] p-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-[#3d472f]">노무사 제출용 다운로드</p>
                                <p className="text-[10px] text-[#5d6c4a]">{payrollMonth} 급여명세서</p>
                            </div>
                            <button onClick={onDownloadLaborSubmission} className="bg-[#2F5597] text-[#f5f3e8] px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:bg-[#1e3a6e]">
                                <Download size={14} /> 다운로드
                            </button>
                        </div>
                    )}
                </div>

                {/* 처리 필요 / 최근 현황 */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[#5d6c4a]">주의 사항</h3>
                    {/* 연차 결재 대기 (결재권자 전용) */}
                    {isApprover && pendingApprovalCount > 0 && (
                        <button type="button" onClick={() => onNavigate('APPROVALS')} className="w-full text-left bg-[#fdf6e3] border border-[#d8973c] p-3 hover:bg-[#f9eccb] transition-colors">
                            <p className="text-xs font-bold text-[#7a5a1a] flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1"><CheckSquare size={12} /> 연차 결재 대기 {pendingApprovalCount}건</span>
                                <ChevronRight size={12} />
                            </p>
                            <p className="text-[10px] text-[#7a7565] mt-1">클릭하면 연차결재 화면으로 이동합니다.</p>
                        </button>
                    )}
                    {/* 계약갱신 임박 */}
                    {renewalSoon.length > 0 ? (
                        <button type="button" onClick={() => onNavigate('HR', 'RENEWAL_NEEDED')} className="w-full text-left bg-[#f5f3e8] border border-[#c5c0b0] p-3 hover:border-[#d8973c] hover:bg-[#fdf6e3] transition-colors">
                            <p className="text-xs font-bold text-[#d8973c] mb-2 flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1"><Clock size={12} /> 계약갱신 임박 ({renewalSoon.length}명)</span>
                                <ChevronRight size={12} className="text-[#d8973c]" />
                            </p>
                            {renewalSoon.map((u, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                    <span className="text-[#3d472f] font-bold">{u.name} <span className="font-normal text-[#9a9585]">{u.team}</span></span>
                                    <span className="text-[#d8973c]">{u.renewalDate}</span>
                                </div>
                            ))}
                        </button>
                    ) : (
                        <div className="bg-[#f5f3e8] border border-[#c5c0b0] p-3 text-xs text-[#9a9585]">계약갱신 임박 인원이 없습니다.</div>
                    )}
                    {/* 최근 입사 */}
                    {recentHires.length > 0 && (
                        <div className="bg-[#f5f3e8] border border-[#c5c0b0] p-3">
                            <p className="text-xs font-bold text-[#5d6c4a] mb-2 flex items-center gap-1"><Users size={12} /> 최근 입사 ({recentHires.length}명)</p>
                            {recentHires.map((u, i) => (
                                <div key={i} className="flex justify-between text-[10px] py-0.5">
                                    <span className="text-[#3d472f] font-bold">{u.name} <span className="font-normal text-[#9a9585]">{u.team}</span></span>
                                    <span className="text-[#5d6c4a]">{u.startDate}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* 4대보험 안내 */}
                    {(stats.insuranceNeeded || 0) > 0 && (
                        <button type="button" onClick={() => onNavigate('HR', 'INSURANCE_NEEDED')} className="w-full text-left bg-[#f8f0ef] border border-[#dcc0bc] p-3 hover:border-[#a65d57] hover:bg-[#f0e5e4] transition-colors">
                            <p className="text-xs font-bold text-[#a65d57] flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1"><AlertTriangle size={12} /> 4대보험 미가입 {stats.insuranceNeeded}명</span>
                                <ChevronRight size={12} />
                            </p>
                            <p className="text-[10px] text-[#7a7565] mt-1">클릭하면 인력관리에서 미가입 대상만 표시합니다.</p>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
