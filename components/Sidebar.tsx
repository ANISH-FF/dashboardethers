"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  Home, 
  Store, 
  UtensilsCrossed, 
  Camera, 
  Sparkles, 
  PhoneCall, 
  Calculator, 
  LineChart, 
  Megaphone, 
  FileText, 
  Users,
  Settings,
  Menu,
  X,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_MAIN = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/chat", label: "Team Chat", icon: MessageSquare },
  { href: "/dashboard/brands", label: "Brands Directory", icon: Store },
];

const NAV_AUTOMATION = [
  { href: "/dashboard/menu-automation", label: "Menu Automation", icon: UtensilsCrossed },
  { href: "/dashboard/picture-automation", label: "Picture Automation", icon: Camera },
  { href: "/dashboard/hygiene-check", label: "Hygiene Check", icon: Sparkles },
  { href: "/dashboard/projections", label: "Projections Engine", icon: TrendingUp },
  { href: "/dashboard/leads", label: "Leads Section", icon: PhoneCall },
  { href: "/dashboard/discount-calculator", label: "Discount Calculator", icon: Calculator },
  { href: "/dashboard/pricing-strategy", label: "Pricing Strategy", icon: LineChart },
  { href: "/dashboard/marketing-strategy", label: "Marketing Strategy", icon: Megaphone },
  { href: "/dashboard/reporting", label: "Reporting", icon: FileText },
];

const NAV_COMPANY_ADMIN = [
  { href: "/dashboard/employees", label: "Employee Hub", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const NAV_COMPANY_STAFF = [
  { href: "/dashboard/employees", label: "My Payslips", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLink({ item, pathname, onClick }: { item: any; pathname: string; onClick?: () => void }) {
  const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 group ${
        active
          ? "text-ink"
          : "text-ink/60 hover:text-ink hover:bg-line/40"
      }`}
    >
      {active && (
        <motion.div 
          layoutId="sidebar-active" 
          className="absolute inset-0 rounded-lg bg-line/80 z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <Icon className={`relative z-10 w-4 h-4 transition-colors ${active ? "text-ink" : "text-ink/50 group-hover:text-ink"}`} />
      <span className="relative z-10">{item.label}</span>
    </Link>
  );
}

import { useSidebar } from "./SidebarContext";

export default function Sidebar({ role = "staff" }: { role?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCollapsed: desktopCollapsed, setIsCollapsed: setDesktopCollapsed } = useSidebar();

  const isAdmin = role === "admin";
  const companyNav = isAdmin ? NAV_COMPANY_ADMIN : NAV_COMPANY_STAFF;

  const navContent = (
    <>
      <div className="flex h-16 items-center justify-between px-6 border-b border-line shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="/uploads/logo.png" 
            alt="Ethers Consultancy" 
            className="h-10 w-auto object-contain brightness-0 dark:invert"
          />
        </div>
        <button className="md:hidden p-1 text-ink/50 hover:text-ink" onClick={() => setMobileOpen(false)}>
          <X className="w-5 h-5" />
        </button>
        <button className="hidden md:block p-1 text-ink/50 hover:text-ink" onClick={() => setDesktopCollapsed(true)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 no-scrollbar">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-3 px-2">Core</h4>
          <nav className="flex flex-col gap-1">
            {NAV_MAIN.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
            ))}
          </nav>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-3 px-2">F&B Automation</h4>
          <nav className="flex flex-col gap-1">
            {NAV_AUTOMATION.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
            ))}
          </nav>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-3 px-2">{isAdmin ? "Management" : "My Account"}</h4>
          <nav className="flex flex-col gap-1">
            {companyNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
            ))}
          </nav>
        </div>
      </div>
      
      <div className="p-4 border-t border-line shrink-0">
        <div className="rounded-xl bg-paper-dark p-4 flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink">Ethers OS</span>
          <span className="text-[10px] text-ink/50">v2.0.0 (Automated Edition)</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 bg-paper/80 backdrop-blur-md border border-line text-ink rounded-lg p-2 shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop un-collapse button */}
      <button
        onClick={() => setDesktopCollapsed(false)}
        className={`hidden md:flex fixed top-3 left-4 z-40 bg-paper border border-line text-ink rounded-lg p-2 shadow-sm transition-opacity duration-300 ${desktopCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm" 
              onClick={() => setMobileOpen(false)} 
            />
            <motion.aside 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed md:hidden z-50 w-[280px] h-full bg-paper shadow-2xl flex flex-col border-r border-line"
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside 
        className={`hidden md:flex md:flex-col shrink-0 border-r border-line bg-paper h-screen sticky top-0 transition-all duration-300 ease-in-out ${desktopCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-[260px] opacity-100"}`}
      >
        <div className="w-[260px] h-full flex flex-col">
          {navContent}
        </div>
      </aside>
    </>
  );
}
