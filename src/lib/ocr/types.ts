import type {RawInventoryEntry} from '../../shared/types';

export interface OcrLine { text: string; bbox?: { x0: number; y0: number; x1: number; y1: number }; }
export interface OcrResult { text: string; lines: OcrLine[]; }
export type OcrWorkerMessage = { type: 'recognize'; imageId: string; blob: Blob; mode?: 'relic' } | { type: 'terminate' };
export type OcrWorkerResponse = { type: 'progress'; imageId: string; progress: number; status: string } | { type: 'result'; imageId: string; entries?: RawInventoryEntry[]; text: string; lines: OcrLine[] } | { type: 'error'; imageId: string; message: string };
