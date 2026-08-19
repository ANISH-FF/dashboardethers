"use client";

import { useState, useRef } from "react";
import { BrandProposal } from "@/lib/db";
import { X, Printer, ShieldCheck, FileText, CheckCircle2, TrendingUp, Sparkles, Utensils, Award, Image as ImageIcon } from "lucide-react";
import { downloadDocumentAsImage } from "@/lib/exportDocument";

interface ProposalModalProps {
  brandName: string;
  proposal: BrandProposal | null;
  mode: "create" | "view";
  onClose: () => void;
  onSubmitProposal?: (data: Partial<BrandProposal>) => Promise<void>;
}

export function BrandProposalModal({ brandName, proposal, mode, onClose, onSubmitProposal }: ProposalModalProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [proposalCategory, setProposalCategory] = useState<"delivery" | "dineout">(
    proposal?.category || "delivery"
  );

  const [clientOwnerName, setClientOwnerName] = useState(proposal?.clientOwnerName || "");
  const [clientOwnerPhone, setClientOwnerPhone] = useState(proposal?.clientOwnerPhone || "");

  const [proposalTitle, setProposalTitle] = useState(
    proposal?.proposalTitle ||
      (proposalCategory === "delivery"
        ? `Proposal for Online Delivery & Online Reservation Growth Strategy – ${brandName}`
        : `Proposal for Online Reservation Growth Strategy – ${brandName}`)
  );

  const [retainerAmount, setRetainerAmount] = useState<number>(
    proposal?.retainerAmount || (proposalCategory === "delivery" ? 12000 : 15000)
  );
  const [retainerPeriod, setRetainerPeriod] = useState(proposal?.retainerPeriod || "month");
  const [durationDays, setDurationDays] = useState<number>(
    proposal?.durationDays || (proposalCategory === "delivery" ? 90 : 180)
  );
  const [reviewMonths, setReviewMonths] = useState<number>(
    proposal?.reviewMonths || (proposalCategory === "delivery" ? 3 : 6)
  );
  const [signatoryName, setSignatoryName] = useState(proposal?.signatoryName || "Hemanya Gupta & Tanisha Maity");
  const [signatoryRole, setSignatoryRole] = useState(proposal?.signatoryRole || "Co-Founders & Directors, Ethers Consultancy");
  const [signatoryPhone, setSignatoryPhone] = useState(proposal?.signatoryPhone || "+91 8961361024 / +91 7063866220");
  const [date, setDate] = useState(proposal?.date || new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(
    proposal?.notes ||
      `The proposed commercials will be reviewed and revised after ${proposalCategory === "delivery" ? "3" : "6"} months, based on performance and scope alignment.`
  );
  const [loading, setLoading] = useState(false);

  const handleCategorySwitch = (cat: "delivery" | "dineout") => {
    setProposalCategory(cat);
    if (cat === "delivery") {
      setProposalTitle(`Proposal for Online Delivery & Online Reservation Growth Strategy – ${brandName}`);
      setRetainerAmount(12000);
      setDurationDays(90);
      setReviewMonths(3);
      setNotes("The proposed commercials will be reviewed and revised after 3 months, based on performance and scope alignment.");
    } else {
      setProposalTitle(`Proposal for Online Reservation Growth Strategy – ${brandName}`);
      setRetainerAmount(15000);
      setDurationDays(180);
      setReviewMonths(6);
      setNotes("The proposed commercials will be reviewed and revised after 6 months, based on performance and scope alignment.");
    }
  };

  const deliveryDeliverables = [
    "1. Onboarding & Platform Integration: Complete business profile setup, location accuracy, menu mapping, creatives & backend order flow alignment.",
    "2. Menu Re-Engineering & Combos: Margin analysis, high-margin winner identification, delivery-optimized combos & signature item positioning.",
    "3. Pricing & Burn Management: Competitor benchmarking, smart ROI-driven discounting, commission negotiations & dynamic seasonal pricing.",
    "4. Market, Customer & Data Analytics: Zone analytics, customer cohort retention, repeat order trends, AOV & data-backed telemetry translation.",
    "5. Aggregator Management & Platform Marketing: Complete handling of platform escalations, commercial negotiations & ROI ad spend execution.",
    "6. 10 Days MIS & Telemetry Tracking: 10-day MIS reporting covering orders, cancellations, discounts, ad spend & real-time dashboard.",
  ];

  const dineoutDeliverables = [
    "1. Onboarding & Platform Integration: End-to-end profile optimization across reservation aggregators to ensure maximum discoverability.",
    "2. Menu Hygiene & Signature Items: Menu performance analysis, contribution margin restructuring & signature item promotion.",
    "3. Pricing & Burn Management: Price benchmarking, smart non-peak hour discounting & commission terms optimization.",
    "4. Market, Customer & Footfall Research: Diner cohort behavior analysis, repeat footfall retention & continuous competitor tracking.",
    "5. Aggregator Management & Marketing: Table booking escalations handling, commercial negotiations, platform ad campaigns & influencer collabs.",
    "6. 10 Days MIS & Table Bookings Telemetry: 10-day MIS reporting for table bookings, cover revenue, ad spend & quick KPI monitoring.",
  ];

  const currentDeliverables = proposalCategory === "delivery" ? deliveryDeliverables : dineoutDeliverables;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitProposal) return;
    setLoading(true);
    try {
      await onSubmitProposal({
        category: proposalCategory,
        clientOwnerName,
        clientOwnerPhone,
        proposalTitle,
        retainerAmount,
        retainerPeriod,
        durationDays,
        reviewMonths,
        signatoryName,
        signatoryRole,
        signatoryPhone,
        date,
        deliverables: currentDeliverables,
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

  const handleDownloadPng = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      await downloadDocumentAsImage(docRef.current, `Proposal_${brandName}_${activeProposal.category}`);
    } finally {
      setDownloading(false);
    }
  };

  const activeProposal = proposal || {
    id: `prop_preview`,
    brandId: "1",
    brandName,
    category: proposalCategory,
    clientOwnerName,
    clientOwnerPhone,
    proposalTitle,
    date,
    retainerAmount,
    retainerPeriod,
    durationDays,
    reviewMonths,
    signatoryName,
    signatoryRole,
    signatoryPhone,
    deliverables: currentDeliverables,
    notes,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-4xl max-h-[95vh] flex flex-col p-0 shadow-2xl overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto">
        
        {/* Top Action Header */}
        <div className="p-4 border-b border-line bg-paper-dark flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {mode === "create" ? `Create Growth Proposal – ${brandName}` : activeProposal.proposalTitle}
              </h3>
              <p className="text-[11px] text-ink/50 font-mono">Official Ethers Commercial Proposal Template</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <>
                <button
                  onClick={handleDownloadPng}
                  disabled={downloading}
                  className="btn btn-primary text-xs flex items-center gap-1.5 font-bold shadow-md"
                  title="Download 100% exact HD PNG image with zero bottom space"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> {downloading ? "Saving..." : "Download HD Image"}
                </button>
                <button
                  onClick={handlePrint}
                  className="p-1.5 rounded-lg border border-line text-ink/70 hover:text-ink hover:bg-paper-dark"
                  title="Browser Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {mode === "create" ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar text-xs">
            {/* Category Select Toggles */}
            <div className="space-y-1">
              <label className="label">Select Proposal Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCategorySwitch("delivery")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                    proposalCategory === "delivery"
                      ? "bg-amber-500/10 border-amber-500 text-amber-300 shadow-sm"
                      : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Online Delivery Proposal</div>
                    <div className="text-[10px] text-ink/50">90-Day Delivery Roadmap & Aggregator Retainer</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleCategorySwitch("dineout")}
                  className={`p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                    proposalCategory === "dineout"
                      ? "bg-purple-500/10 border-purple-500 text-purple-300 shadow-sm"
                      : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Online Dineout Proposal</div>
                    <div className="text-[10px] text-ink/50">180-Day Reservation Roadmap & Table Footfall</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="label">Proposal Title</label>
              <input
                type="text"
                required
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                className="input font-semibold"
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
                <label className="label">Billing Frequency</label>
                <input
                  type="text"
                  value={retainerPeriod}
                  onChange={(e) => setRetainerPeriod(e.target.value)}
                  className="input font-mono"
                  placeholder="per month"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client Name (Owner / Partner)</label>
                <input
                  type="text"
                  required
                  value={clientOwnerName}
                  onChange={(e) => setClientOwnerName(e.target.value)}
                  className="input font-semibold"
                  placeholder="e.g. Mr. Varun Kharbanda"
                />
              </div>
              <div>
                <label className="label">Client Mobile Number</label>
                <input
                  type="text"
                  required
                  value={clientOwnerPhone}
                  onChange={(e) => setClientOwnerPhone(e.target.value)}
                  className="input font-mono"
                  placeholder="e.g. +91 98300 12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ethers Signatories</label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  className="input font-semibold"
                />
              </div>
              <div>
                <label className="label">Ethers Role</label>
                <input
                  type="text"
                  value={signatoryRole}
                  onChange={(e) => setSignatoryRole(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Commercial Review Terms & Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input leading-relaxed"
              />
            </div>

            <div className="p-3 rounded-xl bg-paper-dark border border-line space-y-1 text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Reference 9-Pillar Scope Pre-Loaded ({proposalCategory.toUpperCase()}):
              </span>
              <p className="text-ink/60 text-[11px] leading-relaxed">
                Pre-loaded with exact 9-point scope extracted from official reference proposal documents. Formatted to render inside single A4 printable page with gold double-frame.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary text-xs">
                {loading ? "Generating..." : `Generate ${proposalCategory === "delivery" ? "Delivery" : "Dineout"} Proposal`}
              </button>
            </div>
          </form>
        ) : (
          /* Printable Single-Page Luxury Gold Double-Frame View */
          <div className="p-4 sm:p-8 bg-white text-zinc-900 overflow-y-auto flex-1 font-sans printable-area no-scrollbar">
            <div ref={docRef} className="bg-white border-[5px] border-solid border-[#989B5F] p-2 rounded-sm shadow-md printable-certificate">
              <div className="border-2 border-solid border-[#989B5F] p-6 sm:p-8 text-center space-y-4 bg-white text-[#2C322C] relative overflow-hidden flex flex-col justify-between min-h-[750px]">
                
                {/* Top Header Block */}
                <div className="space-y-2">
                  <div className="flex flex-col items-center justify-center gap-1.5 relative z-10">
                    <img 
                      src="/uploads/logo.png" 
                      alt="Ethers Consultancy Logo" 
                      className="h-12 sm:h-16 w-auto object-contain max-w-[240px]"
                    />
                    <h2 className="text-xs sm:text-sm font-sans font-extrabold uppercase tracking-[0.25em] text-[#2C322C]">
                      ETHERS CONSULTANCY
                    </h2>
                  </div>

                  {/* Main Title */}
                  <div className="pt-1 relative z-10">
                    <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#2F3119] tracking-tight">
                      {activeProposal.proposalTitle}
                    </h1>
                  </div>

                  {/* Ref & Date Row */}
                  <div className="flex items-center justify-between text-xs font-sans font-bold text-[#2C322C] pt-1.5 pb-2 border-b border-[#989B5F]/50 relative z-10">
                    <div className="font-mono text-zinc-600 font-medium">Ref: ETH-PROP-2026-{activeProposal.id.slice(-6)}</div>
                    <div>Date: {activeProposal.date || "17-August-2026"}</div>
                  </div>
                </div>

                {/* Client Welcome Note */}
                <div className="text-xs font-serif text-[#2C322C] leading-normal text-left space-y-1.5 relative z-10 max-w-3xl mx-auto">
                  <div className="font-sans text-[11px] pb-1 border-b border-zinc-200 flex justify-between items-center">
                    <span>Client / Brand: <strong className="font-bold text-[#2F3119]">{activeProposal.brandName}</strong></span>
                    <span className="uppercase font-bold tracking-wider text-[10px] text-zinc-900 font-mono">
                      {activeProposal.category === "dineout" ? "Dineout Reservation Roadmap" : "Online Delivery Growth Roadmap"} ({activeProposal.durationDays || 90} Days)
                    </span>
                  </div>
                  <p className="pt-1">
                    We are pleased to present this structured growth proposal for <strong className="font-sans font-bold text-[#2F3119]">{activeProposal.brandName}</strong>, designed to strengthen aggregator discoverability, optimize margin burn, and drive sustainable revenue growth.
                  </p>
                </div>

                {/* 9-Point Executive Scope Grid */}
                <div className="text-left relative z-10 space-y-1.5 max-w-3xl mx-auto w-full">
                  <h3 className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#2F3119] border-b border-[#989B5F]/40 pb-0.5">
                    Executive Scope of Services & Deliverables ({activeProposal.durationDays}-Day Plan)
                  </h3>
                  <div className="grid grid-cols-1 gap-1 text-[10.5px] font-sans text-zinc-800 leading-snug">
                    {(activeProposal.deliverables || currentDeliverables).map((item, idx) => (
                      <div key={idx} className="p-1.5 bg-zinc-50/90 rounded border border-zinc-200/80">
                        <p className="font-medium">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commercials Table */}
                <div className="text-left relative z-10 space-y-1.5 max-w-3xl mx-auto w-full">
                  <h3 className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#2F3119] border-b border-[#989B5F]/40 pb-0.5">
                    Proposed Commercial Investment
                  </h3>
                  <table className="w-full text-xs font-sans border-collapse border border-zinc-200 bg-white">
                    <thead>
                      <tr className="bg-[#2F3119] text-white font-bold uppercase text-[10px]">
                        <th className="p-2.5 text-left">Particulars</th>
                        <th className="p-2.5 text-right w-44">Retainer Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2.5">
                          <p className="font-bold text-zinc-900 text-xs">
                            Monthly Retainer for {activeProposal.category === "dineout" ? "Online Reservations & Footfall Strategy" : "Online Delivery & Aggregator Growth"} – {activeProposal.brandName}
                          </p>
                          <p className="text-[10px] text-zinc-500 italic">
                            Includes complete execution of all 6 roadmap deliverables across platforms.
                          </p>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-sm text-zinc-900">
                          Rs. {activeProposal.retainerAmount.toLocaleString("en-IN")} / {activeProposal.retainerPeriod}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] font-sans text-zinc-700 italic bg-zinc-50 p-1.5 rounded border border-zinc-200">
                    Note: {activeProposal.notes}
                  </p>
                </div>

                {/* Confidentiality Notice */}
                <div className="text-[9.5px] font-sans text-zinc-500 leading-tight italic border-t border-zinc-200 pt-1.5 max-w-3xl mx-auto text-left">
                  "All data, strategy documents, and commercial terms under this proposal are strictly confidential between Ethers Consultancy and {activeProposal.brandName}."
                </div>

                {/* Triple Signatures Footer (Left: Hemanya, Middle: Client Owner, Right: Tanisha) */}
                <div className="grid grid-cols-3 gap-3 w-full pt-2 max-w-3xl mx-auto items-end text-center">
                  {/* Left: Hemanya */}
                  <div className="flex flex-col items-center">
                    <img src="/uploads/Hemanyasignature.jpeg" alt="Hemanya Signature" className="w-36 sm:w-44 h-16 sm:h-20 object-contain mix-blend-multiply -mb-2.5 max-w-full" />
                    <div className="w-32 sm:w-40 h-0.5 bg-[#2F3119] mb-1"></div>
                    <div className="font-serif font-bold text-xs text-[#2C322C]">Hemanya Gupta</div>
                    <div className="font-sans text-[10px] text-zinc-600">Co-Founder & Director</div>
                  </div>

                  {/* Middle: Client Owner */}
                  <div className="flex flex-col items-center justify-end h-full">
                    <div className="h-16 sm:h-20 w-full flex items-end justify-center pb-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 font-sans -mb-0.5">(Client Signature)</span>
                    </div>
                    <div className="w-32 sm:w-40 h-0.5 bg-[#2F3119] mb-1"></div>
                    <div className="font-serif font-bold text-xs text-[#2C322C]">{activeProposal.clientOwnerName || "Client Name"}</div>
                    <div className="font-sans text-[10px] text-zinc-600 font-mono">{activeProposal.clientOwnerPhone || "Client Mobile"}</div>
                  </div>

                  {/* Right: Tanisha */}
                  <div className="flex flex-col items-center">
                    <img src="/uploads/tanishasignature.jpeg" alt="Tanisha Signature" className="w-36 sm:w-44 h-16 sm:h-20 object-contain mix-blend-multiply -mb-2.5 max-w-full" />
                    <div className="w-32 sm:w-40 h-0.5 bg-[#2F3119] mb-1"></div>
                    <div className="font-serif font-bold text-xs text-[#2C322C]">Tanisha Maity</div>
                    <div className="font-sans text-[10px] text-zinc-600">Co-Founder & Director</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
