'use client';

// Main-thread interface to the XLS parser Web Worker.
// Returns an async generator that yields chunks of parsed rows.

import type { WorkerResponse } from './xlsParser.worker';

export interface ParseChunk {
  rows: import('./xlsParser.worker').ParsedRow[];
  chunkIndex: number;
  totalChunks: number;
}

export interface ParseProgress {
  phase: string;
  percent: number;
}

export interface ParseMetadata {
  periodStart: string;
  periodEnd: string;
  totalRows: number;
  skippedRows: number;
  skipSummary: Record<string, number>;
}

export type ParseEvent =
  | { type: 'progress'; data: ParseProgress }
  | { type: 'metadata'; data: ParseMetadata }
  | { type: 'chunk'; data: ParseChunk }
  | { type: 'done'; totalRows: number }
  | { type: 'error'; message: string }

export async function* parseXLSFile(file: File): AsyncGenerator<ParseEvent> {
  const buffer = await file.arrayBuffer();

  const worker = new Worker(new URL('./xlsParser.worker.ts', import.meta.url));

  const eventQueue: ParseEvent[] = [];
  let resolve: (() => void) | null = null;
  let isDone = false;

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;

    if (msg.type === 'progress') {
      eventQueue.push({ type: 'progress', data: { phase: msg.phase, percent: msg.percent } });
    } else if (msg.type === 'metadata') {
      eventQueue.push({ type: 'metadata', data: msg.data });
    } else if (msg.type === 'chunk') {
      eventQueue.push({ type: 'chunk', data: { rows: msg.rows, chunkIndex: msg.chunkIndex, totalChunks: msg.totalChunks } });
    } else if (msg.type === 'done') {
      eventQueue.push({ type: 'done', totalRows: msg.totalRows });
      isDone = true;
    } else if (msg.type === 'error') {
      eventQueue.push({ type: 'error', message: msg.message });
      isDone = true;
    }

    resolve?.();
    resolve = null;
  };

  worker.onerror = (e) => {
    eventQueue.push({ type: 'error', message: e.message });
    isDone = true;
    resolve?.();
    resolve = null;
  };

  // Start the worker
  worker.postMessage({ type: 'parse', buffer, filename: file.name }, [buffer]);

  try {
    while (true) {
      if (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        yield event;
        if (event.type === 'done' || event.type === 'error') break;
      } else if (isDone) {
        break;
      } else {
        // Wait for next message
        await new Promise<void>((r) => { resolve = r; });
      }
    }
  } finally {
    worker.terminate();
  }
}
