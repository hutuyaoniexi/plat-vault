import {useState} from 'react';

interface Props { onFiles: (files: File[], rejectedCount: number) => void; }
const imageFiles = (files: Iterable<File>) => [...files].filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
export function ScreenshotDropzone({ onFiles }: Props) {
  const [active, setActive] = useState(false);
  const accept = (files: Iterable<File>) => { const supplied = [...files]; const accepted = imageFiles(supplied); onFiles(accepted, supplied.length - accepted.length); };
  return <section className={`dropzone ${active ? 'active' : ''}`} onDragOver={(event) => { event.preventDefault(); setActive(true); }} onDragLeave={() => setActive(false)} onDrop={(event) => { event.preventDefault(); setActive(false); accept(event.dataTransfer.files); }} onPaste={(event) => { accept(event.clipboardData.files); }} tabIndex={0}>
    <div><strong>拖入截图</strong><span>或 Ctrl/Cmd + V 粘贴截图</span><span>支持 PNG、JPEG、WebP</span><span className="image-limits">单张不超过 20 MB</span></div>
  </section>;
}
