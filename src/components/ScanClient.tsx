"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPantryItem } from "@/actions/pantry";
import { InstructionIcon } from "@/components/InstructionIcon";

type Tab = "scan" | "manual";

interface DetectedResult {
  code: string;
  productName: string | null;
  productId: string | null;
  defaultUnit: string | null;
}

export function ScanClient({
  defaultLocation,
  locationSuggestions = [],
}: {
  defaultLocation: string;
  locationSuggestions?: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, setPending] = useState(false);
  const [detected, setDetected] = useState<DetectedResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  async function saveItem(formData: FormData) {
    setPending(true);
    try {
      const r = await createPantryItem(formData);
      if (r.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
        setName("");
        setQuantity("1");
        setUnit("each");
        setExpirationDate("");
        setBarcode("");
        setProductId("");
        setLocation(defaultLocation || "");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [location, setLocation] = useState(defaultLocation || "");
  const [expirationDate, setExpirationDate] = useState("");
  const [barcode, setBarcode] = useState("");
  const [productId, setProductId] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      // iOS WebKit requires these attributes set programmatically for inline autoplay
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.muted = true;
      video.play().catch(() => {
        /* autoplay blocked — iOS will show play button or resume after next gesture */
      });
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  async function startCamera() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      if (globalThis.isSecureContext === false || window.location.protocol === "http:") {
        setError(
          "Camera requires HTTPS. Access this page via https:// or localhost.",
        );
      } else {
        setError("Camera API not available in this browser.");
      }
      return;
    }

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: { facingMode: "environment" }, audio: false },
      { video: true, audio: false },
    ];

    let s: MediaStream | null = null;
    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!s) {
      const msg = lastErr instanceof Error ? lastErr.message : "";
      const name = lastErr instanceof DOMException ? lastErr.name : "";
      if (name === "NotAllowedError" || msg.includes("Permission")) {
        setError("Camera permission denied. Allow camera access in your browser/device settings.");
      } else if (name === "NotFoundError" || msg.includes("DevicesNotFound")) {
        setError("No camera found on this device.");
      } else {
        setError(`Camera unavailable (${name || "unknown error"}). Use manual entry.`);
      }
      return;
    }

    streamRef.current = s;
    setStream(s);
    setScanning(true);
  }

  useEffect(() => {
    if (tab !== "scan" || !scanning || !stream || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const run = async () => {
      const { BarcodeDetector } = await import("barcode-detector/pure");
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });

      while (!cancelled && video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 80));
      }

      let frameCount = 0;
      const scanFrame = async (): Promise<void> => {
        if (cancelled || video.readyState < 2) return;
        frameCount++;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw === 0 || vh === 0) {
          await new Promise((r) => setTimeout(r, 100));
          return;
        }

        // Crop center 60% of the frame (where the crosshairs are) for faster, more accurate detection
        const cropW = Math.round(vw * 0.6);
        const cropH = Math.round(vh * 0.6);
        const cropX = Math.round((vw - cropW) / 2);
        const cropY = Math.round((vh - cropH) / 2);

        canvas.width = cropW;
        canvas.height = cropH;
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        try {
          let codes = await detector.detect(canvas);

          // Every 3rd frame, also try the full frame as fallback
          if (codes.length === 0 && frameCount % 3 === 0) {
            canvas.width = vw;
            canvas.height = vh;
            ctx.drawImage(video, 0, 0);
            codes = await detector.detect(canvas);
          }

          if (codes.length > 0) {
            const code = codes[0]!.rawValue;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            cancelled = true;
            setStream(null);
            setScanning(false);
            setLookingUp(true);

            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(50);
            }

            const result: DetectedResult = {
              code,
              productName: null,
              productId: null,
              defaultUnit: null,
            };
            try {
              const res = await fetch(`/api/products/barcode?code=${encodeURIComponent(code)}`, { cache: "no-store" });
              if (res.ok) {
                const data = (await res.json()) as {
                  found: boolean;
                  product?: { id: number; name: string; defaultUnit?: string | null };
                };
                if (data.found && data.product) {
                  result.productName = data.product.name;
                  result.productId = String(data.product.id);
                  result.defaultUnit = data.product.defaultUnit ?? null;
                }
              }
            } catch {
              /* lookup failed — user can still confirm with raw barcode */
            }
            setLookingUp(false);
            setDetected(result);
            return;
          }
        } catch {
          /* frame decode error — retry */
        }
      };

      while (!cancelled) {
        await scanFrame();
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, scanning, stream]);

  function confirmDetected() {
    if (!detected) return;
    setBarcode(detected.code);
    if (detected.productName) setName(detected.productName);
    if (detected.productId) setProductId(detected.productId);
    if (detected.defaultUnit) setUnit(detected.defaultUnit.slice(0, 50));
    setDetected(null);
  }

  function rescan() {
    setDetected(null);
    setLookingUp(false);
    void startCamera();
  }

  return (
    <div className="space-y-6 pb-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Scan / Add</h1>

      <div className="flex gap-1 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-inset)] p-1">
        <button
          type="button"
          onClick={() => {
            setTab("scan");
            setError(null);
          }}
          className={`btn-primary-touch flex-1 rounded-lg text-sm font-semibold ${
            tab === "scan" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Scan
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            setDetected(null);
            setTab("manual");
            setError(null);
          }}
          className={`btn-primary-touch flex-1 rounded-lg text-sm font-semibold ${
            tab === "manual" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Manual
        </button>
      </div>

      {tab === "scan" && (
        <div className="space-y-3">
          {lookingUp && (
            <div className="panel-bordered flex items-center justify-center gap-3 py-10">
              <span className="scan-spinner" />
              <span className="text-sm text-[var(--muted)]">Looking up barcode…</span>
            </div>
          )}

          {detected && (
            <div className="panel-bordered space-y-4 border-[var(--accent)]" role="status">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-lg">✓</span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug">
                    {detected.productName ?? "Unknown product"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                    {detected.code}
                  </p>
                  {!detected.productName && (
                    <p className="mt-1 text-xs text-[var(--warn)]">
                      Not in database yet — enter details below and this barcode will be saved for future scans.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmDetected}
                  className="btn-primary-touch flex-1 bg-[var(--accent)] font-semibold text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={rescan}
                  className="btn-primary-touch border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-[var(--foreground)]"
                >
                  Scan again
                </button>
              </div>
            </div>
          )}

          {!detected && !lookingUp && !stream && (
            <button
              type="button"
              onClick={startCamera}
              className="btn-primary-touch w-full rounded-2xl border-2 border-dashed border-[var(--border-accent)] py-12 text-[var(--muted)]"
            >
              Open camera
            </button>
          )}

          {!detected && !lookingUp && stream && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-black aspect-video max-h-[min(56vh,520px)] w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                webkit-playsinline=""
                muted
                aria-label="Camera preview for barcode scanning"
              />
              <div
                className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
                aria-hidden
              >
                <div className="scan-crosshair-line-v" />
                <div className="scan-crosshair-line-h" />
                <div
                  className="absolute left-1/2 top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--accent)] bg-black/30 shadow-[0_0_18px_var(--accent-glow)]"
                />
                <div
                  className="absolute left-1/2 top-1/2 z-20 w-[min(94%,440px)] -translate-x-1/2 -translate-y-1/2 px-2"
                  style={{ height: "clamp(100px, 30%, 200px)" }}
                >
                  <div className="scan-barcode-target relative h-full w-full">
                    <span className="absolute -left-1 -top-1 h-8 w-8 border-l-4 border-t-4 border-[var(--accent)] rounded-tl" />
                    <span className="absolute -right-1 -top-1 h-8 w-8 border-r-4 border-t-4 border-[var(--accent)] rounded-tr" />
                    <span className="absolute -bottom-1 -left-1 h-8 w-8 border-b-4 border-l-4 border-[var(--accent)] rounded-bl" />
                    <span className="absolute -bottom-1 -right-1 h-8 w-8 border-b-4 border-r-4 border-[var(--accent)] rounded-br" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-2 right-2 z-40">
                <InstructionIcon
                  variant="inverse"
                  placement="top"
                  text="Align the barcode inside the highlighted frame. Hold still until it reads."
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
          {!detected && !lookingUp && (
            <div className="flex justify-center">
              <InstructionIcon text="Point the camera at a barcode to scan. HTTPS (or localhost) is required for the camera on most phones and tablets." />
            </div>
          )}
        </div>
      )}

      <form
        action={async (formData) => {
          await saveItem(formData);
        }}
        className="plan-form-panel space-y-3 p-4"
      >
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="barcode" value={barcode} />
        <input type="hidden" name="category" value="" />
        <input type="hidden" name="notes" value="" />
        <input type="hidden" name="lowStockThreshold" value="" />
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Quantity</label>
            <input
              name="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Unit</label>
            <input
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Expiry</label>
          <input
            name="expirationDate"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Location</label>
          <datalist id="scan-location-suggestions">
            {locationSuggestions.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
          <input
            name="location"
            list="scan-location-suggestions"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            autoComplete="off"
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        {tab === "manual" && (
          <div>
            <label className="mb-1 block text-xs font-medium">Barcode (optional)</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary-touch flex-1 bg-[var(--accent)] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {tab === "scan" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                stopCamera();
                void startCamera();
              }}
              className="btn-primary-touch border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-[var(--foreground)]"
            >
              Scan next
            </button>
          )}
        </div>
        {savedFlash && (
          <p className="text-center text-sm text-[var(--accent-muted)]" role="status">
            Saved
          </p>
        )}
      </form>
    </div>
  );
}
