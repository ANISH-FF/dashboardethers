"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Users, Circle, Minimize2, ExternalLink, Sparkles, Volume2 } from "lucide-react";
import Link from "next/link";

interface UserStatus {
  email: string;
  name: string;
  role: string;
  isOnline: boolean;
  isIdle: boolean;
  activeSection: string;
  lastSeen: number;
}

interface Message {
  id: string;
  sender_email: string;
  sender_name: string;
  recipient_email?: string;
  channel_id?: string;
  content: string;
  timestamp: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
}

export function GlobalQuickChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [targetType, setTargetType] = useState<"channel" | "dm">("channel");
  const [targetId, setTargetId] = useState<string>("general");

  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);

  const [toastMsg, setToastMsg] = useState<{ sender: string; text: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll chat data every 4 seconds
  useEffect(() => {
    fetchChatData();
    const interval = setInterval(() => {
      fetchChatData();
    }, 4000);
    return () => clearInterval(interval);
  }, [targetType, targetId]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const now = ctx.currentTime;
      // High-pitched soft pop tone C6 (1046.5Hz) -> E6 (1318.5Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.07);
      gain2.gain.setValueAtTime(0.2, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.25);
    } catch (e) {
      // AudioContext policy
    }
  };

  const fetchChatData = async () => {
    try {
      const res = await fetch(`/api/chat?type=${targetType}&target=${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (data.channels) setChannels(data.channels);
        if (data.users) setUsers(data.users);

        const newMsgs: Message[] = data.messages || [];
        setMessages(newMsgs);

        const allMsgs: Message[] = data.allUserMessages || [];

        // On first load, seed seen set with existing message IDs so no sound plays on refresh
        if (!initialLoadDoneRef.current) {
          allMsgs.forEach((m) => seenMsgIdsRef.current.add(m.id));
          initialLoadDoneRef.current = true;
          return;
        }

        // Detect new incoming messages from other team members
        const myEmail = (data.currentUser?.email || "").toLowerCase();
        let incomingCount = 0;
        let lastIncoming: Message | null = null;

        allMsgs.forEach((m) => {
          if (!seenMsgIdsRef.current.has(m.id)) {
            seenMsgIdsRef.current.add(m.id);
            if (m.sender_email.toLowerCase() !== myEmail) {
              incomingCount++;
              lastIncoming = m;
            }
          }
        });

        if (incomingCount > 0 && lastIncoming) {
          playNotificationSound();
          setToastMsg({ sender: (lastIncoming as Message).sender_name, text: (lastIncoming as Message).content });
          setUnreadCount((prev) => prev + incomingCount);
          setTimeout(() => setToastMsg(null), 6000);
        }
      }
    } catch (e) {
      console.error("Failed to fetch quick chat data:", e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim() || sending) return;

    const content = inputMsg.trim();
    setInputMsg("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          target_type: targetType,
          target_id: targetId,
          content,
        }),
      });

      if (res.ok) {
        const sendData = await res.json();
        if (sendData.message?.id) {
          seenMsgIdsRef.current.add(sendData.message.id);
        }
        await fetchChatData();
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const onlineUsers = users.filter((u) => u.isOnline && u.email.toLowerCase() !== currentUser?.email?.toLowerCase());
  const totalOnline = onlineUsers.length + (currentUser ? 1 : 0);
  const activeTargetName =
    targetType === "channel"
      ? `#${channels.find((c) => c.id === targetId)?.name || targetId}`
      : users.find((u) => u.email.toLowerCase() === targetId.toLowerCase())?.name || targetId;

  return (
    <>
      {/* ── NEW MESSAGE TOAST NOTIFICATION ───────────────────────────────────── */}
      {toastMsg && !isOpen && (
        <div
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-20 right-12 z-50 bg-[#0d0e12]/95 border border-zinc-700 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3 cursor-pointer animate-in slide-in-from-bottom-3 duration-300 max-w-sm"
        >
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>{toastMsg.sender}</span>
            </div>
            <p className="text-[11px] text-zinc-300 truncate">{toastMsg.text}</p>
          </div>
        </div>
      )}

      {/* ── FLOATING CHAT TRIGGER BUTTON (MONOCHROME BLACK & WHITE THEME) ────────── */}
      <div className="fixed bottom-6 right-12 z-40 flex items-center gap-2">
        {isMinimized ? (
          /* Classy Monochrome Black & White Circle Icon (Default State) */
          <button
            onClick={() => {
              setIsMinimized(false);
              setIsOpen(true);
            }}
            title="Team Messenger"
            className="w-11 h-11 rounded-full bg-[#0e0f12] border border-zinc-700 hover:border-white text-white shadow-2xl backdrop-blur-xl flex items-center justify-center relative transition-all duration-300 hover:scale-105 group"
          >
            <MessageSquare className="w-5 h-5 text-white group-hover:text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-lg border border-black animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        ) : (
          /* Classy Monochrome Black & White Pill Bar */
          <div className="flex items-center bg-[#0e0f12]/95 border border-zinc-800 hover:border-zinc-700 rounded-full shadow-2xl backdrop-blur-2xl transition-all duration-300">
            <button
              onClick={() => {
                setIsOpen(!isOpen);
                if (!isOpen) setUnreadCount(0);
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-white font-bold transition-all"
            >
              <div className="relative flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-lg border border-black animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </div>

              <span className="text-xs font-extrabold tracking-tight hidden sm:inline">Team Messenger</span>

              {/* Online Teammates Pill Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-zinc-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{totalOnline} Online</span>
              </div>
            </button>

            {/* Quick Hide/Minimize Button */}
            <button
              onClick={() => {
                setIsMinimized(true);
                setIsOpen(false);
              }}
              title="Minimize Messenger Widget"
              className="pr-3 pl-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── FLOATING QUICK CHAT MESSENGER DRAWER ──────────────────────────────── */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-20 right-12 z-50 w-full max-w-md h-[540px] bg-[#0c0d10]/95 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Header Bar */}
          <div className="p-3.5 bg-[#090a0d] border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white">
                  Ethers Team Chat
                </h3>
                <p className="text-[10px] text-zinc-400">
                  {onlineUsers.length > 0
                    ? `${onlineUsers.length} colleague${onlineUsers.length > 1 ? "s" : ""} online`
                    : "No other teammates online right now"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/dashboard/team-chat"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Expand to Full Screen Chat"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Presence Banner bar */}
          <div className="px-3.5 py-2 bg-black/50 border-b border-zinc-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px]">
            <span className="text-zinc-500 font-bold uppercase text-[9px] shrink-0">Live Presence:</span>
            {users.map((u) => (
              <div
                key={u.email}
                onClick={() => {
                  if (u.email.toLowerCase() !== currentUser?.email?.toLowerCase()) {
                    setTargetType("dm");
                    setTargetId(u.email);
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0 cursor-pointer transition-all ${
                  u.isOnline
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-zinc-900 border-zinc-800 text-zinc-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className="font-bold">{u.name.split(" ")[0]}</span>
                {u.isOnline && u.activeSection && (
                  <span className="text-[9px] text-zinc-400">({u.activeSection})</span>
                )}
              </div>
            ))}
          </div>

          {/* Channel / DM Selector Pills */}
          <div className="px-3.5 py-2 bg-[#090a0d] border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* Pinned AI Copilot Pill */}
            <button
              onClick={() => {
                setTargetType("dm");
                setTargetId("assistant@ethers.ai");
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                targetType === "dm" && targetId.toLowerCase() === "assistant@ethers.ai"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm font-extrabold"
                  : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Ethers AI
            </button>

            <span className="w-px h-4 bg-zinc-800 shrink-0" />

            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setTargetType("channel");
                  setTargetId(c.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                  targetType === "channel" && targetId === c.id
                    ? "bg-purple-600 text-white shadow-sm font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                #{c.name}
              </button>
            ))}
          </div>

          {/* Message List Feed */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto font-sans text-xs">
            <div className="text-center my-1">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase tracking-wider">
                Viewing {activeTargetName}
              </span>
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs font-mono">
                {targetType === "dm" && targetId.toLowerCase() === "assistant@ethers.ai"
                  ? "Ask Ethers AI anything about Menu, Reporting, Hygiene Check, or Employee Hub."
                  : `No messages yet in ${activeTargetName}. Start the conversation.`}
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_email.toLowerCase() === currentUser?.email?.toLowerCase();
                const isAi = m.sender_email.toLowerCase() === "assistant@ethers.ai";
                const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in duration-200`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isAi ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <Sparkles className="w-2.5 h-2.5" /> Ethers AI
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-400">{isMe ? "You" : m.sender_name}</span>
                      )}
                      <span className="text-[9px] text-zinc-600">{timeStr}</span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isMe
                          ? "bg-emerald-600 text-white rounded-tr-none shadow-md font-medium"
                          : isAi
                          ? "bg-[#101317] border border-emerald-500/30 text-zinc-100 rounded-tl-none shadow-md"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Input Bar with Multi-line Stack Support */}
          <div className="p-3 bg-[#090a0d] border-t border-zinc-800/80 flex items-end gap-2">
            <textarea
              rows={1}
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message ${activeTargetName}...`}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 resize-none min-h-[38px] max-h-28 overflow-y-auto leading-relaxed"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputMsg.trim() || sending}
              className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white disabled:opacity-40 shadow-md transition-all shrink-0 mb-0.5"
              title="Send message (Ctrl+Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
