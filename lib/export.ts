import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Row = Record<string, string | number>;

export function exportCSV(rows: Row[], filename: string) {
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  downloadBlob(lines.join("\n"), `${filename}.csv`, "text/csv");
}

export function exportExcel(rows: Row[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Content Plans");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF(rows: Row[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  const headers = Object.keys(rows[0] ?? {});
  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [28, 27, 25] },
  });
  doc.save(`${filename}.pdf`);
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
