'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error.digest ?? error.message)
  }, [error])

  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#030712] font-sans text-slate-200 flex items-center justify-center px-4">
        <div
          className="rounded-[2rem] p-10 text-center max-w-lg w-full border border-rose-500/20"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20"
              style={{ background: 'rgba(244,63,94,0.1)' }}
            >
              <AlertTriangle
                className="h-8 w-8"
                style={{ color: 'rgb(251,113,133)' }}
              />
            </div>
          </div>

          <h2
            className="text-2xl font-bold mb-3"
            style={{ color: '#fff' }}
          >
            Falha crítica na aplicação
          </h2>
          <p
            className="leading-relaxed mb-8"
            style={{ color: 'rgb(148,163,184)' }}
          >
            Ocorreu um erro grave ao carregar o sistema. Tente recarregar a página. Se o problema continuar, entre em contato com o suporte técnico.
          </p>

          {error.digest && (
            <p
              className="text-xs mb-6 font-mono"
              style={{ color: 'rgb(71,85,105)' }}
            >
              Referência: {error.digest}
            </p>
          )}

          <button
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all"
            style={{
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: 'rgb(165,180,252)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
