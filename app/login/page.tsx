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
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="mb-8 space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">
              P
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                Plastiron · Relatórios de vendas
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Entrar no painel
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Acesse seus clientes, resultados e relatórios com o e-mail e a senha da sua conta.
              </p>
            </div>
          </div>

          <LoginForm redirectedFrom={redirectedFrom} />
        </div>
      </div>
    </div>
  );
}
