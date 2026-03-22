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

const RESUME_SCAN_DELAY_MS = 420;
const SAVED_FLASH_MS = 1600;

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
  const flashTimerRef = useRef<number | null>(null);
  const resumeScanTimerRef = useRef<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, setPending] = useState(false);
  const [detected, setDetected] = useState<DetectedResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [location, setLocation] = useState(defaultLocation || "");
  const [expirationDate, setExpirationDate] = useState("");
  const [barcode, setBarcode] = useState("");
  const [productId, setProductId] = useState("");

  function clearTimers() {
    if (flashTimerRef.current != null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (resumeScanTimerRef.current != null) {
      window.clearTimeout(resumeScanTimerRef.current);
      resumeScanTimerRef.current = null;
    }
  }

  function clearProductFields() {
    setName("");
    setExpirationDate("");
    setBarcode("");
    setProductId("");
  }

  function resetScanEntryState() {
    clearProductFields();
    setDetected(null);
    setLookingUp(false);
    setShowAdvanced(false);
    setFormError(null);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setScanning(false);
  }

  function applyDetectedResult(result: DetectedResult) {
    setBarcode(result.code);
    setProductId(result.productId ?? "");
    setName(result.productName ?? "");
    if (result.defaultUnit) {
      setUnit(result.defaultUnit.slice(0, 50));
    }
    setDetected(result);
    setShowAdvanced(false);
    setFormError(null);
  }

  async function saveItem(formData: FormData) {
    setPending(true);
    setFormError(null);
    try {
      const result = await createPantryItem(formData);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      setSavedFlash(true);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = window.setTimeout(() => {
        setSavedFlash(false);
        flashTimerRef.current = null;
      }, SAVED_FLASH_MS);

      resetScanEntryState();
      router.refresh();

      if (tab === "scan") {
        if (resumeScanTimerRef.current != null) {
          window.clearTimeout(resumeScanTimerRef.current);
        }
        resumeScanTimerRef.current = window.setTimeout(() => {
          resumeScanTimerRef.current = null;
          if (document.visibilityState === "hidden") return;
          void startCamera();
        }, RESUME_SCAN_DELAY_MS);
      }
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      clearTimers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.muted = true;
      video.play().catch(() => {
        /* autoplay blocked — the browser will resume after the next gesture */
      });
      return;
    }
    video.srcObject = null;
  }, [stream]);

  async function startCamera() {
    setCameraError(null);
    setFormError(null);
    setDetected(null);
    setLookingUp(false);
    setShowAdvanced(false);
    clearProductFields();
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      if (globalThis.isSecureContext === false || window.location.protocol === "http:") {
        setCameraError("Camera requires HTTPS. Access this page via https:// or localhost.");
      } else {
        setCameraError("Camera API not available in this browser.");
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

    let nextStream: MediaStream | null = null;
    let lastError: unknown;
    for (const constraints of attempts) {
      try {
        nextStream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!nextStream) {
      const message = lastError instanceof Error ? lastError.message : "";
      const errorName = lastError instanceof DOMException ? lastError.name : "";
      if (errorName === "NotAllowedError" || message.includes("Permission")) {
        setCameraError("Camera permission denied. Allow camera access in your browser or device settings.");
      } else if (errorName === "NotFoundError" || message.includes("DevicesNotFound")) {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(`Camera unavailable (${errorName || "unknown error"}). Use manual entry.`);
      }
      return;
    }

    streamRef.current = nextStream;
    setStream(nextStream);
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
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      let frameCount = 0;
      const scanFrame = async (): Promise<void> => {
        if (cancelled || video.readyState < 2) return;
        frameCount++;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        if (videoWidth === 0 || videoHeight === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return;
        }

        const cropWidth = Math.round(videoWidth * 0.6);
        const cropHeight = Math.round(videoHeight * 0.6);
        const cropX = Math.round((videoWidth - cropWidth) / 2);
        const cropY = Math.round((videoHeight - cropHeight) / 2);

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        try {
          let codes = await detector.detect(canvas);

          if (codes.length === 0 && frameCount % 3 === 0) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            ctx.drawImage(video, 0, 0);
            codes = await detector.detect(canvas);
          }

          if (codes.length === 0) return;

          const code = codes[0]!.rawValue;
          stopCamera();
          cancelled = true;
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
            const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(code)}`, {
              cache: "no-store",
            });
            if (response.ok) {
              const data = (await response.json()) as {
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
            /* lookup failed — user can still save with the raw barcode */
          }

          setLookingUp(false);
          applyDetectedResult(result);
        } catch {
          /* frame decode error — keep scanning */
        }
      };

      while (!cancelled) {
        await scanFrame();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [scanning, stream, tab]);

  function rescan() {
    resetScanEntryState();
    void startCamera();
  }

  const showEntryForm = tab === "manual" || detected != null;
  const showCameraControls = tab === "scan" && detected == null && !lookingUp;

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Scan / Add</h1>
        <p className="text-sm text-[var(--muted)]">
          Scan stays camera-first. Manual entry keeps the same fast fields without the live preview.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-inset)] p-1">
        <button
          type="button"
          onClick={() => {
            setTab("scan");
            setCameraError(null);
            setFormError(null);
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
            resetScanEntryState();
            setTab("manual");
            setCameraError(null);
          }}
          className={`btn-primary-touch flex-1 rounded-lg text-sm font-semibold ${
            tab === "manual" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Manual
        </button>
      </div>

      {savedFlash && (
        <div
          className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-4 py-3 text-sm font-medium text-[var(--accent)]"
          role="status"
        >
          Saved. Ready for the next item.
        </div>
      )}

      {tab === "scan" && (
        <div className="space-y-3">
          {lookingUp && (
            <div className="panel-bordered flex items-center justify-center gap-3 py-10">
              <span className="scan-spinner" />
              <span className="text-sm text-[var(--muted)]">Looking up barcode…</span>
            </div>
          )}

          {showCameraControls && !stream && (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="btn-primary-touch w-full rounded-2xl border-2 border-dashed border-[var(--border-accent)] py-12 text-[var(--muted)]"
            >
              Open camera
            </button>
          )}

          {showCameraControls && stream && (
            <div className="relative aspect-video max-h-[min(56vh,520px)] w-full overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-black">
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
                    <span className="absolute -left-1 -top-1 h-8 w-8 rounded-tl border-l-4 border-t-4 border-[var(--accent)]" />
                    <span className="absolute -right-1 -top-1 h-8 w-8 rounded-tr border-r-4 border-t-4 border-[var(--accent)]" />
                    <span className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl border-b-4 border-l-4 border-[var(--accent)]" />
                    <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br border-b-4 border-r-4 border-[var(--accent)]" />
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

          {cameraError && <p className="text-sm text-[var(--warn)]">{cameraError}</p>}
          {showCameraControls && (
            <div className="flex justify-center">
              <InstructionIcon text="Point the camera at a barcode to scan. HTTPS or localhost is required for the camera on most phones and tablets." />
            </div>
          )}
        </div>
      )}

      {showEntryForm && (
        <form
          action={async (formData) => {
            await saveItem(formData);
          }}
          className="plan-form-panel space-y-4 p-4"
        >
          {detected && (
            <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg text-white">
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug">
                    {detected.productName ?? "Unknown product"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{detected.code}</p>
                  {!detected.productName && (
                    <p className="mt-1 text-xs text-[var(--warn)]">
                      Not in the database yet. Add a name and save it once for future scans.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {formError && (
            <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {formError}
            </p>
          )}

          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="barcode" value={barcode} />
          <input type="hidden" name="category" value="" />
          <input type="hidden" name="notes" value="" />
          <input type="hidden" name="lowStockThreshold" value="" />

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Name
            </label>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Item name"
              required
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Quantity
              </label>
              <input
                name="quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Unit
              </label>
              <input
                name="unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                required
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Location
            </label>
            <datalist id="scan-location-suggestions">
              {locationSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <input
              name="location"
              list="scan-location-suggestions"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              autoComplete="off"
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>

          {showAdvanced && (
            <div className="space-y-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Expiry
                </label>
                <input
                  name="expirationDate"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Barcode
                </label>
                <input
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  readOnly={tab === "scan" && detected != null}
                  placeholder="Optional barcode"
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary-touch flex-1 bg-[var(--accent)] font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : tab === "scan" ? "Save and keep scanning" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="btn-primary-touch border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            >
              {showAdvanced ? "Hide details" : "More details"}
            </button>
            {tab === "scan" && (
              <button
                type="button"
                disabled={pending}
                onClick={rescan}
                className="btn-primary-touch border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 text-[var(--foreground)]"
              >
                Scan again
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
