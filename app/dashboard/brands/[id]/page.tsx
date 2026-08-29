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
  Check,
} from "lucide-react";
import { useBrand, Brand, BrandInvoice, BrandProposal } from "@/components/BrandContext";
import { BrandInvoiceModal } from "@/components/brands/BrandInvoiceModal";
import { BrandProposalModal } from "@/components/brands/BrandProposalModal";

function DocField({
  label,
  value,
  placeholder,
  icon: Icon,
  type = "text",
  onChange,
  onBlur,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon: any;
  type?: string;
  onChange?: (val: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange && onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-all focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-ink/25 disabled:opacity-60"
      />
    </div>
  );
}

export default function BrandDetail({ params }: { params: { id: string } }) {
  const { brands, updateBrandDetails, addBrandInvoice, addBrandProposal, removeBrandInvoice, removeBrandProposal } = useBrand();

  const [session, setSession] = useState<{ email: string; name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.role) {
          setSession({ email: d.email, name: d.name, role: d.role });
        }
      })
      .catch(() => {});
  }, []);

  // ONLY Co-Founders (admin role) can see or manage Proposals & B2B Invoices
  const isAdmin = session?.role === "admin";

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

  const [formData, setFormData] = useState({
    fssaiNumber: brand.fssaiNumber || "",
    gstNumber: brand.gstNumber || "",
    panCard: brand.panCard || "",
    bankDetails: brand.bankDetails || "",
    timing: brand.timing || "",
    cuisine: brand.cuisine || brand.type || "",
    ownerName: brand.ownerName || "",
    ownerNumber: brand.ownerNumber || "",
    managerName: brand.managerName || "",
    managerNumber: brand.managerNumber || "",
    offlineMenuLink: brand.offlineMenuLink || "",
    facadeShootLink: brand.facadeShootLink || "",
    foodImagesLink: brand.foodImagesLink || "",
  });

  const [savingDetails, setSavingDetails] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (brand) {
      setFormData({
        fssaiNumber: brand.fssaiNumber || "",
        gstNumber: brand.gstNumber || "",
        panCard: brand.panCard || "",
        bankDetails: brand.bankDetails || "",
        timing: brand.timing || "",
        cuisine: brand.cuisine || brand.type || "",
        ownerName: brand.ownerName || "",
        ownerNumber: brand.ownerNumber || "",
        managerName: brand.managerName || "",
        managerNumber: brand.managerNumber || "",
        offlineMenuLink: brand.offlineMenuLink || "",
        facadeShootLink: brand.facadeShootLink || "",
        foodImagesLink: brand.foodImagesLink || "",
      });
    }
  }, [
    brand.id,
    brand.fssaiNumber,
    brand.gstNumber,
    brand.panCard,
    brand.bankDetails,
    brand.timing,
    brand.cuisine,
    brand.ownerName,
    brand.ownerNumber,
    brand.managerName,
    brand.managerNumber,
    brand.offlineMenuLink,
    brand.facadeShootLink,
    brand.foodImagesLink,
  ]);

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try {
      await updateBrandDetails(brand.id, formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error("Failed to save brand details:", e);
    } finally {
      setSavingDetails(false);
    }
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
        {/* Legal & Business Details */}
        <div className="card space-y-6">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Legal & Business Details</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <DocField 
              label="FSSAI Number" 
              value={formData.fssaiNumber} 
              placeholder="e.g. 10012011000629"
              icon={FileText} 
              onChange={(v) => handleFieldChange("fssaiNumber", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="GST Number" 
              value={formData.gstNumber} 
              placeholder="e.g. 22AAAAA0000A1Z5"
              icon={FileText} 
              onChange={(v) => handleFieldChange("gstNumber", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="PAN Card" 
              value={formData.panCard} 
              placeholder="e.g. ABCDE1234F"
              icon={FileText} 
              onChange={(v) => handleFieldChange("panCard", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Bank Details (AC/IFSC)" 
              value={formData.bankDetails} 
              placeholder="e.g. 123456789 / HDFC0001234"
              icon={Building} 
              onChange={(v) => handleFieldChange("bankDetails", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Timing" 
              value={formData.timing} 
              placeholder="e.g. 11:00 AM - 11:00 PM"
              icon={Clock} 
              onChange={(v) => handleFieldChange("timing", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Cuisine" 
              value={formData.cuisine} 
              placeholder="e.g. Cloud Kitchen / Multi Cuisine"
              icon={UtensilsCrossed} 
              onChange={(v) => handleFieldChange("cuisine", v)}
              onBlur={handleSaveDetails}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="card space-y-6">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Contact Information</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <DocField 
              label="Owner Name" 
              value={formData.ownerName} 
              placeholder="Enter Owner Name"
              icon={Users} 
              onChange={(v) => handleFieldChange("ownerName", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Owner Number" 
              value={formData.ownerNumber} 
              placeholder="e.g. +91 9876543210"
              icon={Users} 
              onChange={(v) => handleFieldChange("ownerNumber", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Manager Name" 
              value={formData.managerName} 
              placeholder="Enter Manager Name"
              icon={Users} 
              onChange={(v) => handleFieldChange("managerName", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Manager Number" 
              value={formData.managerNumber} 
              placeholder="e.g. +91 9123456789"
              icon={Users} 
              onChange={(v) => handleFieldChange("managerNumber", v)}
              onBlur={handleSaveDetails}
            />
          </div>
        </div>

        {/* Assets & Media */}
        <div className="card space-y-6 lg:col-span-2">
          <h2 className="text-sm font-bold border-b border-line pb-2 text-ink">Assets & Media</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <DocField 
              label="Offline Menu Link" 
              value={formData.offlineMenuLink} 
              placeholder="https://drive.google.com/..."
              icon={LinkIcon} 
              type="url" 
              onChange={(v) => handleFieldChange("offlineMenuLink", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Facade Shoot Link" 
              value={formData.facadeShootLink} 
              placeholder="https://drive.google.com/..."
              icon={Camera} 
              type="url" 
              onChange={(v) => handleFieldChange("facadeShootLink", v)}
              onBlur={handleSaveDetails}
            />
            <DocField 
              label="Food & Ambience Images" 
              value={formData.foodImagesLink} 
              placeholder="https://drive.google.com/..."
              icon={ImageIcon} 
              type="url" 
              onChange={(v) => handleFieldChange("foodImagesLink", v)}
              onBlur={handleSaveDetails}
            />
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
