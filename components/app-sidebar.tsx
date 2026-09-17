"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  ChefHat,
  Calendar,
  ShoppingBasket,
  User,
  LogOut,
  Info,
  Stethoscope,
  Sun,
  Moon,
  ClipboardList,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useUser } from "@/contexts/user-context"

const navigationItems = [
  { title: "Dashboard",         icon: LayoutDashboard, href: "/dashboard"        },
  { title: "Recipes",           icon: ChefHat,         href: "/recipes"          },
  { title: "Meal Plan",         icon: Calendar,        href: "/meal-plan"        },
  { title: "Food Log",          icon: ClipboardList,   href: "/food-log"         },
  { title: "Food & Ingredients",icon: ShoppingBasket,  href: "/food-ingredients" },
  { title: "Health Guide",      icon: Stethoscope,     href: "/conditions"       },
  { title: "Profile",           icon: User,            href: "/profile"          },
  { title: "About",             icon: Info,            href: "/about"            },
]

export function AppSidebar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { logout, user } = useUser()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark")

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/nutridine-logoorg.png"
            alt="NutriDine Logo"
            className="w-9 h-9 rounded-xl object-cover shrink-0"
          />
          <span className="text-xl font-bold text-sidebar-foreground truncate group-data-[collapsible=icon]:hidden">
            NutriDine
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = item.href === "/"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "transition-all duration-200",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      )}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <div className="mt-auto border-t border-sidebar-border">
        {/* Dark mode toggle */}
        <div className="px-3 py-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-150"
            title={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
          >
            {mounted && theme === "dark"
              ? <Sun  className="w-4 h-4 text-amber-400 shrink-0" />
              : <Moon className="w-4 h-4 text-blue-500 shrink-0"  />
            }
            <span className="group-data-[collapsible=icon]:hidden">
              {mounted ? (theme === "dark" ? "Light mode" : "Dark mode") : "Dark mode"}
            </span>
          </button>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-3 bg-muted/40 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 py-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </button>
        </div>
      </div>
    </Sidebar>
  )
}
