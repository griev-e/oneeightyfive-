"use client";

import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { springs } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MacroGrid } from "@/components/ui/macro-grid";
import { CheckDraw } from "@/components/ui/check-draw";
import { PRBadge } from "@/components/ui/pr-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastProvider, useToast } from "@/components/ui/toast";

const COLORS = [
  ["canvas", "bg-canvas border border-border-default"],
  ["raised", "bg-raised"],
  ["overlay", "bg-overlay"],
  ["border-subtle", "bg-border-subtle"],
  ["border-default", "bg-border-default"],
  ["border-strong", "bg-border-strong"],
  ["text-primary", "bg-text-primary"],
  ["text-secondary", "bg-text-secondary"],
  ["text-tertiary", "bg-text-tertiary"],
  ["accent", "bg-accent"],
  ["accent-tint", "bg-accent-tint"],
  ["pr", "bg-pr"],
  ["protein", "bg-protein"],
  ["carbs", "bg-carbs"],
  ["fat", "bg-fat"],
] as const;

const TYPE_RAMP = [
  ["type-hero", "2,412"],
  ["type-display", "185.0"],
  ["type-stat", "135 g"],
  ["type-title", "Weight"],
  ["type-headline", "Barbell Bench Press"],
  ["type-body", "Save your staples once, log them in two taps."],
  ["type-footnote", "7-day average · updated today"],
  ["type-label", "Day streak"],
] as const;

export default function DesignPage() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Gallery />
      </ToastProvider>
    </MotionConfig>
  );
}

function Gallery() {
  const toast = useToast();
  const [num, setNum] = useState(2412);
  const [ring, setRing] = useState(0.72);
  const [checked, setChecked] = useState(true);
  const [seg, setSeg] = useState<"1w" | "1m" | "all">("1m");

  return (
    <div className="mx-auto max-w-xl px-5 pt-[calc(env(safe-area-inset-top)+24px)] pb-24">
      <div className="type-label text-text-tertiary">Surplus</div>
      <h1 className="type-title mt-1 mb-8">Design system</h1>

      <Section title="Color">
        <div className="grid grid-cols-3 gap-3">
          {COLORS.map(([name, cls]) => (
            <div key={name}>
              <div className={`h-14 rounded-md ${cls}`} />
              <div className="type-footnote mt-1.5 text-text-tertiary">
                {name}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="space-y-5">
          {TYPE_RAMP.map(([cls, sample]) => (
            <div key={cls} className="flex items-baseline justify-between gap-4">
              <span className={cls}>{sample}</span>
              <span className="type-footnote shrink-0 text-text-tertiary">
                {cls.replace("type-", "")}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Springs">
        <div className="space-y-3">
          {(
            Object.entries(springs) as [keyof typeof springs, object][]
          ).map(([name]) => (
            <SpringDemo key={name} name={name} />
          ))}
        </div>
      </Section>

      <Section title="Animated number">
        <Card className="flex flex-col items-center gap-4 p-6">
          <AnimatedNumber value={num} className="type-hero" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setNum((n) => n + 642)}>
              +642
            </Button>
            <Button variant="secondary" onClick={() => setNum((n) => n + 58)}>
              +58
            </Button>
            <Button variant="ghost" onClick={() => setNum(2412)}>
              Reset
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Progress">
        <Card className="flex flex-col items-center gap-5 p-6">
          <ProgressRing value={ring} size={156}>
            <AnimatedNumber
              value={Math.round(ring * 2700)}
              className="type-display"
            />
            <span className="type-label mt-1 text-text-tertiary">
              of 2,700
            </span>
          </ProgressRing>
          <div className="w-full">
            <MacroGrid
              protein={{ current: Math.round(ring * 135), target: 135 }}
              carbs={{ current: Math.round(ring * 360), target: 360 }}
              fat={{ current: Math.round(ring * 80), target: 80 }}
              isActive
            />
          </div>
          <div className="flex gap-2">
            {[0.25, 0.72, 1].map((v) => (
              <Button key={v} variant="secondary" onClick={() => setRing(v)}>
                {Math.round(v * 100)}%
              </Button>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Check + PR">
        <Card className="flex items-center justify-center gap-6 p-6">
          <button type="button" onClick={() => setChecked((c) => !c)}>
            <CheckDraw checked={checked} size={32} />
          </button>
          <button type="button" onClick={() => setChecked((c) => !c)}>
            <CheckDraw checked={checked} variant="pr" size={32} />
          </button>
          <PRBadge />
        </Card>
      </Section>

      <Section title="Controls">
        <div className="space-y-4">
          <Segmented
            options={[
              { id: "1w", label: "1W" },
              { id: "1m", label: "1M" },
              { id: "all", label: "All" },
            ]}
            value={seg}
            onChange={setSeg}
          />
          <div className="flex gap-3">
            <Button className="flex-1">Primary</Button>
            <Button variant="secondary" className="flex-1">
              Secondary
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => toast.show("Couldn't save — try again")}
          >
            Show toast
          </Button>
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-2/3" />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="type-label mb-3 text-text-tertiary">{title}</h2>
      {children}
    </section>
  );
}

function SpringDemo({ name }: { name: keyof typeof springs }) {
  const [run, setRun] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setRun((r) => r + 1)}
      className="block w-full rounded-2xl border border-border-subtle bg-raised p-4 text-left"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="type-headline">{name}</span>
        <span className="type-footnote text-text-tertiary">tap to replay</span>
      </div>
      <div className="relative h-3">
        <motion.span
          key={run}
          initial={{ left: 0 }}
          animate={{ left: "calc(100% - 12px)" }}
          transition={springs[name]}
          className="absolute top-0 size-3 rounded-full bg-text-primary"
        />
      </div>
    </button>
  );
}
