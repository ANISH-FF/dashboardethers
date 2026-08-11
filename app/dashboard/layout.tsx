import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { SidebarProvider } from "@/components/SidebarContext";
import { AutomationStoreProvider } from "@/components/AutomationStoreContext";
import { BrandProvider } from "@/components/BrandContext";
import { ActivityTrackerProvider } from "@/components/ActivityTrackerProvider";
import { GlobalQuickChat } from "@/components/GlobalQuickChat";
import { WatermarkFooter } from "@/components/WatermarkFooter";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const settings = getSettings();
  const role = session?.role || "staff";

  return (
    <BrandProvider>
      <SidebarProvider>
        <AutomationStoreProvider>
          <ActivityTrackerProvider>
            <div className="flex h-screen bg-paper overflow-hidden font-sans">
              <Sidebar role={role} />
              <div className="flex flex-1 flex-col overflow-hidden bg-paper-dark">
                <TopBar restaurantName={settings.restaurantName} userName={session?.name} role={role} />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar relative">
                  <div className="w-full">
                    {children}
                    <WatermarkFooter />
                  </div>
                </main>
              </div>
            </div>
            <GlobalQuickChat />
          </ActivityTrackerProvider>
        </AutomationStoreProvider>
      </SidebarProvider>
    </BrandProvider>
  );
}
