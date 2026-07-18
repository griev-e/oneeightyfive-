"use client";

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  MessageSquareText,
  ScanBarcode,
  ScanText,
} from "lucide-react";
import { BarcodeScanner } from "./barcode-scanner";
import { VoiceRecorder } from "./voice-recorder";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  useAnalyzeFoodImage,
  useBarcodeLookup,
  useDescribeFood,
  useTranscribeFood,
} from "@/hooks/use-food-capture";
import { prepareFoodImage } from "@/lib/image";
import type { AnalyzedFood } from "@/lib/food-ai";
import type { CatalogFood } from "@/lib/food-catalog";

export type CaptureMode =
  | "barcode"
  | "label"
  | "description"
  | "meal-photo";

const ACTIONS: Array<{
  mode: CaptureMode;
  label: string;
  helper: string;
  icon: typeof ScanBarcode;
}> = [
  {
    mode: "barcode",
    label: "Barcode",
    helper: "Packaged food",
    icon: ScanBarcode,
  },
  {
    mode: "label",
    label: "Label",
    helper: "Read the macros",
    icon: ScanText,
  },
  {
    mode: "description",
    label: "Describe",
    helper: "Type or speak",
    icon: MessageSquareText,
  },
  {
    mode: "meal-photo",
    label: "Meal photo",
    helper: "Estimate a plate",
    icon: Camera,
  },
];

export function FoodInputActions({
  onSelect,
}: {
  onSelect: (mode: CaptureMode) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.mode}
            type="button"
            className="flex min-h-16 items-center gap-3 rounded-md border border-border-subtle bg-raised px-3 text-left active:bg-overlay"
            onClick={() => onSelect(action.mode)}
          >
            <Icon
              size={19}
              strokeWidth={1.75}
              className="shrink-0 text-text-secondary"
            />
            <span className="min-w-0">
              <span className="type-body block text-text-primary">
                {action.label}
              </span>
              <span className="type-footnote block truncate text-text-tertiary">
                {action.helper}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BarcodeCapture({
  onFood,
}: {
  onFood: (food: CatalogFood) => void;
}) {
  const lookup = useBarcodeLookup();
  const toast = useToast();
  const [attempt, setAttempt] = useState(0);

  const detect = useCallback(
    (barcode: string) => {
      if (lookup.isPending) return;
      lookup.mutate(barcode, {
        onSuccess: ({ foods }) => {
          if (foods[0]) {
            onFood(foods[0]);
          } else {
            toast.show("Not found — scan the nutrition label instead");
            setAttempt((value) => value + 1);
          }
        },
      });
    },
    [lookup, onFood, toast],
  );

  return (
    <BarcodeScanner
      key={attempt}
      onDetected={detect}
      disabled={lookup.isPending}
    />
  );
}

export function DescriptionCapture({
  onFood,
}: {
  onFood: (food: AnalyzedFood) => void;
}) {
  const [description, setDescription] = useState("");
  const describe = useDescribeFood();
  const transcribe = useTranscribeFood();
  const pending = describe.isPending || transcribe.isPending;

  const submit = () => {
    const value = description.trim();
    if (!value) return;
    describe.mutate(value, { onSuccess: ({ food }) => onFood(food) });
  };

  return (
    <div>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Two eggs, one bagel with cream cheese, and a cup of whole milk"
        maxLength={500}
        rows={4}
        className="type-body w-full resize-none rounded-md border border-border-subtle bg-raised p-4 text-text-primary placeholder:text-text-tertiary focus:border-border-strong"
      />
      <Button
        className="mt-3 w-full"
        disabled={!description.trim() || pending}
        onClick={submit}
      >
        {describe.isPending ? "Estimating…" : "Fill macros"}
      </Button>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="type-label text-text-tertiary">Or</span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>
      <VoiceRecorder
        pending={pending}
        onAudio={(audio) =>
          transcribe.mutate(audio, {
            onSuccess: ({ transcript, food }) => {
              setDescription(transcript);
              onFood(food);
            },
          })
        }
      />
    </div>
  );
}

export function ImageCapture({
  mode,
  onFood,
}: {
  mode: "label" | "meal-photo";
  onFood: (food: AnalyzedFood) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const analyze = useAnalyzeFoodImage();
  const toast = useToast();
  const isLabel = mode === "label";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const prepared = await prepareFoodImage(file);
      analyze.mutate(
        { file: prepared, mode },
        { onSuccess: ({ food }) => onFood(food) },
      );
    } catch {
      toast.show("Couldn't prepare that image");
    }
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-raised p-5 text-center">
      {isLabel ? (
        <ScanText
          size={28}
          strokeWidth={1.5}
          className="mx-auto text-text-secondary"
        />
      ) : (
        <Camera
          size={28}
          strokeWidth={1.5}
          className="mx-auto text-text-secondary"
        />
      )}
      <div className="type-headline mt-3">
        {isLabel ? "Photograph the nutrition label" : "Photograph the meal"}
      </div>
      <p className="type-footnote mt-1 text-text-tertiary">
        {isLabel
          ? "Keep the serving size and all macro rows sharp and visible."
          : "Include the full plate. Hidden oils and sauces may reduce accuracy."}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button
        className="mt-5 w-full"
        disabled={analyze.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {analyze.isPending
          ? isLabel
            ? "Reading label…"
            : "Estimating meal…"
          : "Take or choose photo"}
      </Button>
    </div>
  );
}
