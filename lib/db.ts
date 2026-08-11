import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

// --- Tiny file-backed "database" -------------------------------------
// No Postgres, no Prisma. Each "table" is a single JSON file on disk.
// Good enough for a small internal team tool; swap for a real DB later
// if you ever need multi-instance / concurrent-write scale.

const DATA_DIR = path.join(process.cwd(), "data");

function ensureFile(file: string, fallback: unknown) {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(full)) fs.writeFileSync(full, JSON.stringify(fallback, null, 2));
  return full;
}

function readJSON<T>(file: string, fallback: T): T {
  const full = ensureFile(file, fallback);
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(file: string, data: T) {
  const full = ensureFile(file, data);
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
}

// --- Types -------------------------------------------------------------

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  diet: "veg" | "nonveg" | "egg";
  spiceLevel?: number;
  basePrice: number;
  onlinePrice?: number;
  halfPortionAvailable: boolean;
  halfPortionPrice?: number;
  description?: string;
  imageUrl?: string;
  variants?: string[];
  addOns?: string[];
  allergens?: string[];
  aiFields?: string[]; // which fields were AI-generated, for the "AI" badge
  createdAt: string;
  updatedAt: string;
};

export type CampaignItem = {
  id: string;
  title: string;
  date: string;
  status: "planned" | "done";
  createdAt: string;
};

export type Settings = {
  restaurantName: string;
  city: string;
  zomatoUrl?: string;
  swiggyUrl?: string;
  lastKnownRating?: number;
};

export type DiscrepancyRecord = {
  id: string;
  itemName: string;
  issueType: string;
  source: "Internal" | "Swiggy" | "Zomato";
  detail: string;
  createdAt: string;
};

// --- Menu ---------------------------------------------------------------

export function getMenuItems(): MenuItem[] {
  return readJSON<MenuItem[]>("menu.json", []);
}

export function saveMenuItems(items: MenuItem[]) {
  writeJSON("menu.json", items);
}

export function createMenuItem(partial: Partial<MenuItem>): MenuItem {
  const items = getMenuItems();
  const now = new Date().toISOString();
  const item: MenuItem = {
    id: uuid(),
    name: partial.name ?? "Untitled item",
    category: partial.category ?? "Uncategorized",
    subCategory: partial.subCategory,
    diet: partial.diet ?? "veg",
    spiceLevel: partial.spiceLevel,
    basePrice: partial.basePrice ?? 0,
    onlinePrice: partial.onlinePrice,
    halfPortionAvailable: partial.halfPortionAvailable ?? false,
    halfPortionPrice: partial.halfPortionPrice,
    description: partial.description,
    imageUrl: partial.imageUrl,
    variants: partial.variants ?? [],
    addOns: partial.addOns ?? [],
    allergens: partial.allergens ?? [],
    aiFields: partial.aiFields ?? [],
    createdAt: now,
    updatedAt: now
  };
  items.push(item);
  saveMenuItems(items);
  return item;
}

export function updateMenuItem(id: string, patch: Partial<MenuItem>): MenuItem | null {
  const items = getMenuItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  saveMenuItems(items);
  return items[idx];
}

export function deleteMenuItem(id: string) {
  const items = getMenuItems().filter((i) => i.id !== id);
  saveMenuItems(items);
}

// --- Settings -------------------------------------------------------------

export function getSettings(): Settings {
  return readJSON<Settings>("settings.json", {
    restaurantName: process.env.RESTAURANT_NAME || "Ethers Kitchen",
    city: process.env.RESTAURANT_CITY || "Mumbai"
  });
}

export function saveSettings(settings: Settings) {
  writeJSON("settings.json", settings);
}

// --- Marketing calendar ----------------------------------------------------

export function getCampaigns(): CampaignItem[] {
  return readJSON<CampaignItem[]>("campaigns.json", []);
}

export function addCampaign(title: string, date: string): CampaignItem {
  const campaigns = getCampaigns();
  const item: CampaignItem = {
    id: uuid(),
    title,
    date,
    status: "planned",
    createdAt: new Date().toISOString()
  };
  campaigns.push(item);
  writeJSON("campaigns.json", campaigns);
  return item;
}

export function updateCampaignStatus(id: string, status: "planned" | "done") {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  campaigns[idx].status = status;
  writeJSON("campaigns.json", campaigns);
  return campaigns[idx];
}

// --- Discrepancies ----------------------------------------------------------

export function getDiscrepancies(): DiscrepancyRecord[] {
  return readJSON<DiscrepancyRecord[]>("discrepancies.json", []);
}

export function saveDiscrepancies(records: DiscrepancyRecord[]) {
  writeJSON("discrepancies.json", records);
}

// --- Reports history (optional, keeps last generated report) ---------------

export function saveLastReport(report: unknown) {
  writeJSON("last-report.json", { generatedAt: new Date().toISOString(), report });
}

export function getLastReport() {
  return readJSON("last-report.json", null);
}

// --- Leads CRM -------------------------------------------------------------

export type FollowUpStatus = "In Talks" | "Not Responded" | "Scheduled a meeting" | "Pending";
export type LeadStatus = "Converted" | "In Talks" | "Not Converted" | "Not Responding";

export type LeadItem = {
  id: string;
  brandName: string;
  ownerPhone: string;
  poc: string;
  date: string;
  comments: string;
  followUp1: FollowUpStatus;
  followUp2: FollowUpStatus;
  followUp3: FollowUpStatus;
  scheduledMeeting: string;
  status: LeadStatus;
  estimatedValue?: number;
  location?: string;
  category?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function getLeads(): LeadItem[] {
  return readJSON<LeadItem[]>("leads.json", []);
}

export function saveLeads(leads: LeadItem[]) {
  writeJSON("leads.json", leads);
}

export function createLead(partial: Partial<LeadItem>): LeadItem {
  const leads = getLeads();
  const now = new Date().toISOString();
  const lead: LeadItem = {
    id: `lead_${Date.now()}`,
    brandName: partial.brandName || "New Lead",
    ownerPhone: partial.ownerPhone || "",
    poc: partial.poc || "",
    date: partial.date || now.split("T")[0],
    comments: partial.comments || "",
    followUp1: partial.followUp1 || "In Talks",
    followUp2: partial.followUp2 || "Pending",
    followUp3: partial.followUp3 || "Pending",
    scheduledMeeting: partial.scheduledMeeting || "",
    status: partial.status || "In Talks",
    estimatedValue: partial.estimatedValue || 50000,
    location: partial.location || "Mumbai",
    category: partial.category || "F&B Business",
    assignedTo: partial.assignedTo || "Unassigned",
    createdAt: now,
    updatedAt: now
  };
  leads.unshift(lead);
  saveLeads(leads);
  return lead;
}

export function updateLead(id: string, patch: Partial<LeadItem>): LeadItem | null {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...patch, updatedAt: new Date().toISOString() };
  saveLeads(leads);
  return leads[idx];
}

export function deleteLead(id: string) {
  const leads = getLeads().filter((l) => l.id !== id);
  saveLeads(leads);
}

// --- Brands ----------------------------------------------------------------

export type BrandInvoice = {
  id: string;
  brandId: string;
  brandName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  particulars: string;
  amount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  status: "Paid" | "Pending" | "Overdue";
  notes?: string;
  createdAt: string;
};

export type BrandProposal = {
  id: string;
  brandId: string;
  brandName: string;
  proposalTitle: string;
  date: string;
  retainerAmount: number;
  retainerPeriod: string;
  durationDays: number;
  reviewMonths: number;
  signatoryName: string;
  signatoryRole: string;
  signatoryPhone: string;
  deliverables: string[];
  notes?: string;
  createdAt: string;
};

export type Brand = {
  id: string;
  name: string;
  type: string;
  status: string;
  onboardingDate?: string;
  invoices?: BrandInvoice[];
  proposals?: BrandProposal[];
};

export const INITIAL_BRANDS: Brand[] = [
  { id: "1", name: "Dzomsa", status: "Active", onboardingDate: "2026-06-12", type: "Multi Cuisine" },
  { id: "2", name: "All That Bakes", status: "Active", onboardingDate: "2026-05-04", type: "Bakery" },
  { id: "3", name: "Burger Bae", status: "Active", onboardingDate: "2026-07-20", type: "Cafe" },
  { id: "4", name: "Casa Kitchen", status: "Active", onboardingDate: "2026-01-15", type: "Continental" },
  { id: "5", name: "Dancing Wok", status: "Active", onboardingDate: "2026-02-10", type: "Asian" },
  { id: "6", name: "Desi Dabba", status: "Active", onboardingDate: "2026-03-22", type: "North Indian" },
  { id: "7", name: "Doodleberry", status: "Active", onboardingDate: "2026-04-11", type: "Desserts" },
  { id: "8", name: "Kuumba", status: "Active", onboardingDate: "2026-05-05", type: "Healthy" },
  { id: "9", name: "Kwality Kitchen", status: "Active", onboardingDate: "2026-06-30", type: "North Indian" },
  { id: "10", name: "La Soiree", status: "Active", onboardingDate: "2026-07-12", type: "French" },
  { id: "11", name: "Lucky Tiger", status: "Active", onboardingDate: "2026-07-15", type: "Asian" },
  { id: "12", name: "Makimandu", status: "Active", onboardingDate: "2026-07-18", type: "Japanese" },
  { id: "13", name: "Moon", status: "Active", onboardingDate: "2026-07-21", type: "Cafe" },
  { id: "14", name: "Pomodoro", status: "Active", onboardingDate: "2026-07-22", type: "Italian" },
  { id: "15", name: "Pounds of Happiness", status: "Active", onboardingDate: "2026-07-23", type: "Bakery" },
  { id: "16", name: "Q Kitchen", status: "Active", onboardingDate: "2026-07-24", type: "Fast Food" },
  { id: "17", name: "Ruhani", status: "Active", onboardingDate: "2026-07-25", type: "North Indian" },
  { id: "18", name: "Shikora", status: "Active", onboardingDate: "2026-07-25", type: "Cafe" },
  { id: "19", name: "Tasteera", status: "Active", onboardingDate: "2026-08-01", type: "Cloud Kitchen" },
];

export function getBrands(): Brand[] {
  return readJSON<Brand[]>("brands.json", INITIAL_BRANDS);
}

export function saveBrands(brands: Brand[]) {
  writeJSON("brands.json", brands);
}

export function createBrand(partial: Partial<Brand>): Brand {
  const brands = getBrands();
  const now = new Date().toISOString().split("T")[0];
  const brand: Brand = {
    id: uuid(),
    name: partial.name?.trim() || "New Brand",
    type: partial.type?.trim() || "Multi Cuisine",
    status: partial.status || "Active",
    onboardingDate: now,
    invoices: [],
    proposals: [],
  };
  brands.push(brand);
  saveBrands(brands);
  return brand;
}

export function deleteBrand(id: string): boolean {
  const brands = getBrands();
  const filtered = brands.filter((b) => b.id !== id);
  if (filtered.length === brands.length) return false;
  saveBrands(filtered);
  return true;
}

// --- Brand Invoices & Proposals Helpers -----------------------------

export function createBrandInvoice(brandId: string, partial: Partial<BrandInvoice>): BrandInvoice {
  const brands = getBrands();
  const brand = brands.find((b) => b.id === brandId);
  const now = new Date().toISOString();
  
  const amount = Number(partial.amount || 20000);
  const gstRate = Number(partial.gstRate ?? 18);
  const gstAmount = Number(((amount * gstRate) / 100).toFixed(2));
  const totalAmount = Number((amount + gstAmount).toFixed(2));

  const inv: BrandInvoice = {
    id: `inv_${Date.now()}`,
    brandId,
    brandName: brand?.name || partial.brandName || "Partner Brand",
    invoiceNumber: partial.invoiceNumber || `ETH-INV-${Date.now().toString().slice(-6)}`,
    issueDate: partial.issueDate || now.split("T")[0],
    dueDate: partial.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    particulars: partial.particulars || `Monthly Retainer for Online Delivery Management – ${brand?.name || "Brand"}`,
    amount,
    gstRate,
    gstAmount,
    totalAmount,
    status: partial.status || "Pending",
    notes: partial.notes || "Payable via NEFT/RTGS to Ethers Consultancy Pvt Ltd account.",
    createdAt: now,
  };

  if (brand) {
    if (!brand.invoices) brand.invoices = [];
    brand.invoices.unshift(inv);
    saveBrands(brands);
  }

  return inv;
}

export function createBrandProposal(brandId: string, partial: Partial<BrandProposal>): BrandProposal {
  const brands = getBrands();
  const brand = brands.find((b) => b.id === brandId);
  const now = new Date().toISOString();

  const prop: BrandProposal = {
    id: `prop_${Date.now()}`,
    brandId,
    brandName: brand?.name || partial.brandName || "Partner Brand",
    proposalTitle: partial.proposalTitle || `Proposal for Online Delivery Growth Strategy – ${brand?.name || "Brand"}`,
    date: partial.date || now.split("T")[0],
    retainerAmount: Number(partial.retainerAmount ?? 20000),
    retainerPeriod: partial.retainerPeriod || "Month",
    durationDays: Number(partial.durationDays ?? 90),
    reviewMonths: Number(partial.reviewMonths ?? 3),
    signatoryName: partial.signatoryName || "Tanisha Maity",
    signatoryRole: partial.signatoryRole || "Co-Founder, Ethers Consultancy",
    signatoryPhone: partial.signatoryPhone || "+91 7063866220",
    deliverables: partial.deliverables || [
      "1. Aggregator Onboarding & Optimization (Profile, Visuals, Backend order flow)",
      "2. Menu Re-Engineering (Margin analysis, combos, signature item positioning)",
      "3. Pricing & Burn Management (Competitor benchmarking, smart discounting, offer optimization)",
      "4. Market & Customer Insights (Zone analytics, repeat order retention, competitor tracking)",
      "5. Data Tracking & Performance Analysis (AOV, order trends, ROI telemetry)",
      "6. Aggregator Management (Commission & ad spend negotiation support, issue resolution)",
      "7. Marketing & Brand Visibility (ROI ad campaigns, banner & content optimization)",
    ],
    notes: partial.notes || "The proposed commercials will be reviewed and revised after 3 months, based on performance and scope alignment.",
    createdAt: now,
  };

  if (brand) {
    if (!brand.proposals) brand.proposals = [];
    brand.proposals.unshift(prop);
    saveBrands(brands);
  }

  return prop;
}

export function deleteBrandInvoice(brandId: string, invoiceId: string) {
  const brands = getBrands();
  const brand = brands.find((b) => b.id === brandId);
  if (brand && brand.invoices) {
    brand.invoices = brand.invoices.filter((i) => i.id !== invoiceId);
    saveBrands(brands);
  }
}

export function deleteBrandProposal(brandId: string, proposalId: string) {
  const brands = getBrands();
  const brand = brands.find((b) => b.id === brandId);
  if (brand && brand.proposals) {
    brand.proposals = brand.proposals.filter((p) => p.id !== proposalId);
    saveBrands(brands);
  }
}

