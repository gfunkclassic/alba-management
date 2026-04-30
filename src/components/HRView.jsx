import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Monitor, Users, Briefcase, Wallet, Calendar, AlertTriangle, FileText, UserMinus, Check, Edit, Trash2, Phone, Mail, Shield, UserX, UserPlus } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';
import { ConfirmModal } from './modals/DialogModals';
import { useAuth } from '../contexts/AuthContext';

// 이메일 정규화 (계정 미생성 비교용)
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

// 성별 값을 여러 후보 필드에서 안전하게 가져오기 (표시 전용)
// 우선순위: gender → sex → genderLabel → personalGender → personalInfo.gender
function getGenderValue(user) {
    if (!user || typeof user !== 'object') return '';
    const candidates = [
        user.gender,
        user.sex,
        user.genderLabel,
        user.personalGender,
        user.personalInfo && user.personalInfo.gender,
    ];
    for (const c of candidates) {
        if (c !== undefined && c !== null && String(c).trim() !== '') return c;
    }
    return '';
}

// 성별 표시 일관화 (저장 데이터 변경 없음, 표시 전용)
// - 남/여 그대로
// - 남성/남자/MALE/male/M → 남
// - 여성/여자/FEMALE/female/F → 여
// - 빈 값/null/undefined/알 수 없는 값 → '-'
function displayGender(g) {
    if (g === undefined || g === null) return '-';
    const v = String(g).trim();
    if (v === '') return '-';
    if (v === '남' || v === '여') return v;
    if (v === '남성' || v === '남자') return '남';
    if (v === '여성' || v === '여자') return '여';
    const u = v.toUpperCase();
    if (u === 'M' || u === 'MALE') return '남';
    if (u === 'F' || u === 'FEMALE') return '여';
    return '-';
}

// 근속 기간 계산 (입사일 ~ 오늘 또는 퇴사일)
function calcTenure(startDate, endDate) {
    if (!startDate) return '-';
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return '-';
    const end = endDate ? new Date(endDate) : new Date();
    if (isNaN(end.getTime())) return '-';
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    if (months < 0) return '-';
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return `${m}개월`;
    if (m === 0) return `${y}년`;
    return `${y}년 ${m}개월`;
}

export default function HRView({
    stats,
    teamCounts,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    filterTeam, setFilterTeam,
    filterStatus, setFilterStatus,
    filteredData,
    selectedUser, handleSelectUser,
    calculateMonthlyWage, payrollMonth,
    openModal, openUserForm, openResignModal,
    maskPII = false, roleMode = 'ADMIN', onDeleteUser,
    filterSource = null, onClearHomeFilter = () => {}
}) {
    const FILTER_SOURCE_LABEL = {
        INSURANCE_NEEDED: '홈에서 4대보험 미가입 필터로 들어왔습니다.',
        RENEWAL_NEEDED: '홈에서 계약갱신 임박 필터로 들어왔습니다.',
    };
    const handleFilterStatusChange = (e) => {
        setFilterStatus(e.target.value);
        if (filterSource) onClearHomeFilter();
    };
    const handleClearHomeFilter = () => {
        setFilterStatus('ALL');
        onClearHomeFilter();
    };
    const [deleteTargetUser, setDeleteTargetUser] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | ALBA | STAFF
    const [showMissingGenderOnly, setShowMissingGenderOnly] = useState(false);

    // 계정 미생성 점검용: users 컬렉션 이메일 집합 (1회 fetch, AuthContext 재사용)
    const { getAllUsers } = useAuth();
    const [accountUsers, setAccountUsers] = useState([]);
    useEffect(() => {
        let active = true;
        getAllUsers?.().then(data => { if (active && Array.isArray(data)) setAccountUsers(data); }).catch(() => {});
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 성별 미입력 카운트는 검색/팀/상태/재직 필터 적용 후 데이터(filteredData) 기준
    // — 새 prop 없이 기존 흐름을 깨지 않기 위함. 운영 점검 시 viewMode='전체'로 두면 사실상 전 인원 점검 가능
    const isGenderMissing = (u) => displayGender(getGenderValue(u)) === '-';
    const missingGenderCount = filteredData.filter(isGenderMissing).length;

    // 이메일 미입력 점검: 같은 filteredData 기준 + 퇴사자 제외 (자동 계정 생성 도입 전 데이터 품질 점검용)
    const isInactiveEmployee = (u) => u.employmentStatus === '퇴사' || u.resignDate;
    const isMissingEmail = (u) => !String(u.email || '').trim();
    const missingEmailCount = filteredData.filter(u => !isInactiveEmployee(u) && isMissingEmail(u)).length;

    // 이메일 형식 오류 점검: 빈 이메일은 미입력 칩에서 담당, 여기서는 값이 있는데 기본 형식에 맞지 않는 경우만
    const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isInvalidEmailFormat = (u) => {
        const v = String(u.email || '').trim();
        if (!v) return false; // 빈 값은 형식 오류로 세지 않음
        return !EMAIL_FORMAT_RE.test(v);
    };
    const invalidEmailCount = filteredData.filter(u => !isInactiveEmployee(u) && isInvalidEmailFormat(u)).length;

    // 계정 미생성 점검: employees에는 있고 이메일 정상이지만 users에 매칭 이메일이 없는 인원
    const accountEmailSet = new Set(
        accountUsers.map(u => normalizeEmail(u.email)).filter(Boolean)
    );
    const isMissingAccount = (u) => {
        if (isInactiveEmployee(u)) return false;
        const email = normalizeEmail(u.email);
        if (!email) return false; // 빈 이메일은 '이메일 미입력' 칩 담당
        if (!EMAIL_FORMAT_RE.test(email)) return false; // 형식 오류는 '이메일 형식 오류' 칩 담당
        return !accountEmailSet.has(email);
    };
    const missingAccountCount = filteredData.filter(isMissingAccount).length;

    const baseData = typeFilter === 'ALL' ? filteredData
        : typeFilter === 'ALBA' ? filteredData.filter(u => (u.employmentType || u.position || '아르바이트') === '아르바이트')
        : filteredData.filter(u => (u.employmentType || u.position || '아르바이트') !== '아르바이트');
    const displayData = showMissingGenderOnly ? baseData.filter(isGenderMissing) : baseData;

    // 홈 톤 토큰 (HRView 내부 재사용)
    const INPUT_BASE = "border border-[#d4cfbf] bg-[#faf8f0] text-sm text-[#5a5545] focus:border-[#5d6c4a] outline-none";
    const SEG_GROUP = "flex bg-[#faf8f0] border border-[#d4cfbf]";
    const segBtn = (active, danger = false) =>
        `px-3 py-1.5 text-xs font-bold transition ${active
            ? (danger ? 'bg-[#8d5a4d] text-[#f5f3e8]' : 'bg-[#5d6c4a] text-[#f5f3e8]')
            : 'text-[#7a7565] hover:bg-[#f5f3e8]'}`;

    return (
        <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="전체 인원" value={`${stats.totalActive}명`} icon={<Users size={20} className="text-[#5d6c4a]" />} />
                <StatCard title="4대보험 미가입" value={`${stats.insuranceNeeded}명`} icon={<AlertTriangle size={20} className="text-[#8d5a4d]" />} danger={stats.insuranceNeeded > 0} />
                <StatCard title="계약 갱신 요망 (14일 이내)" value={`${stats.needRenewal}명`} icon={<RotateCcw size={20} className="text-[#a78049]" />} warning={stats.needRenewal > 0} />
                <StatCard title="총 예상 급여" value={`₩${stats.totalWage.toLocaleString()}`} sub="실제 근무 기록 기준" icon={<Wallet size={20} className="text-[#5a6878]" />} />
            </section>

            <section className="bg-[#faf8f0] p-3 border border-[#d4cfbf] flex flex-wrap gap-3 items-center mt-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                    <input type="text" placeholder="이름, 연락처, 이메일 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 ${INPUT_BASE}`} />
                </div>
                <select value={filterStatus} onChange={handleFilterStatusChange} className={`px-3 py-2 font-bold ${INPUT_BASE}`}>
                    <option value="ALL">전체 상태</option>
                    <option value="RENEWAL_NEEDED">계약 갱신 임박</option>
                    <option value="INSURANCE_NEEDED">4대보험 미가입</option>
                </select>
                <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className={`px-3 py-2 font-bold ${INPUT_BASE}`}>
                    {Object.keys(teamCounts).map(team => (<option key={team} value={team}>{team} ({teamCounts[team]})</option>))}
                </select>
                {/* 고용유형 필터 */}
                <div className={SEG_GROUP}>
                    {[{ key: 'ALL', label: '전체' }, { key: 'ALBA', label: '아르바이트' }, { key: 'STAFF', label: '직원/계약직' }].map(f => (
                        <button key={f.key} onClick={() => setTypeFilter(f.key)} className={`${segBtn(typeFilter === f.key)} ${f.key !== 'ALL' ? 'border-l border-[#d4cfbf]' : ''}`}>{f.label}</button>
                    ))}
                </div>
                {/* 재직/퇴사 필터 */}
                <div className={SEG_GROUP}>
                    <button onClick={() => setViewMode('ACTIVE')} className={segBtn(viewMode === 'ACTIVE')}>재직</button>
                    <button onClick={() => setViewMode('RESIGNED')} className={`${segBtn(viewMode === 'RESIGNED', true)} border-l border-[#d4cfbf]`}>퇴사</button>
                    <button onClick={() => setViewMode('ALL')} className={`${segBtn(viewMode === 'ALL')} border-l border-[#d4cfbf]`}>전체</button>
                </div>
                {/* + 신규 등록 (기존 openUserForm 인자 없이 호출 → 신규 모드) */}
                <button
                    type="button"
                    onClick={() => openUserForm()}
                    className="ml-auto px-3 py-1.5 bg-[#5d6c4a] text-[#f5f3e8] text-xs font-bold hover:bg-[#4a5639] border border-[#3d472f] flex items-center gap-1.5"
                    title="신규 등록"
                >
                    <UserPlus size={14} /> 신규 등록
                </button>
            </section>

            {/* 홈 진입 안내 배너 + 성별 미입력 점검 칩 (운영용 안내 그룹) */}
            <div className="mt-3 space-y-2">
                {filterSource && FILTER_SOURCE_LABEL[filterSource] && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f5f1e3] border border-[#c9a66a] text-[11px]">
                        <span className="text-[#7a5a1a] font-bold">{FILTER_SOURCE_LABEL[filterSource]}</span>
                        <button onClick={handleClearHomeFilter} className="px-2 py-0.5 bg-[#faf8f0] border border-[#d4cfbf] text-[#5a5545] font-bold hover:bg-[#f5f3e8]">
                            전체 보기
                        </button>
                    </div>
                )}

                {/* 성별 미입력 점검 안내 칩 (운영용) */}
                <div className="flex items-center gap-2 text-xs">
                    {showMissingGenderOnly ? (
                        <>
                            <span className="px-2 py-1 bg-[#f5f1e3] border border-[#c9a66a] text-[#7a5a1a] font-bold flex items-center gap-1.5">
                                <AlertTriangle size={12} /> 성별 미입력만 보기 중 ({missingGenderCount}명)
                            </span>
                            <button onClick={() => setShowMissingGenderOnly(false)} className="px-2 py-1 bg-[#faf8f0] border border-[#d4cfbf] text-[#5a5545] font-bold hover:bg-[#f5f3e8]">전체 보기</button>
                        </>
                    ) : missingGenderCount > 0 ? (
                        <button onClick={() => setShowMissingGenderOnly(true)} className="px-2 py-1 bg-[#f5f1e3] border border-[#c9a66a] text-[#7a5a1a] font-bold flex items-center gap-1.5 hover:bg-[#ede7d2]">
                            <AlertTriangle size={12} /> 성별 미입력 {missingGenderCount}명 · 클릭해서 보기
                        </button>
                    ) : (
                        <span className="px-2 py-1 bg-[#faf8f0] border border-[#d4cfbf] text-[#9a9585] flex items-center gap-1.5">
                            <Check size={12} /> 성별 미입력 0명
                        </span>
                    )}
                    {/* 이메일 미입력 점검 칩 (표시 전용, 퇴사자 제외) */}
                    {missingEmailCount > 0 ? (
                        <span className="px-2 py-1 bg-[#f5f1e3] border border-[#c9a66a] text-[#7a5a1a] font-bold flex items-center gap-1.5">
                            <Mail size={12} /> 이메일 미입력 {missingEmailCount}명
                        </span>
                    ) : (
                        <span className="px-2 py-1 bg-[#faf8f0] border border-[#d4cfbf] text-[#9a9585] flex items-center gap-1.5">
                            <Mail size={12} /> 이메일 미입력 0명
                        </span>
                    )}
                    {/* 이메일 형식 오류 점검 칩 (표시 전용, 퇴사자 제외, 빈 이메일 제외) */}
                    {invalidEmailCount > 0 ? (
                        <span className="px-2 py-1 bg-[#f5ebe7] border border-[#cba79c] text-[#8d5a4d] font-bold flex items-center gap-1.5">
                            <AlertTriangle size={12} /> 이메일 형식 오류 {invalidEmailCount}명
                        </span>
                    ) : (
                        <span className="px-2 py-1 bg-[#faf8f0] border border-[#d4cfbf] text-[#9a9585] flex items-center gap-1.5">
                            <AlertTriangle size={12} /> 이메일 형식 오류 0명
                        </span>
                    )}
                    {/* 계정 미생성 점검 칩 (표시 전용, 이메일 정상인데 users 미존재) */}
                    {missingAccountCount > 0 ? (
                        <span className="px-2 py-1 bg-[#f5f1e3] border border-[#c9a66a] text-[#7a5a1a] font-bold flex items-center gap-1.5">
                            <UserX size={12} /> 계정 미생성 {missingAccountCount}명
                        </span>
                    ) : (
                        <span className="px-2 py-1 bg-[#faf8f0] border border-[#d4cfbf] text-[#9a9585] flex items-center gap-1.5">
                            <UserX size={12} /> 계정 미생성 0명
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mt-4 lg:items-stretch">
                <div className="flex-1 bg-[#faf8f0] border border-[#d4cfbf] overflow-hidden flex flex-col lg:h-[700px] max-h-[700px]">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                        <table className="w-full">
                            <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] text-[10px] font-bold text-[#5d6c4a] uppercase tracking-wider">
                                {typeFilter === 'STAFF' ? (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">부서</th><th className="p-2.5 text-left">직급</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">진급일</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                ) : typeFilter === 'ALBA' ? (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">팀</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">계약갱신</th><th className="p-2.5 text-center">근무시간</th><th className="p-2.5 text-right">시급</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                ) : (
                                    <tr><th className="p-2.5 pl-3 text-left">성별</th><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">유형</th><th className="p-2.5 text-left">팀/부서</th><th className="p-2.5 text-left">입사일</th><th className="p-2.5 text-center">4대보험</th><th className="p-2.5 text-left">상태</th><th className="p-2.5 pr-3 text-right">관리</th></tr>
                                )}
                            </thead>
                            <tbody className="text-sm divide-y divide-[#ebe8db] [&_td]:align-middle">
                                {displayData.map(user => {
                                    const eType = user.employmentType || user.position || '아르바이트';
                                    const isAlba = eType === '아르바이트';
                                    const insured = user.insuranceStatus;
                                    return (
                                        <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f5f3e8] transition-colors text-xs ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                            <td className="p-2.5 pl-3 text-[#7a7565]">{displayGender(getGenderValue(user))}</td>
                                            <td className="p-2.5 font-bold text-[#3d472f]">{user.name}</td>
                                            {typeFilter === 'STAFF' ? (
                                                <>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.jobTitle || '-'}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#8d5a4d]">✗</span>}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.promotionDate || '-'}</td>
                                                </>
                                            ) : typeFilter === 'ALBA' ? (
                                                <>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#8d5a4d]">✗</span>}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.renewalDate || '-'}</td>
                                                    <td className="p-2.5 text-center text-[#5a5545]">{user.checkIn}~{user.checkOut}</td>
                                                    <td className="p-2.5 text-right font-bold text-[#3d472f]">₩{(user.wage || 0).toLocaleString()}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2.5"><span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold border ${isAlba ? 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]' : 'bg-[#e8edf0] text-[#5a6878] border-[#c5cbd2]'}`}>{eType}</span></td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.team}</td>
                                                    <td className="p-2.5 text-[#5a5545]">{user.startDate}</td>
                                                    <td className="p-2.5 text-center">{insured ? <span className="text-[#5d6c4a] font-bold">✓</span> : <span className="text-[#8d5a4d]">✗</span>}</td>
                                                    <td className="p-2.5">
                                                        {user.resignDate ? <span className="text-[10px] font-bold text-[#8d5a4d]">퇴사</span> : <span className="text-[10px] font-bold text-[#5d6c4a]">재직</span>}
                                                    </td>
                                                </>
                                            )}
                                            <td className="p-2.5 pr-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={(e) => openUserForm(user, e)} className="p-1 bg-[#faf8f0] text-[#5d6c4a] hover:bg-[#f5f3e8] border border-[#d4cfbf]" title='수정'><Edit size={12} /></button>
                                                    {!user.resignDate && <button onClick={(e) => openResignModal(user, e)} className="p-1 bg-[#faf8f0] text-[#a78049] hover:bg-[#f5f1e3] border border-[#c9a66a]" title='퇴사'><UserMinus size={12} /></button>}
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTargetUser(user); }} className="p-1 bg-[#faf8f0] text-[#8d5a4d] hover:bg-[#8d5a4d] hover:text-[#faf8f0] border border-[#cba79c] transition-colors" title='삭제'><Trash2 size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="w-full lg:w-80 bg-[#faf8f0] border border-[#d4cfbf] flex flex-col h-[700px]">
                    {selectedUser ? (() => {
                        const eType = selectedUser.employmentType || selectedUser.position || '아르바이트';
                        const eStatus = selectedUser.employmentStatus || (selectedUser.resignDate ? '퇴사' : '재직');
                        const isAlbaUser = eType === '아르바이트';
                        const tenureLabel = calcTenure(selectedUser.startDate, selectedUser.resignDate);
                        const statusBadgeCls = selectedUser.resignDate
                            ? 'bg-[#8d5a4d] border-[#7a4d40] text-[#f5f3e8]'
                            : eStatus === '수습' ? 'bg-[#f5f1e3] border-[#c9a66a] text-[#7a5a1a]'
                            : eStatus === '퇴사예정' ? 'bg-[#f5ebe7] border-[#cba79c] text-[#8d5a4d]'
                            : 'bg-[#d4dcc0] border-[#b8c4a0] text-[#3d472f]';
                        const typeBadgeCls = isAlbaUser
                            ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]'
                            : 'bg-[#e8edf0] border-[#c5cbd2] text-[#5a6878]';
                        return (
                            <div className="flex flex-col h-full">
                                <div className="p-4 bg-[#5d6c4a] border-b border-[#3d472f]">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight truncate">{selectedUser.name || '-'}</h2>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold border ${statusBadgeCls}`}>{eStatus}</span>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold border ${typeBadgeCls}`}>{eType}</span>
                                        </div>
                                    </div>
                                    <p className="text-[#d4dcc0] text-xs font-bold flex items-center gap-1.5">
                                        <Briefcase size={12} />
                                        <span>{selectedUser.team || '-'}</span>
                                        <span className="text-[#b8c4a0]">·</span>
                                        <span>{(!isAlbaUser && selectedUser.jobTitle) ? selectedUser.jobTitle : (isAlbaUser ? '아르바이트' : '-')}</span>
                                    </p>
                                    {selectedUser.resignDate && (
                                        <div className="mt-3 p-3 bg-[#7a4d40] border-l-4 border-[#3d3929] text-xs">
                                            <div className="font-bold text-[#f5f3e8]">퇴사일: {selectedUser.resignDate}</div>
                                            {selectedUser.resignReason && <div className="mt-1 text-[#dcc0bc]">사유: {selectedUser.resignReason}</div>}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    <div>
                                        <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-1.5">기본 정보</h3>
                                        <div className="bg-[#f5f3e8] p-3 border border-[#d4cfbf] space-y-2">
                                            <InfoRow icon={<Users size={14} />} label="성별" value={displayGender(getGenderValue(selectedUser))} />
                                            <InfoRow icon={<Phone size={14} />} label="연락처" value={maskPII ? '***-****-****' : selectedUser.phone} />
                                            <InfoRow icon={<Mail size={14} />} label="이메일" value={selectedUser.email} />
                                            <InfoRow icon={<Calendar size={14} />} label="입사일" value={selectedUser.startDate} />
                                            <InfoRow icon={<RotateCcw size={14} />} label="근속" value={tenureLabel} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-1.5">근무 / 계약 정보</h3>
                                        <div className="bg-[#f5f3e8] p-3 border border-[#d4cfbf] space-y-2">
                                            {isAlbaUser ? (
                                                <>
                                                    <InfoRow icon={<Monitor size={14} />} label="근무시간" value={(selectedUser.checkIn && selectedUser.checkOut) ? `${selectedUser.checkIn} - ${selectedUser.checkOut}` : '-'} />
                                                    <InfoRow icon={<Calendar size={14} />} label="주 근무일수" value={selectedUser.workDays} />
                                                    <InfoRow icon={<Wallet size={14} />} label="시급" value={selectedUser.wage ? `₩${Number(selectedUser.wage).toLocaleString()}` : '-'} />
                                                    <InfoRow icon={<RotateCcw size={14} />} label="계약 갱신일" value={selectedUser.renewalDate} />
                                                </>
                                            ) : (
                                                <>
                                                    <InfoRow icon={<Briefcase size={14} />} label="직급" value={selectedUser.jobTitle} />
                                                    <InfoRow icon={<Calendar size={14} />} label="진급일" value={selectedUser.promotionDate} />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                            <span>4대보험</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${selectedUser.insuranceStatus ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#f5ebe7] border-[#cba79c] text-[#8d5a4d]'}`}>
                                                {selectedUser.insuranceStatus ? '가입' : '미가입'}
                                            </span>
                                        </h3>
                                        <div className="bg-[#f5f3e8] p-3 border border-[#d4cfbf] space-y-2">
                                            <InfoRow icon={<Shield size={14} />} label="신고일" value={selectedUser.insuranceDate} />
                                        </div>
                                    </div>

                                    {selectedUser.resignDate && (
                                        <div className="bg-[#f5ebe7] p-4 border border-[#cba79c]">
                                            <h3 className="text-[11px] font-bold text-[#8d5a4d] uppercase tracking-wide mb-1.5">퇴사 정보</h3>
                                            <InfoRow icon={<Calendar size={14} />} label="퇴사일" value={selectedUser.resignDate} />
                                            <InfoRow icon={<FileText size={14} />} label="사유" value={selectedUser.resignReason || '미기재'} />
                                        </div>
                                    )}
                                    <div className="bg-[#e8ebd8] p-4 border border-[#b8c4a0]">
                                        <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                            예상 급여
                                            <span className="text-[10px] bg-[#5d6c4a] text-[#f5f3e8] px-1.5 py-0.5">{selectedUser.insuranceStatus ? '세전' : '3.3%공제'}</span>
                                        </h3>
                                        {(() => {
                                            const wage = calculateMonthlyWage(selectedUser, payrollMonth);
                                            if (selectedUser.insuranceStatus) {
                                                return (
                                                    <>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[#7a7565] text-xs font-bold">월 기본급 (예상)</span>
                                                            <span className="text-[#3d472f] font-mono font-bold">₩{wage.estimated.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2 border-t border-[#b8c4a0]">
                                                            <span className="text-[#5d6c4a] text-sm font-black">실적 합계</span>
                                                            <span className="text-[#2d3721] font-black text-lg">₩{wage.actual.toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-[10px] text-[#7a7565] text-right mt-1">4대보험 공제는 노무사 산정 후 확정</p>
                                                    </>
                                                );
                                            } else {
                                                return (
                                                    <>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[#7a7565] text-xs font-bold">월 기본급 (예상)</span>
                                                            <span className="text-[#3d472f] font-mono font-bold">₩{wage.estimated.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[#7a7565] text-xs font-bold">실적 합계</span>
                                                            <span className="text-[#3d472f] font-mono font-bold">₩{wage.actual.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[#8d5a4d] mt-1 mb-2">
                                                            <span className="text-xs font-bold">- 3.3% 공제</span>
                                                            <span className="font-mono font-bold">-₩{wage.strictDeduction.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2 border-t border-[#b8c4a0]">
                                                            <span className="text-[#5d6c4a] text-sm font-black">실지급액</span>
                                                            <span className="text-[#2d3721] font-black text-lg">₩{wage.strictFinalPayout.toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-[#d4cfbf] bg-[#faf8f0]">
                                    <button onClick={() => openModal('calendar')} className="w-full py-3 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border border-[#3d472f] flex justify-center items-center gap-2"><Calendar size={16} /> 근태 관리 열기</button>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[#9a9585] p-8 text-center">
                            <div className="w-14 h-14 rounded-full bg-[#f5f3e8] flex items-center justify-center mb-3 border border-[#d4cfbf]">
                                <Users size={28} className="text-[#9a9585]" />
                            </div>
                            <p className="text-sm font-bold text-[#7a7565] mb-1">직원 상세</p>
                            <p className="text-xs text-[#9a9585] leading-relaxed">왼쪽 목록에서 인력을 선택하면<br />기본 정보·근무·4대보험·예상 급여를 확인할 수 있습니다.</p>
                        </div>
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={!!deleteTargetUser}
                onClose={() => setDeleteTargetUser(null)}
                onConfirm={() => {
                    if (deleteTargetUser) {
                        onDeleteUser(deleteTargetUser.id);
                        setDeleteTargetUser(null);
                    }
                }}
                title="직원 삭제 확인"
                message={deleteTargetUser ? `[${deleteTargetUser.name}] 직원을 목록에서 완전히 삭제하시겠습니까?\n모든 기록이 함께 제거될 수 있습니다.` : ''}
                isDanger={true}
                confirmText="삭제"
            />
        </>
    );
}
