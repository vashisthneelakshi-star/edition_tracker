import ExcelJS from 'exceljs';

const THIN_BORDER = { style: 'thin', color: { argb: 'FFCBCBCB' } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16213E' } };
const LATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE6E5' } };
const EARLY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F5EA' } };
const ONTIME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF9' } };

// columns: [{ header, key, width }]
// rows: array of plain objects matching keys
// delayKey: which column key holds the numeric delay_minutes value (for color coding that cell + row highlight)
export async function exportStyledExcel({ filename, sheetName = 'Report', columns, rows, delayKey }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
  });
  headerRow.height = 22;

  rows.forEach(r => {
    const row = sheet.addRow(r);
    const delayVal = delayKey ? r[delayKey] : null;

    row.eachCell(cell => {
      cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
      cell.alignment = { vertical: 'middle' };
    });

    if (delayKey && typeof delayVal === 'number') {
      const delayCell = row.getCell(columns.findIndex(c => c.key === delayKey) + 1);
      if (delayVal > 0) {
        delayCell.fill = LATE_FILL;
        delayCell.font = { color: { argb: 'FFB3261E' }, bold: true };
      } else if (delayVal < 0) {
        delayCell.fill = EARLY_FILL;
        delayCell.font = { color: { argb: 'FF1A6E3C' }, bold: true };
      } else {
        delayCell.fill = ONTIME_FILL;
        delayCell.font = { color: { argb: 'FF2C4A8A' }, bold: true };
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
