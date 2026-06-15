'use client';

import { create } from 'zustand';

/** Resumo consolidado de todos os arquivos da fila. */
export interface UploadSummary {
  files: number;
  periodStart: string | null;
  periodEnd: string | null;
  totalRows: number;
}

interface UploadState {
  uploadId: string | null;
  progress: number; // 0-100 across parse + upload + finalize
  status: 'idle' | 'parsing' | 'uploading' | 'finalizing' | 'complete' | 'error';
  errorMessage: string | null;
  currentFile: string | null;
  rowCount: number;
  chunksDone: number;
  chunksTotal: number;
  /** Fase emitida pelo worker (ex.: "reading", "building"). */
  phase: string | undefined;
  /** Resumo consolidado exibido no card-resumo ao concluir a fila. */
  summary: UploadSummary;

  setUploadId: (id: string) => void;
  setProgress: (progress: number) => void;
  setStatus: (status: UploadState['status']) => void;
  setError: (message: string) => void;
  setCurrentFile: (name: string) => void;
  setChunks: (done: number, total: number) => void;
  setRowCount: (count: number) => void;
  setPhase: (phase: string) => void;
  /**
   * Acumula as informações de um arquivo concluído no resumo consolidado.
   * Ajusta período mínimo–máximo e soma linhas.
   */
  accumulateSummary: (periodStart: string | null, periodEnd: string | null, rows: number) => void;
  /** Limpa apenas o resumo consolidado (chamado no início de uma nova fila). */
  resetSummary: () => void;
  reset: () => void;
}

const EMPTY_SUMMARY: UploadSummary = {
  files: 0,
  periodStart: null,
  periodEnd: null,
  totalRows: 0,
};

/**
 * Compara dois strings de data em formato "YYYY-MM" (ou "YYYY-MM-DD") de forma
 * lexicográfica — válido porque o parser já emite datas normalizadas nesse formato.
 * Retorna a menor / maior conforme o parâmetro `mode`.
 */
function pickDate(a: string | null, b: string | null, mode: 'min' | 'max'): string | null {
  if (!a) return b;
  if (!b) return a;
  // Strings ISO normalizadas; comparação léxica é suficiente.
  return mode === 'min' ? (a < b ? a : b) : (a > b ? a : b);
}

export const useUploadStore = create<UploadState>((set) => ({
  uploadId: null,
  progress: 0,
  status: 'idle',
  errorMessage: null,
  currentFile: null,
  rowCount: 0,
  chunksDone: 0,
  chunksTotal: 0,
  phase: undefined,
  summary: { ...EMPTY_SUMMARY },

  setUploadId: (id) => set({ uploadId: id }),
  setProgress: (progress) => set({ progress }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setCurrentFile: (name) => set({ currentFile: name }),
  setPhase: (phase) => set({ phase }),
  setChunks: (done, total) => {
    // Fase de upload: 50-95%
    const uploadProgress = total > 0 ? Math.round((done / total) * 45) : 0;
    set({
      chunksDone: done,
      chunksTotal: total,
      progress: Math.min(95, 50 + uploadProgress),
    });
  },
  setRowCount: (count) => set({ rowCount: count }),
  accumulateSummary: (periodStart, periodEnd, rows) =>
    set((state) => ({
      summary: {
        files: state.summary.files + 1,
        periodStart: pickDate(state.summary.periodStart, periodStart, 'min'),
        periodEnd: pickDate(state.summary.periodEnd, periodEnd, 'max'),
        totalRows: state.summary.totalRows + rows,
      },
    })),
  resetSummary: () => set({ summary: { ...EMPTY_SUMMARY } }),
  reset: () =>
    set({
      uploadId: null,
      progress: 0,
      status: 'idle',
      errorMessage: null,
      currentFile: null,
      rowCount: 0,
      chunksDone: 0,
      chunksTotal: 0,
      phase: undefined,
      // Nota: summary NÃO é resetado aqui — é resetado antes da fila pelo resetSummary().
    }),
}));
