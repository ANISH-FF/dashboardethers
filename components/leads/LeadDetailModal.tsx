"use client";

import { LeadItem, FollowUpStatus, LeadStatus } from "@/lib/db";
import { useState, useEffect } from "react";
import { 
  X, 
  Phone, 
  MessageSquare, 
  Calendar, 
  User, 
  MapPin, 
  Building2, 
  ExternalLink,
  Send,
  Save,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronDown
} from "lucide-react";

interface ModalProps {
  lead: LeadItem | null;
  onClose: () => void;
  onUpdateLead: (updatedLead: Partial<LeadItem> & { id: string }) => Promise<void>;
}

export function LeadDetailModal({ lead, onClose, onUpdateLead }: ModalProps) {
  if (!lead) return null;

  const [poc, setPoc] = useState(lead.poc || "");
  const [ownerPhone, setOwnerPhone] = useState(lead.ownerPhone || "");
  const [comments, setComments] = useState(lead.comments || "");
  const [newNote, setNewNote] = useState("");
  const [followUp1, setFollowUp1] = useState<FollowUpStatus>(lead.followUp1);
  const [followUp2, setFollowUp2] = useState<FollowUpStatus>(lead.followUp2);
  const [followUp3, setFollowUp3] = useState<FollowUpStatus>(lead.followUp3);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [scheduledMeeting, setScheduledMeeting] = useState(lead.scheduledMeeting || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setPoc(lead.poc || "");
      setOwnerPhone(lead.ownerPhone || "");
      setComments(lead.comments || "");
      setFollowUp1(lead.followUp1);
      setFollowUp2(lead.followUp2);
      setFollowUp3(lead.followUp3);
      setStatus(lead.status);
      setScheduledMeeting(lead.scheduledMeeting || "");
    }
  }, [lead.id, lead.poc, lead.ownerPhone, lead.followUp1, lead.followUp2, lead.followUp3, lead.status, lead.comments, lead.scheduledMeeting]);

  const cleanPhone = (ownerPhone || "").replace(/[^\d+]/g, "");
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "#";

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const timestamp = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const appended = comments 
      ? `${comments}\n[${timestamp}] ${newNote.trim()}`
      : `[${timestamp}] ${newNote.trim()}`;
    setComments(appended);
    setNewNote("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateLead({
        id: lead.id,
        poc: poc.trim(),
        ownerPhone: ownerPhone.trim(),
        comments,
        followUp1,
        followUp2,
        followUp3,
        status,
        scheduledMeeting
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-2xl max-h-[90vh] flex flex-col p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-line bg-paper-dark flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {lead.category || "F&B Brand"}
              </span>
              {lead.location && (
                <span className="text-xs text-ink/50 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {lead.location}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-ink mt-1">{lead.brandName}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-line bg-paper text-ink/50 hover:text-ink hover:bg-paper-dark transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar">
          
          {/* Quick Action Bar with Editable POC & Phone */}
          <div className="p-4 rounded-xl bg-paper-dark border border-line space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Point of Contact (Freely Editable + Quick Role Selector) */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-ink/50" /> Point of Contact (POC)
                  </span>
                  <span className="text-[10px] text-ink/40">Editable Name / Role</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={poc}
                    onChange={(e) => setPoc(e.target.value)}
                    placeholder="e.g. Owner, Store Manager, Rahul (Owner)..."
                    className="input text-xs py-2 px-3 bg-paper font-semibold text-ink border-line focus:border-purple-500/50 flex-1"
                  />
                  <div className="relative shrink-0">
                    <select
                      value={["Store Manager", "Owner", "General Manager", "Partner", "Outlet In-Charge", "Operations Head"].includes(poc) ? poc : ""}
                      onChange={(e) => {
                        if (e.target.value) setPoc(e.target.value);
                      }}
                      className="appearance-none rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink/80 cursor-pointer outline-none hover:bg-paper-dark transition-all pr-7 focus:border-purple-500/50 shadow-sm"
                      title="Quick select role"
                    >
                      <option value="" disabled>Quick Role ▾</option>
                      <option value="Store Manager">Store Manager</option>
                      <option value="Owner">Owner</option>
                      <option value="General Manager">General Manager</option>
                      <option value="Partner">Partner</option>
                      <option value="Outlet In-Charge">Outlet In-Charge</option>
                      <option value="Operations Head">Operations Head</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-3 pointer-events-none opacity-60 text-ink/70" />
                  </div>
                </div>
              </div>

              {/* Action Buttons (Call / WhatsApp) */}
              <div className="flex items-center gap-2 sm:self-end pt-1">
                {cleanPhone && (
                  <>
                    <a
                      href={`tel:${cleanPhone}`}
                      className="btn btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> Call
                    </a>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Editable Direct Contact Phone Number */}
            <div className="space-y-1.5 pt-2 border-t border-line/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> Direct Contact Phone No. (Editable)
              </span>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Enter direct phone number (e.g. 9903791649)..."
                className="input text-xs py-2 px-3 bg-paper font-mono font-semibold text-ink border-line focus:border-purple-500/50 w-full sm:max-w-md"
              />
            </div>
          </div>

          {/* Follow-up Sequence Settings */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Follow-up Sequence Track
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-[10px]">Follow up 1</label>
                <select
                  value={followUp1}
                  onChange={(e) => setFollowUp1(e.target.value as FollowUpStatus)}
                  className="input text-xs"
                >
                  <option value="In Talks">In Talks</option>
                  <option value="Not Responded">Not Responded</option>
                  <option value="Scheduled a meeting">Scheduled a meeting</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="label text-[10px]">Follow up 2</label>
                <select
                  value={followUp2}
                  onChange={(e) => setFollowUp2(e.target.value as FollowUpStatus)}
                  className="input text-xs"
                >
                  <option value="In Talks">In Talks</option>
                  <option value="Not Responded">Not Responded</option>
                  <option value="Scheduled a meeting">Scheduled a meeting</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="label text-[10px]">Follow up 3</label>
                <select
                  value={followUp3}
                  onChange={(e) => setFollowUp3(e.target.value as FollowUpStatus)}
                  className="input text-xs"
                >
                  <option value="In Talks">In Talks</option>
                  <option value="Not Responded">Not Responded</option>
                  <option value="Scheduled a meeting">Scheduled a meeting</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Meeting & Status */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-[10px]">Scheduled Meeting Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledMeeting ? scheduledMeeting.replace(" ", "T") : ""}
                onChange={(e) => setScheduledMeeting(e.target.value.replace("T", " "))}
                className="input text-xs font-mono"
              />
            </div>

            <div>
              <label className="label text-[10px]">Overall Lead Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="input text-xs font-bold text-ink"
              >
                <option value="In Talks">In Talks</option>
                <option value="Converted">Converted</option>
                <option value="Not Converted">Not Converted</option>
                <option value="Not Responding">Not Responding</option>
              </select>
            </div>
          </div>

          {/* Comments & Activity Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink/50 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Call Log & Activity Comments
            </h3>

            {/* Note Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                placeholder="Add call remarks, feedback, or response..."
                className="input text-xs flex-1"
              />
              <button
                type="button"
                onClick={handleAddNote}
                className="btn btn-secondary text-xs px-3"
              >
                <Send className="w-3.5 h-3.5" /> Add Note
              </button>
            </div>

            {/* Comments Textarea */}
            <textarea
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input font-mono text-xs leading-relaxed"
              placeholder="Detailed activity notes..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-paper-dark flex items-center justify-between">
          <span className="text-[11px] text-ink/50 font-mono">Lead ID: {lead.id}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost text-xs">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary text-xs flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
