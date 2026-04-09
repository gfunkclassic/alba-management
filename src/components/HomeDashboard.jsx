import React from 'react';
import { Users, Wallet, Calendar, FileText, ChevronRight, Download } from 'lucide-react';

export default function HomeDashboard({ stats, payrollMonth, onNavigate, onDownloadLaborSubmission }) {
    const cards = [
        { label: '재직 인원', value: `${stats.totalActive || 0}명`, sub: `퇴사 ${stats.totalResigned || 0}명`, icon: <Users size={20} />, color: 'bg-[#5d6c4a]', action: () => onNavigate('HR') },
        { label: '이번 달 예상 급여', value: `₩${(stats.totalWage || 0).toLocaleString()}`, sub: `${payrollMonth} 기준`, icon: <Wallet size={20} />, color: 'bg-[#2F5597]', action: () => onNavigate('PAYROLL') },
        { label: '연차 소진 필요', value: `${stats.lowLeaveCount || 0}명`, sub: '잔여 3일 이하', icon: <Calendar size={20} />, color: 'bg-[#d8973c]', action: () => onNavigate('LEAVE') },
        { label: '4대보험 미가입', value: `${stats.insuranceNeeded || 0}명`, sub: '가입 필요', icon: <FileText size={20} />, color: 'bg-[#a65d57]', action: () => onNavigate('HR') },
    ];

    const quickActions = [
        { label: '급여정산', desc: '월별 급여 계산 및 조회', action: () => onNavigate('PAYROLL') },
        { label: '연차관리', desc: '연차 현황 및 조정', action: () => onNavigate('LEAVE') },
        { label: '수정이력', desc: '근태 수정 감사 로그', action: () => onNavigate('EDIT_LOGS') },
        { label: 'HR관리', desc: '직원 정보 및 계약 관리', action: () => onNavigate('HR') },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
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
                            <ChevronRight size={14} className="text-[#c5c0b0] group-hover:text-[#5d6c4a] transition-colors" />
                        </div>
                        <p className="text-xs font-bold text-[#7a7565] uppercase">{card.label}</p>
                        <p className="text-lg font-black text-[#3d472f] mt-0.5">{card.value}</p>
                        <p className="text-[10px] text-[#9a9585] mt-0.5">{card.sub}</p>
                    </button>
                ))}
            </div>

            {/* 빠른 실행 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {quickActions.map((qa, i) => (
                    <button key={i} onClick={qa.action} className="bg-[#f5f3e8] border-2 border-[#c5c0b0] px-4 py-3 text-left hover:bg-[#e8ebd8] transition-colors">
                        <p className="text-sm font-bold text-[#3d472f]">{qa.label}</p>
                        <p className="text-[10px] text-[#9a9585] mt-0.5">{qa.desc}</p>
                    </button>
                ))}
            </div>

            {/* 노무사 제출 바로가기 */}
            {onDownloadLaborSubmission && (
                <div className="bg-[#e8ebd8] border-2 border-[#b8c4a0] p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-[#3d472f]">노무사 제출 양식 다운로드</p>
                        <p className="text-xs text-[#5d6c4a] mt-0.5">{payrollMonth} 4대보험 가입자 급여명세서</p>
                    </div>
                    <button onClick={onDownloadLaborSubmission} className="bg-[#2F5597] text-[#f5f3e8] px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-[#1e3a6e] border-2 border-[#1e3a6e]">
                        <Download size={16} /> 다운로드
                    </button>
                </div>
            )}
        </div>
    );
}
