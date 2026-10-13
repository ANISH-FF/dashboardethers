import fs from "fs";
import path from "path";

export interface ApiControlStatus {
  enabled: boolean;
  message: string;
}

export const DEFAULT_API_EXHAUSTED_MESSAGE =
  "You are currently out of API credits. Please contact the administrator to resume the service.";

/**
 * Returns current Gemini API control status.
 * Evaluates in order:
 * 1. Environment variable GEMINI_API_ENABLED in .env / process.env
 * 2. data/api_control.json on disk (hot toggleable from VPS without restarting server)
 */
export function getApiControlStatus(): ApiControlStatus {
  // 1. Environment variable check
  if (process.env.GEMINI_API_ENABLED !== undefined) {
    const envVal = process.env.GEMINI_API_ENABLED.trim().toLowerCase();
    if (envVal === "false" || envVal === "0" || envVal === "off" || envVal === "disabled") {
      return {
        enabled: false,
        message: process.env.GEMINI_API_DISABLED_MESSAGE || DEFAULT_API_EXHAUSTED_MESSAGE,
      };
    }
  }

  // 2. data/api_control.json file check (supports dynamic VPS switch)
  try {
    const configPath = path.join(process.cwd(), "data", "api_control.json");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.enabled === false) {
        return {
          enabled: false,
          message: parsed.message || DEFAULT_API_EXHAUSTED_MESSAGE,
        };
      }
    }
  } catch (err) {
    console.error("[ApiControl] Error checking api_control.json:", err);
  }

  return {
    enabled: true,
    message: DEFAULT_API_EXHAUSTED_MESSAGE,
  };
}

/**
 * Updates data/api_control.json on disk.
 */
export function setApiControlStatus(enabled: boolean, message?: string): void {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const configPath = path.join(dir, "api_control.json");
  const payload = {
    enabled,
    message: message || DEFAULT_API_EXHAUSTED_MESSAGE,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf-8");
}
