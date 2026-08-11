/**
 * Utility functions for parsing transaction dates and filtering rows by target date range/month.
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2, mar26: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseTransactionDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    // Excel serial number timestamp
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(jsDate.getTime()) ? null : jsDate;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Standard Date parse (YYYY-MM-DD or ISO)
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try parsing DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY HH:mm:ss
  const parts = str.split(/[\/\-\s:]/);
  if (parts.length >= 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    let p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p1 > 31) {
        // YYYY-MM-DD
        return new Date(p1, p2 - 1, p3);
      } else if (p3 > 1000 || p3 < 100) {
        // DD-MM-YYYY or DD-MM-YY
        if (p3 < 100) p3 += 2000;
        return new Date(p3, p2 - 1, p1);
      }
    }
  }
  return null;
}

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
  fileName?: string;
}

export interface FilterResult<T> {
  filteredRows: T[];
  totalRows: number;
  excludedRows: number;
  dominantMonthLabel?: string;
}

export function filterTransactionRows<T extends Record<string, any>>(
  rows: T[],
  opts: FilterOptions = {}
): FilterResult<T> {
  const { startDate, endDate, periodLabel, fileName } = opts;

  // 1. Identify valid data rows with dates
  const parsedRows: { row: T; dateObj: Date }[] = [];
  for (const r of rows) {
    // Check common date field names across Zomato & Swiggy formats
    const rawDate =
      r["Date and time"] ||
      r["Date & Time"] ||
      r["Date"] ||
      r["Transaction Date"] ||
      r["Transaction Date & Time"] ||
      r["Transaction Time"] ||
      r["Order Date"] ||
      r["Payment Date"] ||
      r["UTR Date"] ||
      r["Settlement date"];

    const dateObj = parseTransactionDate(rawDate);
    if (dateObj) {
      parsedRows.push({ row: r, dateObj });
    }
  }

  // If no dates found, return original rows unchanged
  if (parsedRows.length === 0) {
    return { filteredRows: rows, totalRows: rows.length, excludedRows: 0 };
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  // Strategy A: Explicit Start & End Date provided by user
  if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
    const matched = parsedRows.filter(
      (item) => item.dateObj >= start && item.dateObj <= end
    );
    const filteredRows = matched.map((m) => m.row);
    return {
      filteredRows,
      totalRows: parsedRows.length,
      excludedRows: parsedRows.length - filteredRows.length,
    };
  }

  // Helper: Parse day ranges like '1-10', '11-20', '21-31' from periodLabel
  function parseDayRangeFromLabel(label: string) {
    if (!label) return null;
    const str = String(label).toLowerCase();
    const rangeMatch = str.match(/\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2}|end)\b/i);
    if (rangeMatch) {
      const startDay = parseInt(rangeMatch[1], 10);
      let endDay = rangeMatch[2] === "end" ? 31 : parseInt(rangeMatch[2], 10);
      if (
        !isNaN(startDay) &&
        !isNaN(endDay) &&
        startDay >= 1 &&
        startDay <= 31 &&
        endDay >= startDay &&
        endDay <= 31
      ) {
        return { startDay, endDay };
      }
    }
    return null;
  }

  // Strategy B: Match month + optional day range specified in periodLabel or fileName (e.g. "March", "1-10 Aug", "11-20 July")
  const labelStr = `${periodLabel || ""} ${fileName || ""}`.toLowerCase();
  const dayRange = parseDayRangeFromLabel(periodLabel || "") || parseDayRangeFromLabel(fileName || "");
  let targetMonth = -1;

  for (const [mName, mIdx] of Object.entries(MONTH_MAP)) {
    const reg = new RegExp(`\\b${mName}\\b`, "i");
    if (reg.test(labelStr)) {
      targetMonth = mIdx;
      break;
    }
  }

  if (targetMonth !== -1) {
    const monthMatched = parsedRows.filter((item) => {
      const matchesMonth = item.dateObj.getMonth() === targetMonth;
      if (!matchesMonth) return false;

      if (dayRange) {
        const day = item.dateObj.getDate();
        return day >= dayRange.startDay && day <= dayRange.endDay;
      }
      return true;
    });

    if (monthMatched.length > 0) {
      const filteredRows = monthMatched.map((m) => m.row);
      return {
        filteredRows,
        totalRows: parsedRows.length,
        excludedRows: parsedRows.length - filteredRows.length,
      };
    }
  }

  // Strategy C: Smart Dominant Month Fallback
  // Auto-detect the month with the majority of transactions and exclude edge/overlap dates
  const monthCounts: Record<string, number> = {};
  parsedRows.forEach((item) => {
    const key = `${item.dateObj.getFullYear()}-${item.dateObj.getMonth()}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });

  let dominantKey: string | null = null;
  let maxCount = 0;
  for (const [k, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = k;
    }
  }

  if (dominantKey && maxCount / parsedRows.length > 0.4) {
    const dominantMatched = parsedRows.filter(
      (item) =>
        `${item.dateObj.getFullYear()}-${item.dateObj.getMonth()}` === dominantKey
    );
    const filteredRows = dominantMatched.map((m) => m.row);
    return {
      filteredRows,
      totalRows: parsedRows.length,
      excludedRows: parsedRows.length - filteredRows.length,
    };
  }

  // Default fallback: return all parsed rows
  return {
    filteredRows: parsedRows.map((p) => p.row),
    totalRows: parsedRows.length,
    excludedRows: 0,
  };
}
