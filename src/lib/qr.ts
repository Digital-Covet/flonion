import QRCode from "qrcode";
import { httpUrl } from "~/lib/safe-url";

/**
 * One QR geometry for every surface that draws a code: the ticket on screen,
 * the PNG an owner downloads and the printed sheet. They are the same code on
 * the same counter, so the module grid, the quiet zone and the logo plate are
 * computed here once rather than three times with three sets of rounding.
 */

/** Printed and scanned in poor light, so both ends keep the high-contrast pair
 * rather than following the theme. */
export const QR_DARK = "#1C1917";
export const QR_LIGHT = "#FFFFFF";

/** Modules of white around the code. Below 2 a scanner can miss the edge. */
const QUIET_ZONE = 2;

/**
 * A centred logo covers modules, so any code carrying one is generated at error
 * correction H (30% of the codewords recoverable) instead of M (15%).
 */
const LEVEL_PLAIN = "M";
const LEVEL_LOGO = "H";

/**
 * Plate side as a share of the code. At 0.26 the plate hides roughly 7% of the
 * modules -- comfortably inside what H recovers -- and still reads as a logo at
 * the 96px the ticket draws it.
 */
const PLATE_SHARE = 0.26;

/** White ring between the plate edge and the artwork, in modules. */
const PLATE_PADDING = 1;

/** Downloaded codes get printed and enlarged, so the PNG is generous. */
const PNG_WIDTH = 1024;

/** A logo big enough to matter is a few hundred KB; past this it is a mistake. */
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

export type QrPlate = {
  x: number;
  y: number;
  side: number;
  radius: number;
  /** The artwork box, inset from the plate by the white ring. */
  logo: { x: number; y: number; side: number };
};

export type QrGeometry = {
  /** viewBox side: modules plus the quiet zone on both edges. */
  size: number;
  /** Every dark module as a single path, offset by the quiet zone. */
  path: string;
  plate: QrPlate | null;
};

/**
 * Odd plate side so it sits symmetrically on the centre module. Every QR
 * version has an odd module count, so an odd side leaves a whole-module offset
 * and the plate lands on the grid instead of halfway across a row.
 */
function plateFor(modules: number, size: number): QrPlate {
  let side = Math.round(modules * PLATE_SHARE);
  if (side % 2 === 0) side += 1;
  const offset = (size - side) / 2;
  return {
    x: offset,
    y: offset,
    side,
    radius: side * 0.2,
    logo: {
      x: offset + PLATE_PADDING,
      y: offset + PLATE_PADDING,
      side: side - PLATE_PADDING * 2,
    },
  };
}

export function qrGeometry(value: string, withLogo: boolean): QrGeometry {
  const qr = QRCode.create(value, {
    errorCorrectionLevel: withLogo ? LEVEL_LOGO : LEVEL_PLAIN,
  });
  const modules = qr.modules.size;
  const size = modules + QUIET_ZONE * 2;
  let path = "";
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.modules.get(y, x)) {
        path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }
  return { size, path, plate: withLogo ? plateFor(modules, size) : null };
}

/**
 * The logo reaches us from an owner-typed field, so keep it to the two shapes
 * the app actually stores: an absolute http(s) link, or a logo it inlined
 * during onboarding. Anything else is dropped and the code is drawn plain.
 */
export function qrLogoSrc(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return httpUrl(trimmed);
}

const escapeAttr = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Standalone SVG for surfaces that take markup rather than components -- today
 * the printed sheet, which is written into a new window.
 *
 * A remote `logo` would still be loading when that window calls `print()`, so
 * callers pass the result of `inlineQrLogo` here, not the stored URL.
 */
export function qrSvgMarkup(value: string, logo?: string | null): string {
  const src = qrLogoSrc(logo);
  const geo = qrGeometry(value, Boolean(src));
  const plate =
    geo.plate && src
      ? `<rect x="${geo.plate.x}" y="${geo.plate.y}" width="${geo.plate.side}" height="${geo.plate.side}" rx="${geo.plate.radius}" fill="${QR_LIGHT}"/>` +
        `<image href="${escapeAttr(src)}" x="${geo.plate.logo.x}" y="${geo.plate.logo.y}" width="${geo.plate.logo.side}" height="${geo.plate.logo.side}" preserveAspectRatio="xMidYMid meet"/>`
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.size} ${geo.size}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${geo.size}" height="${geo.size}" fill="${QR_LIGHT}"/>` +
    `<path d="${geo.path}" fill="${QR_DARK}"/>${plate}</svg>`
  );
}

/**
 * The logo as a data URI. Two reasons it is never left as a remote URL: a
 * cross-origin image taints the canvas and `toDataURL` then throws, and the
 * print window prints as soon as it is written, before a network image would
 * have painted.
 *
 * Returns null when the host will not let us read it -- a logo served without
 * CORS headers is common -- and every caller then draws a plain code rather
 * than failing the download outright.
 */
export async function inlineQrLogo(
  value: string | null | undefined,
): Promise<string | null> {
  const src = qrLogoSrc(value);
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.size > MAX_LOGO_BYTES) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** `object-fit: contain`, so a wide logo keeps its shape inside the square plate. */
function drawContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  box: number,
) {
  // An SVG with no intrinsic size reports 0 in some browsers; fill the box then.
  const w = img.naturalWidth || box;
  const h = img.naturalHeight || box;
  const scale = Math.min(box / w, box / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, x + (box - dw) / 2, y + (box - dh) / 2, dw, dh);
}

function platePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  radius: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, side, side, radius);
  } else {
    ctx.rect(x, y, side, side);
  }
  ctx.closePath();
}

/**
 * The code on its own canvas, logo and all. Falls back to a plain code whenever
 * the logo cannot be inlined, decoded or composited: an owner clicking download
 * wants a QR they can print today, not an error about their logo host.
 */
async function qrCanvas(
  value: string,
  logo?: string | null,
): Promise<HTMLCanvasElement> {
  const inlined = await inlineQrLogo(logo);
  const canvas = document.createElement("canvas");
  const draw = (withLogo: boolean) =>
    QRCode.toCanvas(canvas, value, {
      errorCorrectionLevel: withLogo ? LEVEL_LOGO : LEVEL_PLAIN,
      margin: QUIET_ZONE,
      width: PNG_WIDTH,
      color: { dark: QR_DARK, light: QR_LIGHT },
    });

  if (!inlined) {
    await draw(false);
    return canvas;
  }

  try {
    const geo = qrGeometry(value, true);
    const ctx = canvas.getContext("2d");
    if (!geo.plate || !ctx) throw new Error("No plate to draw into");
    await draw(true);

    // `toCanvas` picks a whole-pixel module size, so the bitmap can come out a
    // little under `width`. Scaling off the canvas keeps the plate on the grid.
    const scale = canvas.width / geo.size;
    const img = await loadImage(inlined);
    const { x, y, side, radius, logo: box } = geo.plate;
    ctx.fillStyle = QR_LIGHT;
    platePath(ctx, x * scale, y * scale, side * scale, radius * scale);
    ctx.fill();
    drawContained(ctx, img, box.x * scale, box.y * scale, box.side * scale);
    return canvas;
  } catch {
    await draw(false);
    return canvas;
  }
}

/** PNG data URI for the bare code, with the logo when there is one. */
export async function qrPngDataUrl(
  value: string,
  logo?: string | null,
): Promise<string> {
  const canvas = await qrCanvas(value, logo);
  return canvas.toDataURL("image/png");
}

// ─── Downloadable sheet ──────────────────────────────────────────────────

/** Flonion's own strip, served from `public/`, so it is always same-origin. */
const FOOTER_SRC = "/qr_footer.png";

/** Gutter around the code, in the code's own pixels. */
const SHEET_PAD = 64;
const PROMPT_SIZE = 56;
const PROMPT_LINE_HEIGHT = 74;
/** The prompt is capped at 60 characters, which never needs a third line. */
const PROMPT_MAX_LINES = 2;
const PROMPT_GAP = 52;
const FOOTER_GAP = 96;

/**
 * Canvas has no font fallback chain of its own: it measures whatever the
 * document has already loaded, so an unloaded Jost silently measures as the
 * system font and the text comes out the wrong width. Ask for it first, and
 * carry on with the system stack if it never arrives.
 */
async function promptFont(): Promise<string> {
  const stack = '"Jost Variable", "Jost", ui-sans-serif, system-ui, sans-serif';
  const font = `600 ${PROMPT_SIZE}px ${stack}`;
  try {
    await document.fonts.load(`600 ${PROMPT_SIZE}px "Jost Variable"`);
  } catch {}
  return font;
}

/** Greedy wrap, and the last line takes an ellipsis rather than overflowing. */
function wrapPrompt(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
      if (lines.length === PROMPT_MAX_LINES) break;
    } else {
      line = next;
    }
  }
  if (lines.length < PROMPT_MAX_LINES && line) lines.push(line);
  const last = lines.length - 1;
  while (last >= 0 && ctx.measureText(lines[last]).width > width) {
    lines[last] = `${lines[last].slice(0, -2).trimEnd()}…`;
  }
  return lines;
}

/**
 * The sheet an owner downloads and tapes to the counter: the code with their
 * logo, the line they wrote under it, and Flonion's strip along the bottom.
 *
 * Every part after the code is optional at render time. A missing font or a
 * footer that will not load costs the owner that part of the sheet, not the
 * download, so each is drawn inside its own guard.
 */
export async function qrSheetPng(input: {
  value: string;
  prompt: string;
  logo?: string | null;
}): Promise<string> {
  const code = await qrCanvas(input.value, input.logo);
  const width = code.width + SHEET_PAD * 2;

  const prompt = input.prompt.trim();
  const font = prompt ? await promptFont() : "";
  const footer = await loadImage(FOOTER_SRC).catch(() => null);
  // The strip is full-bleed: it is a solid panel, and insetting it would leave
  // a white margin the printed sheet reads as a mistake.
  const footerHeight = footer?.naturalWidth
    ? Math.round((width * footer.naturalHeight) / footer.naturalWidth)
    : 0;

  // Measured on a throwaway context: the sheet's own height depends on how
  // many lines the prompt takes, so the canvas cannot be sized until it is.
  const measure = document.createElement("canvas").getContext("2d");
  let lines: string[] = [];
  if (prompt && measure) {
    measure.font = font;
    lines = wrapPrompt(measure, prompt, code.width);
  }

  const textBlock = lines.length
    ? PROMPT_GAP + lines.length * PROMPT_LINE_HEIGHT
    : 0;
  const footerBlock = footerHeight ? FOOTER_GAP + footerHeight : 0;
  // The strip is its own bottom edge, so a gutter under it would only show as
  // a white band the owner has to trim off.
  const bottomPad = footerHeight ? 0 : SHEET_PAD;

  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = SHEET_PAD + code.height + textBlock + footerBlock + bottomPad;
  const ctx = sheet.getContext("2d");
  if (!ctx) return code.toDataURL("image/png");

  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.drawImage(code, SHEET_PAD, SHEET_PAD);

  let y = SHEET_PAD + code.height;
  if (lines.length) {
    ctx.font = font;
    ctx.fillStyle = QR_DARK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    y += PROMPT_GAP;
    for (const line of lines) {
      ctx.fillText(line, width / 2, y + PROMPT_LINE_HEIGHT / 2);
      y += PROMPT_LINE_HEIGHT;
    }
  }

  if (footer && footerHeight) {
    // Bottom edge, not `y`: the strip closes the sheet whatever sits above it.
    ctx.drawImage(footer, 0, sheet.height - footerHeight, width, footerHeight);
  }

  return sheet.toDataURL("image/png");
}
