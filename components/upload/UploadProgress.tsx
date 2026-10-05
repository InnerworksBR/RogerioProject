'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';

interface Props {
  status: 'idle' | 'parsing' | 'uploading' | 'finalizing' | 'complete' | 'error';
  progress: number;
  filename: string | null;
  rowCount: number;
  errorMessage: string | null;
  chunksDone: number;
  chunksTotal: number;
  /** Fase atual emitida pelo worker (ex.: "reading", "parsing", "building") */
  phase?: string;
}

/** Rótulos das três fases visíveis ao usuário, conforme o PRD. */
function getPhaseLabel(
  status: Props['status'],
  chunksDone: number,
  chunksTotal: number
): string {
  if (status === 'parsing') return 'Lendo arquivos...';
  if (status === 'uploading') {
    const suffix = chunksTotal > 0 ? ` (${chunksDone}/${chunksTotal} lotes)` : '';
    return `Calculando pivot...${suffix}`;
  }
  if (status === 'finalizing') return 'Gerando relatórios...';
  if (status === 'complete') return 'Importação concluída';
  if (status === 'error') return 'Erro no processamento';
  return '';
}

export function UploadProgress({
  status,
  progress,
  filename,
  rowCount,
  errorMessage,
  chunksDone,
  chunksTotal,
  phase,
}: Props) {
  if (status === 'idle') return null;

  const label = getPhaseLabel(status, chunksDone, chunksTotal);

  const barColor =
    status === 'error'
      ? 'bg-rose-500'
      : status === 'complete'
      ? 'bg-emerald-500'
      : 'bg-indigo-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 backdrop-blur-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700 truncate">
            {filename ?? 'Arquivo'}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">{label}</p>
        </div>

        <div className="shrink-0">
          {status === 'complete' ? (
            <CircleCheck className="w-5 h-5 text-emerald-700" />
          ) : status === 'error' ? (
            <TriangleAlert className="w-5 h-5 text-rose-700" />
          ) : (
            <span className="text-xs font-semibold tabular-nums text-slate-700">
              {progress}%
            </span>
          )}
        </div>
      </div>

      {/* Barra de progresso — proporcional: parse 0-50, upload 50-95, finalização 95-100 */}
      <div
        className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden"
        role="progressbar"
        aria-label={`Progresso de ${filename ?? 'arquivo'}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, progress))}
        aria-valuetext={`${progress}% — ${label}`}
      >
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${barColor} `}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {/* Marcadores das três fases */}
      <div className="flex justify-between text-xs text-slate-600 px-0.5">
        <span>Lendo</span>
        <span>Pivot</span>
        <span>Relatórios</span>
      </div>

      {status === 'complete' && rowCount > 0 && (
        <p className="text-xs text-emerald-700 font-medium">
          {rowCount.toLocaleString('pt-BR')} linhas importadas com sucesso.
        </p>
      )}

      {status === 'error' && errorMessage && (
        <p className="text-xs text-rose-700">{errorMessage}</p>
      )}
    </div>
  );
}
