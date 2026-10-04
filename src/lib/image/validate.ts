import {MAX_IMAGE_FILE_SIZE_BYTES, MAX_IMAGE_PIXELS} from '../../shared/constants';

function readDimensions(bytes: DataView, type: string): [number, number] | undefined {
  if (type === 'image/png' && bytes.byteLength >= 24 && bytes.getUint32(0) === 0x89504e47) {
    return [bytes.getUint32(16), bytes.getUint32(20)];
  }
  if (type === 'image/jpeg' && bytes.byteLength >= 4 && bytes.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= bytes.byteLength) {
      if (bytes.getUint8(offset) !== 0xff) { offset += 1; continue; }
      const marker = bytes.getUint8(offset + 1);
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.byteLength) break;
      const length = bytes.getUint16(offset);
      if (length < 2 || offset + length > bytes.byteLength) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) break;
        return [bytes.getUint16(offset + 5), bytes.getUint16(offset + 3)];
      }
      offset += length;
    }
  }
  if (type === 'image/webp' && bytes.byteLength >= 30 && bytes.getUint32(0, true) === 0x46464952 && bytes.getUint32(8, true) === 0x50424557) {
    const chunk = String.fromCharCode(bytes.getUint8(12), bytes.getUint8(13), bytes.getUint8(14), bytes.getUint8(15));
    if (chunk === 'VP8X') return [1 + bytes.getUint8(24) + (bytes.getUint8(25) << 8) + (bytes.getUint8(26) << 16), 1 + bytes.getUint8(27) + (bytes.getUint8(28) << 8) + (bytes.getUint8(29) << 16)];
    if (chunk === 'VP8 ' && bytes.byteLength >= 30 && bytes.getUint8(23) === 0x9d && bytes.getUint8(24) === 0x01 && bytes.getUint8(25) === 0x2a) return [bytes.getUint16(26, true) & 0x3fff, bytes.getUint16(28, true) & 0x3fff];
    if (chunk === 'VP8L' && bytes.getUint8(20) === 0x2f) {
      const b1 = bytes.getUint8(21); const b2 = bytes.getUint8(22); const b3 = bytes.getUint8(23); const b4 = bytes.getUint8(24);
      return [1 + (((b2 & 0x3f) << 8) | b1), 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))];
    }
  }
  return undefined;
}

export async function validateImage(blob: Blob): Promise<void> {
  if (blob.size > MAX_IMAGE_FILE_SIZE_BYTES) throw new Error('单张图片不能超过 20 MB');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('图片格式不支持，请使用 PNG、JPEG 或 WebP 图片');
  const header = await blob.slice(0, 1024 * 1024).arrayBuffer();
  const dimensions = readDimensions(new DataView(header), blob.type);
  if (!dimensions) throw new Error('无法读取图片尺寸，请确认图片文件完整');
  const [width, height] = dimensions;
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) throw new Error('图片分辨率不能超过 1600 万像素');
}
