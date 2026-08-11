import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const COOKIE_NAME = "ethers_session";
const EMPLOYEES_FILE = path.join(process.cwd(), "data", "employees.json");

export type Employee = {
  id?: string;
  email: string;
  password: string; // Stored as salt:hash or plain-text legacy (auto-migrated)
  role: "admin" | "staff";
  name: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
  salary?: number;
  phone?: string;
};

// --- Secure Hashing Helpers (Node.js Crypto) -----------------------------
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(plain, salt, 10000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  
  // Backward compatibility check for plain-text passwords
  if (!stored.includes(":")) {
    return plain === stored;
  }

  const [salt, originalHash] = stored.split(":");
  if (!salt || !originalHash) return false;

  const candidateHash = crypto.pbkdf2Sync(plain, salt, 10000, 64, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(originalHash));
}

// Generate concise, readable 8-character password
export function generateCleanPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let pwd = "eth_";
  for (let i = 0; i < 5; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

function getSecret() {
  const secret = process.env.SESSION_SECRET || "ethers_default_secure_secret_key_2026";
  return new TextEncoder().encode(secret);
}

function ensureEmployeesFile() {
  const dataDir = path.dirname(EMPLOYEES_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(EMPLOYEES_FILE)) {
    const seed: Employee[] = [
      {
        id: "emp_hemanya",
        email: process.env.ADMIN_EMAIL || "hemanyagupta@ethers.in",
        password: hashPassword(process.env.ADMIN_PASSWORD || "admin"),
        role: "admin",
        name: "Hemanya Gupta",
        designation: "Co-Founder & Director",
        department: "Executive Leadership"
      },
      {
        id: "emp_tanisha",
        email: "tanishamaity@ethers.in",
        password: hashPassword("admin"),
        role: "admin",
        name: "Tanisha Maity",
        designation: "Co-Founder & Director",
        department: "Executive Leadership"
      }
    ];
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(seed, null, 2));
  }
}

export function getEmployees(): Employee[] {
  ensureEmployeesFile();
  try {
    const content = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function saveEmployees(employees: Employee[]) {
  const dataDir = path.dirname(EMPLOYEES_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
}

// Return employee data without exposing password hashes
export function getPublicEmployees() {
  return getEmployees().map(({ password, ...rest }) => rest);
}

export function verifyCredentials(email: string, plainPassword: string): Employee | null {
  const employees = getEmployees();
  const index = employees.findIndex((e) => e.email.toLowerCase() === email.toLowerCase());
  
  if (index === -1) return null;

  const emp = employees[index];
  const isValid = verifyPassword(plainPassword, emp.password);

  if (!isValid) return null;

  // Auto-migrate legacy plain-text password to hashed password if needed
  if (!emp.password.includes(":")) {
    employees[index].password = hashPassword(plainPassword);
    saveEmployees(employees);
  }

  return employees[index];
}

export function createEmployee(data: {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "staff";
  designation?: string;
  department?: string;
  phone?: string;
  salary?: number;
}): { employee: Omit<Employee, "password">; generatedPassword?: string } {
  const employees = getEmployees();
  const existing = employees.find((e) => e.email.toLowerCase() === data.email.toLowerCase());
  if (existing) {
    throw new Error("An employee with this email already exists.");
  }

  const generated = data.password ? undefined : generateCleanPassword();
  const rawPassword = data.password || generated;
  if (!rawPassword) throw new Error("Password is required.");

  const newEmp: Employee = {
    id: `emp_${Date.now()}`,
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashPassword(rawPassword),
    role: data.role,
    designation: data.designation || (data.role === "admin" ? "Co-Founder" : "Executive"),
    department: data.department || "Operations",
    joiningDate: new Date().toISOString().split("T")[0],
    phone: data.phone || "",
    salary: data.salary || 45000
  };

  employees.push(newEmp);
  saveEmployees(employees);

  const { password, ...publicEmp } = newEmp;
  return { employee: publicEmp, generatedPassword: generated };
}

export function resetEmployeePassword(email: string, newPassword?: string): string {
  const employees = getEmployees();
  const index = employees.findIndex((e) => e.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error("Employee not found.");

  const freshPassword = newPassword || generateCleanPassword();
  employees[index].password = hashPassword(freshPassword);
  saveEmployees(employees);
  return freshPassword;
}

export function deleteEmployeeAccount(email: string) {
  let employees = getEmployees();
  const target = employees.find((e) => e.email.toLowerCase() === email.toLowerCase());
  if (!target) throw new Error("Employee not found.");

  employees = employees.filter((e) => e.email.toLowerCase() !== email.toLowerCase());
  saveEmployees(employees);
}

export async function createSessionToken(employee: Employee) {
  return new SignJWT({ email: employee.email, role: employee.role, name: employee.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { email: string; role: "admin" | "staff"; name: string };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
