// Browser-only: shrink a picked photo to a JPEG data URL that can live in a Postgres text column.
// Re-encoding through a canvas also drops EXIF (GPS, device) and anything that is not pixels.

/** Longest side ≤ `maxSide` px; quality steps down until the data URL is ≤ `maxChars`. Throws if it never fits. */
export async function compressImage(file: File, maxSide: number, maxChars: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff"; // transparent PNG areas would turn black in JPEG
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  for (let q = 0.85; q >= 0.4; q -= 0.15) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= maxChars) return url;
  }
  throw new Error("too big");
}

// Member avatar: shown at most 64 px, so 320 px covers 4× screens; ~45 KB keeps the leader's full-team load light.
export const compressAvatar = (file: File) => compressImage(file, 320, 60_000);
// Voice attachment: must stay readable (a machine, a hazard), limit matches voices.photo_url check (PRD v3 F-1301).
export const compressVoicePhoto = (file: File) => compressImage(file, 1280, 400_000);
