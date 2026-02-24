// src/utils/csvUtils.js
import * as XLSX from 'xlsx';

export const escapeCsvField = (field) => {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

export const readFileData = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', codepage: 949 });
                let allRows = [];
                let headerRow = null;

                workbook.SheetNames.forEach((sheetName, idx) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
                    if (rows.length === 0) return;
                    if (idx === 0) {
                        allRows = [...rows];
                        headerRow = rows[0];
                    } else {
                        const firstRow = rows[0];
                        const isHeader = headerRow && firstRow &&
                            headerRow.length === firstRow.length &&
                            headerRow.every((h, i) => String(h).trim() === String(firstRow[i]).trim());
                        allRows.push(...rows.slice(isHeader ? 1 : 0));
                    }
                });
                resolve(allRows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
    });
};
