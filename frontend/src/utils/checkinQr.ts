import QRCode from 'qrcode';

export function publicCheckinBase(): string {
  return import.meta.env?.VITE_PUBLIC_FRONTEND_URL || window.location.href;
}

export function checkinUrl(token: string, publicBase: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid QR token.');
  const url = new URL(publicBase);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS frontend URL.');
  url.search = '';
  url.hash = `/check-in/${token}`;
  return url.href;
}

export async function printableCheckinSvg(name: string, url: string): Promise<string> {
  const qr = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 320 });
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
  // XML escaping protects printable text; the QR payload contains only the public URL.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="480" viewBox="0 0 420 480"><rect width="420" height="480" fill="white"/><text x="210" y="32" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#7e1925">CHIS Heritage Check-In</text>${qr.replace('<svg ', '<svg x="50" y="50" ')}<foreignObject x="20" y="380" width="380" height="54"><div xmlns="http://www.w3.org/1999/xhtml" style="font:16px sans-serif;text-align:center;color:#23201f">${escape(name)}</div></foreignObject><text x="210" y="457" text-anchor="middle" font-family="sans-serif" font-size="14">Scan to verify your visit</text></svg>`;
}
