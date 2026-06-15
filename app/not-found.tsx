import Link from 'next/link'
import { MapPin, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-[2rem] p-10 text-center max-w-lg w-full border border-slate-700/50">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <MapPin className="h-8 w-8 text-indigo-400" />
          </div>
        </div>

        <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-4">
          404
        </p>

        <h2 className="text-2xl font-bold text-white mb-3">
          Página não encontrada
        </h2>
        <p className="text-slate-400 leading-relaxed mb-8">
          O endereço que você acessou não existe ou foi movido. Verifique o link e tente novamente.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 px-6 py-3 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-500/30 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
