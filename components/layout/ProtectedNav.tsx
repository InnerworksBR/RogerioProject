'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Settings2, Sparkles, Upload, Users, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProtectedNavItem {
  href: string;
  label: string;
}

const icons = { '/': Home, '/clientes': Users, '/upload': Upload, '/reports': BarChart3, '/chat': Sparkles, '/config': Settings2, '/team': UsersRound };

export function ProtectedNav({ items }: { items: ProtectedNavItem[] }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Navegação principal" className="mt-3 grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-2">
      {items.map((item) => {
        const Icon = icons[item.href as keyof typeof icons] ?? BarChart3;
        return (
          <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}
            className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:justify-start sm:px-4 sm:text-sm', isCurrent(item.href) ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
            <Icon className="hidden size-4 shrink-0 min-[380px]:block" aria-hidden="true" />{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
