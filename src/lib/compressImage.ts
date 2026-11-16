/** Máximo por foto: o servidor aceita até 200 mil caracteres. */
const MAX_CHARS = 190_000;

/** Foto do celular (vários MB) vira JPEG de até 1024px; baixa a qualidade até caber no limite. */
export async function compressImage(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  let size = 1024;
  for (let quality = 0.7; ; quality -= 0.1) {
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) return url;
    if (quality <= 0.35) { size = Math.round(size * 0.75); quality = 0.8; }
  }
}
