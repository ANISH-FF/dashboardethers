import { NextRequest, NextResponse } from "next/server";
import { getSession, getPublicEmployees } from "@/lib/auth";
import fs from "fs";
import path from "path";

const ACTIVITY_FILE = path.join(process.cwd(), "data", "activity.json");

function ensureActivityFile() {
  if (!fs.existsSync(ACTIVITY_FILE)) {
    const initial = {
      active_sessions: {},
      daily_logs: {}
    };
    fs.mkdirSync(path.dirname(ACTIVITY_FILE), { recursive: true });
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function readActivityData() {
  ensureActivityFile();
  try {
    const raw = fs.readFileSync(ACTIVITY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { active_sessions: {}, daily_logs: {} };
  }
}

function writeActivityData(data: any) {
  ensureActivityFile();
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // "2026-08-06"
}

// POST /api/activity — Receive 30-second heartbeat ping from active browser tab
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { current_section, active_seconds, idle } = body;

    const email = session.email.toLowerCase();
    const now = Date.now();
    const today = getTodayKey();

    const activityData = readActivityData();
    activityData.active_sessions = activityData.active_sessions || {};
    activityData.daily_logs = activityData.daily_logs || {};

    const sectionName = current_section || "Dashboard Overview";
    const deltaSecs = Number(active_seconds) > 0 ? Math.min(Number(active_seconds), 60) : 0;

    // Update active session info
    activityData.active_sessions[email] = {
      name: session.name,
      email: session.email,
      role: session.role,
      current_section: sectionName,
      last_ping: now,
      idle: !!idle
    };

    // Update daily log for today if not idle and tab was active
    if (!idle && deltaSecs > 0) {
      activityData.daily_logs[today] = activityData.daily_logs[today] || {};
      activityData.daily_logs[today][email] = activityData.daily_logs[today][email] || {
        name: session.name,
        email: session.email,
        total_seconds: 0,
        sections: {}
      };

      const userLog = activityData.daily_logs[today][email];
      userLog.total_seconds = (userLog.total_seconds || 0) + deltaSecs;
      userLog.sections[sectionName] = (userLog.sections[sectionName] || 0) + deltaSecs;
    }

    writeActivityData(activityData);

    return NextResponse.json({ ok: true, timestamp: now });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Heartbeat failed" }, { status: 500 });
  }
}

// GET /api/activity — Co-Founder / Admin Exclusive Activity Analytics
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Admins / Co-Founders can view complete team activity analytics
    const isAdmin = session.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Access restricted to Co-Founders and Admins." }, { status: 403 });
    }

    const activityData = readActivityData();
    const employees = getPublicEmployees();
    const now = Date.now();
    const today = getTodayKey();

    const todayLogs = (activityData.daily_logs && activityData.daily_logs[today]) || {};
    const activeSessions = activityData.active_sessions || {};

    const analyticsList = employees.map((emp: any) => {
      const emailKey = emp.email.toLowerCase();
      const sess = activeSessions[emailKey] || {};
      const userLog = todayLogs[emailKey] || { total_seconds: 0, sections: {} };

      // Online if pinged within last 75 seconds
      const isOnline = sess.last_ping ? (now - sess.last_ping < 75000) : false;
      const isIdle = !!sess.idle;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        designation: emp.designation || "Team Member",
        department: emp.department || "General Operations",
        isOnline: isOnline,
        isIdle: isIdle,
        currentSection: isOnline ? (sess.current_section || "Dashboard") : "Offline",
        lastSeen: sess.last_ping || 0,
        totalSecondsToday: userLog.total_seconds || 0,
        sectionsBreakdown: userLog.sections || {}
      };
    });

    // Compute overall company metrics
    const totalOnline = analyticsList.filter((e) => e.isOnline).length;
    const totalScreenTimeSecs = analyticsList.reduce((acc, curr) => acc + curr.totalSecondsToday, 0);

    // Find most used section across company
    const sectionTotals: Record<string, number> = {};
    analyticsList.forEach((emp) => {
      Object.entries(emp.sectionsBreakdown).forEach(([sec, secTime]) => {
        sectionTotals[sec] = (sectionTotals[sec] || 0) + (secTime as number);
      });
    });

    let topSection = "N/A";
    let topSecTime = 0;
    Object.entries(sectionTotals).forEach(([sec, secTime]) => {
      if (secTime > topSecTime) {
        topSection = sec;
        topSecTime = secTime;
      }
    });

    return NextResponse.json({
      summary: {
        totalEmployees: employees.length,
        totalOnline: totalOnline,
        totalScreenTimeSecs: totalScreenTimeSecs,
        topSection: topSection,
        sectionTotals: sectionTotals
      },
      employeesActivity: analyticsList
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load activity analytics" }, { status: 500 });
  }
}
