const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Valid CSV
const validCsv = `Student Name,Course,Completion Date
Pooja Varma,Revit Architecture & BIM,2026-09-15
Karan Joshi,AutoCAD 2D & 3D,2026-08-20
Ananya Sharma,SketchUp & Interior Design,2026-10-05`;
fs.writeFileSync(path.join(__dirname, 'test_students.csv'), validCsv, 'utf8');

// 2. Valid XLSX
const wsData = [
    ['Student Name', 'Course', 'Completion Date'],
    ['Pooja Varma', 'Revit Architecture & BIM', '2026-09-15'],
    ['Karan Joshi', 'AutoCAD 2D & 3D', '2026-08-20'],
    ['Ananya Sharma', 'SketchUp & Interior Design', '2026-10-05']
];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, 'Students');
XLSX.writeFile(wb, path.join(__dirname, 'test_students.xlsx'));

// 3. Missing Column CSV (no Course column)
const missingColCsv = `Student Name,Completion Date
Pooja Varma,2026-09-15
Karan Joshi,2026-08-20`;
fs.writeFileSync(path.join(__dirname, 'test_missing_column.csv'), missingColCsv, 'utf8');

// 4. Missing Column XLSX
const wsMissingData = [
    ['Student Name', 'Completion Date'],
    ['Pooja Varma', '2026-09-15']
];
const wbMissing = XLSX.utils.book_new();
const wsMissing = XLSX.utils.aoa_to_sheet(wsMissingData);
XLSX.utils.book_append_sheet(wbMissing, wsMissing, 'Students');
XLSX.writeFile(wbMissing, path.join(__dirname, 'test_missing_column.xlsx'));

console.log('Test spreadsheets generated successfully.');
