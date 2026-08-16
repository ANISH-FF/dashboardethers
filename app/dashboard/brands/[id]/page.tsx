"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  FileText,
  Building,
  Clock,
  Users,
  Camera,
  UtensilsCrossed,
  Link as LinkIcon,
  ImageIcon,
  Plus,
  Trash2,
  Eye,
  FileSpreadsheet,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { useBrand, Brand, BrandInvoice, BrandProposal } from "@/components/BrandContext";
import { BrandInvoiceModal } from "@/components/brands/BrandInvoiceModal";
import { BrandProposalModal } from "@/components/brands/BrandProposalModal";

function DocField({ label, value, icon: Icon, type = "text" }: { label: string; value: string; icon: any; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <input 
        type={type} 
        defaultValue={value} 
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-all focus:border-ink focus:ring-1 focus:ring-ink"
      />
    </div>
  );
}

export default function BrandDetail({ params }: { params: { id: string } }) {
  const { brands, addBrandInvoice, addBrandProposal, removeBrandInvoice, removeBrandProposal } = useBrand();

  const [session, setSession] = useState<{ email: string; name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSession({ email: d.email, name: d.name, role: d.role });
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = !session || session.role === "admin"; // Co-founder has full access

  const [invoiceModal, setInvoiceModal] = useState<{ mode: "create" | "view"; invoice: BrandInvoice | null } | null>(null);
  const [proposalModal, setProposalModal] = useState<{ mode: "create" | "view"; proposal: BrandProposal | null } | null>(null);

  const brand: Brand = brands.find((b) => b.id === params.id) || {
    id: params.id,
    name: "Restaurant Partner",
    type: "Multi Cuisine",
    status: "Active",
    invoices: [],
    proposals: [],
  };

  const invoices = brand.invoices || [];
  const proposals = brand.proposals || [];

  const handleCreateInvoice = async (invoiceData: Partial<BrandInvoice>) => {
    await addBrandInvoice(brand.id, invoiceData);
    setInvoiceModal(null);
  };

  const handleCreateProposal = async (proposalData: Partial<BrandProposal>) => {
    await addBrandProposal(brand.id, proposalData);
    setProposalModal(null);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    await removeBrandInvoice(brand.id, invoiceId);
  };

  const handleDeleteProposal = async (proposalId: string) => {
    await removeBrandProposal(brand.id, proposalId);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/brands" className="p-2 rounded-lg hover:bg-line transition-colors text-ink/60 hover:text-ink">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-ink tracking-tight">{brand.name}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {brand.type}
              </span>
            </div>
            <p className="text-sm text-ink/50">
              {isAdmin ? "Brand Information, Commercial Proposals & B2B Invoices" : "Brand Legal Details, Contacts & Media Assets"}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInvoiceModal({ mode: "create", invoice: null })}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              + New Invoice
            </button>
            <button
              onClick={() => setProposalModal({ mode: "create", proposal: null })}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              + New Proposal
            </button>
          </div>
        )}
      </div>

      {/* Commercial Proposals & B2B Billing Cards (Visible ONLY to Co-Founders) */}
      {isAdmin && (
        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* B2B Invoices Module */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-ink">B2B Billing & Invoices</h2>
                  <p className="text-[11px] text-ink/50">GST Invoices & Retainer Records</p>
                </div>
              </div>
              <button
                onClick={() => setInvoiceModal({ mode: "create", invoice: null })}
                className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Invoice
              </button>
            </div>

            {invoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink/40 space-y-2 border border-dashed border-line rounded-xl">
                <FileSpreadsheet className="w-6 h-6 mx-auto text-ink/30" />
                <p>No invoices generated for {brand.name} yet.</p>
                <button
                  onClick={() => setInvoiceModal({ mode: "create", invoice: null })}
                  className="text-emerald-400 hover:underline font-semibold text-xs"
                >
                  Create First B2B Invoice
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-lg bg-paper-dark border border-line flex items-center justify-between text-xs hover:border-ink/30 transition-all"
                  >
                    <div>
                      <p className="font-mono font-bold text-ink">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-ink/50 mt-0.5">{inv.particulars}</p>
                      <p className="text-[10px] text-ink/40 font-mono mt-0.5">Date: {inv.issueDate} • Due: {inv.dueDate}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-mono font-bold text-emerald-400 text-sm">₹{inv.totalAmount.toLocaleString("en-IN")}</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {inv.status}
                        </span>
                        <button
                          onClick={() => setInvoiceModal({ mode: "view", invoice: inv })}
                          className="p-1 text-ink/50 hover:text-ink rounded transition-colors"
                          title="View / Print Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-1 text-ink/40 hover:text-red-400 rounded transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Growth Proposals Module */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-ink">Growth Strategy Proposals</h2>
                  <p className="text-[11px] text-ink/50">90-Day Delivery Roadmap & Commercial Retainer</p>
                </div>
              </div>
              <button
                onClick={() => setProposalModal({ mode: "create", proposal: null })}
                className="text-xs text-purple-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create Proposal
              </button>
            </div>

            {proposals.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink/40 space-y-2 border border-dashed border-line rounded-xl">
                <Sparkles className="w-6 h-6 mx-auto text-ink/30" />
                <p>No proposals created for {brand.name} yet.</p>
                <button
                  onClick={() => setProposalModal({ mode: "create", proposal: null })}
                  className="text-purple-400 hover:underline font-semibold text-xs"
                >
                  Generate Tasteera-Style Proposal (Editable)
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                {proposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-3 rounded-lg bg-paper-dark border border-line flex items-center justify-between text-xs hover:border-ink/30 transition-all"
                  >
                    <div>
                      <p className="font-bold text-ink">{prop.proposalTitle}</p>
                      <p className="text-[11px] text-ink/50 mt-0.5">{prop.durationDays}-Day Strategy Roadmap • Signed by {prop.signatoryName}</p>
                      <p className="text-[10px] text-ink/40 font-mono mt-0.5">Created: {prop.date}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-mono font-bold text-purple-400 text-sm">₹{prop.retainerAmount.toLocaleString("en-IN")}/mo</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setProposalModal({ mode: "view", proposal: prop })}
                          className="p-1 text-ink/50 hover:text-ink rounded transition-colors"
                          title="View / Print Proposal"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProposal(prop.id)}
                          className="p-1 text-ink/40 hover:text-red-400 rounded transition-colors"
                          title="Delete Proposal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal, Contact & Assets Modules (Visible to EVERYONE) */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* B2B Invoices Module */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">B2B Billing & Invoices</h2>
                <p className="text-[11px] text-ink/50">GST Invoices & Retainer Records</p>
              </div>
            </div>
            <button
              onClick={() => setInvoiceModal({ mode: "create", invoice: null })}
              className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Issue Invoice
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink/40 space-y-2 border border-dashed border-line rounded-xl">
              <FileSpreadsheet className="w-6 h-6 mx-auto text-ink/30" />
              <p>No invoices generated for {brand.name} yet.</p>
              <button
                onClick={() => setInvoiceModal({ mode: "create", invoice: null })}
                className="text-emerald-400 hover:underline font-semibold text-xs"
              >
                Create First B2B Invoice
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 rounded-lg bg-paper-dark border border-line flex items-center justify-between text-xs hover:border-ink/30 transition-all"
                >
                  <div>
                    <p className="font-mono font-bold text-ink">{inv.invoiceNumber}</p>
                    <p className="text-[11px] text-ink/50 mt-0.5">{inv.particulars}</p>
                    <p className="text-[10px] text-ink/40 font-mono mt-0.5">Date: {inv.issueDate} • Due: {inv.dueDate}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-mono font-bold text-emerald-400 text-sm">₹{inv.totalAmount.toLocaleString("en-IN")}</p>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {inv.status}
                      </span>
                      <button
                        onClick={() => setInvoiceModal({ mode: "view", invoice: inv })}
                        className="p-1 text-ink/50 hover:text-ink rounded transition-colors"
                        title="View / Print Invoice"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-1 text-ink/40 hover:text-red-400 rounded transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Growth Proposals Module */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">Growth Strategy Proposals</h2>
                <p className="text-[11px] text-ink/50">90-Day Delivery Roadmap & Commercial Retainer</p>
              </div>
            </div>
            <button
              onClick={() => setProposalModal({ mode: "create", proposal: null })}
              className="text-xs text-purple-400 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create Proposal
            </button>
          </div>

          {proposals.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink/40 space-y-2 border border-dashed border-line rounded-xl">
              <Sparkles className="w-6 h-6 mx-auto text-ink/30" />
              <p>No proposals created for {brand.name} yet.</p>
              <button
                onClick={() => setProposalModal({ mode: "create", proposal: null })}
                className="text-purple-400 hover:underline font-semibold text-xs"
              >
                Generate Tasteera-Style Proposal (Editable)
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className="p-3 rounded-lg bg-paper-dark border border-line flex items-center justify-between text-xs hover:border-ink/30 transition-all"
                >
                  <div>
                    <p className="font-bold text-ink">{prop.proposalTitle}</p>
                    <p className="text-[11px] text-ink/50 mt-0.5">{prop.durationDays}-Day Strategy Roadmap • Signed by {prop.signatoryName}</p>
                    <p className="text-[10px] text-ink/40 font-mono mt-0.5">Created: {prop.date}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-mono font-bold text-purple-400 text-sm">₹{prop.retainerAmount.toLocaleString("en-IN")}/mo</p>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setProposalModal({ mode: "view", proposal: prop })}
                        className="p-1 text-ink/50 hover:text-ink rounded transition-colors"
                        title="View / Print Proposal"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProposal(prop.id)}
                        className="p-1 text-ink/40 hover:text-red-400 rounded transition-colors"
                        title="Delete Proposal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legal & Business Details */}
        <div className="card space-y-6">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Legal & Business Details</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <DocField label="FSSAI Number" value="10012011000629" icon={FileText} />
            <DocField label="GST Number" value="22AAAAA0000A1Z5" icon={FileText} />
            <DocField label="PAN Card" value="ABCDE1234F" icon={FileText} />
            <DocField label="Bank Details (AC/IFSC)" value="123456789 / HDFC0001234" icon={Building} />
            <DocField label="Timing" value="11:00 AM - 11:00 PM" icon={Clock} />
            <DocField label="Cuisine" value={brand.type} icon={UtensilsCrossed} />
          </div>
        </div>

        {/* Contact Information */}
        <div className="card space-y-6">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Contact Information</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <DocField label="Owner Name" value="Rahul Sharma" icon={Users} />
            <DocField label="Owner Number" value="+91 9876543210" icon={Users} />
            <DocField label="Manager Name" value="Amit Kumar" icon={Users} />
            <DocField label="Manager Number" value="+91 9123456789" icon={Users} />
          </div>
        </div>

        {/* Assets & Media */}
        <div className="card space-y-6 lg:col-span-2">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Assets & Media</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <DocField label="Offline Menu Link" value="https://drive.google.com/..." icon={LinkIcon} type="url" />
            <DocField label="Facade Shoot" value="https://drive.google.com/..." icon={Camera} type="url" />
            <DocField label="Food & Ambience Images" value="https://drive.google.com/..." icon={ImageIcon} type="url" />
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {invoiceModal && (
        <BrandInvoiceModal
          brandName={brand.name}
          invoice={invoiceModal.invoice}
          mode={invoiceModal.mode}
          onClose={() => setInvoiceModal(null)}
          onSubmitInvoice={handleCreateInvoice}
        />
      )}

      {/* Proposal Modal */}
      {proposalModal && (
        <BrandProposalModal
          brandName={brand.name}
          proposal={proposalModal.proposal}
          mode={proposalModal.mode}
          onClose={() => setProposalModal(null)}
          onSubmitProposal={handleCreateProposal}
        />
      )}
    </div>
  );
}
