import {useState} from 'react';
import type {ScreenshotAsset} from '../../shared/types';

export interface ScreenshotProgress { progress: number; status: string; error?: string; }
export function ScreenshotList({ screenshots, progress, onRemove, disabled = false }: { screenshots: ScreenshotAsset[]; progress: Record<string, ScreenshotProgress>; onRemove: (id: string) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<ScreenshotAsset | undefined>();
  return <><div className="screenshots">{screenshots.map((shot) => { const state = progress[shot.id]; return <article className="shot" key={shot.id}><button className="preview-trigger" onClick={() => setPreview(shot)} aria-label={`预览 ${shot.name}`}><img src={shot.objectUrl} alt={shot.name}/></button><button className="danger" disabled={disabled} onClick={() => onRemove(shot.id)} aria-label={`删除 ${shot.name}`}>×</button><p>{shot.name}</p>{state && <><p className={state.error ? 'error' : 'muted'}>{state.error ?? state.status}</p><div className="progress"><i style={{ width: `${Math.round(state.progress * 100)}%` }}/></div></>}</article>; })}</div>{preview && <div className="image-preview" role="presentation" onClick={() => setPreview(undefined)}><button className="preview-close" onClick={() => setPreview(undefined)} aria-label="关闭预览">×</button><img src={preview.objectUrl} alt={preview.name} onClick={(event) => event.stopPropagation()}/><p>{preview.name}</p></div>}</>;
}
