"use client";

import { EmployeeDocument } from "@/lib/documents";
import { X, Printer, Award, FileText, CheckCircle2, ShieldCheck, TrendingUp, UserCheck, FileCheck } from "lucide-react";

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
      <div className="card bg-paper border-line w-full max-w-4xl max-h-[95vh] flex flex-col p-0 shadow-2xl overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto">
        
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
              className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md"
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

        {/* Printable Document Area */}
        <div className="p-4 sm:p-8 bg-white text-zinc-900 overflow-y-auto flex-1 font-sans printable-area no-scrollbar">
          
          {/* Classy #989B5F Double Frame Container */}
          <div className="bg-white border-[5px] border-solid border-[#989B5F] p-2.5 rounded-sm shadow-md printable-certificate">
            <div className="border-2 border-solid border-[#989B5F] p-6 sm:p-12 text-center space-y-6 bg-white text-[#2C322C] relative overflow-hidden flex flex-col justify-between min-h-[750px]">
              
              {/* Top Header Block */}
              <div className="space-y-4">
                {/* Logo & Company Name */}
                <div className="flex flex-col items-center justify-center gap-2 relative z-10">
                  <img 
                    src="/uploads/logo.png" 
                    alt="Ethers Consultancy Logo" 
                    className="h-14 sm:h-18 w-auto object-contain max-w-[260px]"
                  />
                  <h2 className="text-sm sm:text-base font-sans font-extrabold uppercase tracking-[0.25em] text-[#2C322C]">
                    ETHERS CONSULTANCY
                  </h2>
                </div>

                {/* Main Title */}
                <div className="pt-2 relative z-10">
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2F3119] tracking-tight">
                    {doc.type === "certificate" && "Certificate of Employment"}
                    {doc.type === "offer_letter" && "Offer Letter of Employment"}
                    {doc.type === "employment_terms" && "Employment Agreement Terms & Conditions"}
                    {doc.type === "increment_letter" && "Salary Increment & Revision Letter"}
                    {doc.type === "recommendation_letter" && "Letter of Recommendation"}
                    {doc.type === "completion_letter" && "Letter of Completion"}
                    {doc.type === "payslip" && `Salary Slip — ${doc.monthYear || "July 2026"}`}
                  </h1>
                </div>

                {/* Date & Ref Row */}
                <div className="flex items-center justify-between text-xs sm:text-sm font-sans font-bold text-[#2C322C] pt-2 pb-3 border-b border-[#989B5F]/50 relative z-10">
                  <div className="font-mono text-zinc-600 font-medium">Ref: {doc.verificationCode || "ETH-DOC-2026"}</div>
                  <div>Date: {doc.issueDate || "31-July-2026"}</div>
                </div>
              </div>

              {/* ---------------- 1. EMPLOYMENT CERTIFICATE ---------------- */}
              {doc.type === "certificate" && (
                <div className="text-sm sm:text-base font-serif text-[#2C322C] leading-[2.1] text-left space-y-4 py-4 relative z-10 max-w-3xl mx-auto">
                  <p>
                    This is to certify that <strong className="text-[#2F3119] font-sans font-bold">"{doc.employeeName}"</strong>, was working in our company from <strong className="text-[#2F3119] font-sans font-bold">{doc.joiningDate || "5-April-2026"}</strong> to <strong className="text-[#2F3119] font-sans font-bold">{doc.issueDate || "31-July-2026"}</strong> as <strong className="text-[#2F3119] font-sans font-bold">“{doc.designation || "Growth & LinkedIn Branding Consultant"}.”</strong>
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
              )}

              {/* ---------------- 2. OFFER LETTER OF EMPLOYMENT (FORMAL PROSE) ---------------- */}
              {doc.type === "offer_letter" && (
                <div className="text-xs sm:text-sm font-serif text-[#2C322C] leading-[1.95] text-left space-y-3.5 py-2 relative z-10 max-w-3xl mx-auto">
                  <div className="font-sans text-xs space-y-0.5 pb-2 border-b border-zinc-200">
                    <p className="font-bold text-[#2F3119] uppercase tracking-wider text-[10px]">Private & Confidential</p>
                    <p><strong className="font-bold text-zinc-900">{doc.employeeName}</strong> ({doc.employeeEmail})</p>
                    <p className="text-zinc-600">Sub: Offer for Employment as <strong className="font-bold text-zinc-900">{doc.designation}</strong></p>
                  </div>

                  <p>Dear <strong className="font-sans font-bold">{doc.employeeName}</strong>,</p>

                  <p>
                    We are thrilled to invite you to join Ethers Consultancy as our new <strong className="font-sans font-bold">{doc.designation}</strong>. At Ethers Consultancy, we focus on building a high-caliber team, and we are certain your contributions will be vital to our continued success. We look forward to providing you with a rewarding experience that is both rich in learning and professional growth.
                  </p>

                  <p>
                    <strong className="font-sans font-bold text-[#2F3119]">Role & Responsibilities:</strong> Your role at Ethers Consultancy will involve optimizing menus and pricing strategies, managing accounts for partner restaurants and cloud kitchens, and contributing to marketing initiatives to boost visibility on platforms like Swiggy and Zomato. You will also assist in analyzing performance reports, identifying improvement areas, and collaborating with partners to strengthen their digital presence.
                  </p>

                  <p>
                    <strong className="font-sans font-bold text-[#2F3119]">Duration & Commitment:</strong> This tenure begins on <strong className="font-sans font-bold">{doc.joiningDate || doc.issueDate}</strong>, in Kolkata, with a mandatory minimum commitment of <strong className="font-sans font-bold">{doc.probationMonths || 6} months</strong> for successful completion.
                  </p>

                  <p>
                    <strong className="font-sans font-bold text-[#2F3119]">Working Module (Hybrid):</strong> You will operate on a hybrid schedule, working 3 days a week on-site from our office and 3 days a week from home (WFH). Specific days will be coordinated with your reporting manager.
                  </p>

                  <p>
                    <strong className="font-sans font-bold text-[#2F3119]">Compensation & Benefits:</strong> You will receive a fixed monthly payout of <strong className="font-sans font-bold font-mono text-zinc-900">Rs. {(doc.salaryDetails?.netSalary || 5000).toLocaleString("en-IN")}/-</strong>. Additionally, you are eligible for performance incentives attributed to your work, processed upon payment receipt.
                  </p>

                  <p>
                    <strong className="font-sans font-bold text-[#2F3119]">Terms of Engagement:</strong> A notice period of <strong className="font-sans font-bold">{doc.noticePeriodDays || 30} days</strong> is required by either party. Sick leave is provided (medical certificate required), and bereavement leave is granted per company policy. A Letter of Recommendation will be awarded upon successful completion of the tenure based on performance.
                  </p>

                  <p>
                    We look forward to having you on board as we continue to grow Ethers Consultancy, and we are excited about the potential contributions you will make to our team!
                  </p>
                </div>
              )}

              {/* ---------------- 3. EMPLOYMENT AGREEMENT & TERMS (WITH CLAUSE 5) ---------------- */}
              {doc.type === "employment_terms" && (
                <div className="text-xs sm:text-sm font-serif text-[#2C322C] leading-[1.9] text-left space-y-3 py-2 relative z-10 max-w-3xl mx-auto">
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-sans space-y-1">
                    <p className="font-bold text-[#2F3119] uppercase tracking-wider text-[11px]">Standard Employment Terms & Conditions</p>
                    <p>Contract Employee: <strong className="font-bold">{doc.employeeName}</strong> • <span className="font-medium text-zinc-700">{doc.designation}</span></p>
                  </div>

                  <div className="space-y-2 text-xs font-sans">
                    <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                      <p className="font-bold text-[#2F3119] text-xs">1. Position & Joining Schedule</p>
                      <p className="text-zinc-700 mt-0.5">The employee is appointed as <strong>{doc.designation}</strong> with effective joining date <strong>{doc.joiningDate || doc.issueDate}</strong>, reporting directly to the Board of Co-Founders.</p>
                    </div>

                    <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                      <p className="font-bold text-[#2F3119] text-xs">2. Compensation & Salary Schedule</p>
                      <p className="text-zinc-700 mt-0.5">Fixed monthly net payout is set to <strong className="font-mono text-zinc-900">₹{(doc.salaryDetails?.netSalary || 0).toLocaleString("en-IN")} / month</strong>, payable on or before the 5th of every calendar month via Direct Bank Transfer.</p>
                    </div>

                    <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                      <p className="font-bold text-[#2F3119] text-xs">3. Probation, Leaves & Notice Period</p>
                      <div className="grid grid-cols-3 gap-2 font-semibold text-zinc-900 mt-1">
                        <div className="p-1.5 bg-zinc-50 rounded border text-center">Probation: {doc.probationMonths || 3} Months</div>
                        <div className="p-1.5 bg-zinc-50 rounded border text-center">Notice Period: {doc.noticePeriodDays || 30} Days</div>
                        <div className="p-1.5 bg-zinc-50 rounded border text-center">Annual Paid Leaves: {doc.annualLeaves || 18} Days</div>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                      <p className="font-bold text-[#2F3119] text-xs">4. Confidentiality & Non-Disclosure (NDA)</p>
                      <p className="text-zinc-700 mt-0.5">The employee agrees to maintain strict confidentiality regarding Ethers Consultancy partner brand metrics, proprietary pricing strategies, algorithms, and trade secrets during and after employment tenure.</p>
                    </div>

                    <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                      <p className="font-bold text-[#2F3119] text-xs">5. Data Protection, Security & Legal Remedies</p>
                      <p className="text-zinc-700 mt-0.5">The employee agrees that any unauthorized data access, breach of confidential client information, trade secret leak, or intentional misconduct will result in immediate termination of service and strict legal proceedings under applicable Cyber Laws and statutory legal remedies.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- 4. SALARY INCREMENT & REVISION LETTER ---------------- */}
              {doc.type === "increment_letter" && (
                <div className="text-xs sm:text-sm font-serif text-[#2C322C] leading-[1.95] text-left space-y-3.5 py-3 relative z-10 max-w-3xl mx-auto">
                  <p>To: <strong className="font-sans font-bold">{doc.employeeName}</strong> ({doc.designation})</p>

                  <p>Dear <strong className="font-sans font-bold">{doc.employeeName}</strong>,</p>

                  <p>
                    We wish to confirm that your performance for the recent appraisal tenure has been assessed as <strong className="font-sans font-bold text-[#2F3119]">“EE — Exceeds Expectation”</strong>. In view of your outstanding performance and contribution to meeting our organizational objectives, your compensation has been revised with effect from <strong className="font-sans font-bold">{doc.effectiveDate || doc.issueDate}</strong>.
                  </p>

                  {/* Revision Matrix */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 font-sans my-2">
                    <p className="font-bold text-[#2F3119] text-xs uppercase tracking-wider">Annual & Monthly CTC Revision Matrix:</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                        <p className="text-zinc-500 text-[10px] uppercase font-bold">Previous Monthly CTC</p>
                        <p className="text-xs sm:text-sm font-black font-mono text-zinc-700">₹{(doc.oldSalary || 45000).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-zinc-300 shadow-sm">
                        <p className="text-zinc-900 text-[10px] uppercase font-bold">Revised Monthly CTC</p>
                        <p className="text-xs sm:text-sm font-black font-mono text-zinc-900">₹{(doc.newSalary || 55000).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-zinc-300">
                        <p className="text-zinc-900 text-[10px] uppercase font-bold">Hike Percentage</p>
                        <p className="text-xs sm:text-sm font-black font-mono text-zinc-900">
                          +{doc.oldSalary && doc.newSalary ? (((doc.newSalary - doc.oldSalary) / doc.oldSalary) * 100).toFixed(1) : 22.2}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <p>
                    Variable Pay & Performance Incentive is subject to continuing in the active service of the company and not serving notice period as on the date of disbursement. All other terms and conditions of your employment remain unaltered. Your compensation details are to be treated as strictly confidential.
                  </p>
                </div>
              )}

              {/* ---------------- 5. LETTER OF RECOMMENDATION (LOR) ---------------- */}
              {doc.type === "recommendation_letter" && (
                <div className="text-xs sm:text-sm font-serif text-[#2C322C] leading-[2.0] text-left space-y-4 py-4 relative z-10 max-w-3xl mx-auto">
                  <p className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-500">To Whom It May Concern</p>

                  <p>
                    It is my distinct pleasure to write this letter of recommendation for <strong className="font-sans font-bold text-[#2F3119]">"{doc.employeeName}"</strong>, who served as <strong className="font-sans font-bold">{doc.designation}</strong> at Ethers Consultancy.
                  </p>

                  <p>
                    During their tenure working on F&B Brand Consulting, Menu Engineering & Pricing Analytics, <strong className="font-sans font-bold">{doc.employeeName}</strong> demonstrated outstanding analytical capabilities, strong work ethic, and extraordinary problem-solving skills under high-pressure consulting environments.
                  </p>

                  <p>
                    As one of our team's most productive team members, they consistently exceeded operational targets, optimized client payout margins, and displayed strong teamwork and leadership capabilities. For example, when encountering complex partner growth challenges, they addressed them with strategic initiative, positively impacting partner revenue and overall brand visibility.
                  </p>

                  <p>
                    Should you require any further information or detailed verification regarding their performance and conduct during their tenure with us, please feel free to contact the undersigned authority at <strong className="font-sans font-bold text-[#2F3119]">contact@ethers.in</strong>.
                  </p>

                  <p>
                    I endorse <strong className="font-sans font-bold">{doc.employeeName}</strong> without reservation for any future professional endeavors or leadership opportunities.
                  </p>
                </div>
              )}

              {/* ---------------- 6. LETTER OF COMPLETION (NO BLUE BOX) ---------------- */}
              {doc.type === "completion_letter" && (
                <div className="text-xs sm:text-sm font-serif text-[#2C322C] leading-[2.0] text-left space-y-4 py-4 relative z-10 max-w-3xl mx-auto">
                  <div className="pb-2 border-b border-zinc-200 font-sans text-xs space-y-0.5">
                    <p className="font-bold text-[#2F3119] uppercase tracking-wider text-[11px]">Confirmation of Employment & Service Completion</p>
                    <p className="font-bold text-zinc-900 text-sm">TO WHOM IT MAY CONCERN</p>
                  </div>

                  <p>
                    This letter serves to formally confirm that <strong className="font-sans font-bold text-[#2F3119]">"{doc.employeeName}"</strong> was associated with <strong className="font-sans font-bold">ETHERS CONSULTANCY</strong> from <strong className="font-sans font-bold">{doc.joiningDate || "5-April-2026"}</strong> to <strong className="font-sans font-bold">{doc.issueDate || "31-July-2026"}</strong> as <strong className="font-sans font-bold">“{doc.designation}.”</strong>
                  </p>

                  <p>
                    During their tenure, <strong className="font-sans font-bold">{doc.employeeName}</strong> led core F&B consulting projects, menu engineering, and operational analytics with high dedication and professional excellence. All assigned deliverables and client audits were completed in full accordance with company quality benchmarks.
                  </p>

                  <p>
                    Should you require any further information or official background verification regarding their employment record and service tenure, please feel free to reach out to our HR department or the undersigned authority at <strong className="font-sans font-bold text-[#2F3119]">contact@ethers.in</strong>.
                  </p>

                  <p>
                    We sincerely appreciate their devoted service and wish <strong className="font-sans font-bold">{doc.employeeName}</strong> continued success in all their future professional endeavors!
                  </p>
                </div>
              )}

              {/* ---------------- 7. MONTHLY PAYSLIP ---------------- */}
              {doc.type === "payslip" && (
                <div className="text-xs font-sans text-[#2C322C] space-y-4 py-3 relative z-10 max-w-3xl mx-auto text-left">
                  {/* Employee Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                    <div><span className="text-zinc-500 text-[10px]">Employee Name:</span> <p className="font-bold text-zinc-900">{doc.employeeName}</p></div>
                    <div><span className="text-zinc-500 text-[10px]">Designation:</span> <p className="font-bold text-zinc-900">{doc.designation}</p></div>
                    <div><span className="text-zinc-500 text-[10px]">Pay Period:</span> <p className="font-bold text-zinc-900 font-mono">{doc.monthYear || "July 2026"}</p></div>
                    <div><span className="text-zinc-500 text-[10px]">Employee Email:</span> <p className="font-mono text-zinc-800 text-[11px]">{doc.employeeEmail}</p></div>
                    <div><span className="text-zinc-500 text-[10px]">Work Location:</span> <p className="font-medium text-zinc-800">Kolkata / Remote Hybrid</p></div>
                    <div><span className="text-zinc-500 text-[10px]">Disbursement:</span> <p className="font-bold text-zinc-900">Direct Bank Transfer</p></div>
                  </div>

                  {/* Earnings & Deductions Table */}
                  <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 font-bold uppercase text-zinc-700">
                          <th className="p-2.5 text-left">Earnings & Allowances</th>
                          <th className="p-2.5 text-right">Amount (₹)</th>
                          <th className="p-2.5 text-left border-l border-zinc-200">Deductions</th>
                          <th className="p-2.5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 font-medium text-zinc-900">
                        <tr>
                          <td className="p-2.5">Basic Salary</td>
                          <td className="p-2.5 text-right font-mono">₹{(doc.salaryDetails?.basic || Math.round((doc.salaryDetails?.netSalary || 5000) * 0.5)).toLocaleString("en-IN")}</td>
                          <td className="p-2.5 border-l border-zinc-200">Professional Tax (PT)</td>
                          <td className="p-2.5 text-right font-mono">₹110.00</td>
                        </tr>
                        <tr>
                          <td className="p-2.5">House Rent Allowance (HRA)</td>
                          <td className="p-2.5 text-right font-mono">₹{(doc.salaryDetails?.hra || Math.round((doc.salaryDetails?.netSalary || 5000) * 0.3)).toLocaleString("en-IN")}</td>
                          <td className="p-2.5 border-l border-zinc-200">TDS / Deductions</td>
                          <td className="p-2.5 text-right font-mono">₹{(doc.salaryDetails?.deductions || 0).toLocaleString("en-IN")}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5">Special Allowance & Bonus</td>
                          <td className="p-2.5 text-right font-mono">₹{(doc.salaryDetails?.allowances || Math.round((doc.salaryDetails?.netSalary || 5000) * 0.2)).toLocaleString("en-IN")}</td>
                          <td className="p-2.5 border-l border-zinc-200 font-bold">Total Deductions</td>
                          <td className="p-2.5 text-right font-mono font-bold text-zinc-900">₹{(110 + (doc.salaryDetails?.deductions || 0)).toLocaleString("en-IN")}</td>
                        </tr>
                        <tr className="bg-zinc-100 font-bold text-sm border-t-2 border-zinc-900">
                          <td className="p-3 text-zinc-900" colSpan={2}>Net Monthly Salary Disbursed</td>
                          <td className="p-3 text-right text-zinc-900 font-mono" colSpan={2}>
                            ₹{(doc.salaryDetails?.netSalary || 5000).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic text-center">This is an officially generated digital payslip issued by Ethers Consultancy.</p>
                </div>
              )}

              {/* Bottom Footer Block — Dual Real Scanned Signatures */}
              <div className="pt-6 relative z-10">
                <div className="flex justify-between items-end w-full px-2 text-center">
                  <div className="flex flex-col items-center w-60 sm:w-64">
                    <div className="relative w-full h-[60px] flex items-end justify-center">
                      <img 
                        src="/uploads/Hemanyasignature.jpeg" 
                        alt="Hemanya Gupta Signature" 
                        className="absolute -bottom-2 h-20 sm:h-24 w-auto object-contain z-10 mix-blend-multiply filter contrast-150 brightness-95"
                      />
                      <div className="absolute bottom-[12px] w-full h-[1.5px] bg-[#2F3119] z-0" />
                    </div>
                    <p className="font-serif font-bold text-sm sm:text-base text-[#2C322C] mt-2">Hemanya Gupta</p>
                    <p className="font-serif text-[11px] sm:text-xs text-zinc-600 font-medium mt-0.5">Co-Founder & Director</p>
                  </div>

                  <div className="flex flex-col items-center w-60 sm:w-64">
                    <div className="relative w-full h-[60px] flex items-end justify-center">
                      <img 
                        src="/uploads/tanishasignature.jpeg" 
                        alt="Tanisha Maity Signature" 
                        className="absolute -bottom-2 h-20 sm:h-24 w-auto object-contain z-10 mix-blend-multiply filter contrast-150 brightness-95"
                      />
                      <div className="absolute bottom-[12px] w-full h-[1.5px] bg-[#2F3119] z-0" />
                    </div>
                    <p className="font-serif font-bold text-sm sm:text-base text-[#2C322C] mt-2">Tanisha Maity</p>
                    <p className="font-serif text-[11px] sm:text-xs text-zinc-600 font-medium mt-0.5">Co-Founder & Director</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-3 text-center text-[10px] text-zinc-400 font-mono print:hidden">
            This document is computer generated and officially issued by Ethers Consultancy.
          </div>

        </div>

      </div>
    </div>
  );
}
