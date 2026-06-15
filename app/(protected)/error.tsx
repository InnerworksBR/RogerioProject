'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ProtectedError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[ProtectedError]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="glass rounded-[2rem] p-10 text-center max-w-lg w-full border border-rose-500/20">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          Algo deu errado
        </h2>
        <p className="text-slate-400 leading-relaxed mb-8">
          Ocorreu um erro inesperado ao carregar esta página. Tente novamente — se o problema persistir, entre em contato com o suporte.
        </p>

        {error.digest && (
          <p className="text-xs text-slate-600 mb-6 font-mono">
            Referência: {error.digest}
          </p>
        )}

        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 px-6 py-3 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-500/30 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
