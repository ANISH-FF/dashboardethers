"use client";

import { useState } from "react";
import { BrandInvoice } from "@/lib/db";
import { X, Printer, ShieldCheck, FileSpreadsheet, Building2, CheckCircle2, DollarSign } from "lucide-react";

interface InvoiceModalProps {
  brandName: string;
  invoice: BrandInvoice | null;
  mode: "create" | "view";
  onClose: () => void;
  onSubmitInvoice?: (data: Partial<BrandInvoice>) => Promise<void>;
}

export function BrandInvoiceModal({ brandName, invoice, mode, onClose, onSubmitInvoice }: InvoiceModalProps) {
  const [particulars, setParticulars] = useState(
    `Monthly Retainer for Online Delivery Management – ${brandName}`
  );
  const [amount, setAmount] = useState(20000);
  const [gstRate, setGstRate] = useState(18);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<"Paid" | "Pending" | "Overdue">("Pending");
  const [notes, setNotes] = useState("Payable via NEFT/RTGS/UPI to Ethers Consultancy Pvt Ltd account.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitInvoice) return;
    setLoading(true);
    try {
      await onSubmitInvoice({
        particulars,
        amount,
        gstRate,
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

  const activeInvoice = invoice || {
    id: `inv_preview`,
    brandId: "1",
    brandName,
    invoiceNumber: `ETH-INV-${Date.now().toString().slice(-6)}`,
    issueDate,
    dueDate,
    particulars,
    amount,
    gstRate,
    gstAmount: (amount * gstRate) / 100,
    totalAmount: amount + (amount * gstRate) / 100,
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
                {mode === "create" ? `Generate B2B GST Invoice – ${brandName}` : `Tax Invoice ${activeInvoice.invoiceNumber}`}
              </h3>
              <p className="text-[11px] text-ink/50 font-mono">B2B Retainer Billing & Payment Telemetry</p>
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
              <label className="label">Invoice Line Particulars / Services</label>
              <input
                type="text"
                required
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Retainer Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="label">GST Rate (%)</label>
                <input
                  type="number"
                  required
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="input font-mono"
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
                className="input"
              />
            </div>

            {/* Calculated Breakdown Summary */}
            <div className="p-4 rounded-xl bg-paper-dark border border-line space-y-1.5 font-mono">
              <div className="flex justify-between text-ink/60">
                <span>Subtotal:</span>
                <span>₹{amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span>GST ({gstRate}%):</span>
                <span>₹{((amount * gstRate) / 100).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-emerald-400 border-t border-line pt-2">
                <span>Total Payable:</span>
                <span>₹{(amount + (amount * gstRate) / 100).toLocaleString("en-IN")}</span>
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
          /* Printable Tax Invoice View */
          <div className="p-8 sm:p-12 bg-white text-zinc-900 overflow-y-auto flex-1 font-sans printable-area no-scrollbar relative">
            <div className="relative z-10">
              {/* Header Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-6 mb-6">
                <div className="flex items-center gap-3">
                  <img src="/uploads/logo.png" alt="Ethers Logo" className="w-10 h-10 object-contain brightness-0" />
                  <div>
                    <h1 className="text-2xl font-black uppercase text-zinc-900 tracking-wider">Ethers Consultancy</h1>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Official B2B Tax Invoice</p>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-600">
                  <p className="font-bold text-zinc-900">Ethers Consultancy Pvt Ltd</p>
                  <p>20 Maharshi Debendra Road, Kolkata 700007</p>
                  <p>GSTIN: 19AAACE1234F1Z5</p>
                  <p>contact@ethers.in | www.ethers.in</p>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="flex justify-between items-start mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
                <div>
                  <p className="text-zinc-500">Billed To (Partner Brand):</p>
                  <p className="text-base font-bold text-zinc-900">{activeInvoice.brandName}</p>
                  <p className="text-zinc-600 font-mono mt-0.5">Account Status: {activeInvoice.status}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-zinc-500">Invoice Number:</p>
                  <p className="font-bold text-zinc-900 text-sm">{activeInvoice.invoiceNumber}</p>
                  <p className="text-zinc-500 mt-1">Issue Date: <span className="text-zinc-800">{activeInvoice.issueDate}</span></p>
                  <p className="text-zinc-500">Due Date: <span className="text-zinc-800 font-bold">{activeInvoice.dueDate}</span></p>
                </div>
              </div>

              {/* Invoice Table */}
              <table className="w-full text-xs border-collapse border border-zinc-200 bg-white mb-6">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 font-bold uppercase text-zinc-700">
                    <th className="p-3 text-left">Particulars / Scope of Service</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium">
                  <tr>
                    <td className="p-4 leading-relaxed">
                      <p className="font-bold text-zinc-900">{activeInvoice.particulars}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        End-to-end Online Delivery growth strategy, aggregator management, menu engineering & performance telemetry.
                      </p>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">
                      ₹{activeInvoice.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                  <tr className="bg-zinc-50 font-mono">
                    <td className="p-3 text-right text-zinc-600 font-sans">Subtotal:</td>
                    <td className="p-3 text-right font-bold text-zinc-800">₹{activeInvoice.amount.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr className="bg-zinc-50 font-mono">
                    <td className="p-3 text-right text-zinc-600 font-sans">GST ({activeInvoice.gstRate}%):</td>
                    <td className="p-3 text-right font-bold text-zinc-800">₹{activeInvoice.gstAmount.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr className="bg-zinc-900 text-white font-mono text-sm">
                    <td className="p-3 text-right font-sans font-bold uppercase">Total Payable Amount:</td>
                    <td className="p-3 text-right font-black text-emerald-400">₹{activeInvoice.totalAmount.toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>

              {/* Bank Transfer Details */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-xs mb-8">
                <div>
                  <p className="font-bold text-zinc-900 mb-1">Bank Remittance Account:</p>
                  <p className="text-zinc-600 font-mono">Account Name: Ethers Consultancy Pvt Ltd</p>
                  <p className="text-zinc-600 font-mono">Bank: HDFC Bank (Burrabazar Branch)</p>
                  <p className="text-zinc-600 font-mono">A/C No: 50200088991122</p>
                  <p className="text-zinc-600 font-mono">IFSC Code: HDFC0000142</p>
                </div>
                <div>
                  <p className="font-bold text-zinc-900 mb-1">Terms & Conditions:</p>
                  <p className="text-zinc-600 leading-relaxed">{activeInvoice.notes}</p>
                </div>
              </div>

              {/* Signature */}
              <div className="pt-6 border-t border-zinc-200 flex justify-between items-end text-xs">
                <div className="text-zinc-400 font-mono text-[10px]">
                  Computer generated official invoice • Verified by Ethers Consultancy OS
                </div>
                <div className="text-right">
                  <div className="h-10 border-b border-zinc-400 w-44 flex items-end justify-end pb-1 font-serif italic text-zinc-800 font-bold text-sm">
                    Authorized Signatory
                  </div>
                  <p className="font-bold text-zinc-900 mt-1">Ethers Consultancy Pvt Ltd</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
