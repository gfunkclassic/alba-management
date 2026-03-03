import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layers, ChevronDown, Download, RotateCcw, X, UserMinus, Calendar, AlertTriangle, Check, Users, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

// Auth
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ChangePasswordPage from './components/auth/ChangePasswordPage';
import AlbaView from './components/views/AlbaView';
import TeamApproverView from './components/views/TeamApproverView';
import FinalApproverView from './components/views/FinalApproverView';

// Data
import { INITIAL_USERS } from './data/initialUsers';

// Firestore Hooks
import { useEmployees } from './hooks/useEmployees';
import { useAttendance } from './hooks/useAttendance';
import { useLeaveData } from './hooks/useLeaveData';

// Utils
import { normalizeDateStr, getMonthsBetween, getDaysBetween } from './utils/dateUtils';
import { getLegalAnnualLeave, getFirstYearLeave, getFirstYearCarryoverDeadline } from './utils/leaveUtils';
import { escapeCsvField, readFileData } from './utils/csvUtils';

// Sub Views
import HRView from './components/HRView';
import PayrollView from './components/PayrollView';
import LeaveView from './components/LeaveView';
import FinalApprovalInbox from './components/leave/FinalApprovalInbox';
import NotificationBell from './components/notifications/NotificationBell';

// Components & Modals
import CalculatorWidget from './components/CalculatorWidget';
import CalendarModal from './components/modals/CalendarModal';
import LeaveCalendarModal from './components/modals/LeaveCalendarModal';
import UserFormModal from './components/modals/UserFormModal';
import AdjustLeaveModal from './components/modals/AdjustLeaveModal';
import PayrollDetailModal from './components/modals/PayrollDetailModal';

// ── 인사급여 시스템 (Firestore 연동) ───────────────────────────
function HRPayrollApp() {
    const { userProfile } = useAuth();

    // ── Firestore 실시간 훅 ──
    const { employees: users, loading: empLoading, addEmployee, updateEmployee, deleteEmployee, batchImport: batchImportEmployees } = useEmployees();
    const { attendance, saveAttendance: saveAttendanceFn, batchImport: batchImportAttendance } = useAttendance();
    const { leaveRecords, adjustments, carryovers, payrollStatus,
        addLeaveRecord, deleteLeaveRecord, saveAdjustment: saveAdjustmentFn,
        savePayrollStatus, batchImport: batchImportLeave } = useLeaveData();

    // ── 최초 1회 마이그레이션: Firestore가 비어있으면 localStorage → Firestore ──
    const migratedRef = useRef(false);
    useEffect(() => {
        if (empLoading || migratedRef.current) return;
        if (users.length === 0) {
            migratedRef.current = true;
            (async () => {
                try {
                    // 직원 데이터
                    let toMigrate = [];
                    try {
                        const savedUsers = localStorage.getItem('alba_users');
                        if (savedUsers) {
                            const parsed = JSON.parse(savedUsers);
                            if (Array.isArray(parsed) && parsed.length > 0) toMigrate = parsed;
                        }
                    } catch { }
                    if (toMigrate.length === 0) toMigrate = JSON.parse(JSON.stringify(INITIAL_USERS));
                    await batchImportEmployees(toMigrate);

                    // 근태 데이터
                    try {
                        const savedAtt = localStorage.getItem('alba_attendance');
                        if (savedAtt) await batchImportAttendance(JSON.parse(savedAtt));
                    } catch { }

                    // 연차/급여 데이터
                    try {
                        await batchImportLeave({
                            leaveRecords: JSON.parse(localStorage.getItem('leave_records') || '{}'),
                            adjustments: JSON.parse(localStorage.getItem('leave_adjustments') || '{}'),
                            carryovers: JSON.parse(localStorage.getItem('leave_carryovers') || '{}'),
                            payrollStatus: JSON.parse(localStorage.getItem('alba_payroll_status') || '{}'),
                        });
                    } catch { }

                    console.log('✅ Firestore 마이그레이션 완료');
                } catch (e) { console.error('마이그레이션 오류:', e); }
            })();
        }
    }, [empLoading, users.length]);

    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('app_active_tab') || 'HR';
    });

    useEffect(() => {
        localStorage.setItem('app_active_tab', activeTab);
    }, [activeTab]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTeam, setFilterTeam] = useState('전체');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [viewMode, setViewMode] = useState('ACTIVE');
    const [selectedUser, setSelectedUser] = useState(null);
    const [payrollMonth, setPayrollMonth] = useState(() => {
        const saved = localStorage.getItem('alba_payrollMonth');
        if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // payrollMonth 변경 시 localStorage에 저장
    useEffect(() => {
        localStorage.setItem('alba_payrollMonth', payrollMonth);
    }, [payrollMonth]);

    // 역할 모드: 'ADMIN' | 'STAFF' | 'VIEWER'
    const [roleMode, setRoleMode] = useState(() => {
        return localStorage.getItem('alba_role_mode') || 'ADMIN';
    });
    useEffect(() => { localStorage.setItem('alba_role_mode', roleMode); }, [roleMode]);
    const maskPII = roleMode === 'VIEWER';

    const movePayrollMonth = useCallback((offset) => {
        setPayrollMonth(prev => {
            const [y, m] = prev.split('-').map(Number);
            const d = new Date(y, m - 1 + offset, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });
    }, []);

    const handleSelectUser = useCallback((user) => {
        setSelectedUser(prev => prev?.id === user?.id ? prev : user);
    }, []);

    const [modalState, setModalState] = useState({
        calculator: false, calendar: false, leaveCalendar: false,
        resign: false, userForm: false, adjust: false,
        dataMenu: false, resetConfirm: false, payrollDetail: false
    });
    const [payrollDetailUser, setPayrollDetailUser] = useState(null);

    const openModal = useCallback((modalName) => setModalState(prev => ({ ...prev, [modalName]: true })), []);
    const closeModal = useCallback((modalName) => setModalState(prev => ({ ...prev, [modalName]: false })), []);
    const toggleModal = useCallback((modalName) => setModalState(prev => ({ ...prev, [modalName]: !prev[modalName] })), []);

    const showCalculator = modalState.calculator;
    const showCalendar = modalState.calendar;
    const showLeaveCalendar = modalState.leaveCalendar;
    const showResignModal = modalState.resign;
    const showUserForm = modalState.userForm;
    const showAdjustModal = modalState.adjust;
    const showDataMenu = modalState.dataMenu;
    const showResetConfirm = modalState.resetConfirm;

    const [formUser, setFormUser] = useState(null);
    const [adjustUser, setAdjustUser] = useState(null);
    const [resignTargetUser, setResignTargetUser] = useState(null);
    const [resignDateInput, setResignDateInput] = useState('');
    const [resignReasonInput, setResignReasonInput] = useState('');
    const [notification, setNotification] = useState(null);
    const rosterFileInputRef = useRef(null);
    const attendanceFileInputRef = useRef(null);
    const dataMenuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dataMenuRef.current && !dataMenuRef.current.contains(event.target)) closeModal('dataMenu');
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [closeModal]);

    const showNotificationMsg = useCallback((msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);

    const calculateDailyWage = (wage, start, end, overtimeHours = 0) => {
        if (!start || !end) return { basePay: 0, overtimePay: 0, hours: 0, regularHours: 0, actualOvertime: 0 };
        const normalizeTime = (t) => {
            if (!t) return "00:00";
            let cleanT = t.replace(/\s/g, '');
            if (cleanT.includes('시')) cleanT = `${parseInt(cleanT).toString().padStart(2, '0')}:00`;
            const parts = cleanT.split(':');
            if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            return cleanT;
        };
        const startTime = new Date(`2000-01-01T${normalizeTime(start)}`);
        let endTime = new Date(`2000-01-01T${normalizeTime(end)}`);

        if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);

        let diffMs = endTime - startTime;
        let workMinutes = diffMs / (1000 * 60);

        const breakStart = new Date(`2000-01-01T13:00:00`);
        const breakEnd = new Date(`2000-01-01T14:00:00`);
        if (startTime <= breakStart && endTime >= breakEnd) {
            workMinutes -= 60;
        }

        const totalHours = Math.max(0, workMinutes / 60);
        const numericWage = Number(wage) || 0;
        const actualOvertime = Math.min(overtimeHours, totalHours);
        const regularHours = totalHours - actualOvertime;
        return { basePay: regularHours * numericWage, overtimePay: actualOvertime * numericWage * 1.5, hours: totalHours, regularHours, actualOvertime };
    };

    const calculateMonthlyWage = (user, targetMonth) => {
        let actualBaseOvertimePay = 0;
        let actualHolidayPay = 0;
        let totalActualHours = 0;
        let totalActualOvertime = 0;
        const weeklyLogsList = [];
        let actualBasePayOnly = 0;
        const userAttendance = attendance[user.id] || {};

        const getWageForDate = (dateStr) => {
            if (user.wageIncreaseDate && user.previousWage && user.previousWage > 0) {
                if (dateStr < user.wageIncreaseDate) return user.previousWage;
            }
            return user.wage;
        };

        if (!targetMonth) {
            return { estimated: 0, actual: 0, displayTotal: 0, deduction: 0, finalPayout: 0, totalActualHours: 0, totalActualOvertime: 0, strictDeduction: 0, strictFinalPayout: 0, hasRecord: false, actualBasePayOnly: 0, actualHolidayPay: 0, weeklyLogsList: [], weeklyHolidayCount: 0 };
        }

        const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
        const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();
        const monthDates = [];
        for (let i = 1; i <= daysInMonth; i++) {
            monthDates.push(`${targetYear}-${String(targetMonthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
        }

        const dailyRecords = {}; // key: dateStr, value: { checkIn, checkOut, overtime, isRecorded, isTargetMonth }

        // 1) Build dates for the target month
        const processDateStr = (dateStr, isTargetMonthDay) => {
            const record = userAttendance[dateStr];
            if (record) {
                dailyRecords[dateStr] = { checkIn: record.checkIn, checkOut: record.checkOut, overtime: record.overtime, reason: record.reason || '', isRecorded: true, isTargetMonth: isTargetMonthDay };
            } else {
                const dayOfWeek = new Date(dateStr).getDay();
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    dailyRecords[dateStr] = { checkIn: user.checkIn, checkOut: user.checkOut, overtime: 0, reason: '', isRecorded: false, isTargetMonth: isTargetMonthDay };
                } else {
                    dailyRecords[dateStr] = { checkIn: null, checkOut: null, overtime: 0, reason: '', isRecorded: false, isTargetMonth: isTargetMonthDay };
                }
            }
        };

        monthDates.forEach(dateStr => processDateStr(dateStr, true));

        // 2) Also include days from the PREVIOUS month that fall in the same week as the 1st of the target month
        //    (e.g. if Jan 1 is Wednesday, we need to include Dec 29~31 Mon/Tue for week 1's hour total)
        const firstDayOfMonth = new Date(targetYear, targetMonthNum - 1, 1);
        const startDow = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ...
        const diffToMonday = startDow === 0 ? -6 : 1 - startDow;
        if (diffToMonday < 0) {
            // Some days from previous month are part of the first week
            for (let d = diffToMonday; d < 0; d++) {
                const prevDate = new Date(targetYear, targetMonthNum - 1, 1 + d);
                const py = prevDate.getFullYear(), pm = String(prevDate.getMonth() + 1).padStart(2, '0'), pd = String(prevDate.getDate()).padStart(2, '0');
                const prevDateStr = `${py}-${pm}-${pd}`;
                processDateStr(prevDateStr, false); // isTargetMonth = false → won't add to monthly pay
            }
        }

        const weeklyHours = {};
        const weeklyDays = {};
        const weeklyRecordedDays = {};
        const weeklyHasAbsent = {}; // 결근(reason='결근')이 있는 주는 주휴수당 미지급

        Object.entries(dailyRecords).sort().forEach(([dateStr, record]) => {
            const dailyWage = getWageForDate(dateStr);
            const daily = calculateDailyWage(dailyWage, record.checkIn, record.checkOut, record.overtime);

            // 이번 달 날짜만 기본급/총 근무시간 집계에 포함
            if (record.isTargetMonth) {
                actualBasePayOnly += daily.basePay;
                actualBaseOvertimePay += daily.basePay + daily.overtimePay;
                totalActualHours += daily.hours;
                totalActualOvertime += daily.actualOvertime;
            }

            // 주간 근로시간은 이전 달 날짜도 포함 (1주차 주휴수당 기준 판단)
            const [py, pm, pd] = dateStr.split('-').map(Number);
            const date = new Date(py, pm - 1, pd);
            const day = date.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(py, pm - 1, pd + diffToMonday);
            const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

            if (!weeklyHours[weekKey]) {
                weeklyHours[weekKey] = 0;
                weeklyDays[weekKey] = 0;
                weeklyRecordedDays[weekKey] = 0;
            }
            weeklyHours[weekKey] += daily.hours;
            weeklyDays[weekKey] += 1;
            if (record.isRecorded) {
                weeklyRecordedDays[weekKey] += 1;
                // 결근: reason에 '결근'이 명시된 경우에만 해당 주 주휴수당 박탈
                // (공휴일이나 기타 0h 기록은 주휴 박탈 대상이 아님)
                if (record.isRecorded && (record.reason || '').includes('결근')) {
                    weeklyHasAbsent[weekKey] = true;
                }
            }
        });

        let weekOrd = 1;
        const sortedWeekKeys = Object.keys(weeklyHours).sort();
        sortedWeekKeys.forEach(weekKey => {
            const workDays = weeklyDays[weekKey]; // Total days in the week (Mon-Sun)
            const recordedWorkDays = weeklyRecordedDays[weekKey]; // Days with explicit records
            let holidayPayForWeek = 0;
            let holidayHoursEared = 0;

            const [wy, wm, wd] = weekKey.split('-').map(Number);
            const sundayDate = new Date(wy, wm - 1, wd + 6);
            const sundayDateStr = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;

            // Determine if the week falls into the target month based on Thursday
            const thursdayDate = new Date(wy, wm - 1, wd + 3);
            const thursdayMonthStr = `${thursdayDate.getFullYear()}-${String(thursdayDate.getMonth() + 1).padStart(2, '0')}`;
            const isTargetMonth = thursdayMonthStr === targetMonth;

            // 주휴수당 조건:
            // 1) 주 15시간 이상 근무
            // 2) 결근일 없음 (결근이 있는 주는 주휴 미지급)
            // 3) 해당 주가 이번 달에 귀속
            // 단축근무(출근은 했지만 시간 짧음)는 실근무시간/5 기준으로 비례 지급
            if (weeklyHours[weekKey] >= 15 && !weeklyHasAbsent[weekKey]) {
                const holidayHours = Math.min(weeklyHours[weekKey] / 5, 8); // 항상 ÷5 (주 5일 기준)

                if (isTargetMonth) {
                    const holidayWage = getWageForDate(sundayDateStr);
                    holidayPayForWeek = holidayHours * holidayWage;
                    holidayHoursEared = holidayHours;
                    actualHolidayPay += holidayPayForWeek;
                }
            }

            if (isTargetMonth) {
                const startM = new Date(wy, wm - 1, wd); // Monday
                const fridayDate = new Date(wy, wm - 1, wd + 4); // Friday
                const startMon = String(startM.getMonth() + 1).padStart(2, '0');
                const startDay = String(startM.getDate()).padStart(2, '0');
                const endDay = String(fridayDate.getDate()).padStart(2, '0');

                const weekStr = `${weekOrd}주차 (${startMon}/${startDay}~${endDay})`;
                weeklyLogsList.push({
                    weekStr,
                    daysWorked: recordedWorkDays, // Display recorded days
                    totalHours: weeklyHours[weekKey],
                    holidayPay: holidayPayForWeek,
                    holidayHours: holidayHoursEared
                });
                weekOrd++;
            }
        });

        const actualTotalPay = actualBaseOvertimePay + actualHolidayPay;
        const { basePay } = calculateDailyWage(user.wage, user.checkIn, user.checkOut);
        const weeklyWorkHours = (user.workHours || 0) * 5;
        let weeklyHolidayPayEst = 0;
        if (weeklyWorkHours >= 15) weeklyHolidayPayEst = basePay;
        const monthlyBase = (basePay * 5) * 4.345;
        const monthlyHoliday = weeklyHolidayPayEst * 4.345;
        const estimatedTotalPay = Math.round(monthlyBase + monthlyHoliday);

        const strictDeduction = !user.insuranceStatus ? Math.floor((actualTotalPay * 0.033) / 10) * 10 : 0;
        const strictFinalPayout = actualTotalPay - strictDeduction;

        const hasMonthRecord = userAttendance && (targetMonth
            ? Object.keys(userAttendance).some(d => d.startsWith(targetMonth))
            : Object.keys(userAttendance).length > 0);
        const displayTotal = hasMonthRecord ? Math.round(actualTotalPay) : estimatedTotalPay;
        const deduction = !user.insuranceStatus ? Math.floor((displayTotal * 0.033) / 10) * 10 : 0;
        const finalPayout = displayTotal - deduction;

        // build dailyBreakdown for drilldown modal
        const dailyBreakdown = Object.entries(dailyRecords)
            .filter(([, rec]) => rec.isTargetMonth)
            .sort()
            .map(([dateStr, rec]) => {
                const dw = getWageForDate(dateStr);
                const d = calculateDailyWage(dw, rec.checkIn, rec.checkOut, rec.overtime);
                return {
                    date: dateStr,
                    checkIn: rec.checkIn || '',
                    checkOut: rec.checkOut || '',
                    overtime: rec.overtime || 0,
                    reason: rec.reason || '',
                    hours: Math.round(d.hours * 100) / 100,
                    overtimeHours: Math.round(d.actualOvertime * 100) / 100,
                    basePay: Math.round(d.basePay + d.overtimePay),
                    isRecorded: rec.isRecorded,
                    wage: dw
                };
            });

        return {
            estimated: estimatedTotalPay, actual: Math.round(actualTotalPay),
            displayTotal, deduction, finalPayout, totalActualHours,
            totalActualOvertime, strictDeduction, strictFinalPayout,
            hasRecord: !!hasMonthRecord,
            actualBasePayOnly: Math.round(actualBaseOvertimePay),
            actualHolidayPay: Math.round(actualHolidayPay),
            weeklyLogsList, dailyBreakdown
        };
    };

    const leaveCache = useRef(new Map());

    const calculateLeave = useCallback((user) => {
        const userRecords = leaveRecords[user.id] || {};
        const userAdjustment = adjustments[user.id] || 0;
        const userCarryover = carryovers[user.id] || 0;
        const cacheKey = `${user.id}-${user.startDate}-${user.resignDate || 'active'}-${JSON.stringify(userRecords)}-${userAdjustment}-${userCarryover}`;

        if (leaveCache.current.has(cacheKey)) return leaveCache.current.get(cacheKey);

        const today = new Date();
        const startDate = new Date(user.startDate);
        const endDate = user.resignDate ? new Date(user.resignDate) : today;
        const yearsWorked = getDaysBetween(startDate, endDate) / 365;
        const monthsWorked = getMonthsBetween(startDate, endDate);
        const absences = Object.entries(userRecords).filter(([_, type]) => type === '결근').reduce((acc, [date, type]) => ({ ...acc, [date]: type }), {});
        // 연차 유형별 일수 환산 (연차=1, 반차=0.5, 시간차=÷8, 결근=0 (별도 처리))
        const usedLeave = Object.entries(userRecords).reduce((sum, [_, type]) => {
            if (type === '연차') return sum + 1;
            if (type === '반차(오전)' || type === '반차(오후)') return sum + 0.5;
            if (type?.startsWith('시간차')) {
                const match = type.match(/(\d+\.?\d*)h/);
                return sum + (match ? parseFloat(match[1]) / 8 : 0);
            }
            return sum; // 결근은 usedLeave에 포함 안 함 (absences로 별도 관리)
        }, 0);
        let firstYearLeave = 0, firstYearCarryover = 0, annualLeave = 0, carryover = userCarryover;
        if (yearsWorked < 1) {
            firstYearLeave = getFirstYearLeave(user.startDate, endDate, absences);
        } else {
            annualLeave = Math.floor(getLegalAnnualLeave(yearsWorked));
            const carryoverDeadline = getFirstYearCarryoverDeadline(user.startDate);
            if (today <= carryoverDeadline) firstYearCarryover = userCarryover;
        }
        const totalEarned = annualLeave + firstYearLeave + firstYearCarryover + carryover;
        const remaining = totalEarned + userAdjustment - usedLeave;

        const result = {
            yearsWorked: Math.floor(yearsWorked * 10) / 10, monthsWorked,
            firstYearLeave, firstYearCarryover, annualLeave, carryover,
            usedLeave, adjustment: userAdjustment, totalEarned,
            remaining: Math.floor(remaining * 10) / 10, absenceCount: Object.keys(absences).length
        };

        if (leaveCache.current.size > 100) leaveCache.current.delete(leaveCache.current.keys().next().value);
        leaveCache.current.set(cacheKey, result);
        return result;
    }, [leaveRecords, adjustments, carryovers]);

    useEffect(() => { leaveCache.current.clear(); }, [leaveRecords, adjustments, carryovers]);

    const stats = useMemo(() => {
        const activeUsers = users.filter(u => !u.resignDate);
        const resignedUsers = users.filter(u => u.resignDate);
        const totalEstWage = activeUsers.reduce((acc, user) => acc + calculateMonthlyWage(user, payrollMonth).actual, 0);
        const insuranceNeeded = activeUsers.filter(u => !u.insuranceStatus).length;
        let totalRemaining = 0, lowLeaveCount = 0;
        activeUsers.forEach(user => {
            const leave = calculateLeave(user);
            totalRemaining += leave.remaining;
            if (leave.remaining <= 3 && leave.remaining >= 0) lowLeaveCount++;
        });
        return {
            totalActive: activeUsers.length, totalResigned: resignedUsers.length,
            totalWage: totalEstWage, insuranceNeeded,
            needRenewal: activeUsers.filter(u => {
                if (!u.renewalDate || u.renewalDate === '신규') return false;
                const diff = (new Date(u.renewalDate) - new Date()) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 14;
            }).length,
            totalRemaining: Math.floor(totalRemaining * 10) / 10, lowLeaveCount
        };
    }, [users, attendance, calculateLeave, calculateMonthlyWage, payrollMonth]);

    const teamCounts = useMemo(() => {
        const activeUsers = users.filter(u => !u.resignDate);
        const counts = { '전체': activeUsers.length };
        activeUsers.forEach(u => { counts[u.team] = (counts[u.team] || 0) + 1; });
        return counts;
    }, [users]);

    const filteredData = useMemo(() => {
        return users.filter(user => {
            const isResigned = !!user.resignDate;
            if (viewMode === 'ACTIVE' && isResigned) return false;
            if (viewMode === 'RESIGNED' && !isResigned) return false;
            const matchesSearch = user.name.includes(searchTerm) || user.phone?.includes(searchTerm);
            const matchesTeam = filterTeam === '전체' || user.team === filterTeam;
            let matchesStatus = true;
            if (filterStatus === 'RENEWAL_NEEDED') {
                if (!user.renewalDate || user.renewalDate === '신규' || isResigned) matchesStatus = false;
                else { const diff = (new Date(user.renewalDate) - new Date()) / (1000 * 60 * 60 * 24); matchesStatus = diff >= 0 && diff <= 14; }
            } else if (filterStatus === 'INSURANCE_NEEDED') matchesStatus = !user.insuranceStatus;
            return matchesSearch && matchesTeam && matchesStatus;
        });
    }, [users, searchTerm, filterTeam, filterStatus, viewMode]);

    const confirmResign = useCallback(async () => {
        if (resignTargetUser && resignDateInput) {
            const updatedUser = { ...resignTargetUser, resignDate: resignDateInput, resignReason: resignReasonInput };
            await updateEmployee(updatedUser);
            setSelectedUser(prev => prev?.id === resignTargetUser.id ? updatedUser : prev);
            showNotificationMsg(`${resignTargetUser.name}님의 퇴사 처리가 완료되었습니다.`);
            closeModal('resign');
            setResignTargetUser(null);
            setResignReasonInput('');
        }
    }, [resignTargetUser, resignDateInput, resignReasonInput, closeModal, showNotificationMsg, updateEmployee]);

    const openResignModal = useCallback((user, e) => {
        e?.stopPropagation();
        setResignTargetUser(user);
        setResignDateInput(new Date().toISOString().split('T')[0]);
        setResignReasonInput('');
        openModal('resign');
    }, [openModal]);

    const openUserForm = useCallback((user = null, e = null) => {
        e?.stopPropagation();
        setFormUser(user);
        openModal('userForm');
    }, [openModal]);

    const handleUserSave = useCallback(async (user) => {
        if (formUser) {
            await updateEmployee(user);
            setSelectedUser(prev => prev?.id === user.id ? user : prev);
            showNotificationMsg('정보가 수정되었습니다.');
        } else {
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id), 0) + 1 : 1;
            await addEmployee({ ...user, id: newId });
            showNotificationMsg('신규 인원이 등록되었습니다.');
        }
        closeModal('userForm');
    }, [formUser, closeModal, showNotificationMsg, updateEmployee, addEmployee, users]);

    const handleUserDelete = useCallback(async (userId) => {
        await deleteEmployee(userId);
        if (selectedUser?.id === userId) setSelectedUser(null);
        showNotificationMsg('직원이 삭제되었습니다.');
        closeModal('userForm');
    }, [selectedUser, showNotificationMsg, closeModal, deleteEmployee]);

    const saveAttendance = useCallback(async (userId, date, record) => {
        await saveAttendanceFn(userId, date, record);
    }, [saveAttendanceFn]);

    const handleAddLeave = useCallback(async (userId, date, type) => {
        await addLeaveRecord(userId, date, type);
        showNotificationMsg(`${type} 등록 완료`);
    }, [showNotificationMsg, addLeaveRecord]);

    const handleDeleteLeave = useCallback(async (userId, date) => {
        await deleteLeaveRecord(userId, date);
        showNotificationMsg('삭제 완료');
    }, [showNotificationMsg, deleteLeaveRecord]);

    const handleSaveAdjustment = useCallback(async (userId, amount) => {
        await saveAdjustmentFn(userId, amount);
        showNotificationMsg('연차 조정 완료');
        closeModal('adjust');
        setAdjustUser(null);
    }, [closeModal, showNotificationMsg, saveAdjustmentFn]);

    const handleRosterUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const rows = await readFileData(file);
            const uploadedData = [];
            if (rows && rows.length > 0) {
                const headers = rows[0];
                const mapIdx = (key) => headers.findIndex(h => h && String(h).replace(/\s/g, '').includes(key));
                const idxName = mapIdx('이름');
                if (idxName === -1) { showNotificationMsg('이름 컬럼 누락', 'error'); return; }

                rows.slice(1).forEach((row) => {
                    if (!row || row.length === 0) return;
                    const name = row[idxName];
                    if (!name) return;
                    const getValue = (key, fallback = '') => {
                        const idx = mapIdx(key);
                        return idx !== -1 ? (row[idx] !== undefined ? String(row[idx]) : fallback) : fallback;
                    };

                    uploadedData.push({
                        name: String(name), team: getValue('팀', '미정'), gender: getValue('성별'),
                        bank: getValue('은행'), account: getValue('계좌'),
                        startDate: normalizeDateStr(getValue('입사') || getValue('출근날짜')),
                        insuranceDate: normalizeDateStr(getValue('보험')),
                        insuranceStatus: !!getValue('보험'), renewalDate: normalizeDateStr(getValue('갱신')),
                        checkIn: (getValue('출근시간') || '09:00').replace('시', ':00'), checkOut: (getValue('퇴근시간') || '18:00').replace('시', ':00'),
                        workHours: parseInt(getValue('근무시간')) || 8, workDays: getValue('근무일자') || '5일',
                        wage: parseInt(getValue('시급').replace(/[^0-9]/g, '')) || 0,
                        wageIncreaseDate: normalizeDateStr(getValue('인상일')),
                        phone: getValue('연락처'), rrn: getValue('주민'), address: getValue('주소'), email: getValue('이메일'),
                        position: '아르바이트', resignDate: normalizeDateStr(getValue('퇴사') || getValue('퇴사일자') || ''),
                        resignReason: getValue('퇴사사유') || getValue('사유') || ''
                    });
                });

                const updatedUsers = [...users];
                let addedCount = 0, updatedCount = 0;
                uploadedData.forEach(newInfo => {
                    const idx = updatedUsers.findIndex(u => u.name === newInfo.name);
                    if (idx !== -1) { updatedUsers[idx] = { ...updatedUsers[idx], ...newInfo }; updatedCount++; }
                    else { updatedUsers.push({ ...newInfo, id: Math.max(...updatedUsers.map(u => u.id), 0) + 1 }); addedCount++; }
                });
                // Firestore에 일괄 업로드
                await batchImportEmployees(updatedUsers);
                showNotificationMsg(`${addedCount}명 추가, ${updatedCount}명 수정 완료`);
            }
        } catch (err) { console.error(err); showNotificationMsg(err.message || '파일 처리 실패', 'error'); }
        e.target.value = null; closeModal('dataMenu');
    };

    const handleAttendanceUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const rows = await readFileData(file);
            if (rows && rows.length > 0) {
                const headers = rows[0];
                const mapIdx = (key) => headers.findIndex(h => h && String(h).replace(/\s/g, '').includes(key));
                const findExact = (key) => headers.findIndex(h => h && String(h).replace(/\s/g, '') === key);
                const idxName = mapIdx('이름');
                const idxDate = mapIdx('근무일자') !== -1 ? mapIdx('근무일자') : findExact('날짜');
                const idxIn = mapIdx('출근시간') !== -1 ? mapIdx('출근시간') : findExact('출근');
                const idxOut = mapIdx('퇴근시간') !== -1 ? mapIdx('퇴근시간') : findExact('퇴근');
                const idxOvertime = findExact('연장시간') !== -1 ? findExact('연장시간') : findExact('연장');

                if (idxName === -1 || idxDate === -1) { showNotificationMsg('이름 또는 근무일자 컬럼 누락', 'error'); return; }

                const idxReason = mapIdx('근태사유') !== -1 ? mapIdx('근태사유') : (findExact('사유') !== -1 ? findExact('사유') : findExact('비고'));

                let count = 0;
                const saves = [];
                rows.slice(1).forEach(row => {
                    if (!row || row.length === 0) return;
                    const name = row[idxName];
                    if (!name) return;
                    const user = users.find(u => u.name === name);
                    if (!user) return;

                    const dateStr = normalizeDateStr(row[idxDate]);
                    if (!dateStr) return;

                    const rawCheckIn = row[idxIn] ? String(row[idxIn]).replace('시', ':00') : '';
                    const rawCheckOut = row[idxOut] ? String(row[idxOut]).replace('시', ':00') : '';
                    const overtime = (row[idxOvertime] ? Number(row[idxOvertime]) : 0) || 0;
                    const reason = idxReason !== -1 ? String(row[idxReason] || '').trim() : '';

                    const isAbsent = reason.includes('결근');
                    const checkIn = isAbsent ? '' : (rawCheckIn || user.checkIn);
                    const checkOut = isAbsent ? '' : (rawCheckOut || user.checkOut);

                    const idxEarlyReason = mapIdx('조기퇴근사유') !== -1 ? mapIdx('조기퇴근사유') : findExact('조기퇴근');
                    const idxOvertimeReason = mapIdx('연장근무사유') !== -1 ? mapIdx('연장근무사유') : findExact('연장근무');
                    const earlyLeaveReason = idxEarlyReason !== -1 ? String(row[idxEarlyReason] || '').trim() : '';
                    const overtimeReason = idxOvertimeReason !== -1 ? String(row[idxOvertimeReason] || '').trim() : '';

                    saves.push(saveAttendanceFn(user.id, dateStr, { checkIn, checkOut, overtime, reason, earlyLeaveReason, overtimeReason }));
                    count++;
                });
                await Promise.all(saves);
                showNotificationMsg(`총 ${count}건의 근무 기록이 등록되었습니다.`);
            }
        } catch (err) { console.error(err); showNotificationMsg(err.message || '파일 처리 실패', 'error'); }
        e.target.value = null; closeModal('dataMenu');
    };

    const downloadCSV = () => {
        const headers = ["성별", "이름", "은행", "계좌번호", "팀", "입사일", "4대보험 신고일", "계약 갱신일", "출근시간", "퇴근시간", "근무시간", "근무일자", "시급", "시급인상일", "연락처", "주민등록번호", "주소지", "이메일", "퇴사일자", "퇴사사유"];
        const rows = filteredData.map(u => [
            u.gender, u.name, u.bank, u.account, u.team,
            u.startDate, u.insuranceDate, u.renewalDate,
            u.checkIn, u.checkOut, u.workHours, u.workDays, u.wage, u.wageIncreaseDate,
            u.phone, u.rrn, u.address, u.email,
            u.resignDate || '', u.resignReason || ''
        ]);

        const HEADER_STYLE = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '5D6C4A' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: '3D472F' } } }
        };
        const DATA_STYLE = {
            alignment: { vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'E8E4D4' } } }
        };

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        // 컬럼 너비 설정
        ws['!cols'] = [
            { wch: 5 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 8 },
            { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
            { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
            { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 24 },
            { wch: 12 }, { wch: 16 }
        ];

        // 헤더 스타일 적용
        headers.forEach((_, ci) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
            if (ws[cellRef]) ws[cellRef].s = HEADER_STYLE;
        });

        // 데이터 스타일 적용
        rows.forEach((_, ri) => {
            headers.forEach((__, ci) => {
                const cellRef = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
                if (ws[cellRef]) ws[cellRef].s = DATA_STYLE;
            });
        });

        XLSX.utils.book_append_sheet(wb, ws, '직원 명단');
        XLSX.writeFile(wb, `아르바이트_명단_${filterTeam}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        closeModal('dataMenu');
    };

    const downloadLeaveCSV = () => {
        const headers = ["이름", "부서", "입사일", "연차 발생", "1년 미만 연차 발생", "1년 미만 이월 연차", "이월 일수", "사용 일수", "조정 일수", "잔여 일수"];
        const rows = filteredData.map(user => { const leave = calculateLeave(user); return [escapeCsvField(user.name), escapeCsvField(user.team), escapeCsvField(user.startDate), escapeCsvField(leave.annualLeave), escapeCsvField(leave.firstYearLeave), escapeCsvField(leave.firstYearCarryover), escapeCsvField(leave.carryover), escapeCsvField(leave.usedLeave), escapeCsvField(leave.adjustment), escapeCsvField(leave.remaining)]; });
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `연차현황_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link); closeModal('dataMenu');
    };

    const downloadAttendanceTemplate = (team = '전체') => {
        const [ty, tm] = payrollMonth.split('-').map(Number);
        const daysInMonth = new Date(ty, tm, 0).getDate();
        const monthLabel = `${ty}-${String(tm).padStart(2, '0')}`;

        // 해당 월의 평일(월~금)만 추출
        const weekdays = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(ty, tm - 1, d);
            const dow = date.getDay();
            if (dow >= 1 && dow <= 5) {
                weekdays.push(`${ty}-${String(tm).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            }
        }

        // 재직 중인 직원 필터링
        const activeUsers = users.filter(u => !u.resignDate && (team === '전체' || u.team === team));
        if (activeUsers.length === 0) { showNotificationMsg('해당 팀에 재직 중인 직원이 없습니다.', 'error'); return; }

        const headers = ['이름', '근무일자', '시급', '출근', '퇴근', '조기퇴근 사유', '연장근무 사유', '근태 사유'];
        const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '5D6C4A' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin', color: { rgb: '3D472F' } } } };
        const colWidths = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

        const wb = XLSX.utils.book_new();

        // 1. 전체 요약 시트
        const allRows = [];
        activeUsers.forEach(u => {
            weekdays.forEach(dateStr => {
                allRows.push([u.name, dateStr, u.wage, u.checkIn, u.checkOut, '', '', '']);
            });
        });
        const wsSummary = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
        wsSummary['!cols'] = colWidths;
        headers.forEach((_, ci) => { const cell = wsSummary[XLSX.utils.encode_cell({ r: 0, c: ci })]; if (cell) cell.s = headerStyle; });
        XLSX.utils.book_append_sheet(wb, wsSummary, '전체');

        // 2. 인원별 시트
        activeUsers.forEach(u => {
            const rows = weekdays.map(dateStr => [u.name, dateStr, u.wage, u.checkIn, u.checkOut, '', '', '']);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            ws['!cols'] = colWidths;
            headers.forEach((_, ci) => { const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })]; if (cell) cell.s = headerStyle; });
            XLSX.utils.book_append_sheet(wb, ws, u.name.substring(0, 31));
        });

        const teamLabel = team === '전체' ? '전체' : team;
        XLSX.writeFile(wb, `근태양식_${monthLabel}_${teamLabel}.xlsx`);
        showNotificationMsg(`${monthLabel} ${teamLabel} 근태 양식 다운로드 (${activeUsers.length}명 × ${weekdays.length}일)`);
    };

    const handleResetData = useCallback(() => { openModal('resetConfirm'); }, [openModal]);

    const confirmResetData = useCallback(() => {
        try {
            localStorage.setItem('alba_users', JSON.stringify([])); localStorage.setItem('alba_attendance', JSON.stringify({}));
            localStorage.setItem('leave_records', JSON.stringify({})); localStorage.setItem('leave_adjustments', JSON.stringify({}));
            localStorage.setItem('leave_carryovers', JSON.stringify({}));
        } catch (e) { console.log('write failed:', e); }

        setUsers([]); setAttendance({}); setLeaveRecords({}); setAdjustments({}); setCarryovers({}); setSelectedUser(null);
        showNotificationMsg('모든 데이터가 초기화되었습니다.');
        closeModal('dataMenu'); closeModal('resetConfirm');
    }, [showNotificationMsg, closeModal]);

    const applyStyles = (ws, range, styleOverrides) => {
        if (!ws['!ref']) return;
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
                const style = typeof styleOverrides === 'function' ? styleOverrides(R, C, ws[cellRef]) : styleOverrides;
                ws[cellRef].s = { ...(ws[cellRef].s || {}), ...style };
            }
        }
    };

    const downloadInsuredCSV = () => {
        const insuredUsers = filteredData.filter(u => u.insuranceStatus);
        const wb = XLSX.utils.book_new();

        const TITLE_STYLE = { font: { bold: true, color: { rgb: "2F5597" }, sz: 14 } };
        const SUBTITLE_STYLE = { font: { bold: true } };
        const HEADER_STYLE = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2F5597" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: { top: { style: 'thin', color: { rgb: "000000" } }, bottom: { style: 'thin', color: { rgb: "000000" } }, left: { style: 'thin', color: { rgb: "000000" } }, right: { style: 'thin', color: { rgb: "000000" } } }
        };
        const BORDER_ONLY = { border: { top: { style: 'thin', color: { rgb: "000000" } }, bottom: { style: 'thin', color: { rgb: "000000" } }, left: { style: 'thin', color: { rgb: "000000" } }, right: { style: 'thin', color: { rgb: "000000" } } } };
        const CELL_CENTER = { ...BORDER_ONLY, alignment: { horizontal: "center", vertical: "center" } };
        const CELL_NUM = { ...BORDER_ONLY, alignment: { horizontal: "right", vertical: "center" }, numFmt: '#,##0' };

        // 1. Summary Sheet
        const summaryHeaders = ["이름", "은행", "계좌번호", "기본급", "주휴수당", "합계", "비고", "상태"];
        let totalBase = 0, totalHoliday = 0, totalSum = 0;
        const summaryDataAoA = [
            [`${payrollMonth.split('-')[1]}월 급여 계산 최종본 (${payrollMonth.split('-')[0]})`],
            [],
            ["전체 급여 요약"],
            summaryHeaders
        ];

        insuredUsers.forEach(u => {
            const pay = calculateMonthlyWage(u, payrollMonth);
            const base = pay.hasRecord ? pay.actualBasePayOnly : Math.round((calculateDailyWage(u.wage, u.checkIn, u.checkOut).basePay * 5) * 4.345);
            const holi = pay.hasRecord ? pay.actualHolidayPay : Math.round(((u.workHours || 0) * 5 >= 15 ? calculateDailyWage(u.wage, u.checkIn, u.checkOut).basePay : 0) * 4.345);
            const sum = pay.hasRecord ? pay.actual : pay.estimated;
            const status = pay.hasRecord ? "☑" : "☐";
            totalBase += base; totalHoliday += holi; totalSum += sum;
            summaryDataAoA.push([u.name, u.bank, u.account, base, holi, sum, "노무사 전달용", status]);
        });
        summaryDataAoA.push(["합계", "", "", totalBase, totalHoliday, totalSum, `전체 인원: ${insuredUsers.length}명`, "☑"]);

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryDataAoA);
        wsSummary['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 8 }];

        applyStyles(wsSummary, { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, TITLE_STYLE);
        applyStyles(wsSummary, { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, SUBTITLE_STYLE);
        applyStyles(wsSummary, { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }, HEADER_STYLE);
        applyStyles(wsSummary, { s: { r: 4, c: 0 }, e: { r: summaryDataAoA.length - 2, c: 7 } }, (r, c, cell) => {
            if (c >= 3 && c <= 5) return CELL_NUM;
            if (c === 7) return { ...CELL_CENTER, font: { name: 'Segoe UI Symbol' } };
            return CELL_CENTER;
        });
        applyStyles(wsSummary, { s: { r: summaryDataAoA.length - 1, c: 0 }, e: { r: summaryDataAoA.length - 1, c: 7 } }, (r, c, cell) => {
            if (c === 7) return { ...CELL_CENTER, font: { name: 'Segoe UI Symbol' } };
            if (c >= 3 && c <= 5) return { ...CELL_NUM, font: { bold: true } };
            return { ...CELL_CENTER, font: { bold: true } };
        });

        XLSX.utils.book_append_sheet(wb, wsSummary, "전체 급여 요약");

        // 2. Individual Detail Sheets
        insuredUsers.forEach(u => {
            const pay = calculateMonthlyWage(u, payrollMonth);
            const base = pay.hasRecord ? pay.actualBasePayOnly : Math.round((calculateDailyWage(u.wage, u.checkIn, u.checkOut).basePay * 5) * 4.345);
            const holi = pay.hasRecord ? pay.actualHolidayPay : Math.round(((u.workHours || 0) * 5 >= 15 ? calculateDailyWage(u.wage, u.checkIn, u.checkOut).basePay : 0) * 4.345);
            const sum = pay.hasRecord ? pay.actual : pay.estimated;

            const sheetData = [
                [`${u.name} - ${payrollMonth.split('-')[1]}월 급여 상세`],
                ["시급", u.wage, "하루 근무:", `${u.workHours || 8}시간`],
                ["시급 인상일:", u.wageIncreaseDate || "없음", "출퇴근:", `${u.checkIn || "09:00"} ~ ${u.checkOut || "18:00"}`],
                [],
                ["주차별 근무 내역"],
                ["주차", "근무일", "총 시간", "주휴수당", "비고"]
            ];
            const startDataRow = 6;
            let rowsAdded = 0;

            if (pay.hasRecord && pay.weeklyLogsList.length > 0) {
                pay.weeklyLogsList.forEach(log => {
                    sheetData.push([
                        log.weekStr,
                        `${log.daysWorked}일`,
                        `${Math.round(log.totalHours * 10) / 10}h`,
                        log.holidayPay > 0 ? log.holidayPay : 0,
                        log.holidayPay > 0 ? "-" : "2월 이월"
                    ]);
                    rowsAdded++;
                });
            } else {
                sheetData.push(["데이터 없음", "", "", "", ""]);
                rowsAdded++;
            }

            sheetData.push([]); // Empty row

            // 3. 근태 특이사항 섹션 (조기퇴근, 결근, 연차, 연장근무 등)
            const userAtt = attendance[u.id] || {};
            const notableEntries = [];
            const [ty, tmn] = payrollMonth.split('-').map(Number);
            const dim = new Date(ty, tmn, 0).getDate();
            for (let d = 1; d <= dim; d++) {
                const ds = `${ty}-${String(tmn).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const rec = userAtt[ds];
                if (!rec) continue;

                const reason = rec.reason || '';
                const earlyLeaveReason = rec.earlyLeaveReason || '';
                const overtimeReason = rec.overtimeReason || '';

                // 결근
                if (reason.includes('결근')) {
                    notableEntries.push([ds, '결근', '-', reason]);
                    continue;
                }
                // 연차/공휴일 등 근태 사유
                if (reason && !reason.includes('결근')) {
                    const category = reason.includes('연차') ? '연차' : reason.includes('신정') || reason.includes('공휴') ? '공휴일' : '기타';
                    notableEntries.push([ds, category, '-', reason]);
                }
                // 조기퇴근 (퇴근시간이 계약보다 빠른 경우)
                if (rec.checkOut && rec.checkOut < u.checkOut) {
                    const contractHours = calculateDailyWage(u.wage, u.checkIn, u.checkOut).hours;
                    const actualHours = calculateDailyWage(u.wage, rec.checkIn, rec.checkOut).hours;
                    const diff = Math.round((contractHours - actualHours) * 10) / 10;
                    const displayReason = earlyLeaveReason || reason || '';
                    notableEntries.push([ds, '조기퇴근', `${rec.checkIn}~${rec.checkOut} (-${diff}h)`, displayReason]);
                }
                // 연장근무
                if (overtimeReason) {
                    notableEntries.push([ds, '연장근무', `+${rec.overtime || 0}h`, overtimeReason]);
                }
            }

            let noteHeaderRow = -1, noteDataStartRow = -1, noteCount = 0;
            if (notableEntries.length > 0) {
                sheetData.push([]); // 추가 빈 행으로 시각적 분리
                sheetData.push(["근태 특이사항"]);
                noteHeaderRow = sheetData.length - 1;
                sheetData.push(["날짜", "구분", "출퇴근 변동", "사유"]);
                noteDataStartRow = sheetData.length;
                noteCount = notableEntries.length;
                notableEntries.forEach(entry => {
                    sheetData.push(entry);
                });
                sheetData.push([]); // Empty row after notes
            }

            const calcStartRow = sheetData.length;
            sheetData.push(["급여 계산"]);
            sheetData.push(["전체 근무시간 (h)", `${Math.round(pay.totalActualHours * 10) / 10}h`]);
            sheetData.push(["기본급 (정상 근무)", base]);
            sheetData.push(["기본급 합계", base]);
            sheetData.push(["주휴수당 합계", holi]);
            sheetData.push(["총 급여", sum]);

            const wsDetail = XLSX.utils.aoa_to_sheet(sheetData);
            wsDetail['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }];

            // 타이틀 스타일 (Row 0)
            applyStyles(wsDetail, { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, TITLE_STYLE);

            // 기본 정보 셀 (Row 1-2) — 테두리 + 시급 포맷
            applyStyles(wsDetail, { s: { r: 1, c: 0 }, e: { r: 2, c: 3 } }, (r, c) => {
                const baseStyle = { ...BORDER_ONLY, alignment: { vertical: "center" } };
                if (c === 0 || c === 2) return { ...baseStyle, font: { bold: true } };
                if (r === 1 && c === 1) return { ...baseStyle, numFmt: '#,##0"원"' };
                return baseStyle;
            });

            // "주차별 근무 내역" 소제목 (Row 4)
            applyStyles(wsDetail, { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, SUBTITLE_STYLE);
            // 주차 헤더 (Row 5)
            applyStyles(wsDetail, { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } }, HEADER_STYLE);

            // Weekly Logs 데이터 (Row 6+) — 테두리 추가
            applyStyles(wsDetail, { s: { r: startDataRow, c: 0 }, e: { r: startDataRow + rowsAdded - 1, c: 4 } }, (r, c) => {
                if (c === 3) return { ...CELL_NUM, fill: { fgColor: { rgb: "FFE699" } } };
                if (c === 4) return { ...CELL_CENTER };
                return CELL_CENTER;
            });

            // 근태 특이사항 스타일링 (오렌지 헤더)
            if (noteHeaderRow >= 0) {
                const NOTE_HEADER_STYLE = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "C65911" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: { top: { style: 'thin', color: { rgb: "000000" } }, bottom: { style: 'thin', color: { rgb: "000000" } }, left: { style: 'thin', color: { rgb: "000000" } }, right: { style: 'thin', color: { rgb: "000000" } } }
                };
                applyStyles(wsDetail, { s: { r: noteHeaderRow, c: 0 }, e: { r: noteHeaderRow, c: 3 } }, { font: { bold: true, color: { rgb: "C65911" } } });
                applyStyles(wsDetail, { s: { r: noteHeaderRow + 1, c: 0 }, e: { r: noteHeaderRow + 1, c: 3 } }, NOTE_HEADER_STYLE);
                applyStyles(wsDetail, { s: { r: noteDataStartRow, c: 0 }, e: { r: noteDataStartRow + noteCount - 1, c: 3 } }, (r, c) => {
                    const base = { ...BORDER_ONLY, alignment: { horizontal: c === 0 ? "center" : "left", vertical: "center" } };
                    // 구분 컬럼에 색상 적용
                    if (c === 1) {
                        const cellVal = wsDetail[XLSX.utils.encode_cell({ r, c })]?.v || '';
                        if (cellVal === '결근') return { ...base, font: { color: { rgb: "FF0000" }, bold: true } };
                        if (cellVal === '조기퇴근') return { ...base, font: { color: { rgb: "C65911" } } };
                        if (cellVal === '연차') return { ...base, font: { color: { rgb: "2F5597" } } };
                    }
                    return base;
                });
            }

            applyStyles(wsDetail, { s: { r: calcStartRow, c: 0 }, e: { r: calcStartRow, c: 4 } }, SUBTITLE_STYLE);
            // 기본급 (정상 근무)
            if (wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 2, c: 1 })]) {
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 2, c: 1 })].s = { numFmt: '#,##0', alignment: { horizontal: "right" } };
            }
            // 기본급 합계
            if (wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 3, c: 1 })]) {
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 3, c: 1 })].s = { fill: { fgColor: { rgb: "FFF2CC" } }, font: { color: { rgb: "FF0000" }, bold: true }, numFmt: '#,##0', alignment: { horizontal: "right" } };
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 3, c: 0 })].s = { fill: { fgColor: { rgb: "FFF2CC" } }, font: { bold: true } };
            }
            // 주휴수당 합계
            if (wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 4, c: 1 })]) {
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 4, c: 1 })].s = { fill: { fgColor: { rgb: "E2EFDA" } }, font: { bold: true }, numFmt: '#,##0', alignment: { horizontal: "right" } };
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 4, c: 0 })].s = { fill: { fgColor: { rgb: "E2EFDA" } }, font: { bold: true } };
            }
            // 총 급여
            if (wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 5, c: 1 })]) {
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 5, c: 1 })].s = { fill: { fgColor: { rgb: "E2EFDA" } }, font: { color: { rgb: "FF0000" }, bold: true }, numFmt: '#,##0', alignment: { horizontal: "right" } };
                wsDetail[XLSX.utils.encode_cell({ r: calcStartRow + 5, c: 0 })].s = { fill: { fgColor: { rgb: "E2EFDA" } }, font: { bold: true } };
            }

            const sheetName = `${u.name}`.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
        });

        XLSX.writeFile(wb, `${payrollMonth}_4대보험가입자_노무사전달용.xlsx`);
    };

    const downloadFreelancerCSV = () => {
        const freelancerUsers = filteredData.filter(u => !u.insuranceStatus);
        const headers = ["성별", "이름", "은행", "계좌번호", "팀", "급여(세전)", "3.3%공제", "실지급액", "비고"];
        const rows = freelancerUsers.map(u => {
            const pay = calculateMonthlyWage(u, payrollMonth);
            return [escapeCsvField(u.gender), escapeCsvField(u.name), escapeCsvField(u.bank), escapeCsvField(u.account), escapeCsvField(u.team), escapeCsvField(pay.actual), escapeCsvField(pay.strictDeduction), escapeCsvField(pay.strictFinalPayout), "본사 지급 요청"];
        });
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `${payrollMonth}_3.3공제자_본사지급요청.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-[#e8e4d4] p-4 font-mono text-[#2d2a1f] relative">
            {notification && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-md shadow-lg font-bold z-50 transition-all flex items-center gap-2 ${notification.type === 'error' ? 'bg-[#a65d57] text-[#f5f3e8] border-2 border-[#8b4d47]' : 'bg-[#5d6c4a] text-[#f5f3e8] border-2 border-[#3d472f]'}`}>
                    {notification.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
                    {notification.msg}
                    <button onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100"><X size={18} /></button>
                </div>
            )}
            {showCalculator && <CalculatorWidget onClose={() => closeModal('calculator')} />}

            <div className="max-w-[1400px] mx-auto space-y-4">
                <header className="flex justify-between items-center bg-[#5d6c4a] p-4 border-2 border-[#3d472f] shadow-md">
                    <div>
                        <h1 className="text-2xl font-black text-[#f5f3e8] tracking-tight flex items-center gap-2"><span className="text-[#d4dcc0]">페플</span> 아르바이트 관리</h1>
                        <p className="text-[#b8c4a0] text-xs font-medium mt-0.5">★ 효율적인 인사/급여/연차 통합 관리 시스템 ★</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-[#3d472f] border-2 border-[#2d3721] mr-2">
                            <button onClick={() => setActiveTab('HR')} className={`px-4 py-2 text-xs font-bold transition ${activeTab === 'HR' ? 'bg-[#f5f3e8] text-[#3d472f]' : 'text-[#b8c4a0] hover:text-[#f5f3e8]'}`}>HR관리</button>
                            <button onClick={() => setActiveTab('PAYROLL')} className={`px-4 py-2 text-xs font-bold border-x-2 border-[#2d3721] transition ${activeTab === 'PAYROLL' ? 'bg-[#f5f3e8] text-[#3d472f]' : 'text-[#b8c4a0] hover:text-[#f5f3e8]'}`}>급여정산</button>
                            <button onClick={() => setActiveTab('LEAVE')} className={`px-4 py-2 text-xs font-bold transition ${activeTab === 'LEAVE' ? 'bg-[#f5f3e8] text-[#3d472f]' : 'text-[#b8c4a0] hover:text-[#f5f3e8]'}`}>연차관리</button>
                            {userProfile?.role === 'FINAL_APPROVER' && (
                                <button onClick={() => setActiveTab('APPROVALS')} className={`px-4 py-2 text-xs font-bold border-l-2 border-[#2d3721] transition ${activeTab === 'APPROVALS' ? 'bg-[#f5f3e8] text-[#3d472f]' : 'text-[#b8c4a0] hover:text-[#f5f3e8]'}`}>연차결재</button>
                            )}
                        </div>

                        {/* 알림 벨 아이콘 */}
                        <div className="mr-3 flex items-center justify-center">
                            <NotificationBell userId={userProfile?.uid} />
                        </div>

                        {/* 역할 모드 선택기 */}
                        <div className="flex items-center border-2 border-[#2d3721] bg-[#3d472f] mr-2">
                            {[
                                { key: 'ADMIN', label: '관리자', icon: <ShieldCheck size={11} /> },
                                { key: 'STAFF', label: '실무자', icon: <Eye size={11} /> },
                                { key: 'VIEWER', label: '조회전용', icon: <EyeOff size={11} /> },
                            ].map(({ key, label, icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setRoleMode(key)}
                                    title={key === 'VIEWER' ? '개인정보 마스킹 적용' : ''}
                                    className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold border-r border-[#2d3721] last:border-0 transition ${roleMode === key ? 'bg-[#f5f3e8] text-[#3d472f]' : 'text-[#b8c4a0] hover:text-[#f5f3e8]'
                                        }`}
                                >
                                    {icon}{label}
                                </button>
                            ))}
                        </div>

                        <div className="relative" ref={dataMenuRef}>
                            <button onClick={() => toggleModal('dataMenu')} className="flex items-center gap-2 bg-[#f5f3e8] border-2 border-[#3d472f] px-4 py-2 hover:bg-[#e8e4d4] text-sm font-bold text-[#3d472f]">
                                <Layers size={16} /> 데이터 관리 <ChevronDown size={14} className={`transition-transform ${showDataMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showDataMenu && (
                                <div className="absolute right-0 mt-1 w-56 bg-[#f5f3e8] border-2 border-[#3d472f] shadow-lg z-50">
                                    <div className="p-2 border-b-2 border-[#e8e4d4]">
                                        <button onClick={() => attendanceFileInputRef.current?.click()} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Download size={14} /> 근무기록 업로드</button>
                                        <button onClick={() => rosterFileInputRef.current?.click()} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Users size={14} /> 명단 업로드</button>
                                    </div>
                                    <div className="p-2 border-b-2 border-[#e8e4d4]">
                                        <button onClick={() => openUserForm()} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Users size={14} /> 신규 직원 추가</button>
                                        <button onClick={() => openModal('calendar')} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Calendar size={14} /> 근태 기록 열기</button>
                                    </div>
                                    <div className="p-2 border-b-2 border-[#e8e4d4]">
                                        <button onClick={downloadCSV} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Download size={14} /> 전체 명단 다운로드</button>
                                        <button onClick={downloadLeaveCSV} className="w-full text-left px-3 py-2 text-sm text-[#4a4535] hover:bg-[#e8e4d4] flex items-center gap-2 font-bold"><Download size={14} /> 연차 현황 다운로드</button>
                                    </div>
                                    <div className="p-2 bg-[#f8f0ef]">
                                        <button onClick={handleResetData} className="w-full text-left px-3 py-2 text-xs font-bold text-[#a65d57] hover:bg-[#f0e5e4] flex items-center gap-2"><RotateCcw size={14} /> 데이터 초기화</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input type="file" ref={rosterFileInputRef} onChange={handleRosterUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                        <input type="file" ref={attendanceFileInputRef} onChange={handleAttendanceUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                    </div>
                </header>

                {activeTab === 'HR' && (
                    <HRView
                        stats={stats} teamCounts={teamCounts} viewMode={viewMode} setViewMode={setViewMode}
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterTeam={filterTeam} setFilterTeam={setFilterTeam}
                        filterStatus={filterStatus} setFilterStatus={setFilterStatus} filteredData={filteredData}
                        selectedUser={selectedUser} handleSelectUser={handleSelectUser} calculateMonthlyWage={calculateMonthlyWage}
                        payrollMonth={payrollMonth} openModal={openModal} openUserForm={openUserForm} openResignModal={openResignModal}
                        maskPII={maskPII} roleMode={roleMode} onDeleteUser={handleUserDelete}
                    />
                )}

                {activeTab === 'PAYROLL' && (
                    <PayrollView
                        users={filteredData} calculateMonthlyWage={calculateMonthlyWage}
                        onDownloadInsured={downloadInsuredCSV} onDownloadFreelancer={downloadFreelancerCSV}
                        onDownloadTemplate={downloadAttendanceTemplate}
                        payrollMonth={payrollMonth} onMonthChange={movePayrollMonth}
                        payrollStatus={payrollStatus} onStatusChange={async (month, status) => {
                            await savePayrollStatus(month, status);
                        }}
                        onOpenDetail={(user) => { setPayrollDetailUser(user); openModal('payrollDetail'); }}
                    />
                )}

                {activeTab === 'LEAVE' && (
                    <LeaveView
                        users={users} viewMode={viewMode} setViewMode={setViewMode} filteredData={filteredData}
                        selectedUser={selectedUser} handleSelectUser={handleSelectUser} calculateLeave={calculateLeave}
                        openModal={openModal} setAdjustUser={setAdjustUser}
                    />
                )}

                {activeTab === 'APPROVALS' && userProfile?.role === 'FINAL_APPROVER' && (
                    <div className="max-w-5xl mx-auto w-full pt-4">
                        <FinalApprovalInbox />
                    </div>
                )}
            </div>

            {showResignModal && (
                <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-[#f5f3e8] shadow-lg w-full max-w-sm overflow-hidden border-2 border-[#3d472f]">
                        <div className="p-5 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#a65d57]">
                            <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2"><UserMinus size={20} /> ▶ 퇴사 처리</h3>
                            <button onClick={() => closeModal('resign')} className="text-[#f5f3e8] hover:text-[#dcc0bc]"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 bg-[#e8e4d4]">
                            <p className="text-sm text-[#5a5545]"><span className="font-bold text-[#3d472f]">{resignTargetUser?.name}</span>님을 퇴사 처리하시겠습니까?</p>
                            <div><label className="block text-xs font-bold text-[#5d6c4a] mb-1">퇴사일</label><input type="date" value={resignDateInput} onChange={e => setResignDateInput(e.target.value)} className="w-full px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] focus:border-[#5d6c4a] outline-none" /></div>
                            <div><label className="block text-xs font-bold text-[#5d6c4a] mb-1">퇴사 사유 (선택)</label><input type="text" value={resignReasonInput} onChange={e => setResignReasonInput(e.target.value)} placeholder="개인사정, 이직 등" className="w-full px-3 py-2 border-2 border-[#c5c0b0] bg-[#faf8f0] focus:border-[#5d6c4a] outline-none" /></div>
                            <div className="flex gap-2 mt-6">
                                <button onClick={() => closeModal('resign')} className="flex-1 py-2 text-sm font-bold text-[#7a7565] bg-[#e8e4d4] hover:bg-[#d4dcc0] border-2 border-[#c5c0b0]">취소</button>
                                <button onClick={confirmResign} className="flex-1 py-2 text-sm font-bold text-[#f5f3e8] bg-[#a65d57] hover:bg-[#8b4d47] border-2 border-[#7a3d37]">처리 완료</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showResetConfirm && (
                <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-[#f5f3e8] shadow-lg w-full max-w-sm overflow-hidden border-2 border-[#3d472f]">
                        <div className="p-5 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#a65d57]">
                            <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2"><AlertTriangle size={20} /> ▶ 데이터 초기화 경고</h3>
                            <button onClick={() => closeModal('resetConfirm')} className="text-[#f5f3e8] hover:text-[#dcc0bc]"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 bg-[#e8e4d4]">
                            <p className="text-sm font-bold text-[#a65d57] bg-[#f8f0ef] p-3 border-2 border-[#dcc0bc]">주의: 모든 직원, 근무 기록 및 연차 데이터가 영구적으로 삭제됩니다. 계속하시겠습니까?</p>
                            <div className="flex gap-2 mt-6">
                                <button onClick={() => closeModal('resetConfirm')} className="flex-1 py-3 text-sm font-bold text-[#7a7565] bg-[#e8e4d4] hover:bg-[#d4dcc0] border-2 border-[#c5c0b0]">취소</button>
                                <button onClick={confirmResetData} className="flex-1 py-3 text-sm font-bold text-[#f5f3e8] bg-[#a65d57] hover:bg-[#8b4d47] border-2 border-[#7a3d37]">모두 삭제 (되돌릴 수 없음)</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showUserForm && <UserFormModal user={formUser} onClose={() => closeModal('userForm')} onSave={handleUserSave} onDelete={handleUserDelete} />}
            {showCalendar && selectedUser && <CalendarModal user={selectedUser} attendance={attendance[selectedUser.id] || {}} onSave={(date, form) => saveAttendance(selectedUser.id, date, form)} calculateWage={calculateDailyWage} onFileUpload={handleAttendanceUpload} onClose={() => closeModal('calendar')} isLocked={payrollStatus[payrollMonth] === 'CONFIRMED'} />}
            {showLeaveCalendar && selectedUser && <LeaveCalendarModal users={filteredData} leaveRecords={leaveRecords} onAddLeave={handleAddLeave} onDeleteLeave={handleDeleteLeave} onClose={() => closeModal('leaveCalendar')} />}
            {showAdjustModal && adjustUser && <AdjustLeaveModal user={adjustUser} onClose={() => { closeModal('adjust'); setAdjustUser(null); }} onSave={handleSaveAdjustment} currentAdjustment={adjustments[adjustUser.id] || 0} />}
            {modalState.payrollDetail && payrollDetailUser && <PayrollDetailModal user={payrollDetailUser} wage={calculateMonthlyWage(payrollDetailUser, payrollMonth)} payrollMonth={payrollMonth} onClose={() => { closeModal('payrollDetail'); setPayrollDetailUser(null); }} />}
        </div>
    );
}


// ── 최상위 앱 — Auth 라우팅 ───────────────────────────────
export default function App() {
    const { currentUser, userProfile, loading, logout } = useAuth();
    const [showHRSystem, setShowHRSystem] = React.useState(() => {
        return localStorage.getItem('app_show_hr_system') === 'true';
    });

    React.useEffect(() => {
        localStorage.setItem('app_show_hr_system', showHRSystem);
    }, [showHRSystem]);

    const [showRegister, setShowRegister] = React.useState(false);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#5d6c4a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#5d6c4a] font-bold text-sm">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (!currentUser || !userProfile) {
        if (showRegister) return <RegisterPage onGoToLogin={() => setShowRegister(false)} />;
        return <LoginPage onGoToRegister={() => setShowRegister(true)} />;
    }

    // Auth 됐지만 Firestore 문서가 없는 경우
    if (userProfile._noProfile) {
        return (
            <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
                <div className="bg-[#f5f3e8] border-2 border-[#a65d57] p-8 max-w-sm w-full text-center">
                    <p className="font-bold text-[#a65d57] text-sm mb-2">⚠ 프로필 정보 없음</p>
                    <p className="text-xs text-[#7a7565] mb-4">Firebase Console → Firestore → users 컬렉션에<br />이 계정의 문서(role 포함)를 추가 후 새로고침하세요.<br /><span className="font-mono text-[10px] break-all">{currentUser.email}</span></p>
                    <button onClick={() => window.location.reload()} className="text-xs bg-[#5d6c4a] text-[#f5f3e8] px-4 py-2 font-bold">새로고침</button>
                    <button onClick={logout} className="text-xs bg-transparent text-[#7a7565] underline mt-4 block mx-auto">로그아웃</button>
                </div>
            </div>
        );
    }

    // ACTIVE 상태가 아닌 경우 (PENDING, REJECTED, SUSPENDED 등) 접근 차단
    if (userProfile.status && userProfile.status !== 'ACTIVE') {
        const statusMsg = userProfile.status === 'PENDING' ? '관리자 승인 대기 중'
            : userProfile.status === 'REJECTED' ? '가입 거절됨'
                : userProfile.status === 'SUSPENDED' ? '계정 정지됨'
                    : '비활성';
        return (
            <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
                <div className="bg-[#f5f3e8] border-2 border-[#a65d57] p-8 max-w-sm w-full text-center shadow-lg">
                    <AlertTriangle size={32} className="text-[#a65d57] mx-auto mb-3" />
                    <p className="font-bold text-[#3d472f] text-sm mb-2">로그인 제한</p>
                    <p className="text-xs text-[#7a7565] mb-6">현재 계정은 <span className="font-bold text-[#a65d57]">{statusMsg}</span> 상태입니다.<br />관리자에게 문의하세요.</p>
                    <button onClick={logout} className="w-full text-xs bg-[#5d6c4a] border-2 border-[#3d472f] text-[#f5f3e8] px-4 py-2.5 font-bold hover:bg-[#4a5639]">
                        확인 (로그아웃)
                    </button>
                </div>
            </div>
        );
    }


    if (userProfile.is_temp_password) return <ChangePasswordPage />;

    const { role } = userProfile;
    if (role === 'FINAL_APPROVER') {
        if (showHRSystem) {
            return (
                <div className="min-h-screen flex flex-col">
                    {/* 관리자 상단 바 */}
                    <div className="bg-[#2d3721] border-b-2 border-[#1e2516] px-4 py-2 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowHRSystem(false)}
                                className="text-[10px] bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] px-3 py-1.5 font-bold hover:bg-[#4a5639] flex items-center gap-1"
                            >
                                ← 계정 관리
                            </button>
                            <span className="text-[#b8c4a0] text-xs">인사 급여관리 시스템</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-[#a65d57] text-white font-bold px-2 py-0.5">최종 관리자</span>
                            <span className="text-[#b8c4a0] text-xs">{userProfile.name}</span>
                            <button
                                onClick={logout}
                                className="text-[10px] text-[#b8c4a0] hover:text-[#f5f3e8] font-bold"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <HRPayrollApp />
                    </div>
                </div>
            );
        }
        return <FinalApproverView onSwitchToHRSystem={() => setShowHRSystem(true)} />;
    }
    if (role === 'TEAM_APPROVER') return <TeamApproverView />;
    if (role === 'ALBA') return <AlbaView />;

    return (
        <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center">
            <p className="text-[#a65d57] font-bold">알 수 없는 역할: {role}</p>
        </div>
    );
}

