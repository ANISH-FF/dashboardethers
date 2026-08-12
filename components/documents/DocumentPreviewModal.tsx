"use client";

import { EmployeeDocument } from "@/lib/documents";
import { X, Printer, Download, Award, FileText, CheckCircle2, ShieldCheck, TrendingUp, UserCheck, Briefcase } from "lucide-react";

interface ModalProps {
  document: EmployeeDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ document: doc, onClose }: ModalProps) {
  if (!doc) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-3xl max-h-[95vh] flex flex-col p-0 shadow-2xl overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto">
        
        {/* Modal Top Action Header (hidden in print) */}
        <div className="p-4 border-b border-line bg-paper-dark flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {doc.type === "certificate" ? <Award className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink">{doc.title}</h3>
              <p className="text-[11px] text-ink/50 font-mono">Issued to: {doc.employeeName} ({doc.employeeEmail})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink hover:bg-paper-dark"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="p-8 sm:p-12 bg-white text-zinc-900 overflow-y-auto flex-1 font-sans printable-area no-scrollbar relative">
          
          {/* Document Content Wrapper */}
          <div className="relative z-10">
            
            {/* Company Letterhead Header (Hidden for Standalone Certificate) */}
            {doc.type !== "certificate" && (
              <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-6 mb-8">
                <div>
                  <div className="flex items-center gap-3">
                    <img 
                      src="/uploads/logo.png" 
                      alt="Ethers Consultancy Logo" 
                      className="w-10 h-10 object-contain brightness-0"
                    />
                    <div>
                      <h1 className="text-2xl font-black tracking-wider uppercase text-zinc-900">Ethers Consultancy</h1>
                      <p className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">F&B Brand Engineering & Operations Suite</p>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-600 space-y-0.5 max-w-xs">
                  <p className="font-bold text-zinc-900">Ethers Consultancy Pvt Ltd</p>
                  <p>20 Maharshi Debendra Road, Raja Katra, Burrabazar, Kolkata 700007</p>
                  <p>contact@ethers.in | www.ethers.in</p>
                </div>
              </div>
            )}

            {/* Document Type Badge & Reference Code (Hidden for Standalone Certificate) */}
            {doc.type !== "certificate" && (
              <div className="flex items-center justify-between mb-8 text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-semibold">
                  <ShieldCheck className="w-4 h-4" /> Official Verified HR Record
                </div>
                <div className="text-zinc-500">
                  Ref: <span className="font-bold text-zinc-800">{doc.verificationCode}</span>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 1: PAYSLIP ---------------- */}
            {doc.type === "payslip" && (
              <div className="space-y-6 relative p-4 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50/30">
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-zinc-900">Salary Slip - {doc.monthYear || "July 2026"}</h2>
                    <p className="text-xs text-zinc-500">Date of Issue: {doc.issueDate}</p>
                  </div>

                  {/* Employee Summary Box */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-white border border-zinc-200 text-xs">
                    <div>
                      <p className="text-zinc-500">Employee Name:</p>
                      <p className="font-bold text-zinc-900 text-sm">{doc.employeeName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Designation:</p>
                      <p className="font-bold text-zinc-900">{doc.designation}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Employee Email:</p>
                      <p className="font-mono text-zinc-800">{doc.employeeEmail}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Payment Status:</p>
                      <p className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed via Bank Transfer
                      </p>
                    </div>
                  </div>

                  {/* Salary Components Table */}
                  <table className="w-full text-xs border-collapse border border-zinc-200 bg-white">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 font-bold uppercase text-zinc-700">
                        <th className="p-3 text-left">Earnings & Allowances</th>
                        <th className="p-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 font-medium">
                      <tr>
                        <td className="p-3">Basic Pay</td>
                        <td className="p-3 text-right font-mono">₹{(doc.salaryDetails?.basic || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td className="p-3">House Rent Allowance (HRA)</td>
                        <td className="p-3 text-right font-mono">₹{(doc.salaryDetails?.hra || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td className="p-3">Special Allowances & Performance Bonus</td>
                        <td className="p-3 text-right font-mono">₹{(doc.salaryDetails?.allowances || 0).toLocaleString("en-IN")}</td>
                      </tr>
                      {Boolean(doc.salaryDetails?.deductions) && (
                        <tr>
                          <td className="p-3 text-rose-700">Deductions (TDS / PF)</td>
                          <td className="p-3 text-right font-mono text-rose-700">-₹{(doc.salaryDetails?.deductions || 0).toLocaleString("en-IN")}</td>
                        </tr>
                      )}
                      <tr className="bg-zinc-50 font-bold text-sm">
                        <td className="p-3 text-zinc-900">Total Net Salary Paid</td>
                        <td className="p-3 text-right text-emerald-700 font-mono">
                          ₹{(doc.salaryDetails?.netSalary || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 2: OFFER LETTER (1-PAGE COMPACT) ---------------- */}
            {doc.type === "offer_letter" && (
              <div className="space-y-6 leading-relaxed text-sm text-zinc-800 relative">
                <div className="space-y-6">
                  <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                    <div>
                      <p className="text-xs text-zinc-500">Date: {doc.issueDate}</p>
                      <p className="font-bold text-zinc-900 mt-2">To: {doc.employeeName}</p>
                      <p className="text-xs text-zinc-600">{doc.employeeEmail}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 rounded bg-zinc-100 border text-xs font-bold text-zinc-800 uppercase">
                        Offer of Employment (1-Page)
                      </span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 mb-2">Subject: Letter of Appointment - {doc.designation}</h2>
                    <p>Dear <strong>{doc.employeeName}</strong>,</p>
                  </div>

                  <p>
                    On behalf of <strong>Ethers Consultancy</strong>, we are thrilled to extend this formal offer of employment for the position of <strong>{doc.designation}</strong>. Your scheduled joining date is <strong>{doc.joiningDate || doc.issueDate}</strong>.
                  </p>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-2">
                    <p className="font-bold text-zinc-900 text-sm mb-1">Compensation & Position Summary:</p>
                    <div className="grid grid-cols-2 gap-2 font-medium">
                      <div>Designation: <span className="font-bold">{doc.designation}</span></div>
                      <div>Monthly Fixed Salary: <span className="font-bold font-mono">₹{(doc.salaryDetails?.netSalary || 0).toLocaleString("en-IN")} / month</span></div>
                      <div>Work Mode: <span className="font-bold">Full Time / Remote Hybrid</span></div>
                      <div>Reporting Authority: <span className="font-bold">Co-Founders</span></div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-700">
                    {doc.content || "You will be driving core F&B consulting projects, menu engineering, pricing analytics, and brand operations across our partner network."}
                  </p>

                  <p className="text-xs">
                    We look forward to achieving extraordinary milestones together at Ethers Consultancy!
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 3: EMPLOYMENT LETTER (TERMS & CONDITIONS) ---------------- */}
            {doc.type === "employment_terms" && (
              <div className="space-y-6 leading-relaxed text-xs text-zinc-800 relative">
                <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                  <div>
                    <p className="text-xs text-zinc-500">Date of Issue: {doc.issueDate}</p>
                    <p className="font-bold text-zinc-900 text-sm mt-1">Contract For: {doc.employeeName}</p>
                    <p className="text-xs text-zinc-600">{doc.employeeEmail} • {doc.designation}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 uppercase">
                      Employment Agreement & Terms
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide">Standard Employment Terms & Conditions Agreement</h2>
                  
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                    <p className="font-bold text-zinc-900 text-sm">1. Position & Joining Schedule</p>
                    <p>The employee is appointed as <strong>{doc.designation}</strong> with effective joining date <strong>{doc.joiningDate || doc.issueDate}</strong>. Reporting directly to the Board of Co-Founders.</p>
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                    <p className="font-bold text-zinc-900 text-sm">2. Compensation & Salary Schedule</p>
                    <p>Fixed monthly net payout is set to <strong>₹{(doc.salaryDetails?.netSalary || 0).toLocaleString("en-IN")} / month</strong>, payable on or before the 5th of every calendar month via Direct Bank Transfer.</p>
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                    <p className="font-bold text-zinc-900 text-sm">3. Probation, Leaves & Notice Period Policy</p>
                    <div className="grid grid-cols-3 gap-2 font-semibold text-zinc-900 pt-1">
                      <div className="p-2 bg-white rounded border">Probation Period: {doc.probationMonths || 3} Months</div>
                      <div className="p-2 bg-white rounded border">Notice Period: {doc.noticePeriodDays || 30} Days</div>
                      <div className="p-2 bg-white rounded border">Annual Paid Leaves: {doc.annualLeaves || 18} Days</div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                    <p className="font-bold text-zinc-900 text-sm">4. Confidentiality & Non-Disclosure (NDA)</p>
                    <p>The employee agrees to maintain strict confidentiality regarding Ethers Consultancy partner brand metrics, proprietary pricing strategies, algorithms, and trade secrets during and after employment tenure.</p>
                  </div>

                  {Boolean(doc.content) && (
                    <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                      <p className="font-bold">Additional Executive Directives:</p>
                      <p className="leading-relaxed">{doc.content}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- TYPE 4: INCREMENT & REVISION LETTER ---------------- */}
            {doc.type === "increment_letter" && (
              <div className="space-y-6 leading-relaxed text-xs text-zinc-800 relative">
                <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                  <div>
                    <p className="text-xs text-zinc-500">Date of Revision: {doc.issueDate}</p>
                    <p className="font-bold text-zinc-900 text-sm mt-1">To: {doc.employeeName}</p>
                    <p className="text-xs text-zinc-600">{doc.employeeEmail} • {doc.designation}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Salary Increment Letter
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base font-bold text-zinc-900">Subject: Official Salary Revision & Compensation Hike</h2>
                  <p>Dear <strong>{doc.employeeName}</strong>,</p>
                  <p>
                    In recognition of your exceptional performance, leadership, and contributions to Ethers Consultancy operations, we are delighted to inform you that your compensation has been revised effective <strong>{doc.effectiveDate || doc.issueDate}</strong>.
                  </p>

                  {/* Increment Comparison Matrix */}
                  <div className="p-5 bg-gradient-to-r from-amber-50 to-emerald-50 border border-zinc-200 rounded-xl space-y-3">
                    <p className="font-bold text-zinc-900 text-sm">Revised Compensation Structure:</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-white rounded-lg border border-zinc-200">
                        <p className="text-zinc-500 text-[10px] uppercase font-bold">Previous Monthly CTC</p>
                        <p className="text-base font-black font-mono text-zinc-700">₹{(doc.oldSalary || 45000).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-emerald-300 shadow-sm">
                        <p className="text-emerald-700 text-[10px] uppercase font-bold">New Revised Monthly CTC</p>
                        <p className="text-base font-black font-mono text-emerald-700">₹{(doc.newSalary || 55000).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-amber-300">
                        <p className="text-amber-700 text-[10px] uppercase font-bold">Hike Percentage</p>
                        <p className="text-base font-black font-mono text-amber-700">
                          {doc.oldSalary && doc.newSalary ? (((doc.newSalary - doc.oldSalary) / doc.oldSalary) * 100).toFixed(1) : 22.2}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed">
                    {doc.content || "We deeply appreciate your commitment to building high-growth partner brands and leading operations with excellence."}
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 5: RECOMMENDATION LETTER (LOR) ---------------- */}
            {doc.type === "recommendation_letter" && (
              <div className="space-y-6 leading-relaxed text-xs text-zinc-800 relative">
                <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                  <div>
                    <p className="text-xs text-zinc-500">Date: {doc.issueDate}</p>
                    <p className="font-bold text-zinc-900 text-sm mt-1">To Whom It May Concern</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded bg-purple-50 border border-purple-200 text-xs font-bold text-purple-800 uppercase">
                      Letter of Recommendation (LOR)
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base font-bold text-zinc-900">Subject: Letter of Recommendation for {doc.employeeName}</h2>
                  <p>
                    It is my distinct pleasure to write this letter of recommendation for <strong>{doc.employeeName}</strong>, who served as <strong>{doc.designation}</strong> at Ethers Consultancy.
                  </p>

                  <p>
                    During their tenure working on <strong>{doc.projectTitle || "F&B Brand Consulting & Operational Telemetry"}</strong>, {doc.employeeName} demonstrated outstanding analytical capabilities, strong work ethic, and extraordinary problem-solving skills.
                  </p>

                  <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-purple-900 italic">
                    <p className="font-bold not-italic text-xs text-purple-950 uppercase tracking-wider">Executive Performance Summary:</p>
                    <p className="leading-relaxed">
                      "{doc.content || "They consistently exceeded operational targets, optimized client payout margins, and displayed strong teamwork and leadership capabilities under high-pressure consulting environments."}"
                    </p>
                  </div>

                  <p>
                    I endorse {doc.employeeName} without reservation for any future professional endeavors or leadership opportunities.
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 6: COMPLETION LETTER ---------------- */}
            {doc.type === "completion_letter" && (
              <div className="space-y-6 leading-relaxed text-xs text-zinc-800 relative">
                <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                  <div>
                    <p className="text-xs text-zinc-500">Date: {doc.issueDate}</p>
                    <p className="font-bold text-zinc-900 text-sm mt-1">Issued To: {doc.employeeName}</p>
                    <p className="text-xs text-zinc-600">{doc.employeeEmail} • {doc.designation}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 uppercase">
                      Letter of Completion
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base font-bold text-zinc-900">Subject: Successful Project & Service Completion</h2>
                  <p>
                    This is to formally certify that <strong>{doc.employeeName}</strong> has successfully completed their assigned service period and project deliverables as <strong>{doc.designation}</strong> at Ethers Consultancy from <strong>{doc.joiningDate || "Start Date"}</strong> to <strong>{doc.issueDate}</strong>.
                  </p>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                    <p className="font-bold text-zinc-900 text-sm">Project & Role Scope:</p>
                    <p className="font-medium text-zinc-800">{doc.projectTitle || "F&B Operations Consulting & Brand Engineering"}</p>
                    <p className="text-zinc-600 text-xs leading-relaxed">{doc.content || "All deliverables, operational audits, and client projects were completed in accordance with company quality benchmarks."}</p>
                  </div>
                  <p>
                    We wish {doc.employeeName} all the best in their future career endeavors!
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- TYPE 7: CERTIFICATE OF EMPLOYMENT (PREMIUM ELEGANT) ---------------- */}
            {doc.type === "certificate" && (
              <div className="bg-white border-[5px] border-solid border-[#989B5F] p-2.5 rounded-sm shadow-md my-2 printable-certificate">
                <div className="border-2 border-solid border-[#989B5F] p-8 sm:p-16 text-center space-y-8 bg-white text-[#2C322C] relative overflow-hidden flex-1 flex flex-col justify-between">
                  
                  {/* Top Header Block */}
                  <div className="space-y-4">
                    {/* Top Logo & Company Name */}
                    <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                      <img 
                        src="/uploads/logo.png" 
                        alt="Ethers Consultancy Logo" 
                        className="h-16 sm:h-20 w-auto object-contain max-w-[280px]"
                      />
                      <h2 className="text-base sm:text-lg font-sans font-extrabold uppercase tracking-[0.25em] text-[#2C322C]">
                        ETHERS CONSULTANCY
                      </h2>
                    </div>

                    {/* Main Title */}
                    <div className="pt-3 relative z-10">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#2F3119] tracking-tight whitespace-nowrap">
                        Certificate of Employment
                      </h1>
                    </div>

                    {/* Date Row */}
                    <div className="flex items-center justify-end text-sm sm:text-base font-sans font-bold text-[#2C322C] pt-3 pb-4 border-b border-[#989B5F]/50 relative z-10">
                      <div>Date: 31-July-2026</div>
                    </div>
                  </div>

                  {/* Official Certificate Body Paragraphs */}
                  <div className="text-sm sm:text-base font-serif text-[#2C322C] leading-[2.1] text-left space-y-5 py-6 relative z-10 max-w-3xl mx-auto">
                    <p>
                      This is to certify that <strong className="text-[#2F3119] font-sans font-bold">"Mr. Varun Kharbanda"</strong>, was working in our company from <strong className="text-[#2F3119] font-sans font-bold">{doc.joiningDate || "5-April-2026"}</strong> to <strong className="text-[#2F3119] font-sans font-bold">31-July-2026</strong> as <strong className="text-[#2F3119] font-sans font-bold">“{doc.designation || "Growth & LinkedIn Branding Consultant"}.”</strong>
                    </p>

                    <p>
                      During their tenure of employment, we found them to be diligent and hard working.
                    </p>

                    <p>
                      In this period, their conduct and overall performance was excellent and much appreciated by the management.
                    </p>

                    <p>
                      {doc.content ? doc.content : "The management takes this opportunity to thank them for their devoted contribution and wish them all the very best for their future endeavors."}
                    </p>
                  </div>

                  {/* Bottom Footer Block */}
                  <div className="pt-10 relative z-10">
                    {/* Bottom Dual Signatures */}
                    <div className="flex justify-between items-end w-full px-4 text-center">
                      <div className="flex flex-col items-center w-72">
                        <div className="relative w-full h-[90px] flex items-end justify-center">
                          <img 
                            src="/uploads/Hemanyasignature.jpeg" 
                            alt="Hemanya Gupta Signature" 
                            className="absolute -bottom-2 h-24 sm:h-28 w-auto object-contain z-10 mix-blend-multiply filter contrast-150 brightness-95"
                          />
                          <div className="absolute bottom-[10px] w-full h-[1.5px] bg-[#2F3119] z-0" />
                        </div>
                        <p className="font-serif font-bold text-base text-[#2C322C] mt-2">Hemanya Gupta</p>
                        <p className="font-serif text-xs text-zinc-600 font-medium mt-0.5">Co-Founder & Director</p>
                      </div>

                      <div className="flex flex-col items-center w-72">
                        <div className="relative w-full h-[90px] flex items-end justify-center">
                          <img 
                            src="/uploads/tanishasignature.jpeg" 
                            alt="Tanisha Maity Signature" 
                            className="absolute -bottom-2 h-24 sm:h-28 w-auto object-contain z-10 mix-blend-multiply filter contrast-150 brightness-95"
                          />
                          <div className="absolute bottom-[10px] w-full h-[1.5px] bg-[#2F3119] z-0" />
                        </div>
                        <p className="font-serif font-bold text-base text-[#2C322C] mt-2">Tanisha Maity</p>
                        <p className="font-serif text-xs text-zinc-600 font-medium mt-0.5">Co-Founder & Director</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Formal Signatures Footer (Only for Non-Certificate Documents) */}
            {doc.type !== "certificate" && (
              <div className="mt-12 pt-8 border-t border-zinc-200 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <div className="h-16 border-b border-zinc-400 w-52 flex items-end pb-1 relative">
                    <img src="/uploads/Hemanyasignature.jpeg" alt="Hemanya Gupta Signature" className="h-20 w-auto object-contain mix-blend-multiply contrast-150 -mb-3" />
                  </div>
                  <p className="font-bold text-zinc-900 mt-1">Hemanya Gupta</p>
                  <p className="text-[11px] text-zinc-500">Co-Founder & Director</p>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="h-16 border-b border-zinc-400 w-52 flex items-end justify-end pb-1 relative">
                    <img src="/uploads/tanishasignature.jpeg" alt="Tanisha Maity Signature" className="h-20 w-auto object-contain mix-blend-multiply contrast-150 -mb-3" />
                  </div>
                  <p className="font-bold text-zinc-900 mt-1">Tanisha Maity</p>
                  <p className="text-[11px] text-zinc-500">Co-Founder & Director</p>
                </div>
              </div>
            )}

            <div className="mt-8 text-center text-[10px] text-zinc-400 font-mono">
              This document is computer generated and officially issued by Ethers Consultancy Pvt Ltd.
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
