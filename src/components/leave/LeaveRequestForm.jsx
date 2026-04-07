import { useState, useMemo } from 'react';
import { CalendarPlus, AlertCircle, Check, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { KR_HOLIDAYS } from '../../data/holidays';

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

// 연속된 날짜를 구간으로 그룹화 [[start, end], ...]
// 캘린더 기준 연속(dayDiff=1) — 금요일+월요일은 dayDiff=3이므로 별도 구간으로 처리됨
function groupConsecutive(dates) {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((parseLocal(sorted[i]) - parseLocal(prev)) / 86400000);
    if (diff === 1) {
      prev = sorted[i];
    } else {
      groups.push([start, prev]);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  groups.push([start, prev]);
  return groups; // [[startStr, endStr], ...]
}

// ─── 캘린더 컴포넌트 ────────────────────────────────────────────────────────
function LeaveCalendar({ type, singleDate, selectedDates, onDayClick, viewYear, viewMonthIdx }) {
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
          const isSelected = isSingleSel || isWorkdaySel;

          let cls = 'h-7 w-full flex items-center justify-center text-xs rounded relative transition-colors ';

          if (isSelected) {
            cls += 'bg-[#5d6c4a] text-[#f5f3e8] font-black ';
          } else if (isDisabled) {
            cls += 'cursor-not-allowed font-medium ';
            if (dow === 0 || (isHol && dow !== 6)) {
              cls += 'text-[#c47a7a] '; // 일요일 또는 평일 공휴일: 붉은 계열
            } else if (dow === 6) {
              cls += 'text-[#8899b0] '; // 토요일: 청회색 계열
            } else {
              cls += 'text-[#c8c3b8] '; // 과거 평일: 연한 회색
            }
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
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c47a7a]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 폼 ────────────────────────────────────────────────────────────────
export default function LeaveRequestForm({ onSubmitted, userProfile, balance, pendingDeduction = 0 }) {
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

  // FULL: 개별 날짜 누적 선택
  const [selectedDates, setSelectedDates] = useState([]); // 선택된 날짜 배열 (정렬됨)

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
    setResult(null);
  };

  const handleDayClick = (dateStr) => {
    setResult(null);

    if (type !== 'FULL') {
      // HALF: 해제는 항상 허용, 신규 선택 시 잔여 검증
      if (singleDate === dateStr) { setSingleDate(''); return; }
      if (remaining !== null && remaining < 0.5) {
        setResult({ success: false, message: '남은 연차를 초과하여 선택할 수 없습니다.' });
        return;
      }
      setSingleDate(dateStr);
      return;
    }

    // FULL: 해제는 항상 허용, 신규 추가 시 잔여 검증
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(prev => prev.filter(d => d !== dateStr));
      return;
    }
    if (remaining !== null && selectedDates.length >= remaining) {
      setResult({ success: false, message: '남은 연차를 초과하여 선택할 수 없습니다.' });
      return;
    }
    setSelectedDates(prev => [...prev, dateStr].sort());
  };

  // 선택 날짜들이 캘린더 기준 연속인지 확인 (dayDiff=1 연속)
  const selectedIsConsecutive = useMemo(() => {
    if (selectedDates.length < 2) return true;
    const workdays = getWorkdays(selectedDates[0], selectedDates[selectedDates.length - 1]);
    return workdays.length === selectedDates.length && workdays.every((d, i) => d === selectedDates[i]);
  }, [selectedDates]);

  // 선택 날짜를 연속 구간 묶음 포맷으로 변환 (표시 전용)
  const formattedDates = useMemo(() => {
    if (selectedDates.length === 0) return '';
    return groupConsecutive(selectedDates)
      .map(([s, e]) => {
        const sf = s.replace(/-/g, '.');
        const ef = e.replace(/-/g, '.');
        return sf === ef ? sf : `${sf} ~ ${ef}`;
      })
      .join(', ');
  }, [selectedDates]);

  // 선택 요약 텍스트
  const selectionSummary = useMemo(() => {
    if (type !== 'FULL') return singleDate;
    if (selectedDates.length === 0) return '';
    if (selectedDates.length === 1) return `${selectedDates[0].replace(/-/g, '.')} — 1일 연차가 설정되었습니다.`;
    if (selectedIsConsecutive) {
      return `${selectedDates[0].replace(/-/g, '.')} ~ ${selectedDates[selectedDates.length - 1].replace(/-/g, '.')} (평일 ${selectedDates.length}일)`;
    }
    return `${formattedDates} (${selectedDates.length}일)`;
  }, [type, singleDate, selectedDates, selectedIsConsecutive, formattedDates]);

  // 잔여 연차 — balance 미로드 시 null (차단 비활성)
  const remaining = useMemo(() => {
    if (!balance) return null;
    return Math.max(0, (balance.total_days ?? 0) - (balance.used_days ?? 0) - pendingDeduction);
  }, [balance, pendingDeduction]);

  // 현재 선택 기준 산정 일수 (FULL: 선택 개수, HALF: 0.5)
  const selectionCost = useMemo(() => {
    if (type === 'FULL') return selectedDates.length;
    return singleDate ? 0.5 : 0;
  }, [type, selectedDates.length, singleDate]);

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

    // 저장 직전 잔여 연차 재검증
    if (remaining !== null && selectionCost > remaining) {
      setResult({ success: false, message: '남은 연차보다 많은 일수를 신청할 수 없습니다.' });
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#3d472f] flex items-center gap-2">
          <CalendarPlus size={18} className="text-[#5d6c4a]" /> 연차 신청
        </h3>
        {remaining !== null && (
          <div className="text-xs flex items-center gap-1.5">
            <span className="text-[#7a7565]">남은 연차 <strong className="text-[#3d472f]">{remaining}일</strong></span>
            <span className="text-[#c8c3b8]">/</span>
            <span className="text-[#7a7565]">산정 일수 <strong className={selectionCost > remaining ? 'text-[#a65d57]' : selectionCost > 0 ? 'text-[#d8973c]' : 'text-[#9a9585]'}>{selectionCost}일</strong></span>
          </div>
        )}
      </div>

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
            <p className="text-[10px] text-[#7a7565] mt-1">날짜를 클릭해 개별 선택하세요. 다시 클릭하면 해제됩니다. 주말/공휴일은 선택 불가합니다.</p>
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
              onDayClick={handleDayClick}
              viewYear={viewYear}
              viewMonthIdx={viewMonth}
            />
          </div>

          {/* 선택 요약 */}
          {selectionSummary && (
            <div className="mt-1 px-2 py-1.5 text-xs font-bold border bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]">
              {selectionSummary}
            </div>
          )}

          {/* FULL 선택일 chips — 연속 구간 묶음으로 표시, × 클릭 시 해당 구간 전체 해제 */}
          {type === 'FULL' && selectedDates.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {groupConsecutive(selectedDates).map(([start, end]) => {
                const label = start === end
                  ? start.replace(/-/g, '.')
                  : `${start.replace(/-/g, '.')} ~ ${end.replace(/-/g, '.')}`;
                return (
                  <span key={start} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-[#5d6c4a] text-[#f5f3e8] border border-[#3d472f]">
                    {label}
                    <button
                      type="button"
                      onClick={() => setSelectedDates(prev => prev.filter(d => d < start || d > end))}
                      className="hover:text-[#d4dcc0] leading-none ml-0.5"
                      aria-label={`${label} 선택 해제`}
                    >×</button>
                  </span>
                );
              })}
            </div>
          )}

          {/* 범례 */}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#7a7565]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-[#5d6c4a] inline-block" />선택
            </span>
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
