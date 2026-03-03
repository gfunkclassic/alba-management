import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

export function useLeaveData() {
    const [leaveRecords, setLeaveRecords] = useState({});
    const [adjustments, setAdjustments] = useState({});
    const [carryovers, setCarryovers] = useState({});
    const [payrollStatus, setPayrollStatus] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let resolved = 0;
        const checkDone = () => { resolved++; if (resolved >= 4) setLoading(false); };

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

        return () => { unsubLeave(); unsubAdj(); unsubCarry(); unsubPayroll(); };
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
        addLeaveRecord, deleteLeaveRecord, saveAdjustment, savePayrollStatus, batchImport,
    };
}
