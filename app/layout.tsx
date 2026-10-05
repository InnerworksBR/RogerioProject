import type { Metadata } from 'next';
import { Outfit, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';

const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Plastiron | Relatórios de vendas',
  description: 'Dashboard de visita comercial e análise de vendas da Plastiron',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground selection:bg-indigo-100 selection:text-indigo-900">
        <QueryProvider>
          {children}
          <Toaster richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
