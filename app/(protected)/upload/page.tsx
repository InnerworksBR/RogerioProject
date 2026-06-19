import { DropZone } from '@/components/upload/DropZone';
import { UploadHistory } from '@/components/upload/UploadHistory';

import { UploadCloud, CheckCircle2 } from 'lucide-react';

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-500">
          Importação de dados
        </p>
        <h1 className="text-4xl font-black tracking-tight text-white">
          Upload de planilhas
        </h1>
        <p className="text-lg text-slate-400">
          Arraste o relatório exportado do Plastiron para importar os dados de vendas.
        </p>
      </div>

      <div className="glass-card rounded-[2.5rem] border border-white/5 p-2 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="relative z-10 bg-[#030712]/50 rounded-[2rem] p-8 sm:p-12 border border-white/5">
          <DropZone />
        </div>
      </div>

      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="flex items-center text-indigo-300">
          <UploadCloud className="w-5 h-5 mr-3" />
          <h3 className="font-bold text-lg">Como funciona</h3>
        </div>
        <ul className="grid sm:grid-cols-2 gap-4">
          {[
            'O arquivo deve ser exportado direto do Plastiron (.xls ou .xlsx).',
            'Somente linhas com situação LIQ são processadas para análise.',
            'Arquivos com até 100 mil linhas são processados em poucos segundos.',
            'Você pode enviar planilhas de meses ou anos diferentes para compor o histórico.'
          ].map((inst, i) => (
            <li key={i} className="flex items-start text-sm text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 shrink-0 mt-0.5" />
              {inst}
            </li>
          ))}
        </ul>
      </div>
      <UploadHistory />
    </div>
  );
}
