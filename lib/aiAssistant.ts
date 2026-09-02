import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBrands, getLeads } from "@/lib/db";
import { getPublicEmployees } from "@/lib/auth";

function getLiveSystemTelemetry(): string {
  try {
    const brands = getBrands() || [];
    const leads = getLeads() || [];
    const employees = getPublicEmployees() || [];

    const brandNames = brands.map((b) => b.name).join(", ");
    const leadSummary = leads.map((l) => `${l.brandName || l.poc || "Lead"} (${l.status || "Pipeline"})`).join(", ");
    const employeeSummary = employees.map((e) => `${e.name} (${e.designation || e.role})`).join(", ");

    return `
CURRENT LIVE REAL-TIME DATABASE STATE:
- Total Active Brands: ${brands.length} brands (${brandNames || "None"}).
- Total Leads in Pipeline: ${leads.length} leads (${leadSummary || "None"}).
- Total Team Members: ${employees.length} members (${employeeSummary || "None"}).
`;
  } catch (e) {
    return "";
  }
}

const BASE_SYSTEM_INSTRUCTION = `You are "Ethers AI Assistant" (also called Ethers Copilot), an executive, sleek, and highly professional AI assistant built directly into the Ethers Dashboard for Ethers Consultancy.

CRITICAL RULES & FACTS:
1. COMPANY & LEADERSHIP:
   - Company: Ethers Consultancy (Premier F&B operations, menu engineering, and restaurant growth consultancy).
   - Co-Founders: Hemanya Gupta and Tanisha Maity.
   - Designed & Developed by: Anish Srivastava.
2. NO ASTERISKS & NO EMOJIS: Output 100% clean, normal, plain readable text. Do NOT use markdown asterisks (no double asterisks **, no single asterisks *), no hashtags, and NO emojis whatsoever.
3. DOMAIN & BUSINESS CONSULTING:
   - Answer questions regarding Ethers Dashboard, F&B operations, restaurant growth, menu engineering, profitability, pricing, and marketing.
   - If someone mentions "we are in loss" or asks for business advice, recommend strategic actions using Ethers modules:
     * Check Pricing Strategy to adjust online delivery hike margins.
     * Review Performance Reporting to identify discount burn and Swiggy/Zomato commission leakage.
     * Optimize high-margin dishes in Menu Automation.
4. OUT-OF-SCOPE REFUSAL:
   - If the user asks general politics (e.g., "Who is Modi?"), movies, or unrelated trivia, politely decline in clean plain text:
     "I only assist with Ethers Dashboard and F&B operational workflows. Please ask me about our dashboard modules or restaurant operations."
5. TONE & LENGTH: Keep your responses SHORT, CRISP, and CLASSY (2 to 4 sentences or clean plain bullet points).
6. BILINGUAL: If the user talks in English, respond in English. If the user talks in Hindi or Hinglish, respond in natural Hinglish.
7. REAL-TIME DATA: Use the live database state provided to answer accurately about brands, leads, and team members.

DASHBOARD MODULE KNOWLEDGE BASE:
- Pricing Strategy: Used to compare competitor prices, calculate online delivery hike margins, and optimize dish-level profitability against platform commissions.
- Marketing Strategy: Used to analyze promotional campaign ROI, discount burn percentages, and optimize Swiggy/Zomato ad spend.
- Menu Automation: AI-driven dish taxonomy, subcategories, price multipliers, and 1-click ready CSV exports for Swiggy/Zomato.
- Picture Automation: Automated photo resolution checks, image enhancement, and platform-compliant food image management.
- Hygiene Check: Instant visual audit of restaurant listings to check image completeness, banners, and listing health score.
- Performance Reporting: Reconciles Zomato & Swiggy payout statements (upload payout screenshot or PDF) and Dineout (upload CSV file).
- Employee Hub & Documents: Manage staff, issue Offer Letters (with 3 or 6 months commitment options), Experience/Internship Certificates with Date of Birth, and Payslips.
- Brands Directory: Manage onboarded restaurant brands, legal details (FSSAI, GST), drive assets, and contact info.
- Leads Section: Track prospective restaurant client pipelines, calls, and conversion stages.`;

function cleanPlainText(text: string): string {
  if (!text) return "";
  // Strip markdown asterisks, backticks, emojis, etc.
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/#/g, "")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();
}

function getLocalDynamicFallback(prompt: string): string {
  const lower = prompt.toLowerCase();
  
  if (lower.includes("cofounder") || lower.includes("co-founder") || lower.includes("founder")) {
    return "The co-founders of Ethers Consultancy are Hemanya Gupta and Tanisha Maity.";
  }

  if (["who developed", "who made", "developer", "creator", "developed you", "kisne banaya", "banaya kisne"].some((k) => lower.includes(k))) {
    return "I was designed and developed by Anish Srivastava.";
  }

  if (lower.includes("loss") || lower.includes("profit") || lower.includes("sales")) {
    return "To improve profitability, review your Discount Burn and platform deductions in Performance Reporting, adjust your online delivery hike margins in Pricing Strategy, and optimize high-margin dishes in Menu Automation.";
  }

  // Live dynamic Brands lookup
  if (lower.includes("brand") || lower.includes("kitne brand") || lower.includes("how many brand")) {
    const brands = getBrands() || [];
    const brandList = brands.map((b) => b.name).join(", ");
    return `There are currently ${brands.length} active brands in your directory: ${brandList}.`;
  }

  // Live dynamic Leads lookup
  if (lower.includes("lead") || lower.includes("pipeline")) {
    const leads = getLeads() || [];
    return `There are currently ${leads.length} leads in your active pipeline.`;
  }

  // Live dynamic Employees lookup
  if (lower.includes("employee") || lower.includes("team member") || lower.includes("headcount")) {
    const employees = getPublicEmployees() || [];
    return `There are currently ${employees.length} active team members in your roster.`;
  }

  if (lower.includes("pricing")) {
    return "Pricing Strategy is used to analyze competitor menus, calculate online delivery hike margins, and ensure dish profitability after Swiggy and Zomato commissions.";
  }

  if (lower.includes("marketing")) {
    return "Marketing Strategy helps you track promotional campaign ROI, discount burn rates, and plan high-conversion ad campaigns across Swiggy and Zomato.";
  }

  if (lower.includes("report") || lower.includes("payout")) {
    return "For Performance Reporting, simply upload your Zomato or Swiggy payout screenshot/PDF, or upload a CSV file for Dineout to reconcile net payouts and deductions.";
  }

  if (lower.includes("menu")) {
    return "Menu Automation allows you to structure dish taxonomies, apply online price hike percentages, and export ready-to-upload CSVs instantly.";
  }

  if (lower.includes("picture") || lower.includes("photo") || lower.includes("image")) {
    return "Picture Automation checks your food photography resolution, scales images, and ensures full compliance with Swiggy and Zomato guidelines.";
  }

  if (lower.includes("hygiene")) {
    return "Hygiene Check performs an audit of your restaurant storefront, checking photo completeness, banner hygiene, and overall listing health score.";
  }

  if (lower.includes("offer letter") || lower.includes("certificate") || lower.includes("document")) {
    return "In the Employee Hub, you can issue Offer Letters with 3/6-month commitments, Experience/Internship Certificates with Date of Birth, and generate official Payslips.";
  }

  // Check if out of scope
  const outOfScope = ["modi", "politics", "president", "weather", "cricket", "ipl", "movie", "song", "who is pm", "who is president"];
  if (outOfScope.some((k) => lower.includes(k))) {
    return "I only assist with Ethers Dashboard and F&B operational workflows. Please ask me about our dashboard modules or restaurant operations.";
  }

  return "I am your Ethers AI Copilot. You can ask me how any dashboard module works (Menu, Reporting, Hygiene Check, Pricing, Documents, Brands, and more).";
}

export async function generateEthersAiReply(
  prompt: string,
  history: Array<{ role: string; content: string }> = []
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const liveTelemetry = getLiveSystemTelemetry();
  const fullSystemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${liveTelemetry}`;

  if (!apiKey || apiKey.trim() === "") {
    return cleanPlainText(getLocalDynamicFallback(prompt));
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Primary: gemini-2.5-flash (verified working directly on this key)
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: fullSystemInstruction
      });

      // Limit history to last 6 messages to preserve low token consumption
      const recentHistory = history.slice(-6).map((h) => ({
        role: h.role === "assistant" || h.role === "model" ? "model" : "user",
        parts: [{ text: h.content }]
      }));

      const chat = model.startChat({
        history: recentHistory,
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7
        }
      });

      const result = await chat.sendMessage(prompt);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return cleanPlainText(text);
      }
    } catch (err: any) {
      console.warn(`[Ethers AI] ${modelName} call failed, trying next fallback:`, err?.message || err);
    }
  }

  // Fallback to local dynamic knowledge
  return cleanPlainText(getLocalDynamicFallback(prompt));
}
