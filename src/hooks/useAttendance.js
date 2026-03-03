import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

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

    const saveAttendance = useCallback(async (userId, date, record) => {
        const docRef = doc(db, 'attendance', String(userId));
        await setDoc(docRef, { records: { [date]: record } }, { merge: true });
    }, []);

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
