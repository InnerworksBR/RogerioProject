import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function RecuperarSenhaPage() {
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
                Recuperar acesso
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                Esqueceu a senha?
              </h1>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Informe o email cadastrado e enviaremos um link para você
                redefinir a senha.
              </p>
            </div>
          </div>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
