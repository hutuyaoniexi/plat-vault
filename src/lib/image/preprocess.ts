import {MAX_IMAGE_WIDTH} from '../../shared/constants';
import {validateImage} from './validate';

export async function preprocessImage(blob: Blob): Promise<OffscreenCanvas> {
  await validateImage(blob);
  const bitmap = await createImageBitmap(blob);
  // Inventory labels are small. Enlarging them before thresholding retains
  // enough Chinese glyph detail for the local OCR model.
  const scale = Math.min(2, MAX_IMAGE_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { bitmap.close(); throw new Error('无法初始化图片处理画布'); }
  try { context.drawImage(bitmap, 0, 0, width, height); }
  finally { bitmap.close(); }
  const image = context.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const goldText = red > 105 && green > 80 && red > blue * 1.35 && green > blue * 1.2;
    const whiteText = red > 155 && green > 155 && blue > 135;
    const value = goldText || whiteText ? 255 : 0;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
