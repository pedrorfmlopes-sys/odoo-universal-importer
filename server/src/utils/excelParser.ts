import xlsx from 'xlsx';

export interface ParsedSheet {
    name: string;
    columns: string[];
    rowCount: number;
    rows: any[];
    previewRows: any[];
}

export interface ParsedWorkbook {
    sheets: ParsedSheet[];
    defaultSheet: string | null;
}

export const parseExcel = (filePath: string): ParsedWorkbook => {
    // Read the file
    const workbook = xlsx.readFile(filePath);

    // Parse all sheets
    const sheets: ParsedSheet[] = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];

        // Parse data as JSON (header: 0 / default assumes first row is header)
        // Using defval: "" to ensure empty cells are empty strings
        const jsonData: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

        // Extract headers from the keys of the first row (assuming consistent structure)
        let columns: string[] = [];
        if (jsonData.length > 0) {
            columns = Object.keys(jsonData[0]);
        }

        return {
            name: sheetName,
            columns,
            rowCount: jsonData.length,
            rows: jsonData,
            previewRows: jsonData.slice(0, 10)
        };
    });

    return {
        sheets,
        defaultSheet: sheets.length > 0 ? sheets[0].name : null
    };
};


