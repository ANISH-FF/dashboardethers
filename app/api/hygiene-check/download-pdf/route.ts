import { NextRequest, NextResponse } from "next/server";
import { generateSingleAuditReportHtml, generateDualComparisonReportHtml } from "@/lib/hygieneReportHtmlTemplate";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

function getBrowserExecutable(): string {
  const winEdge = `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`;
  if (fs.existsSync(winEdge)) return winEdge;

  const winChrome = `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`;
  if (fs.existsSync(winChrome)) return winChrome;

  try {
    const whichChromium = execSync("which google-chrome || which chromium-browser || which chromium", { encoding: "utf-8" }).trim();
    if (whichChromium) return whichChromium;
  } catch (e) {}

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!data) {
      return NextResponse.json({ error: "Missing report payload data" }, { status: 400 });
    }

    let htmlContent = "";
    let safeName = "Hygiene_Audit";

    if (type === "dual") {
      htmlContent = generateDualComparisonReportHtml(data);
      safeName = (data.comparison?.restaurant_name || "Restaurant").replace(/[^a-zA-Z0-9_-]/g, "_") + "_Zomato_vs_Swiggy_Audit";
    } else {
      htmlContent = generateSingleAuditReportHtml(data);
      safeName = (data.restaurant_name || "Restaurant").replace(/[^a-zA-Z0-9_-]/g, "_") + "_Hygiene_Audit";
    }

    const tmpDir = os.tmpdir();
    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const htmlPath = path.join(tmpDir, `report_${uniqueId}.html`);
    const pdfPath = path.join(tmpDir, `report_${uniqueId}.pdf`);

    fs.writeFileSync(htmlPath, htmlContent, "utf-8");

    const browserExe = getBrowserExecutable();
    if (!browserExe) {
      return new NextResponse(htmlContent, {
        headers: { "Content-Type": "text/html" }
      });
    }

    const cmd = `"${browserExe}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --include-background --no-margins "file:///${htmlPath.replace(/\\/g, "/")}"`;
    execSync(cmd, { stdio: "ignore" });

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: "Failed to render Hygiene PDF output file" }, { status: 500 });
    }

    const pdfBuffer = fs.readFileSync(pdfPath);

    try {
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch (e) {}

    const fileName = `${safeName}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString()
      }
    });
  } catch (err: any) {
    console.error("Hygiene PDF Generation Error:", err);
    return NextResponse.json({ error: err.message || "PDF Generation failed" }, { status: 500 });
  }
}
