"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_RECORDING_MS = 25_000;

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

export function VoiceRecorder({
  onAudio,
  pending = false,
}: {
  onAudio: (audio: Blob) => void;
  pending?: boolean;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      cleanupStream();
    },
    [],
  );

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setUnavailable(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: Blob[] = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        cleanupStream();
        setRecording(false);
        const audio = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        if (audio.size > 0) onAudio(audio);
      };
      recorder.start();
      setRecording(true);
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch {
      cleanupStream();
      setUnavailable(true);
    }
  };

  return (
    <div>
      <Button
        variant={recording ? "primary" : "secondary"}
        className="w-full"
        disabled={pending}
        onClick={recording ? stop : start}
      >
        {recording ? (
          <>
            <Square size={16} fill="currentColor" />
            Finish recording
          </>
        ) : (
          <>
            <Mic size={18} strokeWidth={1.75} />
            {pending ? "Understanding…" : "Describe by voice"}
          </>
        )}
      </Button>
      <p className="type-footnote mt-2 text-center text-text-tertiary">
        {unavailable
          ? "Microphone unavailable — type the meal instead"
          : recording
            ? "Say the foods and amounts, then tap finish"
            : "Example: two eggs, a bagel, and a cup of milk"}
      </p>
    </div>
  );
}
