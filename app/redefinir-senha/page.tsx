import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-slate-200 p-8 shadow-sm shadow-indigo-500/10">
          <div className="mb-8 space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">
              P
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                Definir senha
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Crie sua nova senha
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Escolha uma senha segura para acessar o painel.
              </p>
            </div>
          </div>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
