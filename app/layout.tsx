import type { Metadata } from 'next'
import { ClientProviders } from '@/components/client-providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'NutriDine — Personalized Nutrition System',
  description: 'AI-powered diet recommendations tailored to your health conditions, fitness goals, and food preferences.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#16a34a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="NutriDine" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/nutridine-logoorg.png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="/nutridine-logoorg.png" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
