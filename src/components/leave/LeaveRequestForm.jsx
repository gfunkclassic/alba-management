import { useState, useMemo } from 'react';
import { CalendarPlus, AlertCircle, Check, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ─── 한국 공휴일 (평일 공휴일 + 평일 대체공휴일) 2026~2027 ─────────────────
// ※ 주말(토/일)은 isWeekend()로 별도 차단됨 — 이 목록은 평일 기준만 포함
// ※ ★추정 표시: 음력 기반 공휴일(설날·부처님오신날·추석)은 매년 관보 확인 필요
const KR_HOLIDAYS = new Set([
  // 2026 ─────────────────────────────
  '2026-01-01', // 신정 (목)
  '2026-02-16', // 설날 전날 (월) ★추정
  '2026-02-17', // 설날 (화) ★추정
  '2026-02-18', // 설날 다음날 (수) ★추정
  '2026-03-02', // 삼일절 대체공휴일 (월) — 3/1이 일요일
  '2026-05-05', // 어린이날 (화)
  '2026-05-25', // 부처님오신날 대체공휴일 (월) ★추정 — 5/24가 일요일
  '2026-06-08', // 현충일 대체공휴일 (월) — 6/6이 토요일
  '2026-08-17', // 광복절 대체공휴일 (월) — 8/15가 토요일
  '2026-09-24', // 추석 전날 (목) ★추정
  '2026-09-25', // 추석 (금) ★추정
  '2026-09-28', // 추석 대체공휴일 (월) ★추정 — 9/26이 토요일
  '2026-10-05', // 개천절 대체공휴일 (월) — 10/3이 토요일
  '2026-10-09', // 한글날 (금)
  '2026-12-25', // 성탄절 (금)
  // 2027 ─────────────────────────────
  '2027-01-01', // 신정 (금)
  '2027-02-08', // 설날 다음날 (월) ★추정 — 설날=2/7(일) 추정
  '2027-02-09', // 설날 대체공휴일 (화) ★추정 — 전날+당일 모두 주말
  '2027-03-01', // 삼일절 (월)
  '2027-05-05', // 어린이날 (수)
  '2027-05-13', // 부처님오신날 ★추정
  '2027-06-07', // 현충일 대체공휴일 (월) ★추정 — 6/6이 일요일
  '2027-08-16', // 광복절 대체공휴일 (월) ★추정 — 8/15가 일요일
  '2027-09-14', // 추석 전날 ★추정
  '2027-09-15', // 추석 ★추정
  '2027-09-16', // 추석 다음날 ★추정
  '2027-10-04', // 개천절 대체공휴일 (월) ★추정 — 10/3이 일요일
  '2027-10-11', // 한글날 대체공휴일 (월) ★추정 — 10/9가 토요일
  '2027-12-27', // 성탄절 대체공휴일 (월) ★추정 — 12/25가 토요일
]);

const LEAVE_TYPES = [
  { value: 'FULL',    label: '연차 (1일)',       days: 1.0 },
  { value: 'HALF_AM', label: '오전 반차 (0.5일)', days: 0.5 },
  { value: 'HALF_PM', label: '오후 반차 (0.5일)', days: 0.5 },
];

// ─── 날짜 유틸 ─────────────────────────────────────────────────────────────
function toStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isWeekend(s) {
  return [0, 6].includes(parseLocal(s).getDay()); // 0=일, 6=토
}

function isHoliday(s) {
  return KR_HOLIDAYS.has(s);
}

function isBlocked(s) {
  return isWeekend(s) || isHoliday(s);
}

// startStr ~ endStr 사이 평일(연차 가능일) 배열 반환
function getWorkdays(startStr, endStr) {
  const result = [];
  const cur = parseLocal(startStr);
  const end = parseLocal(endStr);
  while (cur <= end) {
    const s = toStr(cur);
    if (!isBlocked(s)) result.push(s);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ─── 캘린더 컴포넌트 ────────────────────────────────────────────────────────
function LeaveCalendar({ type, singleDate, selectedDates, rangeStart, onDayClick, viewYear, viewMonthIdx }) {
  const today = toStr(new Date());

  const firstOfMonth = new Date(viewYear, viewMonthIdx, 1);
  const lastOfMonth  = new Date(viewYear, viewMonthIdx + 1, 0);
  const startPad = firstOfMonth.getDay(); // 0=일
  const totalDays = lastOfMonth.getDate();

  const cells = [];
  const rows = Math.ceil((startPad + totalDays) / 7);
  for (let i = 0; i < rows * 7; i++) {
    const num = i - startPad + 1;
    cells.push(num >= 1 && num <= totalDays ? toStr(new Date(viewYear, viewMonthIdx, num)) : null);
  }

  // 확정된 범위 첫날 / 끝날 (rangeStart=null일 때만 의미 있음)
  const rangeFirst = rangeStart === null && selectedDates.length > 0 ? selectedDates[0] : null;
  const rangeLast  = rangeStart === null && selectedDates.length > 1 ? selectedDates[selectedDates.length - 1] : null;

  return (
    <div className="select-none">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center pb-1 border-b border-[#e8e4d4]">
        {['일','월','화','수','목','금','토'].map((h, i) => (
          <span key={h} className={`text-[10px] font-bold py-1 ${i === 0 ? 'text-[#a65d57]' : i === 6 ? 'text-[#4a6070]' : 'text-[#7a7565]'}`}>
            {h}
          </span>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-0.5 mt-1">
        {cells.map((dateStr, idx) => {
          if (!dateStr) return <div key={idx} className="h-7" />;

          const dow      = idx % 7; // 0=일, 6=토
          const blocked  = isBlocked(dateStr);
          const isPast   = dateStr < today;
          const isDisabled = blocked || isPast;
          const isToday  = dateStr === today;
          const isHol    = isHoliday(dateStr);

          const isSingleSel  = type !== 'FULL' && singleDate === dateStr;
          const isWorkdaySel = type === 'FULL' && selectedDates.includes(dateStr);
          const isStartMark  = type === 'FULL' && rangeStart === dateStr; // 첫 클릭 대기 중
          const isBetween    = rangeFirst && rangeLast && dateStr > rangeFirst && dateStr < rangeLast;

          const isSelected = isSingleSel || isWorkdaySel || isStartMark;

          let cls = 'h-7 w-full flex items-center justify-center text-xs rounded relative transition-colors ';

          if (isSelected) {
            cls += 'bg-[#5d6c4a] text-[#f5f3e8] font-black ';
          } else if (isBetween) {
            cls += isDisabled
              ? 'bg-[#e8ead8] text-[#c5c0b0] '
              : 'bg-[#c8d4a8] text-[#3d472f] font-bold cursor-pointer ';
          } else if (isDisabled) {
            cls += 'cursor-not-allowed font-medium ';
            cls += isHol && !isWeekend(dateStr) ? 'text-[#c9a0a0] ' : 'text-[#c8c3b8] ';
          } else {
            cls += 'cursor-pointer font-bold ';
            if (dow === 0)      cls += 'text-[#a65d57] hover:bg-[#f8e8e4] ';
            else if (dow === 6) cls += 'text-[#4a6070] hover:bg-[#e4eaf0] ';
            else                cls += 'text-[#3d472f] hover:bg-[#e8e4d4] ';
          }

          if (isToday && !isSelected) cls += 'ring-1 ring-inset ring-[#5d6c4a] ';

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onDayClick(dateStr)}
              className={cls}
              title={isHol ? '공휴일' : isWeekend(dateStr) ? '주말' : ''}
            >
              {parseInt(dateStr.slice(8))}
              {isHol && !isWeekend(dateStr) && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c9a0a0]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 폼 ────────────────────────────────────────────────────────────────
export default function LeaveRequestForm({ onSubmitted, userProfile }) {
  const { submitLeaveRequest, getAllUsers, sendNotification } = useAuth();
  const now = new Date();

  const [type, setType] = useState('FULL');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 캘린더 뷰 월
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // HALF: 단일 날짜
  const [singleDate, setSingleDate] = useState('');

  // FULL: 범위 선택
  const [anchorDate,    setAnchorDate]    = useState(null); // 첫 클릭 기준일 (확장 가능 상태)
  const [selectedDates, setSelectedDates] = useState([]);   // 확정된 평일 배열

  const handleMonthChange = (dir) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setSingleDate('');
    setSelectedDates([]);
    setAnchorDate(null);
    setResult(null);
  };

  const handleDayClick = (dateStr) => {
    setResult(null);

    if (type !== 'FULL') {
      // HALF: 단일 토글
      setSingleDate(prev => prev === dateStr ? '' : dateStr);
      return;
    }

    // FULL: 첫 클릭 → 1일 즉시 확정 / 두 번째 클릭 → 범위 확장
    if (anchorDate === null) {
      // 빈 상태 또는 범위 확정 후 재시작: 1일 즉시 선택 (제출 가능)
      setAnchorDate(dateStr);
      setSelectedDates([dateStr]);
    } else if (dateStr === anchorDate) {
      // 같은 날 재클릭 → 선택 해제
      setAnchorDate(null);
      setSelectedDates([]);
    } else if (dateStr > anchorDate) {
      // 이후 날짜 클릭 → 범위 확장 확정
      setSelectedDates(getWorkdays(anchorDate, dateStr));
      setAnchorDate(null);
    } else {
      // 이전 날짜 클릭 → 새 기준일로 재설정
      setAnchorDate(dateStr);
      setSelectedDates([dateStr]);
    }
  };

  // 선택 요약 텍스트
  const selectionSummary = useMemo(() => {
    if (type !== 'FULL') {
      return singleDate;
    }
    if (selectedDates.length === 0) return '';
    if (anchorDate !== null) {
      // 1일 선택 완료, 범위 확장 가능 상태
      return `${anchorDate} — 1일 연차가 설정되었습니다. 연속 신청하려면 마지막 날짜를 선택하세요.`;
    }
    if (selectedDates.length === 1) return `${selectedDates[0]} (1일)`;
    return `${selectedDates[0]} ~ ${selectedDates[selectedDates.length - 1]} (평일 ${selectedDates.length}일)`;
  }, [type, singleDate, anchorDate, selectedDates]);

  const isExtendable = anchorDate !== null; // 1일 선택 완료, 범위 확장 가능 상태 (제출 가능)

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 유효성 검사
    const datesToSubmit = type === 'FULL' ? selectedDates : (singleDate ? [singleDate] : []);

    if (datesToSubmit.length === 0) {
      setResult({ success: false, message: '날짜를 선택해주세요.' });
      return;
    }
    if (!reason.trim()) {
      setResult({ success: false, message: '사유를 입력해주세요.' });
      return;
    }

    // 저장 직전 주말/공휴일 재검증
    const invalidDate = datesToSubmit.find(d => isBlocked(d));
    if (invalidDate) {
      setResult({ success: false, message: `주말/공휴일이 포함되어 있습니다: ${invalidDate}` });
      return;
    }

    setResult(null);
    setLoading(true);
    try {
      // 단일 문서 + applied_dates 배열 저장
      await submitLeaveRequest({ dates: datesToSubmit, type, reason });

      const label = LEAVE_TYPES.find(t => t.value === type)?.label || type;
      const datesLabel =
        datesToSubmit.length === 1
          ? datesToSubmit[0]
          : `${datesToSubmit[0]} ~ ${datesToSubmit[datesToSubmit.length - 1]} (${datesToSubmit.length}일)`;
      setResult({ success: true, message: `${datesLabel} ${label} 신청이 완료되었습니다.` });

      // 팀 관리자 알림
      try {
        const allUsers = await getAllUsers();
        const promises = [];
        if (userProfile?.team_id) {
          allUsers
            .filter(u => u.team_id === userProfile.team_id && u.roleGroup === 'manager')
            .forEach(ap => {
              promises.push(sendNotification(ap.uid, 'LEAVE_SUBMITTED', {
                user_name: userProfile.name,
                date: datesToSubmit[0],
                type,
              }));
            });
        }
        await Promise.all(promises);
      } catch (ne) {
        console.warn('알림 발송 실패:', ne);
      }

      // 선택 초기화
      setSingleDate('');
      setSelectedDates([]);
      setAnchorDate(null);
      setReason('');
      onSubmitted?.(type, datesToSubmit.length);
    } catch (err) {
      const isDuplicate = err.message?.startsWith('DUPLICATE');
      setResult({
        success: false,
        message: isDuplicate
          ? '해당 날짜에 이미 신청한 연차가 있습니다. 취소 후 재신청 가능합니다.'
          : '신청 중 오류가 발생했습니다: ' + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-5">
      <h3 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2">
        <CalendarPlus size={18} className="text-[#5d6c4a]" /> 연차 신청
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 연차 유형 */}
        <div>
          <label className="text-[10px] font-bold text-[#7a7565] block mb-1">연차 유형 *</label>
          <div className="grid grid-cols-1 gap-1.5">
            {LEAVE_TYPES.map(lt => (
              <button
                key={lt.value}
                type="button"
                onClick={() => handleTypeChange(lt.value)}
                className={`px-3 py-2.5 text-sm font-bold text-left border-2 flex justify-between items-center transition-colors
                  ${type === lt.value
                    ? 'bg-[#5d6c4a] text-[#f5f3e8] border-[#3d472f]'
                    : 'bg-[#f5f3e8] text-[#5a5545] border-[#c5c0b0] hover:border-[#5d6c4a]'}`}
              >
                <span>{lt.label}</span>
                {type === lt.value && <Check size={14} />}
              </button>
            ))}
          </div>
          {type === 'FULL' && (
            <p className="text-[10px] text-[#7a7565] mt-1">날짜를 클릭하면 1일 연차로 설정됩니다. 연속 신청 시 마지막 날짜를 추가로 클릭하세요. 주말/공휴일은 자동 제외됩니다.</p>
          )}
          {type !== 'FULL' && (
            <p className="text-[10px] text-[#7a7565] mt-1">반차는 단일 날짜 선택만 가능합니다.</p>
          )}
        </div>

        {/* 캘린더 */}
        <div>
          <label className="text-[10px] font-bold text-[#7a7565] block mb-1">날짜 선택 *</label>

          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#e8e4d4] border-2 border-b-0 border-[#c5c0b0]">
            <button type="button" onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-[#d4d0c0] rounded transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-[#3d472f]">{viewYear}년 {viewMonth + 1}월</span>
            <button type="button" onClick={() => handleMonthChange(1)} className="p-1 hover:bg-[#d4d0c0] rounded transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="border-2 border-[#c5c0b0] bg-[#faf8f0] p-2">
            <LeaveCalendar
              type={type}
              singleDate={singleDate}
              selectedDates={selectedDates}
              rangeStart={null}
              onDayClick={handleDayClick}
              viewYear={viewYear}
              viewMonthIdx={viewMonth}
            />
          </div>

          {/* 선택 요약 */}
          {selectionSummary && (
            <div className={`mt-1 px-2 py-1.5 text-xs font-bold border ${
              isExtendable
                ? 'bg-[#fdf6e3] border-[#d8973c] text-[#a06820]'
                : 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]'
            }`}>
              {selectionSummary}
            </div>
          )}

          {/* 범례 */}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#7a7565]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-[#5d6c4a] inline-block" />선택
            </span>
            {type === 'FULL' && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-[#c8d4a8] inline-block" />범위(평일)
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-[#f0f0ee] border border-[#c8c3b8] inline-block" />주말
            </span>
            <span className="flex items-center gap-1">
              <span className="relative w-3 h-3 rounded bg-[#f0f0ee] border border-[#c8c3b8] inline-block">
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c9a0a0]" />
              </span>공휴일
            </span>
          </div>
        </div>

        {/* 사유 */}
        <div>
          <label className="text-[10px] font-bold text-[#7a7565] block mb-1">사유 *</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="사유를 입력해주세요 (필수)"
            className="w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none"
          />
        </div>

        {result && (
          <div className={`flex items-start gap-2 p-3 border ${
            result.success
              ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]'
              : 'bg-[#f8f0ef] border-[#dcc0bc] text-[#a65d57]'
          }`}>
            {result.success
              ? <Check size={14} className="mt-0.5 shrink-0" />
              : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <p className="text-xs font-bold">{result.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading
            ? <Loader size={16} className="animate-spin" />
            : <><CalendarPlus size={16} /> 신청하기</>}
        </button>
      </form>
    </div>
  );
}
