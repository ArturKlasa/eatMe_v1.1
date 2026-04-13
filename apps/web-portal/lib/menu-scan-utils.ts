/** Resize an image to at most `maxDim` px on longest side, return as base64 JPEG. */
export async function resizeImageToBase64(
  file: File,
  maxDim = 2000
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

/** Convert each page of a PDF to a JPEG image File using pdfjs-dist (2× scale). */
export async function pdfToImages(file: File, maxPagesPerFile = 20): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Worker is committed to /public — re-copy from node_modules if pdfjs-dist is upgraded
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = Math.min(pdf.numPages, maxPagesPerFile);
  const baseName = file.name.replace(/\.pdf$/i, '');

  return Promise.all(
    Array.from({ length: numPages }, async (_, i) => {
      const pageNum = i + 1;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // ~1680 px for an A4 page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.85
        )
      );
      return new File([blob], `${baseName}_p${pageNum}.jpg`, { type: 'image/jpeg' });
    })
  );
}
