import { NextRequest, NextResponse } from "next/server";
import { getSession, getPublicEmployees } from "@/lib/auth";
import { generateEthersAiReply } from "@/lib/aiAssistant";
import fs from "fs";
import path from "path";

const CHAT_FILE = path.join(process.cwd(), "data", "chat.json");
const ACTIVITY_FILE = path.join(process.cwd(), "data", "activity.json");

function ensureChatFile() {
  if (!fs.existsSync(CHAT_FILE)) {
    const initial = {
      channels: [
        { id: "general", name: "general", description: "Company-wide announcements & discussions", created_at: new Date().toISOString() },
        { id: "growth-team", name: "growth-team", description: "Marketing, pricing & growth strategy", created_at: new Date().toISOString() },
        { id: "tech-ops", name: "tech-ops", description: "Automation & system operations", created_at: new Date().toISOString() }
      ],
      messages: [],
      direct_messages: []
    };
    fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true });
    fs.writeFileSync(CHAT_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function readChatData() {
  ensureChatFile();
  try {
    const raw = fs.readFileSync(CHAT_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { channels: [], messages: [], direct_messages: [] };
  }
}

function writeChatData(data: any) {
  ensureChatFile();
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function getOnlineStatuses() {
  if (!fs.existsSync(ACTIVITY_FILE)) return {};
  try {
    const raw = fs.readFileSync(ACTIVITY_FILE, "utf-8");
    const data = JSON.parse(raw);
    const now = Date.now();
    const statuses: Record<string, { online: boolean; section: string; idle: boolean; last_seen: number }> = {};

    if (data.active_sessions) {
      Object.entries(data.active_sessions).forEach(([email, session]: [string, any]) => {
        const diff = now - session.last_ping;
        // Online if pinged in the last 75 seconds
        const online = diff < 75000;
        statuses[email.toLowerCase()] = {
          online,
          section: session.current_section || "Dashboard",
          idle: !!session.idle,
          last_seen: session.last_ping
        };
      });
    }
    return statuses;
  } catch (e) {
    return {};
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("type") || "channel"; // "channel" or "dm"
    const targetId = searchParams.get("target") || "general"; // channel_id or employee_email

    const chatData = readChatData();
    const employees = getPublicEmployees();
    const onlineStatuses = getOnlineStatuses();

    // Map employees with online presence
    const userList = employees.map((emp: any) => {
      const statusInfo = onlineStatuses[emp.email.toLowerCase()] || {
        online: false,
        section: "Offline",
        idle: false,
        last_seen: 0
      };
      return {
        ...emp,
        isOnline: statusInfo.online,
        isIdle: statusInfo.idle,
        activeSection: statusInfo.section,
        lastSeen: statusInfo.last_seen
      };
    });

    // Pinned AI Assistant contact
    const aiUser = {
      id: "ethers-ai-assistant",
      name: "Ethers AI Assistant",
      email: "assistant@ethers.ai",
      role: "ai",
      designation: "Intelligent Dashboard Copilot",
      isOnline: true,
      isIdle: false,
      isAi: true,
      activeSection: "24/7 AI Engine",
      lastSeen: Date.now()
    };

    const finalUserList = [aiUser, ...userList];

    let relevantMessages = [];
    const currentUserEmail = session.email.toLowerCase();

    // All messages relevant to the current user (all channel msgs + DMs sent to/by current user)
    const allUserMessages = [
      ...(chatData.messages || []),
      ...(chatData.direct_messages || []).filter(
        (m: any) =>
          m.sender_email.toLowerCase() === currentUserEmail ||
          m.recipient_email.toLowerCase() === currentUserEmail
      ),
    ];

    if (targetType === "channel") {
      relevantMessages = (chatData.messages || []).filter(
        (m: any) => m.channel_id === targetId
      );
    } else if (targetType === "dm") {
      const otherUserEmail = targetId.toLowerCase();

      relevantMessages = (chatData.direct_messages || []).filter(
        (m: any) =>
          (m.sender_email.toLowerCase() === currentUserEmail && m.recipient_email.toLowerCase() === otherUserEmail) ||
          (m.sender_email.toLowerCase() === otherUserEmail && m.recipient_email.toLowerCase() === currentUserEmail)
      );
    }

    return NextResponse.json({
      currentUser: {
        email: session.email,
        name: session.name,
        role: session.role
      },
      channels: chatData.channels || [],
      users: finalUserList,
      messages: relevantMessages,
      allUserMessages: allUserMessages
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch chat data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, channel_name, description, target_type, target_id, content } = body;

    const chatData = readChatData();

    if (action === "create_channel") {
      if (!channel_name || !channel_name.trim()) {
        return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
      }
      const slug = channel_name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      const existing = (chatData.channels || []).find((c: any) => c.id === slug);
      if (existing) {
        return NextResponse.json({ error: "Channel already exists" }, { status: 400 });
      }
      const newChannel = {
        id: slug,
        name: slug,
        description: description || "",
        created_at: new Date().toISOString()
      };
      chatData.channels = chatData.channels || [];
      chatData.channels.push(newChannel);
      writeChatData(chatData);
      return NextResponse.json({ ok: true, channel: newChannel });
    }

    // Default action: Send Message
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const newMsg = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      sender_email: session.email,
      sender_name: session.name,
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    const currentUserEmail = session.email.toLowerCase();

    if (target_type === "channel") {
      (newMsg as any).channel_id = target_id;
      chatData.messages = chatData.messages || [];
      chatData.messages.push(newMsg);
      writeChatData(chatData);
      return NextResponse.json({ ok: true, message: newMsg });
    } else {
      (newMsg as any).recipient_email = target_id;
      chatData.direct_messages = chatData.direct_messages || [];
      chatData.direct_messages.push(newMsg);

      // If user is talking to Ethers AI Assistant
      if (target_id.toLowerCase() === "assistant@ethers.ai") {
        // Collect recent history between this user and AI
        const history = (chatData.direct_messages || [])
          .filter(
            (m: any) =>
              (m.sender_email.toLowerCase() === currentUserEmail && m.recipient_email.toLowerCase() === "assistant@ethers.ai") ||
              (m.sender_email.toLowerCase() === "assistant@ethers.ai" && m.recipient_email.toLowerCase() === currentUserEmail)
          )
          .map((m: any) => ({
            role: m.sender_email.toLowerCase() === "assistant@ethers.ai" ? "assistant" : "user",
            content: m.content
          }));

        const aiReplyText = await generateEthersAiReply(content.trim(), history);

        const aiMsg = {
          id: "msg_ai_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          sender_email: "assistant@ethers.ai",
          sender_name: "Ethers AI Assistant",
          recipient_email: session.email,
          content: aiReplyText,
          timestamp: new Date().toISOString()
        };

        chatData.direct_messages.push(aiMsg);
        writeChatData(chatData);

        return NextResponse.json({ ok: true, message: newMsg, reply: aiMsg });
      }

      writeChatData(chatData);
      return NextResponse.json({ ok: true, message: newMsg });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process chat request" }, { status: 500 });
  }
}
