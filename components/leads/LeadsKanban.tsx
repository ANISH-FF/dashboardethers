"use client";

import { LeadItem, LeadStatus } from "@/lib/db";
import { Phone, Calendar, ArrowRight, MessageSquare, CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react";

interface LeadsKanbanProps {
  leads: LeadItem[];
  onUpdateLead: (updatedLead: Partial<LeadItem> & { id: string }) => Promise<void>;
  onSelectLead: (lead: LeadItem) => void;
}

const STAGES: { key: LeadStatus; label: string; color: string; border: string; icon: any }[] = [
  { key: "In Talks", label: "In Talks / Active", color: "bg-blue-500/10 text-blue-400", border: "border-blue-500/20", icon: Clock },
  { key: "Converted", label: "Converted / Won", color: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/20", icon: CheckCircle },
  { key: "Not Responding", label: "Not Responding", color: "bg-amber-500/10 text-amber-400", border: "border-amber-500/20", icon: AlertCircle },
  { key: "Not Converted", label: "Not Converted / Lost", color: "bg-rose-500/10 text-rose-400", border: "border-rose-500/20", icon: XCircle },
];

export function LeadsKanban({ leads, onUpdateLead, onSelectLead }: LeadsKanbanProps) {
  const handleStageMove = async (leadId: string, currentStatus: LeadStatus) => {
    const sequence: LeadStatus[] = ["In Talks", "Converted", "Not Responding", "Not Converted"];
    const currentIndex = sequence.indexOf(currentStatus);
    const nextStatus = sequence[(currentIndex + 1) % sequence.length];
    await onUpdateLead({ id: leadId, status: nextStatus });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.key);
        const StageIcon = stage.icon;

        return (
          <div 
            key={stage.key} 
            className="card bg-paper-dark/80 border-line/80 p-3 flex flex-col h-[calc(100vh-280px)] min-h-[500px]"
          >
            {/* Header */}
            <div className={`p-3 rounded-lg border mb-3 flex items-center justify-between ${stage.color} ${stage.border}`}>
              <div className="flex items-center gap-2">
                <StageIcon className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{stage.label}</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-paper/60 border border-line text-ink">
                {stageLeads.length}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
              {stageLeads.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink/40 border border-dashed border-line rounded-lg">
                  No leads in this stage
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="group card bg-paper border-line p-3.5 hover:border-ink/30 transition-all hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-ink hover:text-blue-400 text-sm text-left transition-colors"
                        >
                          {lead.brandName}
                        </button>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-paper-dark border border-line text-ink/70">
                          ₹{(lead.estimatedValue || 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 text-xs text-ink/60">
                        <span className="font-medium">{lead.poc || "No POC"}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{lead.ownerPhone}</span>
                      </div>

                      {lead.comments && (
                        <p className="mt-2 text-[11px] text-ink/50 line-clamp-2 bg-paper-dark/50 p-2 rounded border border-line/40">
                          "{lead.comments}"
                        </p>
                      )}

                      {lead.scheduledMeeting && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded">
                          <Calendar className="w-3 h-3" />
                          <span>Meeting: {lead.scheduledMeeting}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-line/50 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-ink/40 uppercase">F1:</span>
                        <span className="text-ink/80 font-medium">{lead.followUp1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="p-1 rounded text-ink/50 hover:text-ink hover:bg-paper-dark"
                          title="View comments"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStageMove(lead.id, lead.status)}
                          className="p-1.5 rounded bg-paper-dark border border-line text-ink/70 hover:text-ink hover:border-ink/30 transition-all flex items-center gap-1 text-[10px] font-medium"
                          title="Move to next stage"
                        >
                          <span>Move</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
