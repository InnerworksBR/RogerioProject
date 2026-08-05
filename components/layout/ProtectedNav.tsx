'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface ProtectedNavItem {
  href: string;
  label: string;
}

export function ProtectedNav({ items, variant = 'desktop' }: { items: ProtectedNavItem[]; variant?: 'desktop' | 'mobile' }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === 'desktop') {
    return (
      <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1 md:flex">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-all hover:bg-white/10 hover:text-white', isCurrent(item.href) ? 'bg-white/10 text-white' : 'text-slate-400')}>
            {item.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
      <div className="mt-3 overflow-x-auto pb-1 md:hidden">
        <div className="flex min-w-max items-center gap-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:border-white/20 hover:text-white', isCurrent(item.href) ? 'border-indigo-400/40 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400')}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
  );
}
