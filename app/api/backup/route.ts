import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

const DATA_DIR = path.join(process.cwd(), "data");

const DATA_FILES = [
  "employees.json",
  "documents.json",
  "leads.json",
  "chat.json",
  "activity.json",
  "settings.json",
  "discrepancies.json",
  "marketing_strategy.json",
  "reporting.json",
  "menu.json",
  "monthly_rollups.json",
  "pricing_strategy_store.json",
  "discount_calculator_store.json",
  "projections/projections_state.json",
  "campaigns.json"
];

function readJsonFile(fileName: string) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeJsonFile(fileName: string, data: any) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

// GET: Download complete company database backup (Co-Founders / Admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "admin") {
      return NextResponse.json({ error: "Access Denied: Backup export is restricted to Co-Founders only." }, { status: 403 });
    }
    const backupBundle: Record<string, any> = {
      meta: {
        company: "Ethers Consultancy",
        exportedAt: new Date().toISOString(),
        version: "2.0.0",
        system: "Ethers F&B Operations Suite"
      },
      datasets: {}
    };

    let totalRecords = 0;

    for (const fileName of DATA_FILES) {
      const data = readJsonFile(fileName);
      if (data !== null) {
        backupBundle.datasets[fileName] = data;
        if (Array.isArray(data)) {
          totalRecords += data.length;
        } else if (typeof data === "object") {
          totalRecords += Object.keys(data).length;
        }
      }
    }

    backupBundle.meta.totalRecords = totalRecords;

    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `ethers_full_company_backup_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupBundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate company backup." }, { status: 500 });
  }
}

// POST: Restore company database from backup (Co-Founders / Admin only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (session && session.role !== "admin") {
      return NextResponse.json({ error: "Access Denied: Database restore is restricted to Co-Founders only." }, { status: 403 });
    }
    const body = await req.json();
    if (!body || !body.datasets) {
      return NextResponse.json({ error: "Invalid backup file format." }, { status: 400 });
    }

    let restoredFilesCount = 0;
    const datasets = body.datasets;

    for (const fileName of DATA_FILES) {
      if (datasets[fileName] !== undefined) {
        const success = writeJsonFile(fileName, datasets[fileName]);
        if (success) restoredFilesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${restoredFilesCount} database collections.`,
      exportedAt: body.meta?.exportedAt || "Unknown Date",
      restoredFilesCount
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to restore backup file." }, { status: 500 });
  }
}
