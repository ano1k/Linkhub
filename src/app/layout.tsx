import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "LinkHub — Partage ton serveur Discord, lien toujours actif",
    template: "%s · LinkHub",
  },
  description:
    "Plateforme de partage de serveurs Discord : invitations vérifiées et régénérées automatiquement toutes les 5 minutes, API sécurisée par clé, heartbeat Discord et surveillance du site.",
  keywords: [
    "Discord",
    "invitation",
    "API",
    "partage",
    "serveur",
    "bouton",
    "webhook",
    "heartbeat",
    "surveillance",
  ],
  authors: [{ name: "LinkHub" }],
  creator: "LinkHub",
  applicationName: "LinkHub",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.svg" }],
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "LinkHub",
    title: "LinkHub — Partage ton serveur Discord, lien toujours actif",
    description:
      "Invitations Discord toujours valides, API sécurisée et heartbeat Discord toutes les 5 minutes. Partage tes serveurs sur tous tes sites.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkHub — Partage ton serveur Discord",
    description:
      "Invitations vérifiées et régénérées automatiquement, API sécurisée, heartbeat Discord.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#08070f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen flex flex-col"
      >
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
