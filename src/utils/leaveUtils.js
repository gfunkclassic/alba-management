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
