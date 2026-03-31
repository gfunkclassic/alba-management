// src/utils/leaveUtils.js
import { getMonthsBetween } from './dateUtils';

export const getLegalAnnualLeave = (yearsWorked) => {
    if (yearsWorked < 1) return 0;
    const baseLeave = 15;
    const additionalLeave = Math.floor((yearsWorked - 1) / 2);
    return Math.min(baseLeave + additionalLeave, 25);
};

export const getFirstYearLeave = (startDate, endDate, absences = {}) => {
    const months = getMonthsBetween(startDate, endDate);
    let earnedDays = 0;
    for (let i = 0; i < Math.min(months, 11); i++) {
        const monthStart = new Date(startDate);
        monthStart.setMonth(monthStart.getMonth() + i);
        const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        const monthAbsences = Object.keys(absences).filter(date => date.startsWith(monthKey)).length;
        if (monthAbsences === 0) earnedDays++;
    }
    return Math.min(earnedDays, 11);
};

export const getFirstYearCarryoverDeadline = (startDate) => {
    const start = new Date(startDate);
    return new Date(start.getFullYear() + 1, 11, 31);
};

/**
 * applied_dates 배열을 연속 구간 기준으로 그룹화해 표시용 문자열을 반환합니다.
 *
 * 규칙:
 *   - applied_dates 없음 → fallbackDate(구 date 필드) 단일 날짜 반환
 *   - 1개 → "YYYY.MM.DD"
 *   - 연속 배열 → "YYYY.MM.DD ~ YYYY.MM.DD"
 *   - 비연속 혼합 → "YYYY.MM.DD ~ YYYY.MM.DD, YYYY.MM.DD, ..."
 *
 * 예:
 *   ['2026-04-01','2026-04-02','2026-04-03','2026-04-08']
 *   → "2026.04.01 ~ 2026.04.03, 2026.04.08"
 */
export function formatAppliedDates(appliedDates, fallbackDate) {
    if (!appliedDates || appliedDates.length === 0) {
        return fallbackDate ? fallbackDate.replace(/-/g, '.') : '-';
    }

    const sorted = [...appliedDates].sort();

    // 인접 날짜 간 달력 일수 차이 계산 (타임존 안전)
    const dayDiff = (a, b) => {
        const [ay, am, ad] = a.split('-').map(Number);
        const [by, bm, bd] = b.split('-').map(Number);
        return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
    };

    // 연속 구간 그룹화
    const groups = [];
    let start = sorted[0];
    let prev  = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (dayDiff(prev, sorted[i]) === 1) {
            prev = sorted[i];
        } else {
            groups.push([start, prev]);
            start = sorted[i];
            prev  = sorted[i];
        }
    }
    groups.push([start, prev]);

    return groups
        .map(([s, e]) => {
            const sf = s.replace(/-/g, '.');
            const ef = e.replace(/-/g, '.');
            return sf === ef ? sf : `${sf} ~ ${ef}`;
        })
        .join(', ');
}
