"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, UserCircle2, Store, ChevronDown } from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useBrand } from "./BrandContext";

export default function TopBar({
  restaurantName,
  userName = "Admin",
  role = "admin"
}: {
  restaurantName: string;
  userName?: string;
  role?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const { activeBrand, setActiveBrand, brands } = useBrand();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleDisplay = role === "admin" ? "Co-founder" : "Employee";

  const hiddenBrandRoutes = [
    "/dashboard/menu-automation",
    "/dashboard/picture-automation",
    "/dashboard/pictures",
    "/dashboard/hygiene-check",
    "/dashboard/leads",
    "/dashboard/employees",
  ];
  const hideBrandSwitcher = hiddenBrandRoutes.some((route) => pathname?.startsWith(route));

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-paper/80 backdrop-blur-md px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        {isCollapsed && (
          <img 
            src="/uploads/logo.png" 
            alt="Ethers Consultancy" 
            className="h-10 w-auto object-contain brightness-0 dark:invert ml-12 transition-all duration-300 animate-in fade-in slide-in-from-left-4"
          />
        )}

        {/* Global Brand Switcher (Hidden on Menu Automation, Hygiene Check, and Leads) */}
        {!hideBrandSwitcher && (
          <div className="flex items-center gap-2 bg-[#161616] border border-[#272727] px-3 py-1.5 rounded-xl shadow-sm">
            <Store className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-[#888888] font-medium hidden sm:inline">Active Brand:</span>
            <select
              value={activeBrand?.id}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value);
                if (b) setActiveBrand(b);
              }}
              className="bg-transparent text-xs font-bold text-[#f5f5f5] focus:outline-none cursor-pointer pr-1"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#111111] text-[#f5f5f5]">
                  {b.name} ({b.type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="w-px h-6 bg-line hidden md:block"></div>

        <div className="hidden md:flex items-center gap-3 mr-4">
          <div className="text-right">
            <p className="text-sm font-medium text-ink leading-tight">{userName}</p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-ink/40">{roleDisplay}</p>
          </div>
          <UserCircle2 className="w-8 h-8 text-ink/20" />
        </div>

        <div className="w-px h-6 bg-line hidden md:block"></div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-[13px] font-medium text-ink/60 hover:text-ink transition-colors px-3 py-2 rounded-lg hover:bg-paper-dark"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
