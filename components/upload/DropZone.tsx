'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useUploadStore } from '@/store/uploadStore';
import { useFilterStore } from '@/store/filterStore';
import { parseXLSFile, type ParseMetadata } from '@/lib/xlsParser';
import { getAvailableYears } from '@/lib/reportQueries';
import { UploadProgress } from './UploadProgress';
import { useConfirm } from '@/components/ui/use-confirm';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UploadCloud, CircleCheck, Files } from 'lucide-react';

async function fingerprintFile(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Formata uma data ISO "YYYY-MM-DD" ou "YYYY-MM" para exibição legível em pt-BR. */
function formatPeriod(date: string | null): string {
  if (!date) return '—';
  // Aceita "YYYY-MM" ou "YYYY-MM-DD"
  const parts = date.split('-');
  if (parts.length < 2) return date;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const monthName = monthNames[month - 1] ?? parts[1];
  return `${monthName} ${year}`;
}

export function DropZone() {
  const router = useRouter();
  const store = useUploadStore();
  const filterStore = useFilterStore();
  const [queuedFiles, setQueuedFiles] = useState<string[]>([]);
  const [completedFiles, setCompletedFiles] = useState(0);
  const [queueDone, setQueueDone] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const createUpload = useCallback(async (
    file: File,
    fingerprint: string,
    metadata: ParseMetadata,
    confirmOverlap = false
  ): Promise<string> => {
    const response = await fetch('/api/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        fingerprint,
        periodStart: metadata.periodStart,
        periodEnd: metadata.periodEnd,
        skippedRows: metadata.skippedRows,
        skipSummary: metadata.skipSummary,
        fileSize: file.size,
        totalRows: metadata.totalRows,
        confirmOverlap,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 409 && payload.overlaps && !confirmOverlap) {
      const files = (payload.overlaps as { filename: string }[])
        .map((item) => item.filename)
        .join(', ');
      const accepted = await confirm({
        title: 'Sobreposição de período detectada',
        description: `O período de "${file.name}" sobrepõe uploads existentes (${files}). Deseja importar mesmo assim?`,
        confirmLabel: 'Importar mesmo assim',
        cancelLabel: 'Cancelar',
        variant: 'destructive',
      });
      if (!accepted) throw new Error('Importacao cancelada por sobreposicao de periodo.');
      return createUpload(file, fingerprint, metadata, true);
    }

    if (!response.ok) throw new Error(payload.error ?? 'Falha ao criar registro de upload.');
    return payload.upload_id as string;
  }, [confirm]);

  const processFile = useCallback(async (file: File) => {
    store.reset();
    store.setCurrentFile(file.name);
    store.setStatus('parsing');
    let uploadId: string | null = null;
    let totalRows = 0;
    let chunksDone = 0;
    let fileMeta: ParseMetadata | null = null;

    try {
      const fingerprint = await fingerprintFile(file);

      for await (const event of parseXLSFile(file)) {
        if (event.type === 'progress') {
          // Fase de parsing: 0-50%
          store.setProgress(Math.round(event.data.percent / 2));
          store.setPhase(event.data.phase);
        } else if (event.type === 'metadata') {
          fileMeta = event.data;
          uploadId = await createUpload(file, fingerprint, event.data);
          store.setUploadId(uploadId);
          store.setStatus('uploading');
        } else if (event.type === 'chunk') {
          if (!uploadId) throw new Error('Metadados do arquivo nao foram processados.');
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              upload_id: uploadId,
              rows: event.data.rows,
              chunkIndex: event.data.chunkIndex,
              totalChunks: event.data.totalChunks,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error ?? 'Falha ao enviar lote.');
          chunksDone++;
          store.setChunks(chunksDone, event.data.totalChunks);
          totalRows = typeof payload.row_count === 'number'
            ? payload.row_count
            : totalRows + event.data.rows.length;
        } else if (event.type === 'done') {
          totalRows = event.totalRows;
          store.setRowCount(totalRows);
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      // Fase de finalização: 95-100%
      store.setStatus('finalizing');
      store.setProgress(98);

      store.setStatus('complete');
      store.setProgress(100);

      // Acumula no resumo consolidado
      store.accumulateSummary(
        fileMeta?.periodStart ?? null,
        fileMeta?.periodEnd ?? null,
        totalRows
      );
      setCompletedFiles((count) => count + 1);
      toast.success(`${file.name}: ${totalRows.toLocaleString('pt-BR')} linhas importadas.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      if (uploadId) {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id: uploadId, errorMessage: message }),
        }).catch(() => undefined);
      }
      store.setError(message);
      toast.error(`${file.name}: ${message}`);
    }
  }, [createUpload, store]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setQueuedFiles(acceptedFiles.map((file) => file.name));
    setCompletedFiles(0);
    setQueueDone(false);
    store.resetSummary();

    for (const file of acceptedFiles) {
      await processFile(file);
    }

    // Fila concluída — usuário clica "Ver relatórios" para navegar.
    setQueueDone(true);
  }, [processFile, store]);

  const handleViewReports = useCallback(async () => {
    setIsNavigating(true);
    try {
      // Recarrega os anos disponíveis antes de navegar para evitar o empty state piscando.
      const years = await getAvailableYears();
      filterStore.setAvailableYears(years);
      if (years.length > 0) {
        filterStore.setYear(years[years.length - 1]);
      } else {
        filterStore.setYear(null);
      }
    } catch {
      // Segue a navegação mesmo se falhar — useEnsureReportYears vai tentar de novo.
      filterStore.setAvailableYears([]);
      filterStore.setYear(null);
    }
    router.push('/reports');
  }, [filterStore, router]);

  const isProcessing =
    store.status === 'parsing' ||
    store.status === 'uploading' ||
    store.status === 'finalizing';

  // Mostra o card-resumo quando a fila terminou E pelo menos um arquivo foi concluído.
  const queueComplete = queueDone && completedFiles > 0;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
    disabled: isProcessing,
    maxSize: 25 * 1024 * 1024,
  });

  const summary = store.summary;

  return (
    <>
      <ConfirmDialog />
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-16 text-center transition-all ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-950/20'
              : 'border-slate-700 hover:border-indigo-400 hover:bg-slate-800/50'
          } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="space-y-3">
            <div className="flex justify-center">
              <UploadCloud
                className={`w-10 h-10 ${isDragActive ? 'text-indigo-400' : 'text-slate-500'}`}
              />
            </div>
            <p className="text-lg font-semibold text-slate-200">
              {isDragActive ? 'Solte os arquivos aqui' : 'Arraste um ou mais arquivos .xls ou .xlsx'}
            </p>
            <p className="text-sm text-slate-400">ou clique para selecionar arquivos de até 25 MB</p>
          </div>
        </div>

        {/* Indicador de fila durante processamento */}
        {queuedFiles.length > 0 && !queueComplete && (
          <p className="text-xs text-slate-400">
            Fila: {completedFiles}/{queuedFiles.length} arquivo{queuedFiles.length !== 1 ? 's' : ''} concluído{completedFiles !== 1 ? 's' : ''}.
          </p>
        )}

        {/* Progress do arquivo atual — oculto somente quando o card-resumo final está visível */}
        {store.status !== 'idle' && !queueComplete && (
          <UploadProgress
            status={store.status}
            progress={store.progress}
            filename={store.currentFile}
            rowCount={store.rowCount}
            errorMessage={store.errorMessage}
            chunksDone={store.chunksDone}
            chunksTotal={store.chunksTotal}
            phase={store.phase}
          />
        )}

        {/* Card-resumo consolidado — exibido ao concluir toda a fila com sucesso */}
        {queueComplete && (
          <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <CircleCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-100">
                  {summary.files === 1
                    ? '1 arquivo carregado'
                    : `${summary.files} arquivos carregados`}
                </p>
                <p className="text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Files className="w-3.5 h-3.5" />
                    {formatPeriod(summary.periodStart)}
                    {summary.periodStart !== summary.periodEnd && (
                      <> &ndash; {formatPeriod(summary.periodEnd)}</>
                    )}
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>{summary.totalRows.toLocaleString('pt-BR')} linhas</span>
                </p>
              </div>
            </div>

            <Button
              onClick={handleViewReports}
              disabled={isNavigating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-10"
            >
              {isNavigating ? 'Carregando...' : 'Ver relatórios'}
            </Button>
          </div>
        )}

      </div>
    </>
  );
}
