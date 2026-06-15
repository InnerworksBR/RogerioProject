import type { Metadata } from 'next';
import { Outfit, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Autimex - Dashboard Comercial',
  description: 'Dashboard de visita comercial e análise de vendas da Autimex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[#030712] font-sans selection:bg-indigo-500/30 selection:text-indigo-200 text-slate-200">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#030712] to-[#030712]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[url('/noise.svg')] opacity-[0.04] mix-blend-overlay" />

        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
