"use client";

import { AuthProvider } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
    <SidebarProvider defaultOpen={false} open={false}>
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <SidebarInset className="overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6 max-w-full">
          {children}
        </main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
    </AuthProvider>
  );
}
