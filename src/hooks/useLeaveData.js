import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

export function useLeaveData() {
    const [leaveRecords, setLeaveRecords] = useState({});
    const [adjustments, setAdjustments] = useState({});
    const [carryovers, setCarryovers] = useState({});
    const [payrollStatus, setPayrollStatus] = useState({});
    // leave_balance read-only 구독 — 관리자 연차관리 화면 baseline 우선 표시용
    // key: String(employee_id), value: { total_days, used_days, baseline_* ... }
    const [leaveBalancesByEmployeeId, setLeaveBalancesByEmployeeId] = useState({});
    // leave_requests read-only 구독 — 관리자 연차관리 화면 "이번 달 연차" 카드/모달용
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let resolved = 0;
        const checkDone = () => { resolved++; if (resolved >= 6) setLoading(false); };

        const unsubLeave = onSnapshot(collection(db, 'leave_records'), snap => {
            const data = {};
            snap.docs.forEach(d => { data[parseInt(d.id)] = d.data().records || {}; });
            setLeaveRecords(data);
            checkDone();
        }, () => checkDone());

        const unsubAdj = onSnapshot(collection(db, 'leave_adjustments'), snap => {
            const data = {};
            snap.docs.forEach(d => { data[parseInt(d.id)] = d.data().amount || 0; });
            setAdjustments(data);
            checkDone();
        }, () => checkDone());

        const unsubCarry = onSnapshot(collection(db, 'leave_carryovers'), snap => {
            const data = {};
            snap.docs.forEach(d => { data[parseInt(d.id)] = d.data().amount || 0; });
            setCarryovers(data);
            checkDone();
        }, () => checkDone());

        const unsubPayroll = onSnapshot(doc(db, 'payroll_status', 'global'), snap => {
            setPayrollStatus(snap.exists() ? (snap.data().statuses || {}) : {});
            checkDone();
        }, () => checkDone());

        // 현재 연도 leave_balance 구독 (read-only, employee_id 우선 매핑)
        // 동일 employee의 다년도 문서가 있으면 가장 최신 year를 우선
        const currentYear = new Date().getFullYear();
        const unsubBalance = onSnapshot(collection(db, 'leave_balance'), snap => {
            const byEmpId = {};
            snap.docs.forEach(d => {
                const data = d.data() || {};
                const empId = data.employee_id ? String(data.employee_id) : '';
                if (!empId) return;
                const year = Number(data.year) || currentYear;
                if (year !== currentYear) {
                    // 다른 연도 문서는 유지하지 않음 (현재 연도 우선). 향후 정책 변경 시 확장 가능
                    return;
                }
                byEmpId[empId] = { ...data, _docId: d.id };
            });
            setLeaveBalancesByEmployeeId(byEmpId);
            checkDone();
        }, () => checkDone());

        // leave_requests 구독 (read-only) — 이번 달 연차 카드/모달 표시용
        const unsubReq = onSnapshot(collection(db, 'leave_requests'), snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLeaveRequests(list);
            checkDone();
        }, () => checkDone());

        return () => { unsubLeave(); unsubAdj(); unsubCarry(); unsubPayroll(); unsubBalance(); unsubReq(); };
    }, []);

    const addLeaveRecord = useCallback(async (userId, date, type) => {
        await setDoc(
            doc(db, 'leave_records', String(userId)),
            { records: { [date]: type } },
            { merge: true }
        );
    }, []);

    const deleteLeaveRecord = useCallback(async (userId, date) => {
        try {
            await updateDoc(
                doc(db, 'leave_records', String(userId)),
                { [`records.${date}`]: deleteField() }
            );
        } catch (e) {
            console.error('연차 기록 삭제 오류:', e);
        }
    }, []);

    const saveAdjustment = useCallback(async (userId, amount) => {
        await setDoc(doc(db, 'leave_adjustments', String(userId)), { amount });
    }, []);

    const savePayrollStatus = useCallback(async (month, status) => {
        await setDoc(
            doc(db, 'payroll_status', 'global'),
            { statuses: { [month]: status } },
            { merge: true }
        );
    }, []);

    // 일괄 가져오기 (마이그레이션용)
    const batchImport = useCallback(async ({ leaveRecords, adjustments, carryovers, payrollStatus }) => {
        for (const [userId, records] of Object.entries(leaveRecords || {})) {
            if (Object.keys(records).length === 0) continue;
            await setDoc(doc(db, 'leave_records', String(userId)), { records });
        }
        for (const [userId, amount] of Object.entries(adjustments || {})) {
            if (amount === 0) continue;
            await setDoc(doc(db, 'leave_adjustments', String(userId)), { amount });
        }
        for (const [userId, amount] of Object.entries(carryovers || {})) {
            if (amount === 0) continue;
            await setDoc(doc(db, 'leave_carryovers', String(userId)), { amount });
        }
        if (payrollStatus && Object.keys(payrollStatus).length > 0) {
            await setDoc(doc(db, 'payroll_status', 'global'), { statuses: payrollStatus });
        }
    }, []);

    return {
        leaveRecords, adjustments, carryovers, payrollStatus, loading,
        leaveBalancesByEmployeeId,
        leaveRequests,
        addLeaveRecord, deleteLeaveRecord, saveAdjustment, savePayrollStatus, batchImport,
    };
}
