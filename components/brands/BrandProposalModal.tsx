"use client";

import { useState } from "react";
import { BrandProposal } from "@/lib/db";
import { X, Printer, ShieldCheck, FileText, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";

interface ProposalModalProps {
  brandName: string;
  proposal: BrandProposal | null;
  mode: "create" | "view";
  onClose: () => void;
  onSubmitProposal?: (data: Partial<BrandProposal>) => Promise<void>;
}

export function BrandProposalModal({ brandName, proposal, mode, onClose, onSubmitProposal }: ProposalModalProps) {
  const [proposalTitle, setProposalTitle] = useState(
    `Proposal for Online Delivery Growth Strategy – ${brandName}`
  );
  const [retainerAmount, setRetainerAmount] = useState(20000);
  const [retainerPeriod, setRetainerPeriod] = useState("Month");
  const [durationDays, setDurationDays] = useState(90);
  const [reviewMonths, setReviewMonths] = useState(3);
  const [signatoryName, setSignatoryName] = useState("Tanisha Maity");
  const [signatoryRole, setSignatoryRole] = useState("Co-Founder, Ethers Consultancy");
  const [signatoryPhone, setSignatoryPhone] = useState("+91 7063866220");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(
    "The proposed commercials will be reviewed and revised after 3 months, based on performance and scope alignment."
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitProposal) return;
    setLoading(true);
    try {
      await onSubmitProposal({
        proposalTitle,
        retainerAmount,
        retainerPeriod,
        durationDays,
        reviewMonths,
        signatoryName,
        signatoryRole,
        signatoryPhone,
        date,
        notes,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeProposal = proposal || {
    id: `prop_preview`,
    brandId: "1",
    brandName,
    proposalTitle,
    date,
    retainerAmount,
    retainerPeriod,
    durationDays,
    reviewMonths,
    signatoryName,
    signatoryRole,
    signatoryPhone,
    deliverables: [
      "1. Aggregator Onboarding & Optimization (Profile setup, menu, pricing, high-quality visuals & order flow configuration)",
      "2. Menu Re-Engineering (High/low item margin analysis, contribution optimization, combos & signature item positioning)",
      "3. Pricing & Burn Management (Competitor benchmarking, smart discounting strategies without margin erosion)",
      "4. Market & Customer Insights (High-potential delivery zones identification, repeat order retention & competitor tracking)",
      "5. Data Tracking & Performance Analysis (AOV, order trends, repeat rates & ROI telemetry translation into actions)",
      "6. Aggregator Management (End-to-end issue resolution, commission & ad spend optimization support)",
      "7. Marketing & Brand Visibility (Platform-specific ad campaigns with ROI tracking, content & banner optimization)",
    ],
    notes,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-4xl max-h-[95vh] flex flex-col p-0 shadow-2xl overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto">
        
        {/* Top Header */}
        <div className="p-4 border-b border-line bg-paper-dark flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {mode === "create" ? `Create Growth Proposal – ${brandName}` : activeProposal.proposalTitle}
              </h3>
              <p className="text-[11px] text-ink/50 font-mono">Executive F&B Growth Plan & Retainer Commercials</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <button onClick={handlePrint} className="btn btn-secondary text-xs flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print / Download PDF
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {mode === "create" ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar text-xs">
            <div>
              <label className="label">Proposal Title</label>
              <input
                type="text"
                required
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Monthly Retainer Fee (₹)</label>
                <input
                  type="number"
                  required
                  value={retainerAmount}
                  onChange={(e) => setRetainerAmount(Number(e.target.value))}
                  className="input font-mono font-bold text-emerald-400"
                />
              </div>
              <div>
                <label className="label">Fee Billing Frequency</label>
                <input
                  type="text"
                  value={retainerPeriod}
                  onChange={(e) => setRetainerPeriod(e.target.value)}
                  className="input font-mono"
                  placeholder="e.g. Month"
                />
              </div>
              <div>
                <label className="label">Roadmap Duration (Days)</label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="label">Review Timeline (Months)</label>
                <input
                  type="number"
                  value={reviewMonths}
                  onChange={(e) => setReviewMonths(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Proposal Signatory Name</label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  className="input font-semibold"
                />
              </div>
              <div>
                <label className="label">Signatory Role</label>
                <input
                  type="text"
                  value={signatoryRole}
                  onChange={(e) => setSignatoryRole(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Contact Phone</label>
                <input
                  type="text"
                  value={signatoryPhone}
                  onChange={(e) => setSignatoryPhone(e.target.value)}
                  className="input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="label">Commercial Review Terms & Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input leading-relaxed"
              />
            </div>

            <div className="p-4 rounded-xl bg-paper-dark border border-line space-y-1 text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Executive 7-Pillar Scope Included Automatically:
              </span>
              <p className="text-ink/60 text-[11px] leading-relaxed">
                Includes Aggregator Onboarding, Menu Re-engineering, Pricing & Burn Management, Market & Customer Insights, Data Telemetry Tracking, Aggregator Management, and Platform Marketing.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary text-xs">
                {loading ? "Generating..." : "Generate Growth Proposal"}
              </button>
            </div>
          </form>
        ) : (
          /* Printable Growth Proposal View */
          <div className="p-8 sm:p-12 bg-white text-zinc-900 overflow-y-auto flex-1 font-sans printable-area no-scrollbar relative space-y-8">
            <div className="relative z-10">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-6 mb-6">
                <div className="flex items-center gap-3">
                  <img src="/uploads/logo.png" alt="Ethers Logo" className="w-10 h-10 object-contain brightness-0" />
                  <div>
                    <h1 className="text-2xl font-black uppercase text-zinc-900 tracking-wider">Ethers Consultancy</h1>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">F&B Brand Growth & Commercial Proposal</p>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-600">
                  <p className="font-bold text-zinc-900">Ethers Consultancy</p>
                  <p>20 Maharshi Debendra Road, Kolkata 700007</p>
                  <p>contact@ethers.in | www.ethers.in</p>
                </div>
              </div>

              {/* Title Section */}
              <div className="text-center space-y-2 mb-8 bg-zinc-50 p-6 rounded-xl border border-zinc-200">
                <h2 className="text-2xl font-extrabold text-zinc-900 tracking-wide">{activeProposal.proposalTitle}</h2>
                <p className="text-xs text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                  We are pleased to present a structured Online Delivery Growth Plan for <strong>{activeProposal.brandName}</strong>, designed to strengthen your presence on food aggregators and drive sustainable revenue growth. This proposal focuses on data-led decision-making, cost optimization, menu performance enhancement, and platform-specific marketing.
                </p>
              </div>

              {/* 7 Pillars Roadmap */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-2">
                  Online Delivery Growth Plan ({activeProposal.durationDays}-Day Roadmap)
                </h3>
                <div className="grid gap-3 text-xs">
                  {(activeProposal.deliverables || []).map((item, idx) => (
                    <div key={idx} className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                      <p className="font-bold text-zinc-900">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed Commercials Table (Matching Tasteera PDF) */}
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-2">
                  Proposed Commercials
                </h3>
                <table className="w-full text-xs border-collapse border border-zinc-200 bg-white">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-200 font-bold uppercase text-zinc-700">
                      <th className="p-3 text-left">Particulars</th>
                      <th className="p-3 text-right">Amt.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-medium">
                    <tr>
                      <td className="p-4 leading-relaxed">
                        <p className="font-bold text-zinc-900 text-sm">
                          Monthly Retainer for Online Delivery Management – {activeProposal.brandName}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1 italic">
                          Includes complete execution of all 7 roadmap pillars across Zomato & Swiggy.
                        </p>
                      </td>
                      <td className="p-4 text-right font-mono font-black text-sm text-zinc-900">
                        Rs. {activeProposal.retainerAmount.toLocaleString("en-IN")}/ {activeProposal.retainerPeriod}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-zinc-600 italic bg-amber-50/50 p-3 rounded border border-amber-200">
                  Note: {activeProposal.notes}
                </p>
              </div>

              <p className="text-xs text-zinc-700 leading-relaxed mb-8">
                We believe this focused approach will help <strong>{activeProposal.brandName}</strong> build a strong and profitable presence on online delivery platforms while maintaining healthy margins and consistent growth.
              </p>

              {/* Signatory Footer */}
              <div className="pt-6 border-t border-zinc-200 flex justify-between items-end text-xs">
                <div>
                  <p className="font-bold text-zinc-900 text-sm">Warm Regards,</p>
                  <p className="font-bold text-zinc-900 mt-3 text-base">{activeProposal.signatoryName}</p>
                  <p className="text-zinc-600">{activeProposal.signatoryRole}</p>
                  <p className="text-zinc-600 font-mono">{activeProposal.signatoryPhone}</p>
                </div>
                <div className="text-right text-zinc-400 font-mono text-[10px]">
                  Official Document generated by Ethers Consultancy OS
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
