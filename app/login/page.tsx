import { LoginForm } from '@/components/auth/LoginForm';

type LoginPageProps = {
  searchParams: Promise<{
    redirectedFrom?: string | string[];
  }>;
};

function normalizeRedirectPath(value: string | string[] | undefined) {
  const redirectValue = Array.isArray(value) ? value[0] : value;

  if (!redirectValue || !redirectValue.startsWith('/')) {
    return '/';
  }

  return redirectValue;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectedFrom = normalizeRedirectPath(params.redirectedFrom);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-[2rem] border border-white/60 p-8 shadow-2xl shadow-indigo-500/10">
          <div className="mb-8 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-2xl font-bold text-white shadow-lg shadow-indigo-500/20">
              A
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-indigo-500">
                Área protegida
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                Entrar no painel
              </h1>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Use o email e a senha cadastrados no Supabase. O acesso é liberado
                pelo administrador do projeto.
              </p>
            </div>
          </div>

          <LoginForm redirectedFrom={redirectedFrom} />
        </div>
      </div>
    </div>
  );
}
