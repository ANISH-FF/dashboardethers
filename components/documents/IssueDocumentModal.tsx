"use client";

import { useState } from "react";
import { DocumentType, EmployeeDocument } from "@/lib/documents";
import { X, Plus, FileText, Award, User, DollarSign, Calendar, ShieldCheck } from "lucide-react";

interface IssueModalProps {
  employees: { email: string; name: string; designation?: string }[];
  onClose: () => void;
  onIssueDocument: (docData: Partial<EmployeeDocument>) => Promise<void>;
}

export function IssueDocumentModal({ employees, onClose, onIssueDocument }: IssueModalProps) {
  const [selectedEmail, setSelectedEmail] = useState(employees[0]?.email || "");
  const [docType, setDocType] = useState<DocumentType>("payslip");
  const [title, setTitle] = useState("Monthly Salary Slip - July 2026");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split("T")[0]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthYear, setMonthYear] = useState("July 2026");
  
  // Salary details
  const [basic, setBasic] = useState(27000);
  const [hra, setHra] = useState(13500);
  const [allowances, setAllowances] = useState(4500);
  const [deductions, setDeductions] = useState(0);
  const [oldSalary, setOldSalary] = useState(45000);
  const [newSalary, setNewSalary] = useState(55000);
  
  // Terms & Conditions fields
  const [probationMonths, setProbationMonths] = useState(3);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [annualLeaves, setAnnualLeaves] = useState(18);
  const [projectTitle, setProjectTitle] = useState("F&B Operations Consulting");
  const [dateOfBirth, setDateOfBirth] = useState("");
  
  const [content, setContent] = useState("");
  const [certificateType, setCertificateType] = useState<"internship" | "experience" | "appreciation">("appreciation");
  const [loading, setLoading] = useState(false);

  const selectedEmployee = employees.find((e) => e.email === selectedEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail || !title) return;

    setLoading(true);
    try {
      const netSalary = basic + hra + allowances - deductions;
      await onIssueDocument({
        employeeEmail: selectedEmail,
        employeeName: selectedEmployee?.name || selectedEmail.split("@")[0],
        designation: selectedEmployee?.designation || "Staff Member",
        type: docType,
        certificateType: docType === "certificate" ? certificateType : undefined,
        title,
        issueDate,
        dateOfBirth: docType === "certificate" ? dateOfBirth : undefined,
        joiningDate: (docType === "offer_letter" || docType === "employment_terms" || docType === "completion_letter" || docType === "certificate") ? joiningDate : undefined,
        effectiveDate: (docType === "increment_letter" || docType === "employment_terms") ? effectiveDate : undefined,
        monthYear: docType === "payslip" ? monthYear : undefined,
        salaryDetails: { basic, hra, allowances, deductions, netSalary },
        oldSalary: docType === "increment_letter" ? oldSalary : undefined,
        newSalary: docType === "increment_letter" ? newSalary : undefined,
        probationMonths: (docType === "employment_terms" || docType === "offer_letter") ? probationMonths : undefined,
        noticePeriodDays: docType === "employment_terms" ? noticePeriodDays : undefined,
        annualLeaves: docType === "employment_terms" ? annualLeaves : undefined,
        projectTitle: (docType === "completion_letter" || docType === "recommendation_letter") ? projectTitle : undefined,
        content,
        signedBy: "Hemanya Gupta & Tanisha Maity (Co-Founders)"
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: DocumentType) => {
    setDocType(type);
    if (type === "payslip") {
      setTitle("Monthly Salary Slip - July 2026");
    } else if (type === "offer_letter") {
      setTitle("Official Offer & Appointment Letter");
    } else if (type === "employment_terms") {
      setTitle("Employment Agreement Terms & Conditions");
    } else if (type === "increment_letter") {
      setTitle("Salary Increment & Revision Letter");
    } else if (type === "recommendation_letter") {
      setTitle("Official Letter of Recommendation (LOR)");
    } else if (type === "completion_letter") {
      setTitle("Project & Service Completion Certificate");
    } else {
      setTitle("Employment Certificate");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-xl max-h-[90vh] flex flex-col p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-line bg-paper-dark flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Issue HR & Employee Document</h2>
              <p className="text-xs text-ink/50">Generate Payslips, Contracts, Increment, LOR & Certificates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 no-scrollbar text-xs">
          
          {/* Target Employee & Document Type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Select Employee</label>
              <select
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                className="input font-semibold text-ink"
              >
                {employees.map((emp) => (
                  <option key={emp.email} value={emp.email} className="bg-paper-dark text-ink">
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Document Type</label>
              <select
                value={docType}
                onChange={(e) => handleTypeChange(e.target.value as DocumentType)}
                className="input font-bold"
              >
                <option value="payslip">Monthly Payslip</option>
                <option value="offer_letter">Offer Letter (1 Page)</option>
                <option value="employment_terms">Employment Letter (Terms & Conditions)</option>
                <option value="increment_letter">Increment & Revision Letter</option>
                <option value="recommendation_letter">Letter of Recommendation (LOR)</option>
                <option value="completion_letter">Letter of Completion</option>
                <option value="certificate">Employment Certificate</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
            />
          </div>

          {/* Dates & Period Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="input font-mono"
              />
            </div>

            {docType === "payslip" && (
              <div>
                <label className="label">Pay Period (Month & Year)</label>
                <input
                  type="text"
                  value={monthYear}
                  placeholder="e.g. July 2026"
                  onChange={(e) => setMonthYear(e.target.value)}
                  className="input font-mono"
                />
              </div>
            )}

            {(docType === "offer_letter" || docType === "employment_terms" || docType === "completion_letter" || docType === "certificate") && (
              <div>
                <label className="label">Joining / Start Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="input font-mono"
                />
              </div>
            )}

            {(docType === "increment_letter" || docType === "employment_terms") && (
              <div>
                <label className="label">Effective Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="input font-mono"
                />
              </div>
            )}

            {docType === "certificate" && (
              <div>
                <label className="label">Date of Birth (Optional)</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="input font-mono"
                />
              </div>
            )}

            {docType === "certificate" && (
              <div>
                <label className="label">Certificate Category</label>
                <select
                  value={certificateType}
                  onChange={(e) => {
                    const val = e.target.value as "internship" | "experience" | "appreciation";
                    setCertificateType(val);
                    if (val === "internship") setTitle("Certificate of Internship");
                    else if (val === "experience") setTitle("Certificate of Experience");
                    else setTitle("Certificate of Employment");
                  }}
                  className="input"
                >
                  <option value="appreciation">Employment Certificate</option>
                  <option value="experience">Experience Certificate</option>
                  <option value="internship">Internship Completion</option>
                </select>
              </div>
            )}

            {docType === "offer_letter" && (
              <div>
                <label className="label">Duration & Commitment</label>
                <select
                  value={probationMonths}
                  onChange={(e) => setProbationMonths(Number(e.target.value))}
                  className="input font-mono"
                >
                  <option value={3}>3 Months Commitment</option>
                  <option value={6}>6 Months Commitment</option>
                  <option value={12}>12 Months Commitment</option>
                </select>
              </div>
            )}
          </div>

          {/* Salary Breakdown (Payslip / Offer Letter / Employment Terms) */}
          {(docType === "payslip" || docType === "offer_letter" || docType === "employment_terms") && (
            <div className="p-3.5 rounded-xl bg-paper-dark border border-line space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink/70 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Salary Structure Breakdown (₹)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Basic Pay</label>
                  <input
                    type="number"
                    value={basic}
                    onChange={(e) => setBasic(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">HRA</label>
                  <input
                    type="number"
                    value={hra}
                    onChange={(e) => setHra(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Allowances</label>
                  <input
                    type="number"
                    value={allowances}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Deductions</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
              </div>
              <div className="text-right text-xs font-bold text-emerald-400">
                Calculated Net Salary: ₹{(basic + hra + allowances - deductions).toLocaleString("en-IN")} / month
              </div>
            </div>
          )}

          {/* Increment Fields */}
          {docType === "increment_letter" && (
            <div className="p-3.5 rounded-xl bg-paper-dark border border-line space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink/70 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Salary Revision Breakdown (₹)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Previous Monthly Salary</label>
                  <input
                    type="number"
                    value={oldSalary}
                    onChange={(e) => setOldSalary(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Revised Monthly Salary</label>
                  <input
                    type="number"
                    value={newSalary}
                    onChange={(e) => setNewSalary(Number(e.target.value))}
                    className="input text-xs py-1 font-mono text-emerald-400 font-bold"
                  />
                </div>
              </div>
              {oldSalary > 0 && newSalary > 0 && (
                <div className="text-right text-xs font-bold text-amber-400">
                  Hike Percentage: {(((newSalary - oldSalary) / oldSalary) * 100).toFixed(1)}% Salary Revision
                </div>
              )}
            </div>
          )}

          {/* Terms & Conditions Specific Fields */}
          {docType === "employment_terms" && (
            <div className="p-3.5 rounded-xl bg-paper-dark border border-line space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink/70 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Terms, Probation & Policy Clauses
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Probation (Months)</label>
                  <input
                    type="number"
                    value={probationMonths}
                    onChange={(e) => setProbationMonths(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Notice Period (Days)</label>
                  <input
                    type="number"
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/50 font-medium">Annual Paid Leaves</label>
                  <input
                    type="number"
                    value={annualLeaves}
                    onChange={(e) => setAnnualLeaves(Number(e.target.value))}
                    className="input text-xs py-1 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Completion & Recommendation Fields */}
          {(docType === "completion_letter" || docType === "recommendation_letter") && (
            <div>
              <label className="label">Project / Service Scope Title</label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. F&B Operations & Revenue Consulting"
                className="input"
              />
            </div>
          )}

          {/* Custom Content / Text Body */}
          <div>
            <label className="label">Custom Document Body / Performance Remarks (Optional)</label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add specific remarks, achievements, or custom contractual clauses..."
              className="input leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              {loading ? "Issuing..." : "Generate Official Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
