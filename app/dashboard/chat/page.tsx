"use client";

import { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, 
  Hash, 
  User, 
  Send, 
  Plus, 
  Search, 
  CheckCheck, 
  Circle, 
  Sparkles, 
  Smile, 
  Info, 
  RefreshCw,
  X
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string;
}

interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  department?: string;
  isOnline: boolean;
  isIdle: boolean;
  activeSection: string;
}

interface Message {
  id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  timestamp: string;
  channel_id?: string;
  recipient_email?: string;
}

const COMMON_EMOJIS = ["👍", "🔥", "✅", "🚀", "💡", "🎉", "👏", "❤️", "🙌", "😊"];

export default function TeamChatPage() {
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [targetType, setTargetType] = useState<"channel" | "dm">("channel");
  const [targetId, setTargetId] = useState<string>("general");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // New Channel Modal
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanDesc, setNewChanDesc] = useState("");
  const [chanError, setChanError] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const fetchChatState = async () => {
    try {
      const res = await fetch(`/api/chat?type=${targetType}&target=${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (data.channels) setChannels(data.channels);
        if (data.users) setUsers(data.users);
        if (data.messages) setMessages(data.messages);
      }
    } catch (e) {
      console.error("Error loading chat:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatState();
    // Poll chat state every 4 seconds for lightweight real-time updates
    const interval = setInterval(fetchChatState, 4000);
    return () => clearInterval(interval);
  }, [targetType, targetId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const contentToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          target_type: targetType,
          target_id: targetId,
          content: contentToSend,
        }),
      });

      if (res.ok) {
        fetchChatState();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    setChanError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_channel",
          channel_name: newChanName,
          description: newChanDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Channel creation failed");

      setChannels((prev) => [...prev, data.channel]);
      setTargetType("channel");
      setTargetId(data.channel.id);
      setIsNewChannelOpen(false);
      setNewChanName("");
      setNewChanDesc("");
    } catch (err: any) {
      setChanError(err.message);
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const selectedChannel = targetType === "channel" ? channels.find((c) => c.id === targetId) : null;
  const selectedUser = targetType === "dm" ? users.find((u) => u.email.toLowerCase() === targetId.toLowerCase()) : null;

  const filteredUsers = users.filter((u) => 
    u.email.toLowerCase() !== currentUser?.email?.toLowerCase() &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.department?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-6.5rem)] rounded-2xl border border-white/10 bg-[#0a0a0c] overflow-hidden shadow-2xl">
      {/* ─── LEFT SIDEBAR: Channels & Direct Messages ───────────────────────── */}
      <div className="w-80 border-r border-white/10 bg-[#0d0d12] flex flex-col">
        {/* Header & Search */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MessageSquare size={16} />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">Internal Team Hub</h2>
            </div>
            <button
              onClick={() => setIsNewChannelOpen(true)}
              title="Create Channel"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6 no-scrollbar">
          {/* CHANNELS SECTION */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-semibold tracking-wider text-white/40 uppercase">CHANNELS</span>
              <span className="text-[10px] font-bold text-white/30">{channels.length}</span>
            </div>
            <div className="space-y-1">
              {channels.map((chan) => {
                const isActive = targetType === "channel" && targetId === chan.id;
                return (
                  <button
                    key={chan.id}
                    onClick={() => {
                      setTargetType("channel");
                      setTargetId(chan.id);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-xs font-medium ${
                      isActive 
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold" 
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Hash size={15} className={isActive ? "text-emerald-400" : "text-white/40"} />
                    <span className="truncate">{chan.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-semibold tracking-wider text-white/40 uppercase">DIRECT MESSAGES</span>
              <span className="text-[10px] font-bold text-white/30">{filteredUsers.length}</span>
            </div>
            <div className="space-y-1">
              {filteredUsers.map((u) => {
                const isActive = targetType === "dm" && targetId.toLowerCase() === u.email.toLowerCase();
                const isAi = u.email.toLowerCase() === "assistant@ethers.ai";

                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setTargetType("dm");
                      setTargetId(u.email);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all text-xs font-medium ${
                      isActive 
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold" 
                        : isAi
                        ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase ${
                          isAi 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" 
                            : "bg-white/10 text-white"
                        }`}>
                          {isAi ? <Sparkles className="w-3 h-3" /> : u.name.charAt(0)}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0d0d12] ${
                          u.isOnline ? (u.isIdle ? "bg-amber-400" : "bg-emerald-400") : "bg-zinc-600"
                        }`} />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="truncate font-medium flex items-center gap-1">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-white/40 truncate">{u.designation || u.role}</div>
                      </div>
                    </div>

                    {isAi ? (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                        24/7 AI
                      </span>
                    ) : u.isOnline ? (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {u.isIdle ? "Idle" : "Live"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current User Profile Bar */}
        {currentUser && (
          <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[10px] text-emerald-400/80 font-medium capitalize">{currentUser.role} Account</div>
            </div>
          </div>
        )}
      </div>

      {/* ─── RIGHT CHAT AREA ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#08080a] relative">
        {/* Chat Top Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#0d0d12]/50 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3">
            {targetType === "channel" ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
                  <Hash size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">#{selectedChannel?.name || targetId}</h3>
                  <p className="text-xs text-white/40">{selectedChannel?.description || "Public team channel"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  {selectedUser?.email.toLowerCase() === "assistant@ethers.ai" ? <Sparkles size={18} /> : <User size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {selectedUser?.name || targetId}
                    {selectedUser?.email.toLowerCase() === "assistant@ethers.ai" && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        AI Copilot
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-white/40">
                    {selectedUser?.email.toLowerCase() === "assistant@ethers.ai"
                      ? "Intelligent Dashboard Copilot • 24/7 Online"
                      : `${selectedUser?.designation || "Staff Member"} • ${selectedUser?.email}`}
                  </p>
                </div>
              </>
            )}
          </div>

          <button
            onClick={fetchChatState}
            title="Refresh Messages"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Messages Feed */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/30">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Sparkles size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white/60">
                {targetId.toLowerCase() === "assistant@ethers.ai"
                  ? "Chat with Ethers AI Copilot"
                  : `No messages in ${targetType === "channel" ? "#" + targetId : selectedUser?.name || targetId}`}
              </p>
              <p className="text-xs text-white/40 mt-1 max-w-sm">
                {targetId.toLowerCase() === "assistant@ethers.ai"
                  ? "Ask me about Pricing Strategy, Menu Automation, Performance Reporting, or HR Documents!"
                  : "Say hello and start the conversation!"}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.sender_email.toLowerCase() === currentUser?.email.toLowerCase();
              const isAi = msg.sender_email.toLowerCase() === "assistant@ethers.ai";

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-in fade-in duration-200 ${
                    isSelf ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    isSelf 
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" 
                      : isAi
                      ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                      : "bg-white/10 text-white"
                  }`}>
                    {isAi ? <Sparkles className="w-3.5 h-3.5" /> : (msg.sender_name ? msg.sender_name.charAt(0) : "U")}
                  </div>

                  <div className={`max-w-[75%] ${isSelf ? "items-end text-right" : "items-start text-left"}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {isAi ? (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Ethers AI
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-white/60">{msg.sender_name}</span>
                      )}
                      <span className="text-[10px] text-white/30">{formatTimestamp(msg.timestamp)}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words shadow-lg ${
                        isSelf
                          ? "bg-emerald-600/90 text-white rounded-tr-none border border-emerald-500/30"
                          : isAi
                          ? "bg-[#0e1115] text-zinc-100 rounded-tl-none border border-emerald-500/30 shadow-emerald-950/20"
                          : "bg-[#141419] text-white/90 rounded-tl-none border border-white/10"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-6 bg-[#141419] border border-white/10 rounded-xl p-2 flex items-center gap-1 shadow-2xl z-20">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="w-8 h-8 hover:bg-white/10 rounded-lg text-base flex items-center justify-center transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Box with Multi-line Stack Support */}
        <div className="p-4 border-t border-white/10 bg-[#0d0d12]/80 backdrop-blur">
          <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 focus-within:border-emerald-500/50 transition-all">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-white/40 hover:text-white/80 rounded-xl transition-all shrink-0 mb-0.5"
              title="Insert Emoji"
            >
              <Smile size={18} />
            </button>

            <textarea
              rows={1}
              placeholder={`Message ${targetType === "channel" ? "#" + targetId : selectedUser?.name || "user"}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-transparent px-2 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none resize-none min-h-[38px] max-h-32 overflow-y-auto leading-relaxed"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || sending}
              className={`p-2.5 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 mb-0.5 ${
                inputText.trim() && !sending
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              }`}
              title="Send message (Ctrl+Enter)"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── NEW CHANNEL MODAL ──────────────────────────────────────────────── */}
      {isNewChannelOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121217] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Hash size={18} className="text-emerald-400" /> Create Team Channel
              </h3>
              <button onClick={() => setIsNewChannelOpen(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {chanError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {chanError}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. operations-team"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Brief description of channel purpose"
                  value={newChanDesc}
                  onChange={(e) => setNewChanDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
