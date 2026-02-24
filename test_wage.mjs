// Test to verify holiday pay matches user's expected table for Jan 2025
const calculateDailyWage = (wage, start, end, overtimeHours = 0) => {
    if (!start || !end) return { basePay: 0, overtimePay: 0, hours: 0, regularHours: 0, actualOvertime: 0 };
    const normalizeTime = (t) => {
        if (!t) return "00:00";
        let cleanT = t.replace(/\s/g, '');
        const parts = cleanT.split(':');
        if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        return cleanT;
    };
    const startTime = new Date(`2000-01-01T${normalizeTime(start)}`);
    let endTime = new Date(`2000-01-01T${normalizeTime(end)}`);
    if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
    let workMinutes = (endTime - startTime) / (1000 * 60);
    const breakStart = new Date(`2000-01-01T13:00:00`);
    const breakEnd = new Date(`2000-01-01T14:00:00`);
    if (startTime <= breakStart && endTime >= breakEnd) workMinutes -= 60;
    const totalHours = Math.max(0, workMinutes / 60);
    const numericWage = Number(wage) || 0;
    const actualOvertime = Math.min(overtimeHours, totalHours);
    const regularHours = totalHours - actualOvertime;
    return { basePay: regularHours * numericWage, overtimePay: actualOvertime * numericWage * 1.5, hours: totalHours, regularHours, actualOvertime };
};

const calcMonthlyHoliday = (user, attendance, targetMonth) => {
    const userAttendance = attendance[user.id] || {};
    const getWageForDate = (d) => {
        if (user.wageIncreaseDate && user.previousWage > 0 && d < user.wageIncreaseDate) return user.previousWage;
        return user.wage;
    };
    const [ty, tm] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(ty, tm, 0).getDate();
    const monthDates = [];
    for (let i = 1; i <= daysInMonth; i++) monthDates.push(`${ty}-${String(tm).padStart(2, '0')}-${String(i).padStart(2, '0')}`);

    const dailyRecords = {};
    const processDate = (dateStr, isTM) => {
        const record = userAttendance[dateStr];
        if (record) {
            dailyRecords[dateStr] = { checkIn: record.checkIn, checkOut: record.checkOut, overtime: record.overtime || 0, isRecorded: true, isTargetMonth: isTM };
        } else {
            const dow = new Date(dateStr).getDay();
            if (dow >= 1 && dow <= 5)
                dailyRecords[dateStr] = { checkIn: user.checkIn, checkOut: user.checkOut, overtime: 0, isRecorded: false, isTargetMonth: isTM };
        }
    };
    monthDates.forEach(d => processDate(d, true));
    // previous month overlap into first week
    const firstDow = new Date(ty, tm - 1, 1).getDay();
    const diff = firstDow === 0 ? -6 : 1 - firstDow;
    for (let d = diff; d < 0; d++) {
        const pd = new Date(ty, tm - 1, 1 + d);
        const ds = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(pd.getDate()).padStart(2, '0')}`;
        processDate(ds, false);
    }

    const weeklyHours = {}, weeklyHasAbsent = {};
    Object.entries(dailyRecords).sort().forEach(([dateStr, record]) => {
        const daily = calculateDailyWage(getWageForDate(dateStr), record.checkIn, record.checkOut, record.overtime);
        const [py, pm, pd2] = dateStr.split('-').map(Number);
        const dow = new Date(py, pm - 1, pd2).getDay();
        const diffM = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(py, pm - 1, pd2 + diffM);
        const wk = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
        if (!weeklyHours[wk]) { weeklyHours[wk] = 0; weeklyHasAbsent[wk] = false; }
        weeklyHours[wk] += daily.hours;
        if (record.isRecorded && daily.hours === 0) weeklyHasAbsent[wk] = true;
    });

    let totalHoliday = 0;
    Object.entries(weeklyHours).forEach(([wk, hrs]) => {
        if (weeklyHasAbsent[wk]) return; // 결근 주는 제외
        if (hrs < 15) return;
        const [wy, wm, wd] = wk.split('-').map(Number);
        const thu = new Date(wy, wm - 1, wd + 3);
        const thuMonth = `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}`;
        if (thuMonth !== targetMonth) return;
        const sun = new Date(wy, wm - 1, wd + 6);
        const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
        const holidayHours = Math.min(hrs / 5, 8);
        totalHoliday += holidayHours * getWageForDate(sunStr);
    });
    return Math.round(totalHoliday);
};

// Test cases from user's table
const testCases = [
    { id: 1, name: '권신우', wage: 11500, checkIn: '09:00', checkOut: '17:00', expected: 402500, attendance: {} },
    { id: 9, name: '이지율', wage: 14000, checkIn: '09:00', checkOut: '17:00', expected: 392000, attendance: { 9: { '2025-01-20': { checkIn: '09:00', checkOut: '16:30', overtime: 0 }, '2025-01-21': { checkIn: '', checkOut: '', overtime: 0, reason: '결근' } } } },
    { id: 10, name: '이태호', wage: 14280, checkIn: '09:00', checkOut: '17:00', expected: 499800, attendance: {} },
    { id: 11, name: '박성수', wage: 14850, checkIn: '09:00', checkOut: '17:00', expected: 510840, attendance: { 11: { '2025-01-13': { checkIn: '09:00', checkOut: '13:00', overtime: 0 } } } },
];

testCases.forEach(tc => {
    const got = calcMonthlyHoliday({ id: tc.id, name: tc.name, wage: tc.wage, checkIn: tc.checkIn, checkOut: tc.checkOut }, tc.attendance, '2025-01');
    const ok = Math.abs(got - tc.expected) <= 1;
    console.log(`${tc.name}: 계산=${got.toLocaleString()} 기대=${tc.expected.toLocaleString()} ${ok ? '✅' : '❌ 불일치'}`);
});
