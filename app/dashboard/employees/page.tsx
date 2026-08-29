"use client";

import { useEffect, useState } from "react";
import { EmployeeDocument } from "@/lib/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { IssueDocumentModal } from "@/components/documents/IssueDocumentModal";
import { 
  Users, 
  FileText, 
  Award, 
  Lock, 
  Plus, 
  Eye, 
  UserCheck, 
  KeyRound, 
  Trash2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles,
  FileCheck,
  UserPlus,
  RefreshCw,
  Search,
  CheckCircle2,
  TrendingUp,
  X
} from "lucide-react";

export default function EmployeeHubPage() {
  const [session, setSession] = useState<{ email: string; name: string; role: "admin" | "staff" } | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docCategoryFilter, setDocCategoryFilter] = useState<"all" | "certificate" | "offer" | "increment" | "payslip">("all");
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  
  // Modals state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpRole, setNewEmpRole] = useState<"admin" | "staff">("staff");
  const [newEmpDesignation, setNewEmpDesignation] = useState("");
  const [newEmpDepartment, setNewEmpDepartment] = useState("");
  const [newEmpPhone, setNewEmpPhone] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reveal Credential Modal State
  const [revealedCreds, setRevealedCreds] = useState<{ name: string; email: string; password: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Activity Analytics State
  const [activeTab, setActiveTab] = useState<"directory" | "analytics">("directory");
  const [activityData, setActivityData] = useState<{ summary: any; employeesActivity: any[] } | null>(null);

  const fetchSessionAndEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        if (data.employees) setEmployees(data.employees);
      }
      
      const sessRes = await fetch("/api/auth/session-info");
      if (sessRes.ok) {
        const data = await sessRes.json();
        if (data.session) setSession(data.session);
        if (data.employees && employees.length === 0) setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Error fetching employees/session:", err);
    }
  };

  const fetchActivityAnalytics = async () => {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const data = await res.json();
        setActivityData(data);
      }
    } catch (err) {
      console.error("Error fetching activity analytics:", err);
    }
  };

  useEffect(() => {
    fetchSessionAndEmployees();
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) setDocuments(data.documents);
      });
  }, []);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchActivityAnalytics();
      const interval = setInterval(fetchActivityAnalytics, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const isAdmin = session?.role === "admin" || !session;

  const handleIssueDocument = async (docData: Partial<EmployeeDocument>) => {
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docData),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (err) {
      console.error("Failed to issue document:", err);
    }
  };

  const generatePasswordKey = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let pwd = "eth_";
    for (let i = 0; i < 5; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewEmpPassword(pwd);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmpName,
          email: newEmpEmail,
          role: newEmpRole,
          designation: newEmpDesignation,
          department: newEmpDepartment,
          phone: newEmpPhone,
          password: newEmpPassword || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to add employee.");
        return;
      }

      setIsAddEmployeeOpen(false);
      
      const usedPassword = data.generatedPassword || newEmpPassword;
      setRevealedCreds({
        name: data.employee.name,
        email: data.employee.email,
        password: usedPassword,
        title: "New Employee Created Successfully"
      });

      setNewEmpName("");
      setNewEmpEmail("");
      setNewEmpRole("staff");
      setNewEmpDesignation("");
      setNewEmpDepartment("");
      setNewEmpPhone("");
      setNewEmpPassword("");

      fetchSessionAndEmployees();
    } catch (err) {
      setFormError("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const [deleteDocTarget, setDeleteDocTarget] = useState<EmployeeDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  const confirmDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    setIsDeletingDoc(true);
    try {
      const id = deleteDocTarget.id;
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      setDeleteDocTarget(null);
    } catch (e) {
      console.error("Failed to dismiss document:", e);
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Set Custom Password Modal State (Co-Founders only)
  const [passwordModalEmp, setPasswordModalEmp] = useState<any | null>(null);
  const [customPasswordInput, setCustomPasswordInput] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  const handleSetCustomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalEmp) return;
    setSettingPassword(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: passwordModalEmp.email,
          customPassword: customPasswordInput && customPasswordInput.trim() ? customPasswordInput.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRevealedCreds({
          name: passwordModalEmp.name,
          email: passwordModalEmp.email,
          password: data.newPassword,
          title: "Account Password Updated Successfully",
        });
        setPasswordModalEmp(null);
        setCustomPasswordInput("");
      } else {
        setEmpNoticeMessage({ type: "error", text: data.error || "Failed to update password." });
      }
    } catch {
      setEmpNoticeMessage({ type: "error", text: "Error updating password." });
    } finally {
      setSettingPassword(false);
    }
  };

  // Delete Employee Confirmation State
  const [deleteEmpConfirm, setDeleteEmpConfirm] = useState<any | null>(null);
  const [empNoticeMessage, setEmpNoticeMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const confirmDeleteEmployee = async () => {
    if (!deleteEmpConfirm) return;
    try {
      const res = await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteEmpConfirm.email })
      });
      const data = await res.json();
      if (res.ok) {
        setEmpNoticeMessage({ type: "success", text: `Account for ${deleteEmpConfirm.name} removed successfully.` });
        fetchSessionAndEmployees();
      } else {
        setEmpNoticeMessage({ type: "error", text: data.error || "Failed to delete account." });
      }
    } catch {
      setEmpNoticeMessage({ type: "error", text: "Error deleting account." });
    } finally {
      setDeleteEmpConfirm(null);
    }
  };

  const copyCredentials = () => {
    if (!revealedCreds) return;
    const text = `Ethers Dashboard Credentials:\nEmail: ${revealedCreds.email}\nPassword: ${revealedCreds.password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-paper-dark border border-line text-white shadow-sm">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              {isAdmin ? "Executive Employee Hub" : "Employee Portal & Documents"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
              {isAdmin ? "Co-Founder Access" : "Staff Access"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            {isAdmin 
              ? "Manage team credentials, add new employees, issue payslips, offer letters, and certificates."
              : "Access your monthly salary payslips, appointment letter, and official certificates."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setIsAddEmployeeOpen(true)}
                className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Add Employee
              </button>
              <button
                onClick={() => setIsIssueModalOpen(true)}
                className="btn btn-secondary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" /> Issue Document
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher (Co-Founder / Admin) */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "directory"
                ? "bg-white/10 text-white border border-white/20 shadow-md"
                : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Team & HR Directory
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "analytics"
                ? "bg-white/10 text-white border border-white/20 shadow-lg backdrop-blur-md"
                : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-300" /> Screen Time & Module Analytics
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
      {isAdmin && activeTab === "analytics" ? (
        /* ANALYTICS VIEW — APPLE HUMAN INTERFACE DESIGN */
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="card bg-paper-dark/80 backdrop-blur-md border-line/60 p-4 space-y-1 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs text-ink/60 font-semibold">
                <span>Total Active Team</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-black text-ink">{activityData?.summary?.totalEmployees || employees.length}</p>
              <p className="text-[11px] text-sky-400 font-medium">{activityData?.summary?.totalOnline || 0} Currently Live Online</p>
            </div>

            <div className="card bg-paper-dark/80 backdrop-blur-md border-line/60 p-4 space-y-1 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs text-ink/60 font-semibold">
                <span>Company Screen Time Today</span>
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                {activityData?.summary?.totalScreenTimeSecs
                  ? `${Math.floor(activityData.summary.totalScreenTimeSecs / 3600)}h ${Math.floor((activityData.summary.totalScreenTimeSecs % 3600) / 60)}m`
                  : "0h 0m"}
              </p>
              <p className="text-[11px] text-ink/50">Active tab hours logged today</p>
            </div>

            <div className="card bg-paper-dark/80 backdrop-blur-md border-line/60 p-4 space-y-1 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs text-ink/60 font-semibold">
                <span>Most Used Module</span>
                <FileCheck className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-lg font-bold text-amber-300 truncate">{activityData?.summary?.topSection || "Dashboard"}</p>
              <p className="text-[11px] text-ink/50">Highest employee engagement</p>
            </div>

            <div className="card bg-paper-dark/80 backdrop-blur-md border-line/60 p-4 space-y-1 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs text-ink/60 font-semibold">
                <span>Live Status Refresh</span>
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
              </div>
              <p className="text-sm font-bold text-ink">Auto-Syncing 5s</p>
              <p className="text-[11px] text-indigo-300 font-medium">Real-time Heartbeat Active</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-ink/60 uppercase tracking-widest">Employee Screen Time & Section Breakdown</h3>

            <div className="grid lg:grid-cols-2 gap-4">
              {(activityData?.employeesActivity || employees).map((emp: any) => {
                const totalSecs = emp.totalSecondsToday || 0;
                const hours = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);

                const sectionsList: [string, number][] = Object.entries(emp.sectionsBreakdown || {});
                sectionsList.sort((a, b) => b[1] - a[1]);

                return (
                  <div key={emp.email} className="card bg-paper-dark/90 backdrop-blur-xl border-line/70 p-5 space-y-4 hover:border-white/20 transition-all shadow-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white text-sm shadow-inner">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white tracking-tight">{emp.name}</h4>
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              emp.isOnline ? (emp.isIdle ? "bg-amber-400 shadow-sm" : "bg-sky-400 animate-pulse shadow-sm shadow-sky-400/50") : "bg-zinc-600"
                            }`} />
                          </div>
                          <p className="text-xs text-ink/50">{emp.designation || emp.role} • {emp.department || "General"}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          emp.isOnline 
                            ? (emp.isIdle ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-sky-500/10 text-sky-300 border-sky-500/20")
                            : "bg-white/5 text-zinc-400 border-white/10"
                        }`}>
                          {emp.isOnline ? (emp.isIdle ? "Idle AFK" : "Online Live") : "Offline"}
                        </span>
                        <p className="text-xs font-bold text-zinc-300 mt-1.5 font-mono">
                          {hours > 0 ? `${hours}h ${mins}m Total` : `${mins}m Total`}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-paper/60 border border-line/60 flex items-center justify-between text-xs backdrop-blur-md">
                      <span className="text-ink/60 font-medium">Currently Working In:</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        {emp.isOnline ? emp.currentSection : "Offline"}
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-line/40">
                      <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Module Time Distribution</span>
                      {sectionsList.length === 0 ? (
                        <p className="text-xs text-ink/40 italic">No section activity logged today yet.</p>
                      ) : (
                        sectionsList.map(([sec, secTime], idx) => {
                          const pct = totalSecs > 0 ? Math.round((secTime / totalSecs) * 100) : 0;
                          const secH = Math.floor(secTime / 3600);
                          const secM = Math.floor((secTime % 3600) / 60);

                          // Sleek Apple multi-tone gradient distribution
                          const gradients = [
                            "from-indigo-500 to-sky-400",
                            "from-purple-500 to-indigo-400",
                            "from-blue-500 to-cyan-400",
                            "from-violet-500 to-fuchsia-400",
                            "from-amber-500 to-orange-400"
                          ];
                          const grad = gradients[idx % gradients.length];

                          return (
                            <div key={sec} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-white/80">{sec}</span>
                                <span className="font-mono text-zinc-400 text-[11px]">
                                  {secH > 0 ? `${secH}h ${secM}m` : `${secM}m`} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden border border-white/5">
                                <div 
                                  className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-500 shadow-sm`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* DIRECTORY VIEW */
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card bg-paper-dark border-line space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-ink">Team Credentials & Roles</h2>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper border border-line text-emerald-400">
                  Hashed Security
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {employees.map((emp) => (
                  <div 
                    key={emp.email}
                    className="p-3 rounded-lg bg-paper border border-line space-y-2 hover:border-ink/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="font-bold text-ink flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-400" /> {emp.name}
                        </p>
                        <p className="text-[11px] font-mono text-ink/60">{emp.email}</p>
                        <p className="text-[10px] text-ink/40">{emp.designation || "Team Member"}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        emp.role === "admin"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {emp.role === "admin" ? "Co-Founder" : "Staff"}
                      </span>
                    </div>

                    {isAdmin && (emp.role !== "admin" || emp.email.toLowerCase() === session?.email?.toLowerCase()) && (
                      <div className="flex items-center gap-2 pt-2 border-t border-line/40">
                        <button
                          onClick={() => {
                            setPasswordModalEmp(emp);
                            setCustomPasswordInput("");
                          }}
                          className="text-[10px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors"
                        >
                          <KeyRound className="w-3 h-3 text-amber-400" /> Change Password
                        </button>
                        {emp.email !== session?.email && (
                          <button
                            onClick={() => setDeleteEmpConfirm(emp)}
                            className="text-[10px] text-ink/40 hover:text-red-400 flex items-center gap-1 ml-auto transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* Header Row 1 & Row 2 */}
            <div className="space-y-4 border-b border-line pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-ink">Issued HR Documents</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-paper border border-line text-ink/60">
                    {documents.length} Documents
                  </span>
                </div>
              </div>

              {/* Row 2: Search Bar & 5 Category Filter Tabs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                  <input
                    type="text"
                    placeholder="Search documents or staff..."
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    className="input pl-9 text-xs py-1.5 bg-paper-dark border-line/60 focus:border-emerald-500"
                  />
                  {docSearchQuery && (
                    <button 
                      onClick={() => setDocSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-paper p-1 rounded-lg border border-line text-xs overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setDocCategoryFilter("all")}
                    className={`px-2.5 py-1 rounded font-medium transition-all whitespace-nowrap ${
                      docCategoryFilter === "all" ? "bg-paper-dark text-ink font-bold shadow-sm" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    All Documents
                  </button>
                  <button
                    onClick={() => setDocCategoryFilter("certificate")}
                    className={`px-2.5 py-1 rounded font-medium transition-all whitespace-nowrap ${
                      docCategoryFilter === "certificate" ? "bg-paper-dark text-ink font-bold shadow-sm" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Certificates
                  </button>
                  <button
                    onClick={() => setDocCategoryFilter("offer")}
                    className={`px-2.5 py-1 rounded font-medium transition-all whitespace-nowrap ${
                      docCategoryFilter === "offer" ? "bg-paper-dark text-ink font-bold shadow-sm" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Offer & Contracts
                  </button>
                  <button
                    onClick={() => setDocCategoryFilter("increment")}
                    className={`px-2.5 py-1 rounded font-medium transition-all whitespace-nowrap ${
                      docCategoryFilter === "increment" ? "bg-paper-dark text-ink font-bold shadow-sm" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Increment & LOR
                  </button>
                  <button
                    onClick={() => setDocCategoryFilter("payslip")}
                    className={`px-2.5 py-1 rounded font-medium transition-all whitespace-nowrap ${
                      docCategoryFilter === "payslip" ? "bg-paper-dark text-ink font-bold shadow-sm" : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Payslips
                  </button>
                </div>
              </div>
            </div>

            {/* Filtered Documents List */}
            {(() => {
              const q = docSearchQuery.toLowerCase().trim();
              const filtered = documents.filter((doc) => {
                // Category Filter
                if (docCategoryFilter === "certificate" && doc.type !== "certificate") return false;
                if (docCategoryFilter === "offer" && (doc.type !== "offer_letter" && doc.type !== "employment_terms")) return false;
                if (docCategoryFilter === "increment" && (doc.type !== "increment_letter" && doc.type !== "recommendation_letter" && doc.type !== "completion_letter")) return false;
                if (docCategoryFilter === "payslip" && doc.type !== "payslip") return false;

                // Search Query Filter
                if (q) {
                  const matchName = doc.employeeName?.toLowerCase().includes(q);
                  const matchEmail = doc.employeeEmail?.toLowerCase().includes(q);
                  const matchTitle = doc.title?.toLowerCase().includes(q);
                  const matchCode = doc.verificationCode?.toLowerCase().includes(q);
                  return matchName || matchEmail || matchTitle || matchCode;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center card bg-paper-dark border-line space-y-2">
                    <FileText className="w-8 h-8 text-ink/30 mx-auto" />
                    <p className="text-sm font-bold text-ink">No Documents Found</p>
                    <p className="text-xs text-ink/50">
                      {q ? `No documents match "${docSearchQuery}".` : "No issued HR documents in this category."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filtered.map((doc) => (
                    <div 
                      key={doc.id}
                      className="p-4 rounded-xl card bg-paper-dark border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-paper border border-line mt-0.5">
                          {doc.type === "certificate" && <Award className="w-5 h-5 text-amber-400" />}
                          {doc.type === "offer_letter" && <FileCheck className="w-5 h-5 text-blue-400" />}
                          {doc.type === "employment_terms" && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                          {doc.type === "increment_letter" && <TrendingUp className="w-5 h-5 text-purple-400" />}
                          {doc.type === "recommendation_letter" && <UserCheck className="w-5 h-5 text-indigo-400" />}
                          {doc.type === "completion_letter" && <CheckCircle2 className="w-5 h-5 text-sky-400" />}
                          {doc.type === "payslip" && <FileText className="w-5 h-5 text-emerald-400" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink text-sm">{doc.title}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper border border-line text-emerald-400">
                              {doc.verificationCode || doc.id}
                            </span>
                          </div>
                          <p className="text-xs text-ink/60">Issued to: <strong className="text-ink">{doc.employeeName}</strong> ({doc.employeeEmail})</p>
                          <p className="text-[11px] text-ink/40">Issued Date: {doc.issueDate}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="btn btn-secondary text-xs flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View / Print PDF
                        </button>
                        <button
                          onClick={() => setDeleteDocTarget(doc)}
                          className="p-2 rounded-lg border border-line text-ink/40 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all"
                          title="Dismiss from Admin View"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal: Add New Employee */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-line w-full max-w-md p-6 space-y-4 relative shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-ink">Add New Employee</h3>
              </div>
              <button 
                onClick={() => setIsAddEmployeeOpen(false)} 
                className="text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink/70 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-ink/70 mb-1 font-medium">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@ethers.io"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink/70 mb-1 font-medium">System Role *</label>
                  <select
                    value={newEmpRole}
                    onChange={(e: any) => setNewEmpRole(e.target.value)}
                    className="input text-xs bg-paper font-semibold"
                  >
                    <option value="staff">Staff Member</option>
                    <option value="admin">Co-Founder (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink/70 mb-1 font-medium">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Growth"
                    value={newEmpDepartment}
                    onChange={(e) => setNewEmpDepartment(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink/70 mb-1 font-medium">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Brand Specialist"
                    value={newEmpDesignation}
                    onChange={(e) => setNewEmpDesignation(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-ink/70 mb-1 font-medium">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-ink/70 font-medium">Password (Auto-Generated if blank)</label>
                  <button 
                    type="button" 
                    onClick={generatePasswordKey}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" /> Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. eth_x9k2p"
                  value={newEmpPassword}
                  onChange={(e) => setNewEmpPassword(e.target.value)}
                  className="input text-xs font-mono"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set Custom Password (Co-Founders Only) */}
      {passwordModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-amber-500/30 w-full max-w-md p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-ink">Change Account Password</h3>
              </div>
              <button onClick={() => setPasswordModalEmp(null)} className="text-ink/40 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-paper border border-line space-y-1 text-xs">
              <p className="text-ink/60 font-medium">Changing password for:</p>
              <p className="font-bold text-ink text-sm">{passwordModalEmp.name}</p>
              <p className="text-[11px] font-mono text-ink/50">{passwordModalEmp.email}</p>
            </div>

            <form onSubmit={handleSetCustomPassword} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-ink/70 font-semibold block">Enter Custom Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
                      let pwd = "eth_";
                      for (let i = 0; i < 5; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                      setCustomPasswordInput(pwd);
                    }}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <KeyRound className="w-3 h-3" /> Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin123 or eth_x9k2p"
                  value={customPasswordInput}
                  onChange={(e) => setCustomPasswordInput(e.target.value)}
                  className="input font-mono text-xs font-bold text-emerald-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setPasswordModalEmp(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingPassword || !customPasswordInput.trim()}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  {settingPassword ? "Saving Password..." : "Save New Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Employee */}
      {deleteEmpConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-rose-500/30 w-full max-w-sm p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-ink">Remove Employee Account</h3>
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Are you sure you want to remove <strong className="text-ink">{deleteEmpConfirm.name}</strong> ({deleteEmpConfirm.email}) from Ethers Dashboard?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setDeleteEmpConfirm(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEmployee}
                className="btn bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-md transition-all"
              >
                Yes, Remove Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Employee Notice Message */}
      {empNoticeMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-line w-full max-w-sm p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                {empNoticeMessage.type === "success" ? "Success" : "Error"}
              </h3>
              <button onClick={() => setEmpNoticeMessage(null)} className="text-ink/40 hover:text-ink">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed">{empNoticeMessage.text}</p>
            <div className="flex justify-end pt-2 border-t border-line">
              <button onClick={() => setEmpNoticeMessage(null)} className="btn btn-primary text-xs">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reveal Credentials */}
      {revealedCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-emerald-500/40 w-full max-w-md p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-ink">{revealedCreds.title}</h3>
              </div>
              <button onClick={() => setRevealedCreds(null)} className="text-ink/40 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-paper border border-line space-y-2 text-xs font-mono">
              <p className="text-ink/60 font-sans">Share these login details with the team member:</p>
              <div className="pt-2 space-y-1">
                <p><span className="text-ink/40">Name:</span> <strong className="text-ink">{revealedCreds.name}</strong></p>
                <p><span className="text-ink/40">Email:</span> <strong className="text-emerald-400">{revealedCreds.email}</strong></p>
                <p><span className="text-ink/40">Password:</span> <strong className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{revealedCreds.password}</strong></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={copyCredentials}
                className="btn btn-primary text-xs w-full flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Login Credentials
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document View & Print Modal */}
      <DocumentPreviewModal
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      {/* Issue Document Modal for Admin Co-Founders */}
      {isIssueModalOpen && (
        <IssueDocumentModal
          employees={employees}
          onClose={() => setIsIssueModalOpen(false)}
          onIssueDocument={handleIssueDocument}
        />
      )}

      {/* Modal: Dismiss Document from Admin View */}
      {deleteDocTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="card bg-paper-dark border-line w-full max-w-md p-6 space-y-4 relative shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Dismiss Document</h3>
                  <p className="text-[11px] text-ink/50">Admin View Cleanup</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteDocTarget(null)}
                className="text-ink/40 hover:text-ink p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1 text-xs">
              <p className="font-bold text-ink">{deleteDocTarget.title}</p>
              <p className="text-ink/60 font-mono text-[11px]">
                Issued to: {deleteDocTarget.employeeName} ({deleteDocTarget.verificationCode || deleteDocTarget.id})
              </p>
            </div>

            <p className="text-xs text-ink/70 leading-relaxed">
              This will remove the document from your admin overview. It remains fully active and accessible to the employee.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteDocTarget(null)}
                disabled={isDeletingDoc}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDoc}
                disabled={isDeletingDoc}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                {isDeletingDoc ? "Removing..." : "Remove from Screen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
