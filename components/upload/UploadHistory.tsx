'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UploadMetadata } from '@/types/operations';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { reportQueryKeys } from '@/lib/client/reportApi';

const statusLabel: Record<UploadMetadata['status'], string> = {
  processing: 'Processando',
  complete: 'Concluído',
  error: 'Com erro',
};

function formatDate(value: string | null) {
  if (!value) return 'sem período';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

export function UploadHistory() {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadMetadata[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(() => {
    fetch('/api/upload')
      .then((response) => response.json())
      .then((payload) => setUploads(payload.uploads ?? []))
      .catch(() => setUploads([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(upload: UploadMetadata) {
    const accepted = await confirm({
      title: 'Excluir esta importação?',
      description: `As ${(upload.row_count ?? 0).toLocaleString('pt-BR')} linhas de “${upload.filename}” serão removidas dos relatórios. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir importação',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!accepted) return;
    setRemoving(upload.id);
    try {
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: upload.id, mode: 'remove' }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao excluir importação.');
      await queryClient.invalidateQueries({ queryKey: reportQueryKeys.all });
      toast.success('Importação excluída. Os relatórios serão recalculados na próxima abertura.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir importação.');
    } finally {
      setRemoving(null);
    }
  }

  if (uploads.length === 0) return null;

  return (
    <>
      <ConfirmDialog />
      <section className="glass rounded-3xl p-6">
        <h2 className="text-lg font-bold text-white">Histórico recente</h2>
        <div className="mt-4 space-y-2">
          {uploads.map((upload) => (
            <div key={upload.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-200">{upload.filename}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(upload.period_start)} até {formatDate(upload.period_end)} · {(upload.row_count ?? 0).toLocaleString('pt-BR')} linhas · {new Date(upload.created_at).toLocaleString('pt-BR')}
                </p>
                {upload.skipped_rows > 0 && (
                  <details className="mt-2 text-xs text-amber-300">
                    <summary className="cursor-pointer">{upload.skipped_rows.toLocaleString('pt-BR')} linhas ignoradas</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-400">
                      {Object.entries(upload.skip_summary ?? {}).map(([reason, count]) => <li key={reason}>{reason}: {count.toLocaleString('pt-BR')}</li>)}
                    </ul>
                  </details>
                )}
                {upload.error_msg && <p className="mt-1 text-xs text-rose-400">{upload.error_msg}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={upload.status === 'complete' ? 'text-emerald-400' : upload.status === 'error' ? 'text-rose-400' : 'text-amber-400'}>{statusLabel[upload.status]}</span>
                <Button size="icon" variant="ghost" aria-label={`Excluir importação ${upload.filename}`} disabled={removing === upload.id} onClick={() => void remove(upload)}>
                  <Trash2 className="size-4 text-rose-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
