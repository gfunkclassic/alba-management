import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ATTENDANCE_LOG_FIELDS = ['checkIn', 'checkOut', 'overtime', 'reason', 'earlyLeaveReason', 'overtimeReason'];

function buildEditLog(employeeId, date, before, after, meta) {
    const changedFields = ATTENDANCE_LOG_FIELDS.filter(f => {
        const bv = before ? (before[f] ?? '') : '';
        const av = after[f] ?? '';
        return String(bv) !== String(av);
    });
    if (changedFields.length === 0) return null;

    const pick = (obj) => {
        if (!obj) return null;
        const o = {};
        ATTENDANCE_LOG_FIELDS.forEach(f => { o[f] = obj[f] ?? ''; });
        return o;
    };

    return {
        log_type: 'attendance_edit',
        employee_id: employeeId,
        employee_name: meta.employeeName || '',
        date,
        edited_by_uid: meta.editorUid || '',
        edited_by_name: meta.editorName || '',
        edited_by_role: meta.editorRole || '',
        edited_at: new Date().toISOString(),
        source: meta.source || 'CALENDAR',
        before: pick(before),
        after: pick(after),
        changed_fields: changedFields,
        edit_reason: meta.editReason || ''
    };
}

async function writeEditLog(logEntry) {
    if (!logEntry) return;
    try {
        await addDoc(collection(db, 'attendance_edit_logs'), logEntry);
    } catch (err) {
        console.error('근태 수정 로그 저장 실패:', err);
    }
}

export function useAttendance() {
    const [attendance, setAttendance] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'attendance'),
            (snapshot) => {
                const data = {};
                snapshot.docs.forEach(d => {
                    // 문서 ID: 직원 numeric id (string), data: { records: { dateStr: record } }
                    const empId = parseInt(d.id);
                    data[empId] = d.data().records || {};
                });
                setAttendance(data);
                setLoading(false);
            },
            (err) => {
                console.error('attendance 구독 오류:', err);
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    const saveAttendance = useCallback(async (userId, date, record, logMeta) => {
        const docRef = doc(db, 'attendance', String(userId));
        await setDoc(docRef, { records: { [date]: record } }, { merge: true });

        if (logMeta) {
            const empId = typeof userId === 'string' ? parseInt(userId) : userId;
            const before = attendance[empId]?.[date] || null;
            const logEntry = buildEditLog(empId, date, before, record, logMeta);
            writeEditLog(logEntry);
        }
    }, [attendance]);

    // 일괄 가져오기 (마이그레이션용)
    const batchImport = useCallback(async (attendanceData) => {
        // attendanceData: { [userId]: { [dateStr]: record } }
        for (const [userId, records] of Object.entries(attendanceData)) {
            if (Object.keys(records).length === 0) continue;
            await setDoc(doc(db, 'attendance', String(userId)), { records });
        }
    }, []);

    return { attendance, loading, saveAttendance, batchImport };
}

export { buildEditLog, writeEditLog };
