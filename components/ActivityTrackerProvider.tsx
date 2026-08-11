"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";

function getSectionNameFromPath(path: string): string {
  if (path === "/dashboard") return "Dashboard Overview";
  if (path.includes("/dashboard/picture-automation")) return "Picture Automation";
  if (path.includes("/dashboard/menu-automation")) return "Menu Automation";
  if (path.includes("/dashboard/hygiene-check")) return "Hygiene Audit";
  if (path.includes("/dashboard/pricing-strategy")) return "Pricing Strategy";
  if (path.includes("/dashboard/marketing-strategy")) return "Marketing Strategy";
  if (path.includes("/dashboard/discount-calculator")) return "Discount Calculator";
  if (path.includes("/dashboard/projections")) return "Sales Projections";
  if (path.includes("/dashboard/employees")) return "Employee Hub & HR";
  if (path.includes("/dashboard/chat")) return "Team Chat";
  if (path.includes("/dashboard/brands")) return "Brand Management";
  if (path.includes("/dashboard/leads")) return "Leads & CRM";
  if (path.includes("/dashboard/reports")) return "Analytics Reports";
  if (path.includes("/dashboard/discrepancy")) return "Discrepancy Tracker";
  if (path.includes("/dashboard/settings")) return "Settings";
  return "Dashboard";
}

export function ActivityTrackerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lastActiveRef = useRef<number>(Date.now());
  const activeSecondsRef = useRef<number>(0);
  const [isIdle, setIsIdle] = useState(false);

  // Monitor user activity (mousemove, keydown) to reset AFK idle timer
  useEffect(() => {
    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
      if (isIdle) setIsIdle(false);
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);
    window.addEventListener("click", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, [isIdle]);

  // Track active screen seconds when tab is focused and active
  useEffect(() => {
    const timer = setInterval(() => {
      const isFocused = typeof document !== "undefined" && document.hasFocus() && document.visibilityState === "visible";
      const afkTime = Date.now() - lastActiveRef.current;
      const userAFK = afkTime > 180000; // 3 minutes without mouse/keyboard input

      if (userAFK && !isIdle) {
        setIsIdle(true);
      }

      if (isFocused && !userAFK) {
        activeSecondsRef.current += 1;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isIdle]);

  // Send 30-second heartbeat ping to /api/activity
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const section = getSectionNameFromPath(pathname || "/dashboard");
        const activeSecs = activeSecondsRef.current;
        activeSecondsRef.current = 0; // Reset incremental counter after ping

        const isFocused = typeof document !== "undefined" && document.hasFocus() && document.visibilityState === "visible";
        const afkTime = Date.now() - lastActiveRef.current;
        const currentIdle = !isFocused || afkTime > 180000;

        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_section: section,
            active_seconds: activeSecs,
            idle: currentIdle
          })
        });
      } catch (e) {
        // Silent error catch to avoid disturbing user
      }
    };

    // Initial ping on section change
    sendHeartbeat();

    // 30-second interval ping
    const pingInterval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(pingInterval);
  }, [pathname]);

  return <>{children}</>;
}
