import { AuthProvider } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen={false} open={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
            <h1 className="text-sm font-medium text-muted-foreground">Selecta</h1>
          </header>
          <main className="flex-1 overflow-hidden p-6">
            <div className="h-full overflow-auto">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
