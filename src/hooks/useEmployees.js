import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export function useEmployees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'employees'),
            (snapshot) => {
                const data = snapshot.docs
                    .map(d => ({ ...d.data() }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0));
                setEmployees(data);
                setLoading(false);
            },
            (err) => {
                console.error('employees 구독 오류:', err);
                setLoading(false);
            }
        );
        return unsub;
    }, []);

    const addEmployee = useCallback(async (employee) => {
        await setDoc(doc(db, 'employees', String(employee.id)), employee);
    }, []);

    const updateEmployee = useCallback(async (employee) => {
        await setDoc(doc(db, 'employees', String(employee.id)), employee);
    }, []);

    const deleteEmployee = useCallback(async (employeeId) => {
        await deleteDoc(doc(db, 'employees', String(employeeId)));
    }, []);

    // 일괄 가져오기 (마이그레이션용)
    const batchImport = useCallback(async (users) => {
        const BATCH_SIZE = 400;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            users.slice(i, i + BATCH_SIZE).forEach(user => {
                batch.set(doc(db, 'employees', String(user.id)), user);
            });
            await batch.commit();
        }
    }, []);

    return { employees, loading, addEmployee, updateEmployee, deleteEmployee, batchImport };
}
