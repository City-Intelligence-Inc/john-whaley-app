"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Brain,
  Users,
  Settings,
  ListChecks,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Upload Applicants", href: "/upload", icon: Upload },
  { title: "AI Analysis", href: "/analyze", icon: Brain },
  { title: "Results", href: "/results", icon: ListChecks },
  { title: "All Applicants", href: "/applicants", icon: Users },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              AR
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none">Applicant Reviewer</span>
              <span className="text-[10px] text-muted-foreground">Event Organizer Tool</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">
            {navItems.find((item) => item.href === pathname)?.title || "Applicant Reviewer"}
          </h1>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
