"use client";

import { LeadItem, FollowUpStatus, LeadStatus } from "@/lib/db";
import { useState } from "react";
import { 
  Phone, 
  MessageSquare, 
  Calendar, 
  Eye, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles
} from "lucide-react";

interface LeadsTableProps {
  leads: LeadItem[];
  loading?: boolean;
  onUpdateLead: (updatedLead: Partial<LeadItem> & { id: string }) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  onBulkDeleteLeads?: (ids: string[]) => Promise<void>;
  onSelectLead: (lead: LeadItem) => void;
}

const FOLLOW_UP_OPTIONS: FollowUpStatus[] = ["In Talks", "Not Responded", "Scheduled a meeting", "Pending"];
const STATUS_OPTIONS: LeadStatus[] = ["In Talks", "Converted", "Not Converted", "Not Responding"];
const POC_OPTIONS = ["Store Manager", "Owner", "General Manager", "Partner", "Outlet In-Charge", "Operations Head"];

export function LeadsTable({ leads, loading, onUpdateLead, onDeleteLead, onBulkDeleteLeads, onSelectLead }: LeadsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ type: "single" | "bulk"; id?: string; title: string } | null>(null);

  const handleExecuteBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirmModal({
      type: "bulk",
      title: `Are you sure you want to delete ${selectedIds.length} selected lead(s)?`,
    });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirmModal) return;
    if (deleteConfirmModal.type === "bulk") {
      if (onBulkDeleteLeads) {
        await onBulkDeleteLeads(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => onDeleteLead(id)));
      }
      setSelectedIds([]);
    } else if (deleteConfirmModal.type === "single" && deleteConfirmModal.id) {
      await onDeleteLead(deleteConfirmModal.id);
    }
    setDeleteConfirmModal(null);
  };

  const handleFollowUpChange = async (leadId: string, field: "followUp1" | "followUp2" | "followUp3", value: FollowUpStatus) => {
    setUpdatingId(leadId);
    try {
      await onUpdateLead({ id: leadId, [field]: value });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (leadId: string, value: LeadStatus) => {
    setUpdatingId(leadId);
    try {
      await onUpdateLead({ id: leadId, status: value });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMeetingChange = async (leadId: string, value: string) => {
    setUpdatingId(leadId);
    try {
      await onUpdateLead({ id: leadId, scheduledMeeting: value });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDateChange = async (leadId: string, value: string) => {
    setUpdatingId(leadId);
    try {
      await onUpdateLead({ id: leadId, date: value });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePocChange = async (leadId: string, value: string) => {
    setUpdatingId(leadId);
    try {
      await onUpdateLead({ id: leadId, poc: value });
    } finally {
      setUpdatingId(null);
    }
  };

  const getFollowUpBadgeClass = (val: FollowUpStatus) => {
    switch (val) {
      case "In Talks":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Scheduled a meeting":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Not Responded":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-ink/5 text-ink/40 border-line";
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case "Converted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" /> Converted
          </span>
        );
      case "In Talks":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
            <Clock className="w-3.5 h-3.5 animate-spin-slow" /> In Talks
          </span>
        );
      case "Not Converted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 shadow-sm">
            <XCircle className="w-3.5 h-3.5" /> Not Converted
          </span>
        );
      case "Not Responding":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5" /> Not Responding
          </span>
        );
    }
  };

  if (leads.length === 0) {
    return (
      <div className="card bg-paper-dark border-line p-12 text-center flex flex-col items-center justify-center">
        <Sparkles className="w-10 h-10 text-ink/30 mb-3" />
        <h3 className="text-base font-semibold text-ink">No Leads Found</h3>
        <p className="text-sm text-ink/50 mt-1 max-w-sm">No lead records match your search criteria or filter options.</p>
      </div>
    );
  }

  return (
    <div className="card bg-paper border-line p-0 overflow-hidden shadow-xl">
      {selectedIds.length > 0 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{selectedIds.length} lead(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-ink/60 hover:text-ink px-2 py-1 font-medium"
            >
              Unselect All
            </button>
            <button
              onClick={handleExecuteBulkDelete}
              className="btn bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold rounded-lg transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-paper-dark/90 border-b border-line text-ink/60 uppercase tracking-wider font-bold text-[10px]">
              <th className="py-3.5 px-3.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-line bg-paper-dark text-emerald-500 accent-emerald-500 cursor-pointer"
                  title="Select / Unselect All"
                />
              </th>
              <th className="py-3.5 px-4 min-w-[180px]">Brand & Category</th>
              <th className="py-3.5 px-4 min-w-[160px]">Owner Phone No</th>
              <th className="py-3.5 px-4 min-w-[160px]">POC</th>
              <th className="py-3.5 px-4 min-w-[130px]">Dates</th>
              <th className="py-3.5 px-4 min-w-[200px]">Comments</th>
              <th className="py-3.5 px-4 min-w-[140px]">Follow up 1</th>
              <th className="py-3.5 px-4 min-w-[140px]">Follow up 2</th>
              <th className="py-3.5 px-4 min-w-[140px]">Follow up 3</th>
              <th className="py-3.5 px-4 min-w-[180px]">Scheduled Meeting</th>
              <th className="py-3.5 px-4 min-w-[150px]">Status</th>
              <th className="py-3.5 px-4 text-right min-w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40 font-medium">
            {leads.map((lead) => {
              const cleanPhone = lead.ownerPhone.replace(/[^\d+]/g, "");
              const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "#";
              const isSelected = selectedIds.includes(lead.id);

              return (
                <tr 
                  key={lead.id} 
                  className={`hover:bg-paper-dark/60 transition-colors group ${isSelected ? "bg-emerald-500/5" : ""} ${updatingId === lead.id ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <td className="py-3 px-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(lead.id)}
                      className="w-4 h-4 rounded border-line bg-paper-dark text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </td>
                  {/* Brand & Category */}
                  <td className="py-3 px-4">
                    <button 
                      onClick={() => onSelectLead(lead)}
                      className="text-left font-bold text-ink group-hover:text-blue-400 transition-colors block text-sm"
                    >
                      {lead.brandName}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-dark border border-line text-ink/60 font-mono">
                        {lead.category || "F&B"}
                      </span>
                      {lead.location && (
                        <span className="text-[10px] text-ink/40 truncate max-w-[100px]">
                          {lead.location}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Owner Phone No */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink/90 font-medium">{lead.ownerPhone || "—"}</span>
                      {lead.ownerPhone && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={`tel:${cleanPhone}`} 
                            title="Call Owner"
                            className="p-1 rounded bg-paper-dark border border-line text-ink/70 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a 
                            href={waUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="WhatsApp Chat"
                            className="p-1 rounded bg-paper-dark border border-line text-ink/70 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* POC (Clean 1-Click Dropdown) */}
                  <td className="py-3 px-4 text-ink/80">
                    <div className="relative inline-flex flex-col gap-1 w-36">
                      <div className="relative">
                        <select
                          value={lead.poc || "Store Manager"}
                          onChange={(e) => handlePocChange(lead.id, e.target.value)}
                          className="w-full appearance-none rounded-lg border border-line bg-paper-dark/60 hover:bg-paper-dark px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer outline-none transition-all pr-6 focus:border-purple-500/50 shadow-sm"
                          title="Click to select POC (e.g. Owner or Store Manager)"
                        >
                          {POC_OPTIONS.map((opt) => (
                            <option key={`${lead.id}-poc-${opt}`} value={opt} className="bg-paper-dark text-ink font-sans">
                              {opt}
                            </option>
                          ))}
                          {lead.poc && !POC_OPTIONS.includes(lead.poc) && (
                            <option value={lead.poc} className="bg-paper-dark text-ink font-sans">
                              {lead.poc}
                            </option>
                          )}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-2 pointer-events-none opacity-60 text-ink/70" />
                      </div>
                    </div>
                  </td>

                  {/* Dates (Drop Down / Datepicker) */}
                  <td className="py-3 px-4">
                    <div className="relative inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-ink/40 shrink-0" />
                      <input 
                        type="date" 
                        value={lead.date}
                        onChange={(e) => handleDateChange(lead.id, e.target.value)}
                        className="bg-transparent border-none text-xs font-mono text-ink/80 focus:ring-1 focus:ring-ink/30 rounded px-1 py-0.5 cursor-pointer hover:bg-paper-dark"
                      />
                    </div>
                  </td>

                  {/* Comments */}
                  <td className="py-3 px-4">
                    <div 
                      onClick={() => onSelectLead(lead)}
                      className="cursor-pointer group/comment flex items-start gap-1.5 p-1.5 rounded hover:bg-paper-dark border border-transparent hover:border-line transition-all"
                    >
                      <MessageSquare className="w-3 h-3 text-ink/40 mt-0.5 shrink-0" />
                      <p className="text-ink/70 text-[11px] line-clamp-2 leading-relaxed">
                        {lead.comments || "Click to add notes..."}
                      </p>
                    </div>
                  </td>

                  {/* Follow up 1 */}
                  <td className="py-3 px-4">
                    <div className="relative">
                      <select 
                        key={`${lead.id}-f1-${lead.followUp1}`}
                        id={`${lead.id}-followUp1`}
                        value={lead.followUp1 || "Pending"}
                        onChange={(e) => handleFollowUpChange(lead.id, "followUp1", e.target.value as FollowUpStatus)}
                        className={`w-full appearance-none rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer outline-none transition-all pr-6 ${getFollowUpBadgeClass(lead.followUp1)}`}
                      >
                        {FOLLOW_UP_OPTIONS.map((opt) => (
                          <option key={`${lead.id}-f1-opt-${opt}`} value={opt} className="bg-paper-dark text-ink font-sans">
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none opacity-60" />
                    </div>
                  </td>

                  {/* Follow up 2 */}
                  <td className="py-3 px-4">
                    <div className="relative">
                      <select 
                        key={`${lead.id}-f2-${lead.followUp2}`}
                        id={`${lead.id}-followUp2`}
                        value={lead.followUp2 || "Pending"}
                        onChange={(e) => handleFollowUpChange(lead.id, "followUp2", e.target.value as FollowUpStatus)}
                        className={`w-full appearance-none rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer outline-none transition-all pr-6 ${getFollowUpBadgeClass(lead.followUp2)}`}
                      >
                        {FOLLOW_UP_OPTIONS.map((opt) => (
                          <option key={`${lead.id}-f2-opt-${opt}`} value={opt} className="bg-paper-dark text-ink font-sans">
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none opacity-60" />
                    </div>
                  </td>

                  {/* Follow up 3 */}
                  <td className="py-3 px-4">
                    <div className="relative">
                      <select 
                        key={`${lead.id}-f3-${lead.followUp3}`}
                        id={`${lead.id}-followUp3`}
                        value={lead.followUp3 || "Pending"}
                        onChange={(e) => handleFollowUpChange(lead.id, "followUp3", e.target.value as FollowUpStatus)}
                        className={`w-full appearance-none rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer outline-none transition-all pr-6 ${getFollowUpBadgeClass(lead.followUp3)}`}
                      >
                        {FOLLOW_UP_OPTIONS.map((opt) => (
                          <option key={`${lead.id}-f3-opt-${opt}`} value={opt} className="bg-paper-dark text-ink font-sans">
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none opacity-60" />
                    </div>
                  </td>

                  {/* Scheduled a Meeting */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="datetime-local" 
                        value={lead.scheduledMeeting ? lead.scheduledMeeting.replace(" ", "T") : ""}
                        onChange={(e) => {
                          const formatted = e.target.value ? e.target.value.replace("T", " ") : "";
                          handleMeetingChange(lead.id, formatted);
                        }}
                        className="bg-paper-dark border border-line rounded-lg px-2 py-1 text-[11px] font-mono text-ink focus:ring-1 focus:ring-purple-500/50 outline-none w-full"
                      />
                    </div>
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3 px-4">
                    <div className="relative">
                      <select 
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                        className="w-full appearance-none rounded-lg border border-line bg-paper-dark/90 px-3 py-1.5 text-xs font-semibold text-ink cursor-pointer outline-none transition-all hover:border-ink/40 pr-7"
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st} className="bg-paper-dark text-ink">
                            {st}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none text-ink/50" />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => onSelectLead(lead)}
                        title="View details & logs"
                        className="p-1.5 rounded-lg bg-paper-dark border border-line text-ink/70 hover:text-ink hover:bg-line/40 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          setDeleteConfirmModal({
                            type: "single",
                            id: lead.id,
                            title: `Are you sure you want to delete lead "${lead.brandName}"?`,
                          });
                        }}
                        title="Delete Lead"
                        className="p-1.5 rounded-lg bg-paper-dark border border-line text-ink/40 hover:text-rose-400 hover:border-rose-500/30 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-paper-dark/60 border-t border-line px-4 py-3 flex items-center justify-between text-xs text-ink/50">
        <span>Showing <strong className="text-ink font-semibold">{leads.length}</strong> lead entries</span>
        <span className="text-[11px]">Tip: Select dropdown options to update follow ups instantly.</span>
      </div>

      {/* Custom Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-rose-500/30 w-full max-w-sm p-5 space-y-4 relative shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-ink">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">{deleteConfirmModal.title}</p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                className="btn bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
