import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { UserMenu } from '@/components/auth/UserMenu';
import { hasAIReportChatAccess } from '@/lib/server/reportChatAccess';
import { ProtectedNav } from '@/components/layout/ProtectedNav';

const navItems = [
  { href: '/', label: 'Início' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/upload', label: 'Importações' },
  { href: '/reports', label: 'Relatórios' },
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
    currentNavItems.push({ href: '/config', label: 'Configuração' });
    currentNavItems.push({ href: '/team', label: 'Equipe' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only z-[100] rounded-lg bg-primary px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ir para o conteúdo</a>
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="group flex min-w-0 items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">
                  P
                </div>
                <span className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  <span className="sm:hidden">Plastiron</span>
                  <span className="hidden sm:inline">
                    Plastiron{' '}
                    <span className="font-medium text-indigo-600">
                      Relatórios
                    </span>
                  </span>
                </span>
              </Link>

            </div>

            <UserMenu email={user.email ?? 'Usuário'} />
          </div>

          <ProtectedNav items={currentNavItems} />

        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
