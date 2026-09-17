"use client"

import { UserProvider } from "@/contexts/user-context"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
  if (!googleClientId && process.env.NODE_ENV === "development") {
    console.error("[NutriDine] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google OAuth will not work.")
  }
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <GoogleOAuthProvider clientId={googleClientId}>
        <UserProvider>
          {children}
          <Toaster />
        </UserProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  )
}
