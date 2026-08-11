import fs from "fs";
import path from "path";
import { ReportingStore, MonthlyRollupRecord } from "./reporting-types";

export * from "./reporting-types";

const DATA_FILE = path.join(process.cwd(), "data", "reporting.json");

export function getReportingStore(): ReportingStore {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial: ReportingStore = {
        zomato_delivery: [],
        swiggy_delivery: [],
        zomato_dinein: [],
        swiggy_dineout: [],
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    return {
      zomato_delivery: data.zomato_delivery || [],
      swiggy_delivery: data.swiggy_delivery || [],
      zomato_dinein: data.zomato_dinein || [],
      swiggy_dineout: data.swiggy_dineout || [],
    };
  } catch (err) {
    console.error("Error reading reporting store:", err);
    return {
      zomato_delivery: [],
      swiggy_delivery: [],
      zomato_dinein: [],
      swiggy_dineout: [],
    };
  }
}

export function saveReportingStore(store: ReportingStore) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing reporting store:", err);
  }
}

const ROLLUPS_FILE = path.join(process.cwd(), "data", "monthly_rollups.json");

export function getMonthlyRollupStore(): MonthlyRollupRecord[] {
  try {
    if (!fs.existsSync(ROLLUPS_FILE)) {
      const dir = path.dirname(ROLLUPS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROLLUPS_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(ROLLUPS_FILE, "utf-8");
    return JSON.parse(raw) as MonthlyRollupRecord[];
  } catch (err) {
    console.error("Error reading monthly rollups store:", err);
    return [];
  }
}

export function saveMonthlyRollupRecord(record: MonthlyRollupRecord) {
  try {
    const list = getMonthlyRollupStore();
    const existingIdx = list.findIndex(
      (r) => r.brandId === record.brandId && r.monthName === record.monthName && r.section === record.section
    );

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }

    fs.writeFileSync(ROLLUPS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving monthly rollup record:", err);
  }
}

export function getMonthlyRollupsForBrand(brandId: string): MonthlyRollupRecord[] {
  const list = getMonthlyRollupStore();
  return list.filter((r) => r.brandId === brandId);
}

export function deleteMonthlyRollupRecord(id: string) {
  try {
    const list = getMonthlyRollupStore().filter((r) => r.id !== id);
    fs.writeFileSync(ROLLUPS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Error deleting monthly rollup record:", err);
  }
}
