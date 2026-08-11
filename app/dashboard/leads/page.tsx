"use client";

import { useEffect, useState, useMemo } from "react";
import { LeadItem, LeadStatus } from "@/lib/db";
import { LeadsAnalytics } from "@/components/leads/LeadsAnalytics";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsKanban } from "@/components/leads/LeadsKanban";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { GenerateLeadsModal } from "@/components/leads/GenerateLeadsModal";
import { 
  Plus, 
  Search, 
  Download, 
  RefreshCw, 
  Table, 
  Kanban, 
  Filter, 
  PhoneCall, 
  CheckCircle,
  Clock,
  Sparkles,
  CalendarCheck
} from "lucide-react";
import Papa from "papaparse";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleUpdateLead = async (patch: Partial<LeadItem> & { id: string }) => {
    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === patch.id ? { ...l, ...patch } : l))
    );
    if (selectedLead && selectedLead.id === patch.id) {
      setSelectedLead((prev) => (prev ? { ...prev, ...patch } : null));
    }

    try {
      await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error("Failed to update lead:", err);
      fetchLeads(); // Revert on failure
    }
  };

  const handleAddLead = async (newLeadData: Partial<LeadItem>) => {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeadData),
      });
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) => [data.lead, ...prev]);
      }
    } catch (err) {
      console.error("Failed to create lead:", err);
    }
  };

  const handleDeleteLead = async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete lead:", err);
      fetchLeads();
    }
  };

  const handleBulkDeleteLeads = async (ids: string[]) => {
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    try {
      await fetch(`/api/leads?ids=${ids.join(",")}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to bulk delete leads:", err);
      fetchLeads();
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const csvData = leads.map((l) => ({
      "Brand Name": l.brandName,
      "Owner Phone": l.ownerPhone,
      "Point of Contact": l.poc,
      "Date": l.date,
      "Comments": l.comments,
      "Follow up 1": l.followUp1,
      "Follow up 2": l.followUp2,
      "Follow up 3": l.followUp3,
      "Scheduled Meeting": l.scheduledMeeting,
      "Status": l.status,
      "Category": l.category || "",
      "Location": l.location || "",
      "Estimated Value": l.estimatedValue || 0,
      "Assigned To": l.assignedTo || ""
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ethers_Leads_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Search
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        l.brandName.toLowerCase().includes(query) ||
        l.poc.toLowerCase().includes(query) ||
        l.ownerPhone.includes(query) ||
        l.comments.toLowerCase().includes(query) ||
        (l.category && l.category.toLowerCase().includes(query)) ||
        (l.location && l.location.toLowerCase().includes(query));

      // Status filter
      if (statusFilter === "ALL") return matchesSearch;
      if (statusFilter === "MEETINGS") return matchesSearch && Boolean(l.scheduledMeeting);
      return matchesSearch && l.status === statusFilter;
    });
  }, [leads, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-paper-dark border border-line text-white shadow-sm">
              <PhoneCall className="w-5 h-5 text-white" />
            </span>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">Leads & Sales CRM</h1>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            Manage restaurant lead calls, 3-stage follow-ups, meeting schedules, and conversion pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLeads}
            title="Refresh Leads Data"
            className="btn btn-secondary text-xs px-3 py-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="btn btn-secondary text-xs flex items-center gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Generate AI Leads
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add New Lead
          </button>
        </div>
      </div>

      {/* Analytics KPI Header */}
      <LeadsAnalytics leads={leads} />

      {/* Controls & Search Bar */}
      <div className="card bg-paper-dark border-line p-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-ink/40" />
          <input
            type="text"
            placeholder="Search by brand, phone, POC, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs py-2"
          />
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === "ALL"
                ? "bg-ink text-paper shadow-sm"
                : "text-ink/60 hover:text-ink hover:bg-paper"
            }`}
          >
            All ({leads.length})
          </button>
          <button
            onClick={() => setStatusFilter("In Talks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
              statusFilter === "In Talks"
                ? "bg-blue-500 text-white shadow-sm"
                : "text-ink/60 hover:text-ink hover:bg-paper"
            }`}
          >
            <Clock className="w-3 h-3" /> In Talks ({leads.filter((l) => l.status === "In Talks").length})
          </button>
          <button
            onClick={() => setStatusFilter("MEETINGS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
              statusFilter === "MEETINGS"
                ? "bg-purple-500 text-white shadow-sm"
                : "text-ink/60 hover:text-ink hover:bg-paper"
            }`}
          >
            <CalendarCheck className="w-3 h-3" /> Meetings ({leads.filter((l) => Boolean(l.scheduledMeeting)).length})
          </button>
          <button
            onClick={() => setStatusFilter("Converted")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
              statusFilter === "Converted"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-ink/60 hover:text-ink hover:bg-paper"
            }`}
          >
            <CheckCircle className="w-3 h-3" /> Converted ({leads.filter((l) => l.status === "Converted").length})
          </button>
          <button
            onClick={() => setStatusFilter("Not Responding")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === "Not Responding"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-ink/60 hover:text-ink hover:bg-paper"
            }`}
          >
            Not Responding ({leads.filter((l) => l.status === "Not Responding").length})
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-paper p-1 rounded-lg border border-line shrink-0">
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              viewMode === "table" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Table
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              viewMode === "kanban" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </button>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {viewMode === "table" ? (
        <LeadsTable
          leads={filteredLeads}
          loading={loading}
          onSelectLead={(lead) => setSelectedLead(lead)}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onBulkDeleteLeads={handleBulkDeleteLeads}
        />
      ) : (
        <LeadsKanban
          leads={filteredLeads}
          onUpdateLead={handleUpdateLead}
          onSelectLead={(lead) => setSelectedLead(lead)}
        />
      )}

      {/* Lead Detail Modal / Drawer */}
      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdateLead={handleUpdateLead}
      />

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <AddLeadModal
          onClose={() => setIsAddModalOpen(false)}
          onAddLead={handleAddLead}
        />
      )}

      {/* Generate AI Leads Modal */}
      {isGenerateModalOpen && (
        <GenerateLeadsModal
          onClose={() => setIsGenerateModalOpen(false)}
          onLeadsGenerated={(newLeads) => {
            setLeads((prev) => [...newLeads, ...prev]);
          }}
        />
      )}
    </div>
  );
}
