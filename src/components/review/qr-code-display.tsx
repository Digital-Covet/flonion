import { createEffect, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import Download from "lucide-solid/icons/download";
import QrCode from "lucide-solid/icons/qr-code";

interface QRCodeDisplayProps {
  url: string | null;
  logo?: string | null;
  businessName?: string;
}

const QR_SIZE = 160;
const CANVAS_SCALE = 2;

export function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = createSignal<string | null>(null);

  createEffect(() => {
    const url = props.url;
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

  const downloadQR = () => {
    const qr = dataUrl();
    if (!qr) return;

    const canvasSize = QR_SIZE * CANVAS_SCALE;
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.drawImage(qrImg, 0, 0, canvasSize, canvasSize);

      if (props.logo) {
        const logoImg = new Image();
        logoImg.onload = () => {
          const logoSize = canvasSize * 0.18;
          const center = canvasSize / 2;
          const padding = CANVAS_SCALE * 2;

          ctx.beginPath();
          ctx.arc(center, center, logoSize / 2 + padding, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            logoImg,
            center - logoSize / 2,
            center - logoSize / 2,
            logoSize,
            logoSize,
          );

          triggerDownload(canvas);
        };
        logoImg.onerror = () => triggerDownload(canvas);
        logoImg.src = props.logo;
      } else {
        triggerDownload(canvas);
      }
    };
    qrImg.src = qr;
  };

  const triggerDownload = (canvas: HTMLCanvasElement) => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-code-${props.businessName || "review"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <p class="text-center text-xs text-muted-foreground/60">
            Scan to leave a review
          </p>
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
