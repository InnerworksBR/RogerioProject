import { DropZone } from '@/components/upload/DropZone';
import { UploadHistory } from '@/components/upload/UploadHistory';

import { UploadCloud, CheckCircle2 } from 'lucide-react';

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
          Importação de dados
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Importar planilhas
        </h1>
        <p className="text-base text-slate-600">
          Envie os arquivos exportados do ERP para atualizar seus indicadores e relatórios.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <DropZone />
      </div>

      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="flex items-center text-indigo-700">
          <UploadCloud className="w-5 h-5 mr-3" />
          <h2 className="font-semibold text-lg">Antes de importar</h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-4">
          {[
            'Use o relatório de vendas do ERP nos formatos .xls ou .xlsx.',
            'Somente vendas liquidadas (situação LIQ) entram na análise.',
            'Você pode selecionar vários arquivos de até 25 MB cada.',
            'Ao concluir, clique em Ver relatórios para analisar o histórico.'
          ].map((inst, i) => (
            <li key={i} className="flex items-start text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 mr-2 shrink-0 mt-0.5" />
              {inst}
            </li>
          ))}
        </ul>
      </div>
      <UploadHistory />
    </div>
  );
}
