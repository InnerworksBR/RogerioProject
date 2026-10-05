'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/upload');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível carregar o histórico.');
      setUploads(payload.uploads ?? []);
    } catch {
      setError('Não foi possível carregar o histórico de importações. Tente novamente.');
    } finally {
      setLoading(false);
    }
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

  if (loading) return <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Carregando histórico de importações…</p>;
  if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>;
  if (uploads.length === 0) return <section className="glass rounded-2xl p-5"><h2 className="font-semibold">Histórico de importações</h2><p className="mt-2 text-sm text-slate-600">Você ainda não importou arquivos. As planilhas processadas aparecerão aqui.</p></section>;

  return (
    <>
      <ConfirmDialog />
      <section className="glass rounded-3xl p-6">
        <h2 className="text-lg font-bold text-slate-900">Histórico recente</h2>
        <div className="mt-4 space-y-2">
          {uploads.map((upload) => (
            <div key={upload.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-700">{upload.filename}</p>
                <p className="text-xs text-slate-600">
                  {formatDate(upload.period_start)} até {formatDate(upload.period_end)} · {(upload.row_count ?? 0).toLocaleString('pt-BR')} linhas · {new Date(upload.created_at).toLocaleString('pt-BR')}
                </p>
                {upload.skipped_rows > 0 && (
                  <details className="mt-2 text-xs text-amber-700">
                    <summary className="cursor-pointer">{upload.skipped_rows.toLocaleString('pt-BR')} linhas ignoradas</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
                      {Object.entries(upload.skip_summary ?? {}).map(([reason, count]) => <li key={reason}>{reason}: {count.toLocaleString('pt-BR')}</li>)}
                    </ul>
                  </details>
                )}
                {upload.error_msg && <p className="mt-1 text-xs text-rose-700">{upload.error_msg}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={upload.status === 'complete' ? 'text-emerald-700' : upload.status === 'error' ? 'text-rose-700' : 'text-amber-700'}>{statusLabel[upload.status]}</span>
                <Button size="icon" variant="ghost" aria-label={`Excluir importação ${upload.filename}`} disabled={removing === upload.id} onClick={() => void remove(upload)}>
                  <Trash2 className="size-4 text-rose-700" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
