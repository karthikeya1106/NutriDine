"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoggedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    // Auth guard: redirect to login if no session token present
    const token = typeof window !== "undefined"
      ? localStorage.getItem("nutridine-token")
      : null
    if (!token) {
      router.replace("/")
    }
  }, [isLoggedIn, router])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile top bar with hamburger trigger */}
        <header className="flex h-12 items-center gap-2 px-4 border-b md:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-semibold text-foreground">NutriDine</span>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
