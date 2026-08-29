import fs from "fs";
import path from "path";

const DOCUMENTS_FILE = path.join(process.cwd(), "data", "documents.json");

export type DocumentType = 
  | "payslip" 
  | "offer_letter" 
  | "employment_terms" 
  | "increment_letter" 
  | "recommendation_letter" 
  | "completion_letter" 
  | "certificate";

export type SalaryBreakdown = {
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  netSalary: number;
};

export type EmployeeDocument = {
  id: string;
  employeeEmail: string;
  employeeName: string;
  designation?: string;
  type: DocumentType;
  certificateType?: "internship" | "experience" | "appreciation";
  title: string;
  issueDate: string;
  joiningDate?: string;
  monthYear?: string;
  salaryDetails?: SalaryBreakdown;
  content?: string;
  signedBy: string;
  verificationCode: string;
  // Dynamic fields for expanded document suite
  probationMonths?: number;
  noticePeriodDays?: number;
  annualLeaves?: number;
  oldSalary?: number;
  newSalary?: number;
  effectiveDate?: string;
  projectTitle?: string;
  dateOfBirth?: string;
  hiddenFromAdmin?: boolean;
};

function ensureFile() {
  const dir = path.dirname(DOCUMENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2));
  }
}

export function getDocuments(): EmployeeDocument[] {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DOCUMENTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function saveDocuments(docs: EmployeeDocument[]) {
  ensureFile();
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2));
}

export function getDocumentsForEmployee(email: string): EmployeeDocument[] {
  const all = getDocuments();
  return all.filter((d) => d.employeeEmail.toLowerCase() === email.toLowerCase());
}

export function deleteDocumentForAdmin(id: string): boolean {
  const all = getDocuments();
  const target = all.find((d) => d.id === id);
  if (!target) return false;
  target.hiddenFromAdmin = true;
  saveDocuments(all);
  return true;
}

export function createDocument(partial: Partial<EmployeeDocument>): EmployeeDocument {
  const all = getDocuments();
  const now = new Date().toISOString().split("T")[0];
  const doc: EmployeeDocument = {
    id: `doc_${Date.now()}`,
    employeeEmail: partial.employeeEmail || "staff@ethers.in",
    employeeName: partial.employeeName || "Employee",
    designation: partial.designation || "Staff Member",
    type: partial.type || "payslip",
    certificateType: partial.certificateType,
    title: partial.title || "Official Document",
    issueDate: partial.issueDate || now,
    joiningDate: partial.joiningDate,
    monthYear: partial.monthYear,
    salaryDetails: partial.salaryDetails || { basic: 27000, hra: 13500, allowances: 4500, deductions: 0, netSalary: 45000 },
    content: partial.content || "",
    signedBy: partial.signedBy || "Hemanya Gupta & Tanisha Maity (Co-Founders)",
    verificationCode: `ETH-${(partial.type || "DOC").substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`,
    probationMonths: partial.probationMonths || 3,
    noticePeriodDays: partial.noticePeriodDays || 30,
    annualLeaves: partial.annualLeaves || 18,
    oldSalary: partial.oldSalary,
    newSalary: partial.newSalary,
    effectiveDate: partial.effectiveDate || now,
    projectTitle: partial.projectTitle || "F&B Operations Consulting",
    dateOfBirth: partial.dateOfBirth,
  };
  all.unshift(doc);
  saveDocuments(all);
  return doc;
}
