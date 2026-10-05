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
    <html lang="pt-BR" style={{ colorScheme: 'light' }}>
      <body className="min-h-screen bg-white font-sans text-slate-700 flex items-center justify-center px-4">
        <div
          className="rounded-2xl p-10 text-center max-w-lg w-full border border-rose-500/20"
          style={{
            background:
              '#ffffff',
          }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20"
              style={{ background: 'rgba(244,63,94,0.1)' }}
            >
              <AlertTriangle
                className="h-8 w-8"
                style={{ color: '#be2340' }}
              />
            </div>
          </div>

          <h2
            className="text-2xl font-bold mb-3"
            style={{ color: '#17243c' }}
          >
            Falha crítica na aplicação
          </h2>
          <p
            className="leading-relaxed mb-8"
            style={{ color: '#52627a' }}
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
              background: '#3558c8',
              border: '1px solid #3558c8',
              color: '#ffffff',
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
