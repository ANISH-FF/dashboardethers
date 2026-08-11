import fs from "fs";
import path from "path";
import { BrandMarketingStrategyData } from "./marketingStrategy";

const STRATEGY_FILE_PATH = path.join(process.cwd(), "data", "marketing_strategy.json");

export function getBrandMarketingStrategyStore(): Record<string, BrandMarketingStrategyData> {
  try {
    if (fs.existsSync(STRATEGY_FILE_PATH)) {
      const fileData = fs.readFileSync(STRATEGY_FILE_PATH, "utf-8");
      return JSON.parse(fileData);
    }
  } catch (err) {
    console.error("Failed to read marketing_strategy.json:", err);
  }
  return {};
}

export function saveBrandMarketingStrategy(data: BrandMarketingStrategyData): BrandMarketingStrategyData {
  const store = getBrandMarketingStrategyStore();
  const updatedData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  store[data.brandId] = updatedData;

  const dataDir = path.dirname(STRATEGY_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(STRATEGY_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  return updatedData;
}
