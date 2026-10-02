import { ADMIN_COPY } from '../config/storeCopy';

export async function resizeProductImage(file: File, role: 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery'): Promise<Blob> {
  // Canvas conversion would flatten an animated GIF to its first frame.
  if (file.type === 'image/gif') return file;
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = source;
    await image.decode();
    const maxWidth = role === 'icon' ? 800 : role === 'card' ? 1200 : role === 'banner' ? 1600 : role === 'mobile-banner' ? 900 : 1400;
    const maxHeight = role === 'icon' ? 800 : role === 'card' ? 800 : role === 'banner' ? 1000 : role === 'mobile-banner' ? 1200 : 1050;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(ADMIN_COPY.products.resizeError);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error(ADMIN_COPY.products.resizeError);
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}
