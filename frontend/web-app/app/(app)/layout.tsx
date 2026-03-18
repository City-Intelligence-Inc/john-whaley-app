"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} open={false}>
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <SidebarInset>
        <main className="flex-1 overflow-hidden p-4 md:p-6 pb-20 md:pb-6">
          <div className="h-full overflow-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
