"use client";

import { useState, useRef } from "react";
import { BrandInvoice } from "@/lib/db";
import { X, Printer, ShieldCheck, FileSpreadsheet, Building2, CheckCircle2, DollarSign, Image as ImageIcon, FileText } from "lucide-react";
import { downloadDocumentAsImage } from "@/lib/exportDocument";

interface InvoiceModalProps {
  brandName: string;
  invoice: BrandInvoice | null;
  mode: "create" | "view";
  onClose: () => void;
  onSubmitInvoice?: (data: Partial<BrandInvoice>) => Promise<void>;
}

export function BrandInvoiceModal({ brandName, invoice, mode, onClose, onSubmitInvoice }: InvoiceModalProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const [particulars, setParticulars] = useState(
    `Monthly Retainer for Online Delivery Management – ${brandName}`
  );
  const [amount, setAmount] = useState(20000);
  const [gstRate, setGstRate] = useState(0);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<"Paid" | "Pending" | "Overdue">("Pending");
  const [notes, setNotes] = useState("Payable via NEFT/RTGS/UPI to Ethers Consultancy Kotak Mahindra account.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitInvoice) return;
    setLoading(true);
    try {
      await onSubmitInvoice({
        particulars,
        amount,
        gstRate: 0,
        issueDate,
        dueDate,
        status,
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
      await downloadDocumentAsImage(docRef.current, `Invoice_${brandName}_${activeInvoice.invoiceNumber}`);
    } finally {
      setDownloading(false);
    }
  };

  const activeInvoice = invoice || {
    id: `inv_preview`,
    brandId: "1",
    brandName,
    invoiceNumber: `ETH-INV-${Date.now().toString().slice(-6)}`,
    issueDate,
    dueDate,
    particulars,
    amount,
    gstRate: 0,
    gstAmount: 0,
    totalAmount: amount,
    status,
    notes,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-3xl max-h-[95vh] flex flex-col p-0 shadow-2xl overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto">
        
        {/* Top Header */}
        <div className="p-4 border-b border-line bg-paper-dark flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {mode === "create" ? `Generate B2B Invoice – ${brandName}` : `Invoice ${activeInvoice.invoiceNumber}`}
              </h3>
              <p className="text-[11px] text-ink/50 font-mono">B2B Retainer Billing & Payment Telemetry</p>
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
            <div>
              <label className="label">Invoice Line Particulars / Services</label>
              <input
                type="text"
                required
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                className="input font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Retainer Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="input font-mono font-bold text-emerald-400"
                />
              </div>
              <div>
                <label className="label">Payment Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="input font-bold"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="label">Payment Instructions & Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input leading-relaxed"
              />
            </div>

            {/* Calculated Breakdown Summary */}
            <div className="p-4 rounded-xl bg-paper-dark border border-line space-y-1.5 font-mono">
              <div className="flex justify-between font-bold text-sm text-emerald-400">
                <span>Total Amount Payable:</span>
                <span>₹{amount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary text-xs">
                {loading ? "Generating..." : "Generate B2B Invoice"}
              </button>
            </div>
          </form>
        ) : (
          /* Printable Single-Page Luxury Gold Double-Frame Tax Invoice View */
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
                    <h1 className="text-xl sm:text-2xl font-sans font-extrabold text-zinc-900 tracking-[0.2em] uppercase">
                      INVOICE
                    </h1>
                  </div>

                  {/* Ref & Date Row */}
                  <div className="flex items-center justify-between text-xs font-sans font-bold text-[#2C322C] pt-1.5 pb-2 border-b border-[#989B5F]/50 relative z-10">
                    <div className="font-mono text-zinc-600 font-medium">Invoice No: {activeInvoice.invoiceNumber}</div>
                    <div>Date: {activeInvoice.issueDate}</div>
                  </div>
                </div>

                {/* Billed To & Remittance Meta Box */}
                <div className="text-xs font-sans text-[#2C322C] text-left relative z-10 max-w-3xl mx-auto w-full grid grid-cols-2 gap-4 p-3 bg-zinc-50 rounded border border-zinc-200">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Billed To (Client / Partner Brand):</p>
                    <p className="text-base font-bold text-zinc-900 mt-0.5">{activeInvoice.brandName}</p>
                    <p className="text-[11px] text-zinc-600 mt-1">Status: <span className={`font-bold uppercase ${activeInvoice.status === "Paid" ? "text-emerald-700 font-black" : "text-zinc-900 font-black"}`}>{activeInvoice.status}</span></p>
                  </div>

                  <div className="text-right font-mono">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Payment Details:</p>
                    <p className="text-[11px] text-zinc-700 mt-0.5">Issue Date: <strong className="text-zinc-900">{activeInvoice.issueDate}</strong></p>
                    <p className="text-[11px] text-zinc-700">Due Date: <strong className="text-zinc-900">{activeInvoice.dueDate}</strong></p>
                  </div>
                </div>

                {/* Particulars & Amount Table (Clean & Classy Non-GST) */}
                <div className="text-left relative z-10 space-y-1.5 max-w-3xl mx-auto w-full">
                  <h3 className="text-[11px] font-sans font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-0.5">
                    Services & Retainer Breakup
                  </h3>
                  <table className="w-full text-xs font-sans border-collapse border border-zinc-200 bg-white">
                    <thead>
                      <tr className="bg-zinc-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-2.5 text-left">Particulars / Scope of Service</th>
                        <th className="p-2.5 text-right w-44">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 font-medium">
                      <tr>
                        <td className="p-3 leading-relaxed">
                          <p className="font-bold text-zinc-900 text-xs">{activeInvoice.particulars}</p>
                          <p className="text-[10.5px] text-zinc-500 mt-0.5">
                            Full digital storefront optimization, menu engineering, margin burn tracking, aggregator ad management & weekly growth telemetry reporting.
                          </p>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-sm text-zinc-900">
                          ₹{activeInvoice.amount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                      <tr className="bg-zinc-900 text-white font-mono text-xs">
                        <td className="p-3 text-right font-sans font-bold uppercase tracking-wider">Total Net Amount Payable:</td>
                        <td className="p-3 text-right font-black text-sm text-emerald-400">₹{activeInvoice.amount.toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bank Account Remittance Details Box */}
                <div className="text-left relative z-10 max-w-3xl mx-auto w-full grid grid-cols-2 gap-4 p-3 rounded bg-zinc-50 border border-zinc-200 text-[11px]">
                  <div>
                    <p className="font-bold text-zinc-900 mb-1 uppercase tracking-wider text-[10px]">Bank Remittance Details:</p>
                    <p className="text-zinc-700 font-mono">Account Name: <strong>Ethers Consultancy</strong></p>
                    <p className="text-zinc-700 font-mono">Bank Name: <strong>KOTAK MAHINDRA (HOWRAH BRANCH)</strong></p>
                    <p className="text-zinc-700 font-mono">Account No: <strong>4056265826</strong></p>
                    <p className="text-zinc-700 font-mono">IFSC Code: <strong>KKBK0006566</strong></p>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 mb-1 uppercase tracking-wider text-[10px]">Payment Terms & Notes:</p>
                    <p className="text-zinc-600 leading-relaxed italic">{activeInvoice.notes}</p>
                  </div>
                </div>

                {/* Dual Co-Founders Signatures Footer (Solid Line with Clean Transparent Signature Overlay) */}
                <div className="flex items-end justify-between w-full pt-4 max-w-3xl mx-auto border-t border-zinc-200">
                  <div className="text-center flex flex-col items-center">
                    <img src="/uploads/Hemanyasignature.jpeg" alt="Hemanya Signature" className="h-16 sm:h-20 w-auto object-contain mix-blend-multiply -mb-1 max-w-[220px]" />
                    <div className="w-44 h-0.5 bg-zinc-900 mb-1"></div>
                    <div className="font-serif font-bold text-xs text-zinc-900">Hemanya Gupta</div>
                    <div className="font-sans text-[10px] text-zinc-600">Co-Founder & Director</div>
                  </div>

                  <div className="text-center flex flex-col items-center">
                    <img src="/uploads/tanishasignature.jpeg" alt="Tanisha Signature" className="h-16 sm:h-20 w-auto object-contain mix-blend-multiply -mb-1 max-w-[220px]" />
                    <div className="w-44 h-0.5 bg-zinc-900 mb-1"></div>
                    <div className="font-serif font-bold text-xs text-zinc-900">Tanisha Maity</div>
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
