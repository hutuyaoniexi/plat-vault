import type { ScreenshotAsset } from '../../shared/types';
export interface ScreenshotProgress { progress: number; status: string; error?: string; }
export function ScreenshotList({ screenshots, progress, onRemove }: { screenshots: ScreenshotAsset[]; progress: Record<string, ScreenshotProgress>; onRemove: (id: string) => void }) {
  return <div className="screenshots">{screenshots.map((shot) => { const state = progress[shot.id]; return <article className="shot" key={shot.id}><img src={shot.objectUrl} alt={shot.name}/><button className="danger" onClick={() => onRemove(shot.id)} aria-label={`删除 ${shot.name}`}>×</button><p>{shot.name}</p>{state && <><p className={state.error ? 'error' : 'muted'}>{state.error ?? state.status}</p><div className="progress"><i style={{ width: `${Math.round(state.progress * 100)}%` }}/></div></>}</article>; })}</div>;
}
