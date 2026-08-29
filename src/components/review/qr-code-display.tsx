import { createEffect, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import Download from "lucide-solid/icons/download";
import Pencil from "lucide-solid/icons/pencil";
import QrCode from "lucide-solid/icons/qr-code";

interface QRCodeDisplayProps {
  url: string | null;
  logo?: string | null;
  businessName?: string;
  reviewId?: string | null;
  instructionText?: string;
}

const QR_SIZE = 160;
const CANVAS_SCALE = 2;

function getQrUrl(reviewId: string | null | undefined, fallback: string | null): string | null {
  if (reviewId) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/qr/${reviewId}`;
  }
  return fallback;
}

export function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = createSignal<string | null>(null);
  const [instructionText, setInstructionText] = createSignal(
    props.instructionText ?? "Scan to leave a review",
  );
  const [editing, setEditing] = createSignal(false);
  const [draftText, setDraftText] = createSignal(instructionText());
  let textareaRef: HTMLTextAreaElement | undefined;

  createEffect(() => {
    if (textareaRef && editing()) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${textareaRef.scrollHeight}px`;
    }
  });

  createEffect(() => {
    const url = getQrUrl(props.reviewId, props.url);
    if (!url) {
      setDataUrl(null);
      return;
    }

    QRCode.toDataURL(url, {
      width: QR_SIZE * CANVAS_SCALE,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#1a1a2e", light: "#ffffff" },
    }).then(setDataUrl);
  });

  const downloadQR = async () => {
    const url = getQrUrl(props.reviewId, props.url);
    if (!url) return;

    const canvasSize = 1080;
    const qrSize = 600;
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });

    const drawFinal = (qrImg: HTMLImageElement) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      const qrX = (canvasSize - qrSize) / 2;
      const qrY = 120;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      if (props.logo) {
        const logoImg = new Image();
        logoImg.onload = () => {
          drawLogoAndText(ctx, logoImg, canvasSize, qrSize, qrX, qrY, instructionText());
          triggerDownload(canvas);
        };
        logoImg.onerror = () => {
          drawTextOnly(ctx, canvasSize, qrSize, qrX, qrY, instructionText());
          triggerDownload(canvas);
        };
        logoImg.src = props.logo;
      } else {
        drawTextOnly(ctx, canvasSize, qrSize, qrX, qrY, instructionText());
        triggerDownload(canvas);
      }
    };

    const qrImg = new Image();
    qrImg.onload = () => drawFinal(qrImg);
    qrImg.src = qrDataUrl;
  };

  const triggerDownload = (canvas: HTMLCanvasElement) => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-code-${props.businessName || "review"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const drawLogoAndText = (
    ctx: CanvasRenderingContext2D,
    logoImg: HTMLImageElement,
    canvasSize: number,
    qrSize: number,
    qrX: number,
    qrY: number,
    instrText: string,
  ) => {
    const logoSize = qrSize * 0.18;
    const center = canvasSize / 2;
    const logoCenter = qrY + qrSize / 2;
    const padding = 8;

    ctx.beginPath();
    ctx.arc(center, logoCenter, logoSize / 2 + padding, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, logoCenter, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      logoImg,
      center - logoSize / 2,
      logoCenter - logoSize / 2,
      logoSize,
      logoSize,
    );
    ctx.restore();

    drawTextOnly(ctx, canvasSize, qrSize, qrX, qrY, instrText);
  };

  const drawTextOnly = (
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    qrSize: number,
    _qrX: number,
    qrY: number,
    instrText: string,
  ) => {
    const textY = qrY + qrSize + 60;

    if (props.businessName) {
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#1a1a2e";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const maxWidth = canvasSize - 120;
      const name = props.businessName;
      if (ctx.measureText(name).width > maxWidth) {
        let truncated = name;
        while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + "...", canvasSize / 2, textY);
      } else {
        ctx.fillText(name, canvasSize / 2, textY);
      }
    }

    const instrY = textY + (props.businessName ? 56 : 0);
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(instructionText(), canvasSize / 2, instrY);
  };

  return (
    <div class="h-full rounded-xl border border-border bg-card p-5 shadow-md">
      <div class="flex h-full flex-col items-center justify-center gap-3">
        <Show
          when={dataUrl()}
          fallback={
            <div class="flex flex-col items-center gap-3">
              <div
                class="flex items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/30"
                style={{ width: `${QR_SIZE}px`, height: `${QR_SIZE}px` }}
              >
                <QrCode class="size-10 text-muted-foreground/30" aria-hidden="true" />
              </div>
              <p class="text-center text-xs text-muted-foreground/60">
                Generate a share link to show QR code
              </p>
            </div>
          }
        >
          <div class="relative inline-block">
            <img
              src={dataUrl()!}
              alt="QR code"
              width={QR_SIZE}
              height={QR_SIZE}
            />
            <Show when={props.logo}>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="flex size-12 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
                  <img
                    src={props.logo!}
                    alt="Company logo"
                    class="size-8 rounded-full object-contain"
                  />
                </div>
              </div>
            </Show>
          </div>
          <Show when={props.businessName}>
            <p class="max-w-[180px] truncate text-center text-sm font-medium text-foreground">
              {props.businessName}
            </p>
          </Show>
          <Show
            when={editing()}
            fallback={
              <button
                type="button"
                onClick={() => {
                  setDraftText(instructionText());
                  setEditing(true);
                }}
                class="text-center text-xs text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
              >
                <Pencil class="mr-1 inline-block size-3" aria-hidden="true" />
                {instructionText()}
              </button>
            }
          >
            <textarea
              ref={textareaRef}
              value={draftText()}
              onInput={(e) => setDraftText((e.target as HTMLTextAreaElement).value)}
              onBlur={() => {
                const trimmed = draftText().trim();
                setInstructionText(trimmed || "Scan to leave a review");
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraftText(instructionText());
                  setEditing(false);
                }
              }}
              class="w-full max-w-[200px] resize-none overflow-hidden border-none bg-transparent p-0 text-center text-xs text-muted-foreground/60 outline-none focus:ring-0"
              rows={1}
              autofocus
            />
            <div class="flex justify-center">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const trimmed = draftText().trim();
                  setInstructionText(trimmed || "Scan to leave a review");
                  setEditing(false);
                }}
                class="mt-1 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Done
              </button>
            </div>
          </Show>
          <button
            type="button"
            onClick={downloadQR}
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download class="size-3.5" aria-hidden="true" />
            Download QR
          </button>
        </Show>
      </div>
    </div>
  );
}
