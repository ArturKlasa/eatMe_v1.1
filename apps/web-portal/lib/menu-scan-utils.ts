// ============================================================================
// Menu Scan — Browser Utility Functions
// ============================================================================
// Pure browser utility functions for image and PDF processing.
// These are extracted from app/admin/menu-scan/page.tsx and imported by the
// useMenuScanState hook.
// ============================================================================

/**
 * Resize an image File to at most `maxDim` pixels on the longest side,
 * then return it as a base64-encoded JPEG suitable for sending to the API.
 *
 * @param file      - The image File to resize
 * @param maxDim    - Maximum width or height in pixels (default 1500)
 * @returns         An object with the output filename, MIME type, and base64 data
 */
export async function resizeImageToBase64(
  file: File,
  maxDim = 1500
): Promise<{ name: string; mime_type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({
        name: file.name.replace(/\.[^.]+$/, '.jpg'),
        mime_type: 'image/jpeg',
        data: dataUrl.split(',')[1],
      });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = objectUrl;
  });
}

/**
 * Convert each page of a PDF file to a JPEG image File using pdfjs-dist.
 * Renders at 2× scale for high-quality output (~1680px for A4).
 * Pages are rendered client-side — no server involved.
 *
 * @param file            - The PDF File to convert
 * @param maxPagesPerFile - Maximum pages to extract (default 20)
 * @returns               An array of JPEG image Files, one per PDF page
 */
export async function pdfToImages(file: File, maxPagesPerFile = 20): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Worker is committed to /public — re-copy from node_modules if pdfjs-dist is upgraded
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = Math.min(pdf.numPages, maxPagesPerFile);
  const baseName = file.name.replace(/\.pdf$/i, '');
  const results: File[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // ~1680 px for an A4 page
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    );
    results.push(new File([blob], `${baseName}_p${pageNum}.jpg`, { type: 'image/jpeg' }));
  }

  return results;
}
