import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Single place every module calls into Gemini through --------------
// Never import this from a client component. It reads GEMINI_API_KEY
// from the server environment only.

import fs from "fs";
import path from "path";

function getApiKey(): string {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match && match[1] && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch (e) {}
  return process.env.GEMINI_API_KEY || "";
}

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
  }
  return new GoogleGenerativeAI(apiKey);
}

type CallOptions = {
  /** base64 image data (no data: prefix) for multimodal prompts */
  imageBase64?: string;
  imageMimeType?: string;
  /** ask Gemini to return strict JSON matching this shape description */
  expectJson?: boolean;
  /** turn on Google Search grounding, for real-world/current info lookups */
  useSearchGrounding?: boolean;
  temperature?: number;
};

export async function callGemini(prompt: string, options: CallOptions = {}): Promise<string> {
  const genAI = getClient();

  const generationConfig: any = {
    temperature: options.temperature ?? 0.4,
  };

  if (options.expectJson && !options.useSearchGrounding) {
    generationConfig.responseMimeType = "application/json";
  }

  const parts: any[] = [{ text: prompt }];
  if (options.imageBase64) {
    parts.unshift({
      inlineData: {
        data: options.imageBase64,
        mimeType: options.imageMimeType || "image/jpeg"
      }
    });
  }

  const candidateModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig,
        tools: options.useSearchGrounding ? [{ googleSearch: {} }] as any : undefined
      });

      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err: any) {
      console.warn(`Gemini model [${modelName}] failed (${err?.message || err}). Trying next model...`);
      if (i === candidateModels.length - 1) {
        throw new Error(`AI request failed (${err?.message || err}).`);
      }
    }
  }

  throw new Error("AI request failed.");
}

/** Calls Gemini expecting JSON back, parses it, and throws a clear error if it doesn't. */
export async function callGeminiJSON<T = any>(prompt: string, options: CallOptions = {}): Promise<T> {
  const raw = await callGemini(prompt, { ...options, expectJson: true });
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("AI returned an unexpected format. Please retry.");
  }
}
