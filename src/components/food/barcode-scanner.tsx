"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BarcodeScanner({
  onDetected,
  disabled = false,
}: {
  onDetected: (barcode: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  // Mount-only: the camera must not restart when the parent re-renders
  // (e.g. while the lookup mutation is pending).
  useEffect(() => {
    let stopped = false;
    let stopScanner: (() => void) | undefined;
    detectedRef.current = false;

    void import("@zxing/browser")
      .then(async ({ BarcodeFormat, BrowserMultiFormatReader }) => {
        if (stopped || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 150,
        });
        // Retail codes only — with every ZXing format enabled, a noisy frame
        // can decode as e.g. CODE_39 and look up the wrong product.
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ];
        let lastText = "";
        let matches = 0;
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          },
          videoRef.current,
          (result, _error, scannerControls) => {
            if (!result || detectedRef.current) return;
            // A single misread frame must never log food: accept a code only
            // once two consecutive frames agree.
            const text = result.getText();
            matches = text === lastText ? matches + 1 : 1;
            lastText = text;
            if (matches < 2) return;
            detectedRef.current = true;
            scannerControls.stop();
            onDetectedRef.current(text);
          },
        );
        stopScanner = () => controls.stop();
        if (stopped) controls.stop();
      })
      .catch(() => {
        if (!stopped) setCameraError(true);
      });

    return () => {
      stopped = true;
      stopScanner?.();
    };
  }, []);

  const submitManual = () => {
    const barcode = manual.replace(/\D/g, "");
    if (barcode.length >= 6 && barcode.length <= 14) onDetected(barcode);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-border-default bg-raised">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Barcode camera"
          className="aspect-video w-full object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-1/2 border-t border-border-strong"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-canvas/80 px-3 py-2">
          <ScanLine size={16} strokeWidth={1.75} />
          <span className="type-footnote text-text-secondary">
            {cameraError ? "Camera unavailable" : "Hold the barcode in frame"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manual}
          onChange={(event) =>
            setManual(event.target.value.replace(/\D/g, "").slice(0, 14))
          }
          onKeyDown={(event) => event.key === "Enter" && submitManual()}
          placeholder="Enter barcode"
          aria-label="Barcode number"
          className="type-body h-11 min-w-0 flex-1 rounded-md border border-border-subtle bg-raised px-4 text-text-primary placeholder:text-text-tertiary focus:border-border-strong"
        />
        <Button
          variant="secondary"
          className="h-11 px-4 type-body"
          disabled={disabled || manual.length < 6}
          onClick={submitManual}
        >
          Look up
        </Button>
      </div>
    </div>
  );
}
