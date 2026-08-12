import { NextRequest, NextResponse } from "next/server";
import { getDocuments } from "@/lib/documents";
import { generateDocumentHtml } from "@/lib/documentHtmlTemplate";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

function getBrowserExecutable(): string {
  // Check Windows Edge/Chrome
  const winEdge = `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`;
  if (fs.existsSync(winEdge)) return winEdge;

  const winChrome = `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`;
  if (fs.existsSync(winChrome)) return winChrome;

  // Check Linux Chromium
  try {
    const whichChromium = execSync("which google-chrome || which chromium-browser || which chromium", { encoding: "utf-8" }).trim();
    if (whichChromium) return whichChromium;
  } catch (e) {}

  return "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const documents = getDocuments();
    const doc = documents.find((d) => d.id === id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const htmlContent = generateDocumentHtml(doc);
    const tmpDir = os.tmpdir();
    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const htmlPath = path.join(tmpDir, `doc_${uniqueId}.html`);
    const pdfPath = path.join(tmpDir, `doc_${uniqueId}.pdf`);

    // Write HTML file
    fs.writeFileSync(htmlPath, htmlContent, "utf-8");

    const browserExe = getBrowserExecutable();
    if (!browserExe) {
      // Fallback: If no headless browser is available, return HTML for native browser print
      return new NextResponse(htmlContent, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // Run headless browser to print to PDF
    const cmd = `"${browserExe}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --include-background --no-margins "file:///${htmlPath.replace(/\\/g, "/")}"`;
    execSync(cmd, { stdio: "ignore" });

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: "Failed to render PDF output file" }, { status: 500 });
    }

    const pdfBuffer = fs.readFileSync(pdfPath);

    // Clean up temporary files
    try {
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch (e) {}

    const safeName = (doc.employeeName || "Employee").replace(/\s+/g, "_");
    const safeTitle = (doc.title || "Document").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeName}_${safeTitle}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString()
      }
    });
  } catch (err: any) {
    console.error("PDF API Error:", err);
    return NextResponse.json({ error: err.message || "PDF Generation failed" }, { status: 500 });
  }
}
