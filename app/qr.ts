import qrcode from "qrcode-generator";

export type QrMatrix = { path: string; moduleCount: number };

/**
 * Encodes a link as an SVG path, one 1x1 rect per dark module.
 *
 * A path rather than an image so the printed sign stays sharp at any size and
 * needs no network request. Modules are emitted as `M{column} {row}` — column
 * is the x coordinate and row the y — because transposing them yields a QR that
 * still looks plausible to the eye but does not scan.
 */
export function qrPath(value: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const moduleCount = qr.getModuleCount();

  let path = "";
  for (let row = 0; row < moduleCount; row++) {
    for (let column = 0; column < moduleCount; column++) {
      if (qr.isDark(row, column)) path += `M${column} ${row}h1v1h-1z`;
    }
  }
  return { path, moduleCount };
}
