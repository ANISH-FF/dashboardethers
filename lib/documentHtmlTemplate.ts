import { EmployeeDocument } from "./documents";

export function generateDocumentHtml(doc: EmployeeDocument): string {
  const logoUri = "/uploads/logo.png";
  const hemanyaSigUri = "/uploads/Hemanyasignature.jpeg";
  const tanishaSigUri = "/uploads/tanishasignature.jpeg";

  const safeTitle = 
    doc.type === "certificate" ? (
      doc.title ||
      (doc.certificateType === "internship" ? "Certificate of Internship" :
       doc.certificateType === "experience" ? "Certificate of Experience" :
       "Certificate of Employment")
    ) :
    doc.type === "offer_letter" ? (doc.title || "Offer Letter of Employment") :
    doc.type === "employment_terms" ? (doc.title || "Employment Agreement Terms & Conditions") :
    doc.type === "increment_letter" ? (doc.title || "Salary Increment & Revision Letter") :
    doc.type === "recommendation_letter" ? (doc.title || "Letter of Recommendation") :
    doc.type === "completion_letter" ? (doc.title || "Letter of Completion") :
    (doc.title || `Salary Slip — ${doc.monthYear || "July 2026"}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${safeTitle} - ${doc.employeeName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,700&family=Inter:wght@400;600;700;800&display=swap');

        @page {
            size: A4 portrait;
            margin: 0;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background: #ffffff;
            font-family: 'Playfair Display', Georgia, serif;
            color: #2C322C;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            padding: 12mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .outer-frame {
            border: 5px solid #989B5F;
            padding: 4px;
            background: #ffffff;
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }

        .inner-frame {
            border: 2px solid #989B5F;
            padding: 40px 45px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            position: relative;
            background-color: #ffffff;
            box-sizing: border-box;
        }

        .top-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }

        .company-logo {
            height: 65px;
            width: auto;
            max-width: 260px;
            object-fit: contain;
        }

        .company-name {
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.25em;
            color: #2C322C;
            text-transform: uppercase;
        }

        .main-title {
            font-size: 34px;
            font-weight: 700;
            color: #2F3119;
            white-space: nowrap;
            margin-top: 10px;
            letter-spacing: -0.5px;
        }

        .date-row {
            display: flex;
            justify-content: space-between;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 700;
            color: #2C322C;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(152, 155, 95, 0.5);
            margin-top: 8px;
            width: 100%;
        }

        .body-text {
            font-size: 15px;
            line-height: 2.1;
            text-align: left;
            margin: 20px 0;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .body-text p {
            margin-bottom: 16px;
        }

        .highlight {
            color: #2F3119;
            font-weight: 700;
            font-family: 'Inter', sans-serif;
        }

        .signatures-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            width: 100%;
            margin-top: 30px;
            padding: 0 10px;
        }

        .sig-block {
            width: 240px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .sig-img {
            height: 75px;
            width: auto;
            object-fit: contain;
            margin-bottom: 4px;
        }

        .sig-line {
            width: 100%;
            height: 1.5px;
            background-color: #2F3119;
            margin-bottom: 6px;
        }

        .sig-name {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 15px;
            font-weight: 700;
            color: #2C322C;
        }

        .sig-title {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 12px;
            color: #555555;
            font-weight: 500;
            margin-top: 2px;
        }

        .table-box {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            margin: 15px 0;
        }

        .table-box th, .table-box td {
            border: 1px solid #e4e4e7;
            padding: 8px 12px;
        }

        .table-box th {
            background-color: #f4f4f5;
            font-weight: 700;
            text-transform: uppercase;
            color: #3f3f46;
        }
    </style>
</head>
<body>
    <div class="outer-frame">
        <div class="inner-frame">
            
            <div class="top-header">
                <img src="${logoUri}" alt="Ethers Logo" class="company-logo" />
                <div class="company-name">ETHERS CONSULTANCY</div>
                <div class="main-title">${safeTitle}</div>
                <div class="date-row">
                    <span>Ref: ${doc.verificationCode || "ETH-DOC-2026"}</span>
                    <span>Date: ${doc.issueDate || "31-July-2026"}</span>
                </div>
            </div>

            <div class="body-text">
                ${doc.type === "certificate" ? `
                    <p>This is to certify that <span class="highlight">"${doc.employeeName}"</span>${doc.dateOfBirth ? `, with date of birth <span class="highlight">${doc.dateOfBirth}</span>` : ""}, was working in our company from <span class="highlight">${doc.joiningDate || "5-April-2026"}</span> to <span class="highlight">${doc.issueDate || "31-July-2026"}</span> as <span class="highlight">“${doc.designation || "Growth & LinkedIn Branding Consultant"}.”</span></p>
                    <p>During their tenure of employment, we found them to be diligent and hard working.</p>
                    <p>In this period, their conduct and overall performance was excellent and much appreciated by the management.</p>
                    <p>${doc.content ? doc.content : "The management takes this opportunity to thank them for their devoted contribution and wish them all the very best for their future endeavors."}</p>
                ` : ""}

                ${doc.type === "offer_letter" ? `
                    <p style="font-family: 'Inter', sans-serif; font-size: 12px; margin-bottom: 12px;"><strong>Private & Confidential</strong><br/>Recipient: <strong>${doc.employeeName}</strong> (${doc.employeeEmail})<br/>Sub: Offer for Employment as <strong>${doc.designation}</strong></p>
                    <p>Dear <span class="highlight">${doc.employeeName}</span>,</p>
                    <p>We are thrilled to invite you to join Ethers Consultancy as our new <span class="highlight">${doc.designation}</span>. At Ethers Consultancy, we focus on building a high-caliber team, and we are certain your contributions will be vital to our continued success.</p>
                    <p><span class="highlight">Role & Responsibilities:</span> Your role will involve optimizing menus, pricing strategies, managing accounts for partner cloud kitchens, and contributing to marketing initiatives on platforms like Swiggy and Zomato.</p>
                    <p><span class="highlight">Duration & Commitment:</span> This tenure begins on <span class="highlight">${doc.joiningDate || doc.issueDate}</span> in Kolkata, with a minimum commitment of <span class="highlight">${doc.probationMonths || 3} months</span>.</p>
                    <p><span class="highlight">Compensation & Benefits:</span> Fixed monthly payout of <span class="highlight">Rs. ${(doc.salaryDetails?.netSalary || 5000).toLocaleString("en-IN")}/-</span> plus performance incentives.</p>
                    <p>We look forward to having you on board as we continue to grow Ethers Consultancy!</p>
                ` : ""}

                ${doc.type === "completion_letter" ? `
                    <p style="font-family: 'Inter', sans-serif; font-size: 12px; margin-bottom: 12px;"><strong>TO WHOM IT MAY CONCERN</strong></p>
                    <p>This letter serves to formally confirm that <span class="highlight">"${doc.employeeName}"</span> was associated with <span class="highlight">ETHERS CONSULTANCY</span> from <span class="highlight">${doc.joiningDate || "5-April-2026"}</span> to <span class="highlight">${doc.issueDate || "31-July-2026"}</span> as <span class="highlight">“${doc.designation}.”</span></p>
                    <p>During their tenure, <span class="highlight">${doc.employeeName}</span> led core F&B consulting projects, menu engineering, and operational analytics with high dedication and professional excellence.</p>
                    <p>Should you require any further verification or professional reference, please feel free to reach out to the undersigned authority.</p>
                    <p>We sincerely appreciate their devoted service and wish them continued success in all future endeavors!</p>
                ` : ""}

                ${doc.type === "recommendation_letter" ? `
                    <p style="font-family: 'Inter', sans-serif; font-size: 12px; margin-bottom: 12px;"><strong>TO WHOM IT MAY CONCERN</strong></p>
                    <p>It is my distinct pleasure to write this letter of recommendation for <span class="highlight">"${doc.employeeName}"</span>, who served as <span class="highlight">${doc.designation}</span> at Ethers Consultancy.</p>
                    <p>During their tenure working on F&B Brand Consulting & Pricing Analytics, <span class="highlight">${doc.employeeName}</span> demonstrated outstanding analytical capabilities, strong work ethic, and extraordinary problem-solving skills.</p>
                    <p>I endorse <span class="highlight">${doc.employeeName}</span> without reservation for any future professional endeavors or leadership opportunities.</p>
                ` : ""}

                ${doc.type === "increment_letter" ? `
                    <p>Dear <span class="highlight">${doc.employeeName}</span>,</p>
                    <p>We wish to confirm that your performance for the recent appraisal tenure has been assessed as <span class="highlight">“EE — Exceeds Expectation”</span>. In view of your outstanding performance, your compensation has been revised with effect from <span class="highlight">${doc.effectiveDate || doc.issueDate}</span>.</p>
                    <p style="font-family: 'Inter', sans-serif; font-size: 13px;"><strong>Revised Monthly CTC:</strong> Rs. ${(doc.newSalary || 55000).toLocaleString("en-IN")}/-</p>
                    <p>All other terms and conditions of your employment remain unaltered. Your compensation details are to be treated as strictly confidential.</p>
                ` : ""}

                ${doc.type === "employment_terms" ? `
                    <p style="font-family: 'Inter', sans-serif; font-size: 12px; margin-bottom: 12px;"><strong>Employment Terms & Conditions — ${doc.employeeName} (${doc.designation})</strong></p>
                    <p>1. <strong>Position & Joining:</strong> Effective date <strong>${doc.joiningDate || doc.issueDate}</strong>.</p>
                    <p>2. <strong>Compensation:</strong> Fixed monthly net payout of <strong>Rs. ${(doc.salaryDetails?.netSalary || 0).toLocaleString("en-IN")} / month</strong>.</p>
                    <p>3. <strong>Probation & Notice:</strong> Probation: ${doc.probationMonths || 3} months. Notice Period: ${doc.noticePeriodDays || 30} days.</p>
                    <p>4. <strong>Confidentiality & Data Protection:</strong> The employee agrees to maintain strict confidentiality regarding brand metrics and trade secrets. Any data breach will result in immediate termination and legal action.</p>
                ` : ""}

                ${doc.type === "payslip" ? `
                    <table class="table-box">
                        <tr><td><strong>Employee Name:</strong> ${doc.employeeName}</td><td><strong>Pay Period:</strong> ${doc.monthYear || "July 2026"}</td></tr>
                        <tr><td><strong>Designation:</strong> ${doc.designation}</td><td><strong>Disbursement:</strong> Direct Bank Transfer</td></tr>
                    </table>
                    <table class="table-box">
                        <thead>
                            <tr><th>Earnings</th><th>Amount (Rs)</th><th>Deductions</th><th>Amount (Rs)</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Basic Salary</td><td>${(doc.salaryDetails?.basic || 2500).toLocaleString("en-IN")}</td><td>Professional Tax</td><td>110</td></tr>
                            <tr><td>HRA</td><td>${(doc.salaryDetails?.hra || 1500).toLocaleString("en-IN")}</td><td>TDS</td><td>0</td></tr>
                            <tr><td>Allowances</td><td>${(doc.salaryDetails?.allowances || 1000).toLocaleString("en-IN")}</td><td>Total Deductions</td><td>110</td></tr>
                            <tr style="font-weight: 700; background-color: #f4f4f5;"><td>Net Disbursed</td><td colspan="3">Rs. ${(doc.salaryDetails?.netSalary || 5000).toLocaleString("en-IN")}</td></tr>
                        </tbody>
                    </table>
                ` : ""}
            </div>

            <div class="signatures-grid">
                <div class="sig-block">
                    <img src="${hemanyaSigUri}" alt="Hemanya Gupta Signature" class="sig-img" />
                    <div class="sig-line"></div>
                    <div class="sig-name">Hemanya Gupta</div>
                    <div class="sig-title">Co-Founder & Director</div>
                </div>

                <div class="sig-block">
                    <img src="${tanishaSigUri}" alt="Tanisha Maity Signature" class="sig-img" />
                    <div class="sig-line"></div>
                    <div class="sig-name">Tanisha Maity</div>
                    <div class="sig-title">Co-Founder & Director</div>
                </div>
            </div>

        </div>
    </div>
</body>
</html>`;
}
