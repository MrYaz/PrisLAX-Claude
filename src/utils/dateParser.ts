const MONTH_NAMES: Record<string, string> = {
  januari: '01', februari: '02', mars: '03', april: '04',
  maj: '05', juni: '06', juli: '07', augusti: '08',
  september: '09', oktober: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09',
  okt: '10', nov: '11', dec: '12',
};

/**
 * Try to extract a date from a filename.
 * Supports formats like:
 *   260101, 26_01_03, 2026-01-01, 1.1.2026,
 *   januari 2026, jan 2026, jan_2026, etc.
 * Returns ISO date string (YYYY-MM-DD) or empty string.
 */
export function parseDateFromFilename(filename: string): string {
  // Strip extension
  const name = filename.replace(/\.[^.]+$/, '');

  // Try YYYY-MM-DD or YYYY_MM_DD or YYYY.MM.DD
  const isoMatch = name.match(/(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (isoMatch) {
    return formatDate(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  // Try DD-MM-YYYY or DD.MM.YYYY or DD_MM_YYYY
  const dmy = name.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/);
  if (dmy) {
    return formatDate(dmy[3], dmy[2], dmy[1]);
  }

  // Try YYMMDD (6 digits, YY >= 20)
  const compact6 = name.match(/(?:^|[^0-9])(\d{2})(\d{2})(\d{2})(?:$|[^0-9])/);
  if (compact6) {
    const yy = parseInt(compact6[1]);
    if (yy >= 20 && yy <= 40) {
      return formatDate('20' + compact6[1], compact6[2], compact6[3]);
    }
  }

  // Try YY_MM_DD or YY-MM-DD
  const shortYmd = name.match(/(?:^|[^0-9])(\d{2})[-_](\d{1,2})[-_](\d{1,2})(?:$|[^0-9])/);
  if (shortYmd) {
    const yy = parseInt(shortYmd[1]);
    if (yy >= 20 && yy <= 40) {
      return formatDate('20' + shortYmd[1], shortYmd[2], shortYmd[3]);
    }
  }

  // Try "month YYYY" or "month_YYYY" (Swedish)
  const monthYear = name.toLowerCase().match(
    /\b(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|dec)[\s_-]*(\d{4})\b/
  );
  if (monthYear) {
    const mm = MONTH_NAMES[monthYear[1]];
    if (mm) return `${monthYear[2]}-${mm}-01`;
  }

  // Try "month YY"
  const monthShortYear = name.toLowerCase().match(
    /\b(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|dec)[\s_-]*(\d{2})\b/
  );
  if (monthShortYear) {
    const yy = parseInt(monthShortYear[2]);
    if (yy >= 20 && yy <= 40) {
      const mm = MONTH_NAMES[monthShortYear[1]];
      if (mm) return `20${monthShortYear[2]}-${mm}-01`;
    }
  }

  return '';
}

function formatDate(yyyy: string, mm: string, dd: string): string {
  const y = parseInt(yyyy);
  const m = parseInt(mm);
  const d = parseInt(dd);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${yyyy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Build the export filename:
 * "leverantörensnamn_prislista_konverterad_2026-01-01.xlsx"
 */
export function buildExportFilename(supplierName: string, sourceFilename: string): string {
  const date = parseDateFromFilename(sourceFilename) || todayISO();
  const safeName = supplierName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-zåäö0-9_-]/g, '');
  return `${safeName}_prislista_konverterad_${date}.xlsx`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
