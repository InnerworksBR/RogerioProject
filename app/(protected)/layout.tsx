import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { UserMenu } from '@/components/auth/UserMenu';
import { hasAIReportChatAccess } from '@/lib/server/reportChatAccess';

const navItems = [
  { href: '/', label: 'Início' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/upload', label: 'Upload' },
  { href: '/reports', label: 'Relatórios' },
  { href: '/config', label: 'Configuração' },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isLeader = profile?.role === 'leader';
  const hasChatAccess = await hasAIReportChatAccess(supabase).catch(() => false);
  
  const currentNavItems = [...navItems];
  if (hasChatAccess) {
    currentNavItems.push({ href: '/chat', label: 'Chat IA' });
  }
  if (isLeader) {
    currentNavItems.push({ href: '/team', label: 'Equipe' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#030712]/50 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4 sm:gap-8">
              <Link href="/" className="group flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-lg font-bold text-indigo-400 border border-indigo-500/30 transition-transform group-hover:scale-110">
                  P
                </div>
                <span className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
                  <span className="sm:hidden">Plastiron</span>
                  <span className="hidden sm:inline">
                    Plastiron{' '}
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      Relatórios
                    </span>
                  </span>
                </span>
              </Link>

              <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1 md:flex">
                {currentNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <UserMenu email={user.email ?? 'Usuário'} />
          </div>

          <div className="mt-3 overflow-x-auto pb-1 md:hidden">
            <div className="flex min-w-max items-center gap-2">
              {currentNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-400 transition-all hover:border-white/20 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
