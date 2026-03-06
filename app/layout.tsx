import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://inovacortex.com"),
  title: {
    default: "InovaCortex | Agentes de IA e Desenvolvimento SaaS",
    template: "%s | InovaCortex",
  },
  description: "Transforme seu negócio com agentes de inteligência artificial, automações avançadas e desenvolvimento SaaS premium para escala corporativa.",
  openGraph: {
    title: "InovaCortex | Transformando Empresas com IA",
    description: "Criamos a infraestrutura operacional do futuro com agentes de Inteligência Artificial autônomos e integrados.",
    url: "https://inovacortex.com",
    siteName: "InovaCortex",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InovaCortex | Agentes Autônomos de IA",
    description: "Soluções de classe empresarial em IA Generativa, SaaS e Automação extrema.",
  },
};

import { WhatsAppButton } from "@/components/whatsapp-button";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <WhatsAppButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
