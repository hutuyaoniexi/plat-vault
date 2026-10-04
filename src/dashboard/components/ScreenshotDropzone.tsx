import { useRef, useState } from 'react';

interface Props { onFiles: (files: File[]) => void; disabled?: boolean; }
const imageFiles = (files: Iterable<File>) => [...files].filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
export function ScreenshotDropzone({ onFiles, disabled }: Props) {
  const [active, setActive] = useState(false); const input = useRef<HTMLInputElement>(null);
  const accept = (files: Iterable<File>) => { const accepted = imageFiles(files); if (accepted.length) onFiles(accepted); };
  return <section className={`dropzone ${active ? 'active' : ''}`} onDragOver={(event) => { event.preventDefault(); setActive(true); }} onDragLeave={() => setActive(false)} onDrop={(event) => { event.preventDefault(); setActive(false); accept(event.dataTransfer.files); }} onPaste={(event) => { accept(event.clipboardData.files); }} tabIndex={0}>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => accept(event.target.files ?? [])} />
    <div><strong>拖入 Warframe 仓库截图</strong><span>或 <label onClick={() => !disabled && input.current?.click()}>点击选择图片</label> · 也可以 Ctrl/Cmd + V 粘贴截图</span></div>
  </section>;
}
