import React, { useMemo, useState } from 'react';
import { Users, UserMinus, Calendar, Edit, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import StatCard from './ui/StatCard';
import InfoRow from './ui/InfoRow';

// 이번 달 연차 카드/모달용 — leave_requests 구조 기준 helper
// 활성 신청(SUBMITTED/TEAM_APPROVED/FINAL_PENDING/CEO_PENDING) + 승인완료(FINAL_APPROVED) 포함
// 반려/취소(REJECTED/CANCELLED)는 제외
const ACTIVE_REQ_STATUSES = new Set(['SUBMITTED', 'TEAM_APPROVED', 'FINAL_PENDING', 'CEO_PENDING', 'FINAL_APPROVED']);
const PENDING_REQ_STATUSES = new Set(['SUBMITTED', 'TEAM_APPROVED', 'FINAL_PENDING', 'CEO_PENDING']);
const APPROVED_REQ_STATUSES = new Set(['FINAL_APPROVED']);

const STATUS_LABEL = {
    SUBMITTED: '신청중',
    TEAM_APPROVED: '팀 승인',
    FINAL_PENDING: '최종 승인대기',
    CEO_PENDING: '대표 승인대기',
    FINAL_APPROVED: '승인완료',
    REJECTED: '반려',
    CANCELLED: '취소',
};
const TYPE_LABEL = {
    FULL: '연차',
    HALF_AM: '오전 반차',
    HALF_PM: '오후 반차',
};

// 이번 달(YYYY-MM)에 포함되는 신청인지 판정
// applied_dates 우선, 없으면 start_date~end_date 범위, 없으면 단일 date
const reqIsInMonth = (req, ym) => {
    if (Array.isArray(req.applied_dates) && req.applied_dates.length > 0) {
        return req.applied_dates.some(d => String(d).startsWith(ym));
    }
    if (req.start_date && req.end_date) {
        const s = String(req.start_date);
        const e = String(req.end_date);
        // 시작이 ym 이전이고 종료가 ym 이후이거나, 어느 한쪽이 ym에 걸치면 포함
        const sYm = s.slice(0, 7);
        const eYm = e.slice(0, 7);
        return sYm <= ym && ym <= eYm;
    }
    if (req.date) return String(req.date).startsWith(ym);
    return false;
};

// 신청을 일자별로 펼쳐서 (YYYY-MM-DD) 배열로 반환
// 우선순위: applied_dates > start_date~end_date > date
// (timezone drift 방지를 위해 로컬 Date 사용)
const expandRequestDates = (req) => {
    if (Array.isArray(req.applied_dates) && req.applied_dates.length > 0) {
        return req.applied_dates.map(d => String(d)).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d));
    }
    if (req.start_date && req.end_date) {
        const out = [];
        const [sy, sm, sd] = String(req.start_date).split('-').map(Number);
        const [ey, em, ed] = String(req.end_date).split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
            out.push(`${y}-${mo}-${dd}`);
        }
        return out;
    }
    if (req.date) return [String(req.date)];
    return [];
};

// 캘린더 그리드 셀 생성 — 월의 1일이 포함된 주(일~토) 시작 ~ 마지막 날이 포함된 주 끝
// 각 셀: { dateStr, day, isCurrentMonth, isToday, isSunday, isSaturday }
const buildCalendarGrid = (ymStr) => {
    const [y, m] = ymStr.split('-').map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const lastOfMonth = new Date(y, m, 0); // 다음 달 0일 = 이번 달 마지막 날
    const startDow = firstOfMonth.getDay(); // 0=일
    const gridStart = new Date(y, m - 1, 1 - startDow);
    const totalDays = lastOfMonth.getDate();
    const rows = Math.ceil((startDow + totalDays) / 7);
    const cells = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < rows * 7; i++) {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + i);
        const yy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yy}-${mm}-${dd}`;
        const dow = d.getDay();
        cells.push({
            dateStr,
            day: d.getDate(),
            isCurrentMonth: d.getMonth() === m - 1,
            isToday: dateStr === todayStr,
            isSunday: dow === 0,
            isSaturday: dow === 6,
        });
    }
    return cells;
};

const addMonths = (ymStr, delta) => {
    const [y, m] = ymStr.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const todayYM = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 신청의 표시용 기간 라벨 (날짜 상세 패널의 "기간/신청일" 컬럼용)
const reqRangeLabelShort = (req) => {
    if (Array.isArray(req.applied_dates) && req.applied_dates.length > 0) {
        const sorted = [...req.applied_dates].sort();
        if (sorted.length === 1) return sorted[0];
        return `${sorted[0]} ~ ${sorted[sorted.length - 1]} (${sorted.length}일)`;
    }
    if (req.start_date && req.end_date) {
        if (req.start_date === req.end_date) return req.start_date;
        return `${req.start_date} ~ ${req.end_date}`;
    }
    return req.date || '-';
};

// 시각 클래스 토큰 (LeaveView 내부 한정 — 새 파일/유틸 분리 안 함)
const CARD_BASE = 'bg-[#faf8f0] border border-[#d4cfbf]';
const SECTION_TITLE = 'text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2 pb-1 border-b border-[#d4cfbf]';

// 숫자 표시 helper — 정수면 N일, 소수점이면 1자리
const fmtDays = (n) => {
    const v = Number(n);
    if (!isFinite(v)) return '0일';
    return Number.isInteger(v) ? `${v}일` : `${v.toFixed(1)}일`;
};

const isAlba = (u) =>
    (u.employmentType || u.position) === '아르바이트';

// 팀명 정규화 — 화면 표시 + 카운트 + 필터 모두 동일 기준 사용
// ER 팀은 운영상 QC로 통합되었으므로 화면 표시 기준에서는 QC로 합산 (데이터는 보존)
// 그 외 팀은 하드코딩하지 않고 직원 데이터에서 동적으로 추출
const normalizeTeam = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return '미지정';
    if (t === 'ER') return 'QC';
    return t;
};
const teamOf = (u) => normalizeTeam(u.team || u.team_id || u.department);

// baseline 우선 표시값 산출 — baseline이 있고 baseline_type === 'cumulative_from_start_date'이면 baseline 값 사용
// 없거나 형식이 맞지 않으면 기존 calculateLeave 결과를 그대로 fallback으로 사용
// baseline 모드: 잔여 = total_days - used_days + adjustment_days (adjustment_days 없으면 0)
const getDisplayLeave = (user, leaveBalancesByEmployeeId, calculateLeave) => {
    const fallback = calculateLeave(user);
    const balance = leaveBalancesByEmployeeId?.[String(user.id)];
    if (!balance) return { mode: 'fallback', leave: fallback, balance: null };
    if (balance.baseline_type !== 'cumulative_from_start_date') {
        return { mode: 'fallback', leave: fallback, balance };
    }
    const totalEarned = Number(balance.total_days ?? 0);
    const usedLeave = Number(balance.used_days ?? 0);
    const adjustment = Number(balance.adjustment_days ?? 0) || 0;
    const remaining = totalEarned - usedLeave + adjustment;
    return {
        mode: 'baseline',
        leave: {
            yearsWorked: fallback.yearsWorked,
            monthsWorked: fallback.monthsWorked,
            firstYearLeave: fallback.firstYearLeave,
            firstYearCarryover: fallback.firstYearCarryover,
            annualLeave: fallback.annualLeave,
            carryover: fallback.carryover,
            usedLeave,
            adjustment,                  // baseline 모드: leave_balance.adjustment_days 우선 반영
            totalEarned,
            remaining,
            absenceCount: fallback.absenceCount,
        },
        balance,
    };
};

export default function LeaveView({
    users, viewMode, setViewMode, filteredData,
    selectedUser, handleSelectUser, calculateLeave,
    leaveBalancesByEmployeeId,
    leaveRequests,
    openModal, setAdjustUser, setAdjustBaseline
}) {
    // ─── 팀 필터 state (LeaveView 내부 한정) ──────────────────
    const [selectedTeam, setSelectedTeam] = useState('ALL');
    // ─── 이번 달 연차 캘린더 모달 state ──────────────────────
    const [showMonthlyModal, setShowMonthlyModal] = useState(false);
    const [calendarYM, setCalendarYM] = useState(() => todayYM()); // 캘린더 월 이동 (오늘 기준 default)
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(null); // 선택된 날짜(YYYY-MM-DD), null이면 미선택

    // 팀 필터 변경 시 우측 상세 패널 초기화 — handleSelectUser(null)은 App.jsx에서 안전 처리됨
    const handleTeamSelect = (team) => {
        setSelectedTeam(team);
        if (typeof handleSelectUser === 'function') {
            handleSelectUser(null);
        }
    };

    // 이번 달 (YYYY-MM)
    const currentYM = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    // user_id → user (employees) 매핑 — 모달에서 직원명/소속 표시용
    // alba 본인 화면에서 leave_requests.user_id는 users.uid이고, employees에는 user_id 직접 매핑이 없음
    // → users.employee_id ↔ employees.id 연결을 활용해 employees를 찾아야 하지만,
    //   leave_requests에는 employees 정보가 없으므로 본 모달은 user_id 기준 표시 + name fallback 처리
    const userByUid = useMemo(() => {
        // leaveBalancesByEmployeeId가 employee_id 기준 Map이므로, balance.user_id로 employees를 역추적
        const byUid = new Map();
        for (const u of users) {
            // employees doc에는 uid가 직접 없음. leave_balance에서 employee_id ↔ user_id 매칭으로 파악
            const balance = leaveBalancesByEmployeeId?.[String(u.id)];
            if (balance?.user_id) byUid.set(String(balance.user_id), u);
        }
        return byUid;
    }, [users, leaveBalancesByEmployeeId]);

    // 이번 달(오늘 기준) 카드 카운트용 — 캘린더 모달의 calendarYM과는 분리
    const monthlyTotalCount = useMemo(() => {
        if (!Array.isArray(leaveRequests)) return 0;
        return leaveRequests
            .filter(r => ACTIVE_REQ_STATUSES.has(r.status))
            .filter(r => reqIsInMonth(r, currentYM))
            .length;
    }, [leaveRequests, currentYM]);

    // ─── 캘린더 모달용: calendarYM 기준 데이터 ─────────────────
    const calendarCells = useMemo(() => buildCalendarGrid(calendarYM), [calendarYM]);

    // 모달 닫기 시 선택 날짜 초기화 — 다음 오픈 시 깨끗한 상태로 시작
    const closeMonthlyModal = () => {
        setShowMonthlyModal(false);
        setSelectedCalendarDate(null);
    };

    // 월 이동 시 선택 날짜 초기화
    const goToMonth = (delta) => {
        setCalendarYM(addMonths(calendarYM, delta));
        setSelectedCalendarDate(null);
    };
    const goToToday = () => {
        setCalendarYM(todayYM());
        setSelectedCalendarDate(null);
    };

    // 날짜별 신청 entries 매핑 — 활성 5종만, 각 신청을 일자별로 펼침
    const entriesByDate = useMemo(() => {
        const map = new Map();
        if (!Array.isArray(leaveRequests)) return map;
        for (const r of leaveRequests) {
            if (!ACTIVE_REQ_STATUSES.has(r.status)) continue;
            const dates = expandRequestDates(r);
            if (dates.length === 0) continue;
            const emp = userByUid.get(String(r.user_id));
            const entry = {
                id: r.id,
                name: emp?.name || r.user_id || '직원 미확인',
                team: emp ? teamOf(emp) : '-',
                type: r.type || '',
                typeLabel: TYPE_LABEL[r.type] || r.type || '',
                status: r.status,
                statusLabel: STATUS_LABEL[r.status] || r.status,
                isPending: PENDING_REQ_STATUSES.has(r.status),
                isApproved: APPROVED_REQ_STATUSES.has(r.status),
            };
            for (const d of dates) {
                if (!map.has(d)) map.set(d, []);
                map.get(d).push(entry);
            }
        }
        // 각 날짜별 정렬: 승인완료 → 승인대기 순(상태 동일 시 직원명 오름차순)
        for (const [d, arr] of map.entries()) {
            arr.sort((a, b) => {
                if (a.isApproved !== b.isApproved) return a.isApproved ? -1 : 1;
                return String(a.name).localeCompare(String(b.name));
            });
        }
        return map;
    }, [leaveRequests, userByUid]);

    // 선택된 날짜의 신청자 전체 목록 (셀 +N명 케이스 포함, 정렬: 소속 → 이름)
    // 신청 원본(leave_requests)도 가져와 기간/일수 표시
    const selectedDateEntries = useMemo(() => {
        if (!selectedCalendarDate || !Array.isArray(leaveRequests)) return [];
        const reqsByDate = leaveRequests
            .filter(r => ACTIVE_REQ_STATUSES.has(r.status))
            .filter(r => expandRequestDates(r).includes(selectedCalendarDate));
        return reqsByDate
            .map(r => {
                const emp = userByUid.get(String(r.user_id));
                const team = emp ? teamOf(emp) : '-';
                return {
                    id: r.id,
                    name: emp?.name || r.user_id || '직원 미확인',
                    team,
                    type: r.type,
                    typeLabel: TYPE_LABEL[r.type] || r.type || '-',
                    status: r.status,
                    statusLabel: STATUS_LABEL[r.status] || r.status,
                    isPending: PENDING_REQ_STATUSES.has(r.status),
                    isApproved: APPROVED_REQ_STATUSES.has(r.status),
                    dayCount: r.day_count ?? 1,
                    rangeLabel: reqRangeLabelShort(r),
                };
            })
            .sort((a, b) => {
                const t = String(a.team).localeCompare(String(b.team));
                if (t !== 0) return t;
                const n = String(a.name).localeCompare(String(b.name));
                if (n !== 0) return n;
                return String(a.typeLabel).localeCompare(String(b.typeLabel));
            });
    }, [selectedCalendarDate, leaveRequests, userByUid]);

    // calendarYM 월 통계 (모달 상단 요약용)
    const calendarStats = useMemo(() => {
        let total = 0, pending = 0, approved = 0;
        const seenIds = new Set();
        for (const cell of calendarCells) {
            if (!cell.isCurrentMonth) continue;
            const arr = entriesByDate.get(cell.dateStr) || [];
            for (const e of arr) {
                if (seenIds.has(e.id)) continue;
                seenIds.add(e.id);
                total++;
                if (e.isPending) pending++;
                else if (e.isApproved) approved++;
            }
        }
        return { total, pending, approved };
    }, [calendarCells, entriesByDate]);

    // ─── 상단 카드용 집계 (LeaveView 내부에서만 안전하게 계산) ──
    // 연차관리 화면 기준: 재직/퇴사 모두 "아르바이트"로 한정 (카드 숫자와 클릭 후 목록 일관성)
    const activeAlba = useMemo(() => users.filter(u => !u.resignDate && isAlba(u)), [users]);
    const resignedAlba = useMemo(() => users.filter(u => u.resignDate && isAlba(u)), [users]);

    // 연차 조정 버튼 클릭 헬퍼 — baseline 직원이면 adjustBaseline 컨텍스트 함께 설정
    const openAdjustModal = (user) => {
        const balance = leaveBalancesByEmployeeId?.[String(user.id)];
        if (balance && balance.baseline_type === 'cumulative_from_start_date') {
            setAdjustBaseline?.({
                balanceDocId: balance._docId || `${balance.user_id}_${balance.year}`,
                currentAdjustment: Number(balance.adjustment_days ?? 0) || 0,
            });
        } else {
            setAdjustBaseline?.(null);
        }
        setAdjustUser(user);
        openModal('adjust');
    };

    // 팀별 재직 아르바이트 인원 — 정규화된 teamOf 기준, 인원 많은 순
    const teamCounts = useMemo(() => {
        const m = new Map();
        for (const u of activeAlba) {
            const key = teamOf(u);
            m.set(key, (m.get(key) || 0) + 1);
        }
        return Array.from(m.entries())
            .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    }, [activeAlba]);

    // 목록 필터 — 연차관리 화면 기준: 아르바이트만 + 선택된 팀
    // 카드 숫자(재직/퇴사 아르바이트)와 클릭 후 목록 인원이 일치하도록 employmentType 추가 필터 적용
    const visibleList = useMemo(() => {
        const albaOnly = filteredData.filter(u => isAlba(u));
        if (selectedTeam === 'ALL') return albaOnly;
        return albaOnly.filter(u => teamOf(u) === selectedTeam);
    }, [filteredData, selectedTeam]);

    // 팀 버튼 공통 스타일
    const teamBtnBase = 'inline-flex items-center justify-center gap-1.5 min-w-[64px] h-8 px-3 text-xs font-bold border-2 transition-colors';
    const teamBtnIdle = 'bg-[#f5f3e8] text-[#5d6c4a] border-[#d4cfbf] hover:bg-[#e8e4d4] hover:border-[#a8b58a]';
    const teamBtnActive = 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]';

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            <div className={`flex-1 ${CARD_BASE} overflow-hidden`}>
                {/* ── 상단 카드 ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[#d4cfbf] bg-[#faf8f0]">
                    {/* 재직 아르바이트 — 우측 아이콘 박스 제거, 보조 문구만 */}
                    <div
                        onClick={() => setViewMode('ACTIVE')}
                        className={`p-5 border-2 transition-all duration-200 cursor-pointer ${viewMode === 'ACTIVE' ? 'border-[#5d6c4a] ring-2 ring-[#5d6c4a] shadow-md transform -translate-y-0.5 bg-[#e8ebd8]' : 'bg-[#f5f3e8] border-[#c5c0b0] hover:border-[#5d6c4a] hover:bg-[#e8e4d4]'}`}
                    >
                        <p className="text-[10px] font-bold text-[#6b7b54] uppercase tracking-wider mb-1">재직 아르바이트</p>
                        <h3 className="text-2xl font-black text-[#3d472f]">{activeAlba.length}명</h3>
                        <p className="text-[10px] text-[#7a7565] mt-1">퇴사자 제외</p>
                    </div>

                    {/* 팀별 현황 — 클릭 가능한 필터 버튼 묶음 */}
                    <div className={`p-3 ${CARD_BASE}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={16} className="text-[#5d6c4a]" />
                            <span className="text-[11px] font-bold text-[#7a7565] uppercase tracking-wide">팀별 현황</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleTeamSelect('ALL')}
                                className={`${teamBtnBase} ${selectedTeam === 'ALL' ? teamBtnActive : teamBtnIdle}`}
                            >
                                전체 <span className={selectedTeam === 'ALL' ? 'text-[#d4dcc0]' : 'text-[#3d472f]'}>{activeAlba.length}</span>
                            </button>
                            {teamCounts.map(([team, count]) => (
                                <button
                                    key={team}
                                    type="button"
                                    onClick={() => handleTeamSelect(team)}
                                    className={`${teamBtnBase} ${selectedTeam === team ? teamBtnActive : teamBtnIdle}`}
                                >
                                    {team} <span className={selectedTeam === team ? 'text-[#d4dcc0]' : 'text-[#3d472f]'}>{count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 이번 달 연차 — 클릭 시 월간 캘린더 모달 표시 (모달 월은 calendarYM 별도 관리) */}
                    <div
                        onClick={() => { setCalendarYM(todayYM()); setShowMonthlyModal(true); }}
                        className="p-5 border-2 bg-[#f5f3e8] border-[#c5c0b0] cursor-pointer hover:border-[#5d6c4a] hover:bg-[#e8e4d4] transition-colors"
                    >
                        <p className="text-[10px] font-bold text-[#6b7b54] uppercase tracking-wider mb-1">이번 달 연차</p>
                        <h3 className="text-2xl font-black text-[#3d472f]">{monthlyTotalCount}건</h3>
                        <p className="text-[10px] text-[#7a7565] mt-1">이번 달 신청 내역 기준</p>
                    </div>

                    {/* 퇴사 인원 — 연차관리 화면 기준 = 퇴사 아르바이트 */}
                    <StatCard
                        title="퇴사 인원"
                        value={`${resignedAlba.length}명`}
                        icon={<UserMinus size={20} />}
                        onClick={() => setViewMode('RESIGNED')}
                        active={viewMode === 'RESIGNED'}
                    />
                    {/* 주: filteredData가 App.jsx에서 employmentType 필터를 적용하지 않을 수 있으므로,
                        화면 일치를 위해 RESIGNED 모드에서도 알바만 필터링되도록 visibleList에서 추가 가드 */}
                </div>

                {/* ── 인원 목록 ── */}
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-[#f5f3e8] sticky top-0 z-10 border-b border-[#d4cfbf] text-xs font-bold text-[#5d6c4a] uppercase tracking-wider">
                            <tr>
                                <th className="p-3 pl-4 text-left">직원 정보</th>
                                <th className="p-3 text-center">소속</th>
                                <th className="p-3 text-center">근속</th>
                                <th className="p-3 text-center">총 발생연차</th>
                                <th className="p-3 text-center">사용 연차</th>
                                <th className="p-3 text-center">잔여 연차</th>
                                <th className="p-3 pr-4 text-right">연차 조정</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-[#ebe8db] [&_td]:align-middle">
                            {visibleList.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-6 text-center text-xs text-[#9a9585]">선택한 팀에 해당하는 직원이 없습니다.</td>
                                </tr>
                            ) : visibleList.map(user => {
                                const { leave } = getDisplayLeave(user, leaveBalancesByEmployeeId, calculateLeave);
                                const isLow = leave.remaining <= 3;
                                const teamLabel = teamOf(user);
                                return (
                                    <tr key={user.id} onClick={() => handleSelectUser(user)} className={`group cursor-pointer hover:bg-[#f5f3e8] transition-colors ${selectedUser?.id === user.id ? 'bg-[#e8ebd8]' : ''}`}>
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 flex items-center justify-center font-bold text-xs ${user.resignDate ? 'bg-[#c5c0b0] text-[#f5f3e8]' : 'bg-[#5d6c4a] text-[#f5f3e8]'}`}>
                                                    {user.name[0]}
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${user.resignDate ? 'text-[#9a9585]' : 'text-[#3d472f]'}`}>
                                                        {user.name}
                                                    </p>
                                                    <p className="text-[10px] text-[#7a7565]">{user.startDate} 입사</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-[#5a5545]">
                                            <span className="text-xs font-bold bg-[#f5f3e8] border border-[#d4cfbf] px-2 py-0.5">{teamLabel}</span>
                                        </td>
                                        <td className="p-3 text-center text-[#5a5545]"><span className="font-mono bg-[#f5f3e8] border border-[#d4cfbf] px-1">{leave.yearsWorked}년</span></td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{fmtDays(leave.totalEarned)}</td>
                                        <td className="p-3 text-center text-[#5a5545] font-bold">{fmtDays(leave.usedLeave)}</td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-bold border ${isLow ? 'bg-[#f5ebe7] text-[#8d5a4d] border-[#cba79c]' : 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]'}`}>
                                                {fmtDays(leave.remaining)}
                                            </span>
                                        </td>
                                        <td className="p-3 pr-4 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openAdjustModal(user); }}
                                                className="px-3 py-1.5 text-xs bg-[#faf8f0] text-[#5d6c4a] hover:bg-[#f5f3e8] font-bold inline-flex items-center gap-1 border border-[#d4cfbf]"
                                            >
                                                <Edit size={12} /> 연차 조정
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── 우측 상세 패널 ── */}
            <div className={`w-full lg:w-80 ${CARD_BASE} flex flex-col`}>
                {selectedUser ? (
                    <div className="flex flex-col h-full">
                        <div className="p-4 bg-[#5d6c4a] border-b border-[#3d472f]">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl font-black text-[#f5f3e8] tracking-tight">{selectedUser.name}</h2>
                            </div>
                            <p className="text-[#d4dcc0] text-sm font-bold">{teamOf(selectedUser)} | {selectedUser.startDate}</p>
                            {selectedUser.resignDate && (<p className="text-xs text-[#f5f3e8] mt-1 bg-[#8d5a4d] inline-block px-2 py-0.5 border border-[#7a4d40]">퇴사: {selectedUser.resignDate}</p>)}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {(() => {
                                const { mode, leave, balance } = getDisplayLeave(selectedUser, leaveBalancesByEmployeeId, calculateLeave);
                                const isBaseline = mode === 'baseline';
                                return (
                                    <>
                                        <div>
                                            <h3 className={SECTION_TITLE}>근무 정보</h3>
                                            <InfoRow label="근속기간" value={`${leave.yearsWorked}년 (${leave.monthsWorked}개월)`} />
                                        </div>
                                        {isBaseline ? (
                                            <>
                                                <div className="bg-[#fdf6e3] border border-[#d8c490] p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-[#a06820] uppercase tracking-wider">입사일 기준 누적 연차로 관리 중</span>
                                                    </div>
                                                    <p className="text-[10px] text-[#7a5a1a] leading-relaxed">
                                                        {balance?.system_start_date || '2026-05-08'} 기준 입사일부터 누적 발생/사용/잔여 연차 기준값이 반영되었습니다.
                                                        {balance?.pre_system_used_days !== undefined && (
                                                            <><br />프로그램 사용 전 누적 사용분: {fmtDays(balance.pre_system_used_days)}</>
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h3 className={SECTION_TITLE}>연차 현황</h3>
                                                    <InfoRow label="누적 총 발생" value={fmtDays(leave.totalEarned)} />
                                                    <InfoRow label="누적 사용" value={fmtDays(leave.usedLeave)} />
                                                    <InfoRow
                                                        label="관리자 조정"
                                                        value={`${leave.adjustment > 0 ? '+' : ''}${fmtDays(leave.adjustment).replace('일', '')}일`}
                                                    />
                                                    <div className="border-t border-[#d4cfbf] my-2 pt-2"></div>
                                                    <InfoRow label="최종 잔여" value={fmtDays(leave.remaining)} />
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                <h3 className={SECTION_TITLE}>연차 현황</h3>
                                                <InfoRow label="1년 미만 발생" value={fmtDays(leave.firstYearLeave)} />
                                                <InfoRow label="법정 연차 발생" value={fmtDays(leave.annualLeave)} />
                                                <InfoRow label="이월 연차 반영" value={fmtDays(leave.carryover + leave.firstYearCarryover)} />
                                                <InfoRow label="임의 조정" value={`${leave.adjustment > 0 ? '+' : ''}${leave.adjustment}일`} />
                                                <div className="border-t border-[#d4cfbf] my-2 pt-2"></div>
                                                <InfoRow label="총 사용 연차" value={fmtDays(leave.usedLeave)} />
                                                {leave.absenceCount > 0 && (<InfoRow icon={<AlertTriangle size={14} className="text-[#a78049]" />} label="결근" value={`${leave.absenceCount}일`} />)}
                                            </div>
                                        )}
                                        <div className="bg-[#e8ebd8] p-4 border border-[#b8c4a0]">
                                            <h3 className="text-[11px] font-bold text-[#5d6c4a] uppercase tracking-wide mb-2">잔여 연차</h3>
                                            <div className="flex justify-between items-end">
                                                {(() => {
                                                    const remaining = leave.remaining;
                                                    const tone = remaining <= 0 ? 'text-[#8d5a4d]'
                                                        : remaining <= 3 ? 'text-[#a78049]'
                                                            : 'text-[#5d6c4a]';
                                                    return <span className={`text-2xl font-black ${tone}`}>{fmtDays(remaining)}</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="p-4 border-t border-[#d4cfbf] bg-[#faf8f0]">
                            <button onClick={() => openAdjustModal(selectedUser)} className="w-full py-3 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border border-[#3d472f] flex justify-center items-center gap-2"><Edit size={16} /> 연차 조정</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#9a9585] p-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-[#f5f3e8] flex items-center justify-center mb-3 border border-[#d4cfbf]">
                            <Users size={28} className="text-[#9a9585]" />
                        </div>
                        <p className="text-sm font-bold text-[#7a7565] mb-1">직원 상세</p>
                        <p className="text-xs text-[#9a9585] leading-relaxed">왼쪽 목록에서 직원을 선택하면<br />근속·연차 현황·잔여 연차를 확인할 수 있습니다.</p>
                    </div>
                )}
            </div>

            {/* ── 이번 달 연차 캘린더 모달 ── */}
            {showMonthlyModal && (
                <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={closeMonthlyModal}>
                    <div className="bg-[#f5f3e8] shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-[#3d472f]" onClick={(e) => e.stopPropagation()}>
                        {/* 상단 바 */}
                        <div className="p-4 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#5d6c4a]">
                            <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2">
                                <Calendar size={18} /> 연차 캘린더
                            </h3>
                            <button onClick={closeMonthlyModal} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={20} /></button>
                        </div>

                        {/* 월 이동 + 요약 */}
                        <div className="p-4 border-b border-[#d4cfbf] bg-[#faf8f0]">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => goToMonth(-1)}
                                        className="px-2 py-1.5 text-xs bg-[#f5f3e8] text-[#5d6c4a] hover:bg-[#e8e4d4] border border-[#d4cfbf] inline-flex items-center gap-1"
                                    >
                                        <ChevronLeft size={14} /> 이전
                                    </button>
                                    <span className="text-base font-black text-[#3d472f] min-w-[110px] text-center">{calendarYM.split('-')[0]}년 {Number(calendarYM.split('-')[1])}월</span>
                                    <button
                                        type="button"
                                        onClick={() => goToMonth(1)}
                                        className="px-2 py-1.5 text-xs bg-[#f5f3e8] text-[#5d6c4a] hover:bg-[#e8e4d4] border border-[#d4cfbf] inline-flex items-center gap-1"
                                    >
                                        다음 <ChevronRight size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToToday}
                                        className={`px-3 py-1.5 text-xs font-bold border ${calendarYM === todayYM() ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]' : 'bg-[#f5f3e8] text-[#5d6c4a] border-[#d4cfbf] hover:bg-[#e8e4d4]'}`}
                                    >
                                        이번 달
                                    </button>
                                </div>
                                <div className="flex gap-3 text-xs">
                                    <span className="text-[#7a7565]">총 <strong className="text-[#3d472f]">{calendarStats.total}</strong>건</span>
                                    <span className="text-[#a78049]">승인대기 <strong>{calendarStats.pending}</strong>건</span>
                                    <span className="text-[#5d6c4a]">승인완료 <strong>{calendarStats.approved}</strong>건</span>
                                </div>
                            </div>
                        </div>

                        {/* 캘린더 그리드 */}
                        <div className="flex-1 overflow-auto p-3 bg-[#faf8f0]">
                            <div className="grid grid-cols-7 gap-px bg-[#d4cfbf] border border-[#d4cfbf]">
                                {['일', '월', '화', '수', '목', '금', '토'].map((dn, i) => (
                                    <div key={dn} className={`p-2 text-center text-[11px] font-bold uppercase tracking-wide ${i === 0 ? 'text-[#8d5a4d]' : i === 6 ? 'text-[#5a6878]' : 'text-[#5d6c4a]'} bg-[#e8e4d4]`}>
                                        {dn}
                                    </div>
                                ))}
                                {calendarCells.map(cell => {
                                    const arr = entriesByDate.get(cell.dateStr) || [];
                                    const dayColor = cell.isSunday ? 'text-[#8d5a4d]' : cell.isSaturday ? 'text-[#5a6878]' : 'text-[#3d472f]';
                                    const bgColor = cell.isCurrentMonth ? 'bg-[#faf8f0]' : 'bg-[#f0eee0]';
                                    const isSelected = selectedCalendarDate === cell.dateStr;
                                    return (
                                        <div
                                            key={cell.dateStr}
                                            onClick={() => setSelectedCalendarDate(cell.dateStr)}
                                            className={`min-h-[90px] p-1.5 cursor-pointer hover:bg-[#e8e4d4] transition-colors ${bgColor} ${cell.isCurrentMonth ? '' : 'opacity-60'} ${cell.isToday && !isSelected ? 'ring-2 ring-inset ring-[#5d6c4a]' : ''} ${isSelected ? 'ring-2 ring-inset ring-[#a06820] bg-[#fdf6e3]' : ''}`}
                                            title={`${cell.dateStr} 클릭하여 신청자 보기`}
                                        >
                                            <div className={`text-[11px] font-bold ${dayColor} mb-1 flex items-center justify-between`}>
                                                <span>{cell.day}</span>
                                                {arr.length > 0 && cell.isCurrentMonth && (
                                                    <span className="text-[9px] font-normal text-[#9a9585]">{arr.length}</span>
                                                )}
                                            </div>
                                            {cell.isCurrentMonth && arr.slice(0, 4).map((e, idx) => (
                                                <div
                                                    key={`${e.id}-${idx}`}
                                                    className={`text-[10px] leading-tight px-1 py-0.5 mb-0.5 border truncate ${e.isPending ? 'bg-[#fdf6e3] text-[#7a5a1a] border-[#d8c490]' : 'bg-[#e8ebd8] text-[#3d472f] border-[#b8c4a0]'}`}
                                                    title={`${e.name} · ${e.typeLabel} · ${e.statusLabel} · ${e.team}`}
                                                >
                                                    <span className="font-bold">{e.name}</span>
                                                    <span className="text-[#7a7565]"> · {e.typeLabel}</span>
                                                </div>
                                            ))}
                                            {cell.isCurrentMonth && arr.length > 4 && (
                                                <div className="text-[10px] text-[#7a7565] font-bold mt-0.5">+{arr.length - 4}명</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 범례 */}
                            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[#7a7565]">
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 bg-[#fdf6e3] border border-[#d8c490]" /> 승인대기
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 bg-[#e8ebd8] border border-[#b8c4a0]" /> 승인완료
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 ring-2 ring-inset ring-[#5d6c4a] bg-[#faf8f0]" /> 오늘
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 ring-2 ring-inset ring-[#a06820] bg-[#fdf6e3]" /> 선택 날짜
                                </span>
                            </div>

                            {/* 선택 날짜 상세 영역 */}
                            <div className="mt-4 border-t-2 border-[#d4cfbf] pt-3">
                                <div className="flex items-baseline justify-between mb-2">
                                    <h4 className="text-xs font-bold text-[#5d6c4a] uppercase tracking-wide">선택 날짜 상세</h4>
                                    {selectedCalendarDate && (
                                        <span className="text-[11px] text-[#7a7565]">
                                            {selectedCalendarDate} ({selectedDateEntries.length}건)
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCalendarDate(null)}
                                                className="ml-2 text-[10px] text-[#9a9585] hover:text-[#5d6c4a] underline"
                                            >
                                                선택 해제
                                            </button>
                                        </span>
                                    )}
                                </div>
                                {!selectedCalendarDate ? (
                                    <p className="text-xs text-[#9a9585] py-3 text-center">
                                        날짜를 선택하면 해당일 연차 신청자를 확인할 수 있습니다.
                                    </p>
                                ) : selectedDateEntries.length === 0 ? (
                                    <p className="text-xs text-[#9a9585] py-3 text-center">
                                        해당 날짜의 연차 신청 내역이 없습니다.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto border border-[#d4cfbf] bg-[#faf8f0]">
                                        <table className="w-full text-xs">
                                            <thead className="bg-[#f5f3e8] border-b border-[#d4cfbf] text-[#5d6c4a] uppercase tracking-wider font-bold">
                                                <tr>
                                                    <th className="p-2 pl-3 text-left">직원</th>
                                                    <th className="p-2 text-center">소속</th>
                                                    <th className="p-2 text-center">유형</th>
                                                    <th className="p-2 text-center">일수</th>
                                                    <th className="p-2 text-left">기간</th>
                                                    <th className="p-2 pr-3 text-center">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#ebe8db]">
                                                {selectedDateEntries.map(e => (
                                                    <tr key={e.id} className="hover:bg-[#f5f3e8]">
                                                        <td className="p-2 pl-3 font-bold text-[#3d472f]">{e.name}</td>
                                                        <td className="p-2 text-center">
                                                            <span className="text-[10px] font-bold bg-[#f5f3e8] border border-[#d4cfbf] px-1.5 py-0.5">{e.team}</span>
                                                        </td>
                                                        <td className="p-2 text-center text-[#5a5545]">{e.typeLabel}</td>
                                                        <td className="p-2 text-center font-bold text-[#5a5545]">{fmtDays(e.dayCount)}</td>
                                                        <td className="p-2 font-mono text-[11px] text-[#5a5545]">{e.rangeLabel}</td>
                                                        <td className="p-2 pr-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold border ${e.isPending ? 'bg-[#fdf6e3] text-[#a06820] border-[#d8c490]' : e.isApproved ? 'bg-[#e8ebd8] text-[#5d6c4a] border-[#b8c4a0]' : 'bg-[#f5f3e8] text-[#7a7565] border-[#d4cfbf]'}`}>
                                                                {e.statusLabel}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-3 border-t border-[#d4cfbf] flex justify-end bg-[#faf8f0]">
                            <button onClick={closeMonthlyModal} className="px-4 py-2 text-xs bg-[#f5f3e8] text-[#5a5545] font-bold hover:bg-[#e0ddd0] border border-[#d4cfbf]">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
