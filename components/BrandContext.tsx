"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrandInvoice, BrandProposal } from "@/lib/db";

export type { BrandInvoice, BrandProposal };

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
  { id: "1", name: "Dzomsa", status: "Active", onboardingDate: "2026-06-12", type: "Multi Cuisine", invoices: [], proposals: [] },
  { id: "2", name: "All That Bakes", status: "Active", onboardingDate: "2026-05-04", type: "Bakery", invoices: [], proposals: [] },
  { id: "3", name: "Burger Bae", status: "Active", onboardingDate: "2026-07-20", type: "Cafe", invoices: [], proposals: [] },
  { id: "4", name: "Casa Kitchen", status: "Active", onboardingDate: "2026-01-15", type: "Continental", invoices: [], proposals: [] },
  { id: "5", name: "Dancing Wok", status: "Active", onboardingDate: "2026-02-10", type: "Asian", invoices: [], proposals: [] },
  { id: "6", name: "Desi Dabba", status: "Active", onboardingDate: "2026-03-22", type: "North Indian", invoices: [], proposals: [] },
  { id: "7", name: "Doodleberry", status: "Active", onboardingDate: "2026-04-11", type: "Desserts", invoices: [], proposals: [] },
  { id: "8", name: "Kuumba", status: "Active", onboardingDate: "2026-05-05", type: "Healthy", invoices: [], proposals: [] },
  { id: "9", name: "Kwality Kitchen", status: "Active", onboardingDate: "2026-06-30", type: "North Indian", invoices: [], proposals: [] },
  { id: "10", name: "La Soiree", status: "Active", onboardingDate: "2026-07-12", type: "French", invoices: [], proposals: [] },
  { id: "11", name: "Lucky Tiger", status: "Active", onboardingDate: "2026-07-15", type: "Asian", invoices: [], proposals: [] },
  { id: "12", name: "Makimandu", status: "Active", onboardingDate: "2026-07-18", type: "Japanese", invoices: [], proposals: [] },
  { id: "13", name: "Moon", status: "Active", onboardingDate: "2026-07-21", type: "Cafe", invoices: [], proposals: [] },
  { id: "14", name: "Pomodoro", status: "Active", onboardingDate: "2026-07-22", type: "Italian", invoices: [], proposals: [] },
  { id: "15", name: "Pounds of Happiness", status: "Active", onboardingDate: "2026-07-23", type: "Bakery", invoices: [], proposals: [] },
  { id: "16", name: "Q Kitchen", status: "Active", onboardingDate: "2026-07-24", type: "Fast Food", invoices: [], proposals: [] },
  { id: "17", name: "Ruhani", status: "Active", onboardingDate: "2026-07-25", type: "North Indian", invoices: [], proposals: [] },
  { id: "18", name: "Shikora", status: "Active", onboardingDate: "2026-07-25", type: "Cafe", invoices: [], proposals: [] },
  { id: "19", name: "Tasteera", status: "Active", onboardingDate: "2026-08-01", type: "Cloud Kitchen", invoices: [], proposals: [] },
];

type BrandContextType = {
  activeBrand: Brand;
  setActiveBrand: (brand: Brand) => void;
  brands: Brand[];
  addBrand: (data: { name: string; type?: string; status?: string }) => Promise<Brand | null>;
  deleteBrand: (id: string) => Promise<boolean>;
  addBrandInvoice: (brandId: string, invoiceData: Partial<BrandInvoice>) => Promise<BrandInvoice | null>;
  addBrandProposal: (brandId: string, proposalData: Partial<BrandProposal>) => Promise<BrandProposal | null>;
  removeBrandInvoice: (brandId: string, invoiceId: string) => Promise<boolean>;
  removeBrandProposal: (brandId: string, proposalId: string) => Promise<boolean>;
  refreshBrands: () => Promise<void>;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [activeBrand, setActiveBrandState] = useState<Brand>(INITIAL_BRANDS[0]);

  const refreshBrands = useCallback(async () => {
    try {
      const res = await fetch("/api/brands");
      if (res.ok) {
        const data = await res.json();
        if (data.brands && Array.isArray(data.brands)) {
          setBrands(data.brands);
          
          if (typeof window !== "undefined") {
            const savedId = localStorage.getItem("ethers_active_brand_id");
            const found = data.brands.find((b: Brand) => b.id === savedId) || data.brands[0];
            if (found) setActiveBrandState(found);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch brands:", e);
    }
  }, []);

  useEffect(() => {
    refreshBrands();
  }, [refreshBrands]);

  function setActiveBrand(brand: Brand) {
    setActiveBrandState(brand);
    if (typeof window !== "undefined") {
      localStorage.setItem("ethers_active_brand_id", brand.id);
    }
  }

  async function addBrand(data: { name: string; type?: string; status?: string }): Promise<Brand | null> {
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) setBrands(result.brands);
        if (result.brand) {
          setActiveBrand(result.brand);
          return result.brand;
        }
      }
    } catch (e) {
      console.error("Failed to add brand:", e);
    }
    return null;
  }

  async function deleteBrand(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/brands?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) {
          setBrands(result.brands);
          if (activeBrand.id === id) {
            const fallback = result.brands[0] || INITIAL_BRANDS[0];
            setActiveBrand(fallback);
          }
        }
        return true;
      }
    } catch (e) {
      console.error("Failed to delete brand:", e);
    }
    return false;
  }

  async function addBrandInvoice(brandId: string, invoiceData: Partial<BrandInvoice>): Promise<BrandInvoice | null> {
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_invoice", brandId, invoiceData }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) setBrands(result.brands);
        return result.invoice;
      }
    } catch (e) {
      console.error("Failed to create brand invoice:", e);
    }
    return null;
  }

  async function addBrandProposal(brandId: string, proposalData: Partial<BrandProposal>): Promise<BrandProposal | null> {
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_proposal", brandId, proposalData }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) setBrands(result.brands);
        return result.proposal;
      }
    } catch (e) {
      console.error("Failed to create brand proposal:", e);
    }
    return null;
  }

  async function removeBrandInvoice(brandId: string, invoiceId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/brands?action=delete_invoice&brandId=${brandId}&invoiceId=${invoiceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) setBrands(result.brands);
        return true;
      }
    } catch (e) {
      console.error("Failed to delete brand invoice:", e);
    }
    return false;
  }

  async function removeBrandProposal(brandId: string, proposalId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/brands?action=delete_proposal&brandId=${brandId}&proposalId=${proposalId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const result = await res.json();
        if (result.brands) setBrands(result.brands);
        return true;
      }
    } catch (e) {
      console.error("Failed to delete brand proposal:", e);
    }
    return false;
  }

  return (
    <BrandContext.Provider
      value={{
        activeBrand,
        setActiveBrand,
        brands,
        addBrand,
        deleteBrand,
        addBrandInvoice,
        addBrandProposal,
        removeBrandInvoice,
        removeBrandProposal,
        refreshBrands,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}
