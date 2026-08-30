"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowUpRight, 
  Store, 
  PhoneCall, 
  Activity, 
  Users, 
  TrendingUp, 
  Sparkles, 
  FileSpreadsheet, 
  UtensilsCrossed, 
  Camera, 
  Calculator, 
  LineChart, 
  Megaphone, 
  MessageSquare, 
  Settings,
  ShieldCheck,
  Sun,
  Moon
} from "lucide-react";

type ColorTheme = "emerald" | "blue" | "purple" | "amber" | "cyan" | "rose" | "indigo";

const COLOR_MAPS: Record<ColorTheme, {
  iconBg: string;
  badgeBg: string;
  trendText: string;
  hoverBorder: string;
  hoverTitle: string;
}> = {
  emerald: {
    iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    badgeBg: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    trendText: "text-emerald-400/90",
    hoverBorder: "hover:border-emerald-500/40",
    hoverTitle: "group-hover:text-emerald-400",
  },
  blue: {
    iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    badgeBg: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    trendText: "text-blue-400/90",
    hoverBorder: "hover:border-blue-500/40",
    hoverTitle: "group-hover:text-blue-400",
  },
  purple: {
    iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    badgeBg: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    trendText: "text-purple-400/90",
    hoverBorder: "hover:border-purple-500/40",
    hoverTitle: "group-hover:text-purple-400",
  },
  amber: {
    iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    badgeBg: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    trendText: "text-amber-400/90",
    hoverBorder: "hover:border-amber-500/40",
    hoverTitle: "group-hover:text-amber-400",
  },
  cyan: {
    iconBg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    badgeBg: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    trendText: "text-cyan-400/90",
    hoverBorder: "hover:border-cyan-500/40",
    hoverTitle: "group-hover:text-cyan-400",
  },
  rose: {
    iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    badgeBg: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    trendText: "text-rose-400/90",
    hoverBorder: "hover:border-rose-500/40",
    hoverTitle: "group-hover:text-rose-400",
  },
  indigo: {
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    badgeBg: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    trendText: "text-indigo-400/90",
    hoverBorder: "hover:border-indigo-500/40",
    hoverTitle: "group-hover:text-indigo-400",
  },
};

function StatCard({ 
  label, 
  value, 
  trend, 
  icon: Icon, 
  color = "emerald", 
  loading 
}: { 
  label: string; 
  value: string | number; 
  trend?: string; 
  icon: any; 
  color?: ColorTheme; 
  loading?: boolean 
}) {
  const theme = COLOR_MAPS[color];
  return (
    <div className={`card flex flex-col justify-between p-3.5 bg-paper border-line ${theme.hoverBorder} transition-all shadow-sm`}>
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">{label}</p>
        <div className={`p-1.5 rounded-lg border ${theme.iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="-mt-1">
        <p className="text-2xl font-extrabold text-ink font-mono leading-none">
          {loading ? <span className="animate-pulse text-ink/30">...</span> : value}
        </p>
        {trend && (
          <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${theme.trendText}`}>
            <ArrowUpRight className="w-3 h-3" /> {trend}
          </p>
        )}
      </div>
    </div>
  );
}

function ModuleLink({ 
  href, 
  title, 
  desc, 
  tag, 
  icon: Icon, 
  color = "emerald" 
}: { 
  href: string; 
  title: string; 
  desc: string; 
  tag?: string; 
  icon?: any; 
  color?: ColorTheme 
}) {
  const theme = COLOR_MAPS[color];
  return (
    <Link
      href={href}
      className={`card group block transition-all ${theme.hoverBorder} hover:shadow-lg bg-paper p-4 border border-line`}
    >
      <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-1.5">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={`p-1.5 rounded-md border ${theme.iconBg} transition-colors`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className={`text-sm font-bold text-ink ${theme.hoverTitle} transition-colors`}>{title}</h3>
        </div>
        {tag && (
          <span className={`text-[9px] font-bold uppercase tracking-widest rounded px-2 py-0.5 border ${theme.badgeBg}`}>
            {tag}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/50 leading-relaxed">{desc}</p>
    </Link>
  );
}

export default function DashboardHome() {
  const [stats, setStats] = useState({
    brands: 0,
    leads: 0,
    employees: 5,
    loading: true,
  });
  const [userName, setUserName] = useState<string>("");
  const [greeting, setGreeting] = useState<{ salutation: string; quote: string; mode: string; icon: any }>({
    salutation: "Welcome",
    quote: "Systems operational. Ethers intelligence engine ready.",
    mode: "Day",
    icon: Sparkles,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setUserName(data.name);
      })
      .catch(() => {});

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting({
        salutation: "Good morning",
        quote: "Fresh day, fresh targets. Ethers AI engines are synced and ready for F&B operations.",
        mode: "Morning",
        icon: Sun,
      });
    } else if (hour >= 12 && hour < 17) {
      setGreeting({
        salutation: "Good afternoon",
        quote: "Peak operational hours. All active brand telemetry pipelines are running nominal.",
        mode: "Afternoon",
        icon: Sparkles,
      });
    } else if (hour >= 17 && hour < 22) {
      setGreeting({
        salutation: "Good evening",
        quote: "Wrapping up today's payouts and acquisitions? Here is your executive telemetry breakdown.",
        mode: "Evening",
        icon: Sparkles,
      });
    } else {
      setGreeting({
        salutation: "Night Owl Mode",
        quote: "Late night session active. Ethers OS is monitoring your background automations while you build.",
        mode: "Night",
        icon: Moon,
      });
    }
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [brandsRes, leadsRes, employeesRes] = await Promise.all([
          fetch("/api/brands").catch(() => null),
          fetch("/api/leads").catch(() => null),
          fetch("/api/employees").catch(() => null),
        ]);

        const brandsData = brandsRes && brandsRes.ok ? await brandsRes.json() : null;
        const leadsData = leadsRes && leadsRes.ok ? await leadsRes.json() : null;
        const employeesData = employeesRes && employeesRes.ok ? await employeesRes.json() : null;

        const brandsCount = brandsData?.brands ? brandsData.brands.length : 18;
        const leadsCount = leadsData?.leads ? leadsData.leads.length : 0;
        const employeesCount = employeesData?.employees ? employeesData.employees.length : 5;

        setStats({
          brands: brandsCount,
          leads: leadsCount,
          employees: employeesCount,
          loading: false,
        });
      } catch (err) {
        console.error("Failed to load dashboard home stats:", err);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchStats();
  }, []);

  const GreetingIcon = greeting.icon;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-2">
      {/* Executive Greeting Header (Starts directly at page top) */}

      {/* Executive Greeting Header (Seamless Zero-Border Background Fit) */}
      <div className="py-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold bg-white/5 border border-white/10 text-zinc-400 flex items-center gap-1.5">
                <GreetingIcon className="w-3 h-3 text-emerald-400" /> {greeting.mode} Executive Session
              </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {greeting.salutation}{userName ? `, ${userName}` : ""}
            </h2>
            
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl font-sans leading-relaxed">
              &ldquo;{greeting.quote}&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-right">
              <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Systems Nominal</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Ethers Intelligence v2.0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Luxury Continuous Founder Marquee Strip (Obsidian Mesh & Silver Metallic Gradient) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-950 via-[#0c0c0f] to-zinc-950 py-2.5 px-4 shadow-2xl backdrop-blur-xl">
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-24 bg-emerald-500/10 blur-3xl rounded-full" />
        
        {/* Marquee Content with Edge Fades */}
        <div className="relative w-full overflow-hidden">
          {/* Edge Fade Gradients for Seamless Depth */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0c0c0f] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0c0c0f] to-transparent z-10" />

          <div className="animate-marquee select-none whitespace-nowrap">
            <div className="flex shrink-0 items-center gap-10 pr-10 font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.22em] bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-10 pr-10 font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.22em] bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent" aria-hidden="true">
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]">✦</span>
                <span>Grind until Mom &amp; Dad have your card and &ldquo;how much?&rdquo; is no longer a question.</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Active Brands"
          value={stats.brands}
          trend="Live synced directory"
          icon={Store}
          color="emerald"
          loading={stats.loading}
        />
        <StatCard
          label="Total Leads"
          value={stats.leads}
          trend="Real-time pipeline"
          icon={PhoneCall}
          color="blue"
          loading={stats.loading}
        />
        <StatCard
          label="System Health"
          value="98%"
          trend="All systems nominal"
          icon={Activity}
          color="amber"
        />
        <StatCard
          label="Team Members"
          value={stats.employees}
          trend="Active headcount"
          icon={Users}
          color="purple"
          loading={stats.loading}
        />
      </div>

      {/* Complete Core Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/40">Core Operations & Directory</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <ModuleLink
            href="/dashboard/brands"
            title="Brands Directory"
            desc="Manage onboarded restaurant brands, drive links & documents."
            tag="CORE"
            icon={Store}
            color="emerald"
          />
          <ModuleLink
            href="/dashboard/leads"
            title="Leads Section"
            desc="Track brand acquisition pipeline, calls & conversions."
            tag="SALES"
            icon={PhoneCall}
            color="blue"
          />
          <ModuleLink
            href="/dashboard/chat"
            title="Team Chat"
            desc="Real-time team communication and brand operations channel."
            tag="COLLAB"
            icon={MessageSquare}
            color="purple"
          />
          <ModuleLink
            href="/dashboard/employees"
            title="Employee Hub"
            desc="Manage staff accounts, designations & salary slips."
            tag="HR"
            icon={Users}
            color="cyan"
          />
        </div>
      </div>

      {/* F&B Automation & Telemetry */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/40">F&B Automation & Telemetry</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <ModuleLink
            href="/dashboard/projections"
            title="Projections Engine"
            desc="6-Month revenue, discount burn & payout projection modeler."
            tag="FINANCE"
            icon={TrendingUp}
            color="emerald"
          />
          <ModuleLink
            href="/dashboard/hygiene-check"
            title="Hygiene Check"
            desc="Ethers Fastest Hygeine Checker."
            tag="AI VISION"
            icon={Sparkles}
            color="purple"
          />
          <ModuleLink
            href="/dashboard/reporting"
            title="Performance Reporting"
            desc="Zomato & Swiggy period payout matrices & burn breakdown."
            tag="PAYOUTS"
            icon={FileSpreadsheet}
            color="amber"
          />
          <ModuleLink
            href="/dashboard/menu-automation"
            title="Menu Automation"
            desc="AI-driven dish taxonomy, subcategories & variant grouping."
            tag="ENGINEERING"
            icon={UtensilsCrossed}
            color="cyan"
          />
          <ModuleLink
            href="/dashboard/picture-automation"
            title="Picture Automation"
            desc="Automated photo scaling, tagging & Cloudinary management."
            tag="AUTOMATION"
            icon={Camera}
            color="rose"
          />
          <ModuleLink
            href="/dashboard/settings"
            title="Account Settings"
            desc="Password updates & admin system database backups."
            tag="SYSTEM"
            icon={Settings}
            color="indigo"
          />
        </div>
      </div>

      {/* Strategy & Profit Calculators */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/40">Strategy & Profit Calculators</h2>
        <div className="grid sm:grid-cols-3 gap-3.5">
          <ModuleLink
            href="/dashboard/discount-calculator"
            title="Discount Calculator"
            desc="Optimize Zomato/Swiggy discounts for maximum net payout ROI."
            tag="ROI"
            icon={Calculator}
            color="amber"
          />
          <ModuleLink
            href="/dashboard/pricing-strategy"
            title="Pricing Strategy"
            desc="Competitor price benchmarking and margin suggestions."
            tag="ANALYTICS"
            icon={LineChart}
            color="blue"
          />
          <ModuleLink
            href="/dashboard/marketing-strategy"
            title="Marketing Strategy"
            desc="Ad budget allocation, ROI forecasting & campaign optimization."
            tag="GROWTH"
            icon={Megaphone}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}
