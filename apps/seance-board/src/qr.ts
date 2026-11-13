import QRCode from 'qrcode';

/** Draw a QR as inline SVG. Fills use var(--bk-qr-*) tokens (always dark on light, so phone scanners accept it). */
export function qrSvg(code: string, label: string): string {
  const { modules } = QRCode.create(code, { errorCorrectionLevel: 'L' });
  const n = modules.size;
  const q = 4; // quiet zone, in modules
  const size = n + q * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
  const esc = label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="var(--bk-qr-bg)"/><path d="${d}" fill="var(--bk-qr-fg)"/></svg>`;
}

export interface Scanner {
  stop(): void;
}

/** Start the camera and report the first QR text found. Rejects when the camera is denied or missing. */
export async function startScanner(video: HTMLVideoElement, onCode: (text: string) => void): Promise<Scanner> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const { default: jsQR } = await import('jsqr'); // loaded only when the scanner opens
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let live = true;
  const tick = () => {
    if (!live) return;
    if (video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(img.data, img.width, img.height);
      if (hit?.data) {
        onCode(hit.data);
        return;
      }
    }
    setTimeout(tick, 200);
  };
  tick();
  return {
    stop() {
      live = false;
      stream.getTracks().forEach((tk) => tk.stop());
      video.srcObject = null;
    },
  };
}
