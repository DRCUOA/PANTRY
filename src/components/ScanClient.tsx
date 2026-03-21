"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPantryItem } from "@/actions/pantry";

type Tab = "scan" | "manual";

export function ScanClient({ defaultLocation }: { defaultLocation: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, setPending] = useState(false);

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

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setScanning(false);
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function startCamera() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch {
      setError("Camera unavailable. Use manual entry or allow camera access.");
    }
  }

  useEffect(() => {
    if (tab !== "scan" || !scanning || !stream || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;
    if (!("BarcodeDetector" in window)) {
      setError("Barcode scanning not supported in this browser. Try manual entry.");
      return;
    }
    const Detector = (
      window as unknown as {
        BarcodeDetector: new (o: { formats: string[] }) => {
          detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });
    const tick = async () => {
      while (!cancelled && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const code = codes[0]!.rawValue;
            stopCamera();
            setBarcode(code);
            try {
              const res = await fetch(`/api/products/barcode?code=${encodeURIComponent(code)}`);
              if (res.ok) {
                const data = (await res.json()) as {
                  found: boolean;
                  product?: { id: number; name: string; defaultUnit?: string | null };
                };
                if (data.found && data.product) {
                  setName(data.product.name);
                  setProductId(String(data.product.id));
                  if (data.product.defaultUnit) {
                    setUnit(data.product.defaultUnit.slice(0, 50));
                  }
                }
              }
            } catch {
              /* ignore lookup errors */
            }
            break;
          }
        } catch {
          /* frame */
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [tab, scanning, stream, stopCamera]);

  return (
    <div className="space-y-6 pb-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Scan / Add</h1>

      <div className="flex rounded-xl border border-[var(--border)] p-1">
        <button
          type="button"
          onClick={() => {
            setTab("scan");
            setError(null);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            tab === "scan" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Scan
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            setTab("manual");
            setError(null);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            tab === "manual" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Manual
        </button>
      </div>

      {tab === "scan" && (
        <div className="space-y-3">
          {!stream ? (
            <button
              type="button"
              onClick={startCamera}
              className="w-full rounded-2xl border border-dashed border-[var(--border)] py-12 text-sm text-[var(--muted)]"
            >
              Open camera
            </button>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
              <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
            </div>
          )}
          {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
          <p className="text-xs text-[var(--muted)]">
            Point at a barcode. Requires HTTPS on most devices.
          </p>
        </div>
      )}

      <form
        action={async (formData) => {
          await saveItem(formData);
        }}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Unit</label>
            <input
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Location</label>
          <input
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        {tab === "manual" && (
          <div>
            <label className="mb-1 block text-xs font-medium">Barcode (optional)</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white disabled:opacity-50"
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
              className="rounded-xl border border-[var(--border)] px-4 text-sm"
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
