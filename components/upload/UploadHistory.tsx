'use client';

import { useEffect, useState } from 'react';
import type { UploadMetadata } from '@/types/operations';

export function UploadHistory() {
  const [uploads, setUploads] = useState<UploadMetadata[]>([]);

  useEffect(() => {
    fetch('/api/upload')
      .then((response) => response.json())
      .then((payload) => setUploads(payload.uploads ?? []))
      .catch(() => setUploads([]));
  }, []);

  if (uploads.length === 0) return null;

  return (
    <section className="glass rounded-3xl p-6">
      <h2 className="text-lg font-bold text-white">Histórico recente</h2>
      <div className="mt-4 space-y-2">
        {uploads.map((upload) => (
          <div key={upload.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-200">{upload.filename}</p>
              <p className="text-xs text-slate-500">
                {upload.period_start ?? 'sem período'} até {upload.period_end ?? 'sem período'} | {(upload.row_count ?? 0).toLocaleString('pt-BR')} linhas
              </p>
            </div>
            <span className={upload.status === 'complete' ? 'text-emerald-400' : upload.status === 'error' ? 'text-rose-400' : 'text-amber-400'}>
              {upload.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
