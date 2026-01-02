
const XLSX = require('xlsx');
const path = require('path');

const filePath = "C:\\Users\\pedro\\OneDrive\\APPS\\GitHub\\odoo-universal-importer\\Fima_LISTA DE PRECIOS ITA_SPA 2023 2024.xlsx";

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log("Sheet Name:", sheetName);
    console.log("Total Rows:", rows.length);
    console.log("Columns:", Object.keys(rows[0] || {}));
    console.log("\nFirst 5 Rows Sample:");
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));

} catch (e) {
    console.error("Error reading file:", e.message);
}
