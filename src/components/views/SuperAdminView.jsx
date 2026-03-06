import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import CEOApprovalInbox from '../leave/CEOApprovalInbox';

export default function SuperAdminView({ onSwitchToHRSystem }) {
    const { userProfile, logout } = useAuth();
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('super_admin_active_tab') || 'APPROVAL';
    });

    useEffect(() => {
        localStorage.setItem('super_admin_active_tab', activeTab);
    }, [activeTab]);

    const TABS = [
        { key: 'APPROVAL', label: '최종 결재함', icon: <ShieldCheck size={15} /> },
        { key: 'RECORDS', label: '전체 기록 열람', icon: <FileText size={15} /> },
    ];

    return (
        <div className="min-h-screen bg-[#e8e4d4]">
            {/* 헤더 */}
            <header className="bg-[#302b25] border-b-2 border-[#1c1915] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#d8973c] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] font-black text-sm">C</div>
                    <span className="text-[#f5f3e8] font-bold text-sm">최고관리자 뷰어</span>
                    <span className="text-[10px] bg-[#d8973c] text-white font-bold px-2 py-0.5">대표(CEO)</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[#e2ceab] text-xs font-bold mr-1">{userProfile?.name}님</span>
                        <div className="pt-1.5">
                            <NotificationBell userId={userProfile?.uid} />
                        </div>
                    </div>
                    <div className="w-px h-4 bg-[#d8973c]"></div>
                    <button onClick={logout} className="flex items-center gap-1 text-[#e2ceab] hover:text-[#f5f3e8] text-xs"><LogOut size={14} /> 로그아웃</button>
                </div>
            </header>

            {/* 탭 바 */}
            <div className="bg-[#f5f3e8] border-b-2 border-[#c5c0b0] flex items-center">
                <div className="flex flex-1">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === t.key ? 'border-[#302b25] text-[#302b25]' : 'border-transparent text-[#7a7565] hover:text-[#5a5545]'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                {onSwitchToHRSystem && (
                    <button onClick={onSwitchToHRSystem} className="mr-4 text-[10px] bg-[#d8973c] border border-[#7a5a1a] text-[#f5f3e8] px-3 py-1.5 font-bold hover:bg-[#b07a30]">
                        ← 인사급여 시스템
                    </button>
                )}
            </div>

            <main className="max-w-6xl mx-auto p-6 space-y-6">
                {activeTab === 'APPROVAL' && <CEOApprovalInbox />}
                {activeTab === 'RECORDS' && (
                    <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-6 text-center">
                        <p className="text-sm font-bold text-[#7a7565] mb-2">과거 결재 내역 확인</p>
                        <p className="text-xs text-[#9a9585]">인사급여 시스템 탭으로 이동하여 [근태/연차] 메뉴에서 세부 직원들의 모든 연차 신청내역을 열람하실 수 있습니다.</p>
                        <button onClick={onSwitchToHRSystem} className="mt-4 text-xs bg-[#d8973c] border-2 border-[#7a5a1a] text-[#f5f3e8] px-4 py-2 font-bold hover:bg-[#b07a30]">
                            인사급여 시스템으로 이동
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
