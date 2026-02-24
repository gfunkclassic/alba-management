// src/utils/dateUtils.js

export const getMonthsBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

export const getDaysBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
};

export const normalizeDateStr = (dateStr) => {
    if (!dateStr) return '';

    let str = String(dateStr).trim();

    // Excel serial date 처리
    if (!isNaN(str) && Number(str) > 30000 && Number(str) < 80000) {
        const d = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }

    // 1. YYYYMMDD 8자리 숫자인 경우 바로 변환
    if (/^\d{8}$/.test(str)) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }

    // 2. 공백, 점(.), 슬래시(/), 한글(년,월,일)을 하이픈(-)으로 통일
    let normalized = str.replace(/[\s./년월일]+/g, '-');

    if (normalized.endsWith('-')) normalized = normalized.slice(0, -1);
    if (normalized.startsWith('-')) normalized = normalized.slice(1);

    // 3. 패턴 분해해서 정확한 Y, M, D 유추
    const parts = normalized.split('-');
    if (parts.length === 3) {
        let [p1, p2, p3] = parts;
        let y, m, d;

        if (p1.length === 4) {
            y = p1; m = p2; d = p3;
        } else if (p3.length === 4) {
            y = p3; m = p1; d = p2;
        } else {
            const n1 = parseInt(p1);
            const n3 = parseInt(p3);
            if (n3 > 31) {
                y = `20${p3.padStart(2, '0')}`; m = p1; d = p2;
            } else if (n1 > 31) {
                y = `20${p1.padStart(2, '0')}`; m = p2; d = p3;
            } else {
                if (n3 >= 20 && n3 <= 31 && n1 <= 12) {
                    y = `20${p3.padStart(2, '0')}`; m = p1; d = p2;
                } else {
                    y = `20${p1.padStart(2, '0')}`; m = p2; d = p3;
                }
            }
        }

        m = m.padStart(2, '0');
        d = d.padStart(2, '0');
        const dateObj = new Date(`${y}-${m}-${d}`);
        if (isNaN(dateObj.getTime())) return normalized;
        return `${y}-${m}-${d}`;
    }
    return normalized;
};
