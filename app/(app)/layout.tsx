import { Suspense } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { NavUserSkeleton } from "@/components/app/nav-user"
import { SidebarUser } from "@/components/app/sidebar-user"
import { TopbarTitle } from "@/components/app/topbar-title"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar
        user={
          <Suspense fallback={<NavUserSkeleton />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Suspense fallback={null}>
            <TopbarTitle />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
