"use client";

import { usePathname } from "next/navigation";

export function WatermarkFooter() {
  const pathname = usePathname();

  // Exclude menu automation page as requested by the user
  if (pathname === "/dashboard/menu-automation") {
    return null;
  }

  return (
    <div className="pt-8 pb-6 flex items-center justify-center text-[11px] font-mono text-ink/30 tracking-wider select-none">
      <span>Designed & Developed by</span>
      <span className="font-extrabold text-ink/80 ml-1.5 bg-gradient-to-r from-zinc-200 via-white to-emerald-400 bg-clip-text text-transparent">
        Anish Srivastava
      </span>
    </div>
  );
}
