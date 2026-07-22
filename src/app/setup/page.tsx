"use client";

/**
 * The questionnaire: 13 screens, one question each, spring-pushed like a
 * native onboarding. Every answer feeds a named formula in lib/plan.ts —
 * nothing here is decorative. Ends in the staged plan reveal.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { MotionProvider } from "@/components/ui/motion-provider";
import { applyWeightKey } from "@/lib/numeric-entry";
import {
  APPETITE_OPTIONS,
  BODYFAT_OPTIONS,
  BULK_OPTIONS,
  CARDIO_OPTIONS,
  LIFT_DAYS,
  NEAT_OPTIONS,
  SESSION_OPTIONS,
} from "@/lib/plan-options";
import { ChevronLeft } from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { NumberPad } from "@/components/ui/number-pad";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToastProvider } from "@/components/ui/toast";
import { PlanReveal, type TargetOverrides } from "@/components/setup/plan-reveal";
import { fetchJson } from "@/hooks/fetch-json";
import { useProfile, useSavePlan } from "@/hooks/use-profile";
import { DEFAULT_SETTINGS, type Settings } from "@/hooks/use-settings";
import { getAppDate } from "@/lib/dates";
import {
  buildPlan,
  planWeightLbs,
  type Appetite,
  type BulkStyle,
  type NeatTier,
  type PlanInputs,
  type Sex,
} from "@/lib/plan";
import { computePace, type WeighIn } from "@/lib/stats";
import { del } from "idb-keyval";
import { formatWeight } from "@/lib/format";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

type Answers = {
  sex: Sex | null;
  birthDigits: string; // MMDDYYYY progressive
  heightFt: string;
  heightInches: string;
  weight: string;
  weightConfirmed: boolean;
  bodyFatPct: number | null | undefined; // undefined = unanswered, null = "not sure"
  neatTier: NeatTier | null;
  liftDaysPerWeek: number | null;
  sessionMin: number | null;
  cardioMinPerWeek: number | null;
  trainingMonths: string;
  goalWeight: string;
  bulkStyle: BulkStyle | null;
  appetite: Appetite | null;
};

const STEPS = [
  "sex",
  "birth",
  "height",
  "weight",
  "bodyfat",
  "neat",
  "liftDays",
  "session",
  "cardio",
  "trainingMonths",
  "goalWeight",
  "bulkStyle",
  "appetite",
] as const;
type StepId = (typeof STEPS)[number];

export default function SetupPage() {
  // /setup lives outside the (app) shell — it brings its own providers
  const [client] = useState(() => new QueryClient());
  return (
    <MotionProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Flow />
        </ToastProvider>
      </QueryClientProvider>
    </MotionProvider>
  );
}

function Flow() {
  const router = useRouter();
  const today = getAppDate();
  const { data: profile } = useProfile();
  const { data: weighIns = [] } = useQuery({
    queryKey: ["weigh-ins"],
    queryFn: () => fetchJson<WeighIn[]>("/api/weight"),
  });
  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<Settings>("/api/settings"),
  });
  const savePlan = useSavePlan();

  const firstRun = profile?.completedAt === null;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [revealing, setRevealing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [a, setA] = useState<Answers>(() => ({
    sex: null,
    birthDigits: "",
    heightFt: "",
    heightInches: "",
    weight: "",
    weightConfirmed: false,
    bodyFatPct: undefined,
    neatTier: null,
    liftDaysPerWeek: null,
    sessionMin: null,
    cardioMinPerWeek: null,
    trainingMonths: "",
    goalWeight: "",
    bulkStyle: null,
    appetite: null,
  }));

  // prefill from a completed profile on re-runs
  const [prefilled, setPrefilled] = useState(false);
  if (profile && profile.completedAt !== null && !prefilled) {
    setPrefilled(true);
    const bd = profile.birthDate?.split("-") ?? null;
    setA((prev) => ({
      ...prev,
      sex: profile.sex,
      birthDigits: bd ? `${bd[1]}${bd[2]}${bd[0]}` : "",
      heightFt: profile.heightIn ? String(Math.floor(profile.heightIn / 12)) : "",
      heightInches: profile.heightIn ? String(Math.round(profile.heightIn % 12)) : "",
      bodyFatPct: profile.bodyFatPct,
      neatTier: profile.neatTier,
      liftDaysPerWeek: profile.liftDaysPerWeek,
      sessionMin: profile.sessionMin,
      cardioMinPerWeek: profile.cardioMinPerWeek,
      trainingMonths:
        profile.trainingMonths !== null ? String(profile.trainingMonths) : "",
      bulkStyle: profile.bulkStyle,
      appetite: profile.appetite,
    }));
  }

  const latestWeighIn = weighIns[weighIns.length - 1];
  const recentWeighIn =
    latestWeighIn !== undefined &&
    daysAgo(latestWeighIn.date, today) <= 7 &&
    !a.weightConfirmed
      ? planWeightLbs(weighIns, 0)
      : null;

  const goNext = () => {
    setDirection(1);
    if (step === STEPS.length - 1) setRevealing(true);
    else setStep((s) => s + 1);
  };
  const goBack = () => {
    if (revealing) {
      setRevealing(false);
      return;
    }
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const inputs: PlanInputs | null = useMemo(() => {
    if (
      !a.sex ||
      a.birthDigits.length !== 8 ||
      !a.heightFt ||
      !a.neatTier ||
      a.liftDaysPerWeek === null ||
      a.sessionMin === null ||
      a.cardioMinPerWeek === null ||
      a.trainingMonths === "" ||
      a.goalWeight === "" ||
      !a.bulkStyle ||
      !a.appetite ||
      a.bodyFatPct === undefined
    ) {
      return null;
    }
    const weight =
      a.weight !== ""
        ? parseFloat(a.weight)
        : (recentWeighIn ?? planWeightLbs(weighIns, 0));
    if (!(weight >= 80 && weight <= 400)) return null;
    return {
      sex: a.sex,
      birthDate: `${a.birthDigits.slice(4)}-${a.birthDigits.slice(0, 2)}-${a.birthDigits.slice(2, 4)}`,
      heightIn: parseInt(a.heightFt, 10) * 12 + (parseInt(a.heightInches || "0", 10) || 0),
      currentWeightLbs: weight,
      bodyFatPct: a.bodyFatPct,
      neatTier: a.neatTier,
      liftDaysPerWeek: a.liftDaysPerWeek,
      sessionMin: a.sessionMin,
      cardioMinPerWeek: a.cardioMinPerWeek,
      trainingMonths: parseInt(a.trainingMonths, 10),
      trainingMonthsAsOf: today,
      appetite: a.appetite,
      bulkStyle: a.bulkStyle,
      goalWeightLbs: parseFloat(a.goalWeight),
      rateOverride: null,
    };
  }, [a, recentWeighIn, weighIns, today]);

  const plan = useMemo(() => {
    if (!inputs) return null;
    const pace = computePace(weighIns, settings.goalRateLbsPerWeek);
    return buildPlan(inputs, {
      today,
      weighIns,
      currentCalorieTarget: settings.calorieTarget,
      paceBand: pace.status === "ready" ? pace.band : null,
      observed: null,
    });
  }, [inputs, weighIns, settings, today]);

  const start = (overrides: TargetOverrides, customized: boolean) => {
    if (!inputs) return;
    savePlan.mutate(
      {
        effectiveDate: today,
        answers: { ...inputs },
        overrides: customized ? overrides : undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          // the app shell's persisted cache predates the new targets
          void del("REACT_QUERY_OFFLINE_CACHE");
          setTimeout(() => router.replace("/"), 450);
        },
      },
    );
  };

  if (revealing && plan) {
    return (
      <main className="app-shell flex flex-col bg-canvas">
        <Header
          progress={1}
          onBack={goBack}
          showBack={!saved}
          later={null}
        />
        <PlanReveal
          plan={plan}
          saving={savePlan.isPending}
          saved={saved}
          onStart={start}
        />
      </main>
    );
  }

  const id = STEPS[step];
  return (
    <main className="app-shell flex flex-col bg-canvas">
      <Header
        progress={(step + 1) / (STEPS.length + 1)}
        onBack={goBack}
        showBack={step > 0}
        later={
          firstRun
            ? () => {
                localStorage.setItem("surplus_setup_skipped", "1");
                router.replace("/");
              }
            : null
        }
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.div
            key={id}
            initial={{ x: direction * 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={springs.sheet}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-screen pb-[max(env(safe-area-inset-bottom),2rem)]"
          >
            <div className="mx-auto max-w-2xl pt-4">
              <Step
                id={id}
                a={a}
                setA={setA}
                onAnswer={goNext}
                recentWeighIn={recentWeighIn}
                goalPrefill={settings.goalWeightLbs}
              />
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function daysAgo(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) /
      86_400_000,
  );
}

function Header({
  progress,
  onBack,
  showBack,
  later,
}: {
  progress: number;
  onBack: () => void;
  showBack: boolean;
  later: (() => void) | null;
}) {
  return (
    <div className="flex items-center gap-4 px-screen pt-[calc(env(safe-area-inset-top)+12px)]">
      <m.button
        type="button"
        onClick={onBack}
        whileTap={{ scale: press.icon }}
        transition={springs.instant}
        aria-label="Back"
        className={cn(
          "-ml-2 flex size-11 items-center justify-center text-text-secondary",
          !showBack && "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft size={22} strokeWidth={1.75} />
      </m.button>
      <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-border-default">
        <m.div
          className="h-full origin-left rounded-full bg-text-primary"
          animate={{ scaleX: progress }}
          transition={springs.default}
          initial={false}
        />
      </div>
      {later ? (
        <Button variant="ghost" className="-mr-2 h-11 px-2" onClick={later}>
          Later
        </Button>
      ) : (
        <span className="w-7" />
      )}
    </div>
  );
}

// ---- question renderers ----

function Q({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="type-title">{title}</h1>
      {helper && (
        <p className="type-footnote mt-1 text-text-tertiary">{helper}</p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Chips<T>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string; helper?: string }[];
  selected: T | null | undefined;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <m.button
          key={String(o.value)}
          type="button"
          whileTap={{ scale: press.row }}
          transition={springs.instant}
          onClick={() => onSelect(o.value)}
          className={cn(
            "block w-full rounded-xl border bg-raised p-4 text-left transition-colors duration-150",
            Object.is(selected, o.value)
              ? "border-border-strong"
              : "border-border-subtle",
          )}
        >
          <span className="type-headline block">{o.label}</span>
          {o.helper && (
            <span className="type-footnote mt-0.5 block text-text-secondary">
              {o.helper}
            </span>
          )}
        </m.button>
      ))}
    </div>
  );
}

function PadValue({
  display,
  unit,
  valid,
  onKey,
  onContinue,
  decimal = false,
}: {
  display: string;
  unit: string;
  valid: boolean;
  onKey: (k: string) => void;
  onContinue: () => void;
  decimal?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-center gap-1.5">
        <span className={cn("type-display", display === "" && "text-text-tertiary")}>
          {display === "" ? "0" : display}
        </span>
        <span className="type-footnote text-text-tertiary">{unit}</span>
      </div>
      <NumberPad onKey={onKey} decimal={decimal} />
      <Button className="mt-4 w-full" disabled={!valid} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function Step({
  id,
  a,
  setA,
  onAnswer,
  recentWeighIn,
  goalPrefill,
}: {
  id: StepId;
  a: Answers;
  setA: React.Dispatch<React.SetStateAction<Answers>>;
  onAnswer: () => void;
  recentWeighIn: number | null;
  goalPrefill: number | null;
}) {
  const pick = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setA((prev) => ({ ...prev, [key]: value }));
    setTimeout(onAnswer, 200); // chip auto-advance
  };

  switch (id) {
    case "sex":
      return (
        <Q title="Biological sex" helper="Sets the base-metabolism constant.">
          <Chips
            options={[
              { value: "male" as Sex, label: "Male" },
              { value: "female" as Sex, label: "Female" },
            ]}
            selected={a.sex}
            onSelect={(v) => pick("sex", v)}
          />
        </Q>
      );
    case "birth": {
      const d = a.birthDigits;
      const display = `${d.slice(0, 2).padEnd(2, "•")} / ${d.slice(2, 4).padEnd(2, "•")} / ${d.slice(4).padEnd(4, "•")}`;
      const valid = (() => {
        if (d.length !== 8) return false;
        const mm = +d.slice(0, 2), dd = +d.slice(2, 4), yyyy = +d.slice(4);
        return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1946 && yyyy <= 2012;
      })();
      return (
        <Q title="Date of birth" helper="Age feeds the metabolism formula — and keeps advancing on its own.">
          <div className="mb-4 text-center">
            <span className="type-display tabular-nums tracking-widest">{display}</span>
            <div className="type-label mt-1 text-text-tertiary">MM / DD / YYYY</div>
          </div>
          <NumberPad
            decimal={false}
            onKey={(k) =>
              setA((prev) => ({
                ...prev,
                birthDigits:
                  k === "del"
                    ? prev.birthDigits.slice(0, -1)
                    : prev.birthDigits.length >= 8
                      ? prev.birthDigits
                      : prev.birthDigits + k,
              }))
            }
          />
          <Button className="mt-4 w-full" disabled={!valid} onClick={onAnswer}>
            Continue
          </Button>
        </Q>
      );
    }
    case "height": {
      const ft = parseInt(a.heightFt || "0", 10);
      const inches = parseInt(a.heightInches || "0", 10);
      const total = ft * 12 + inches;
      const valid = total >= 55 && total <= 90 && inches <= 11;
      return (
        <Q title="Height" helper="Feeds metabolism and the carb floor.">
          <div className="mb-4 flex items-baseline justify-center gap-4">
            <span className="type-display tabular-nums">
              {a.heightFt || "•"}
              <span className="type-footnote text-text-tertiary"> ft </span>
              {a.heightInches === "" ? "•" : a.heightInches}
              <span className="type-footnote text-text-tertiary"> in</span>
            </span>
          </div>
          <NumberPad
            decimal={false}
            onKey={(k) =>
              setA((prev) => {
                if (k === "del") {
                  if (prev.heightInches !== "")
                    return { ...prev, heightInches: prev.heightInches.slice(0, -1) };
                  return { ...prev, heightFt: prev.heightFt.slice(0, -1) };
                }
                if (prev.heightFt === "") return { ...prev, heightFt: k };
                if (prev.heightInches.length < 2) {
                  const next = prev.heightInches + k;
                  return parseInt(next, 10) <= 11
                    ? { ...prev, heightInches: next }
                    : prev;
                }
                return prev;
              })
            }
          />
          <p className="type-footnote mt-2 text-center text-text-tertiary">
            First digit is feet, the rest inches.
          </p>
          <Button className="mt-3 w-full" disabled={!valid} onClick={onAnswer}>
            Continue
          </Button>
        </Q>
      );
    }
    case "weight": {
      if (recentWeighIn !== null && a.weight === "") {
        return (
          <Q title="Current weight" helper="From your recent weigh-ins — the 7-day average.">
            <Card className="p-5 text-center">
              <span className="type-display tabular-nums">
                {formatWeight(recentWeighIn)}
              </span>
              <span className="type-footnote ml-1 text-text-tertiary">lbs</span>
            </Card>
            <Button className="mt-4 w-full" onClick={onAnswer}>
              That&apos;s right
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() =>
                setA((prev) => ({ ...prev, weightConfirmed: true, weight: "" }))
              }
            >
              Update it
            </Button>
          </Q>
        );
      }
      const w = a.weight.trim();
      const parsed = parseFloat(w || "0");
      return (
        <Q title="Current weight">
          <PadValue
            display={w}
            unit="lbs"
            valid={parsed >= 80 && parsed <= 400}
            decimal
            onKey={(k) =>
              setA((prev) => ({
                ...prev,
                weight: applyWeightKey(prev.weight.trim(), k),
              }))
            }
            onContinue={onAnswer}
          />
        </Q>
      );
    }
    case "bodyfat":
      return (
        <Q
          title="Body-fat estimate"
          helper="An honest eyeball beats false precision — this tunes the formula blend."
        >
          <Chips
            options={BODYFAT_OPTIONS}
            selected={a.bodyFatPct}
            onSelect={(v) => pick("bodyFatPct", v)}
          />
        </Q>
      );
    case "neat":
      return (
        <Q title="Day-to-day activity" helper="Outside the gym.">
          <Chips
            options={NEAT_OPTIONS}
            selected={a.neatTier}
            onSelect={(v) => pick("neatTier", v)}
          />
        </Q>
      );
    case "liftDays":
      return (
        <Q title="Lifting days per week">
          <div className="grid grid-cols-5 gap-2">
            {LIFT_DAYS.map((n) => (
              <m.button
                key={n}
                type="button"
                whileTap={{ scale: press.row }}
                transition={springs.instant}
                onClick={() => pick("liftDaysPerWeek", n)}
                className={cn(
                  "type-stat flex h-16 items-center justify-center rounded-xl border bg-raised",
                  "transition-colors duration-150",
                  a.liftDaysPerWeek === n
                    ? "border-border-strong"
                    : "border-border-subtle",
                )}
              >
                {n}
              </m.button>
            ))}
          </div>
        </Q>
      );
    case "session":
      return (
        <Q title="Typical session length">
          <Chips
            options={SESSION_OPTIONS}
            selected={a.sessionMin}
            onSelect={(v) => pick("sessionMin", v)}
          />
        </Q>
      );
    case "cardio":
      return (
        <Q title="Deliberate cardio" helper="Runs, bike, sport — per week.">
          <Chips
            options={CARDIO_OPTIONS}
            selected={a.cardioMinPerWeek}
            onSelect={(v) => pick("cardioMinPerWeek", v)}
          />
        </Q>
      );
    case "trainingMonths": {
      const parsed = parseInt(a.trainingMonths || "0", 10);
      return (
        <Q
          title="Months of consistent lifting"
          helper="3+ sessions a week, no break longer than a month. Sets your gain-rate tier — and it keeps advancing on its own."
        >
          <PadValue
            display={a.trainingMonths}
            unit="months"
            valid={a.trainingMonths !== "" && parsed >= 0 && parsed <= 600}
            onKey={(k) =>
              setA((prev) => ({
                ...prev,
                trainingMonths:
                  k === "del"
                    ? prev.trainingMonths.slice(0, -1)
                    : prev.trainingMonths.length >= 3
                      ? prev.trainingMonths
                      : prev.trainingMonths + k,
              }))
            }
            onContinue={onAnswer}
          />
        </Q>
      );
    }
    case "goalWeight": {
      const display = a.goalWeight || (goalPrefill ? String(goalPrefill) : "");
      const parsed = parseFloat(display || "0");
      return (
        <Q
          title="Goal weight"
          helper="Flexible — the weekly pace is what the app manages. At or below current weight means maintenance."
        >
          <PadValue
            display={display}
            unit="lbs"
            valid={parsed >= 80 && parsed <= 400}
            onKey={(k) =>
              setA((prev) => {
                const cur = prev.goalWeight; // first keypress replaces prefill
                if (k === "del")
                  return { ...prev, goalWeight: cur.slice(0, -1) };
                if (k === ".") return prev;
                if (cur.length >= 3) return prev;
                return { ...prev, goalWeight: cur + k };
              })
            }
            onContinue={() => {
              if (a.goalWeight === "" && goalPrefill) {
                setA((prev) => ({ ...prev, goalWeight: String(goalPrefill) }));
              }
              onAnswer();
            }}
          />
        </Q>
      );
    }
    case "bulkStyle":
      return (
        <Q title="How do you want to gain?">
          <Chips
            options={BULK_OPTIONS}
            selected={a.bulkStyle}
            onSelect={(v) => pick("bulkStyle", v)}
          />
        </Q>
      );
    case "appetite":
      return (
        <Q
          title="How hard is eating enough?"
          helper="Honest answer — it tunes protein and fat so the plan is actually doable."
        >
          <Chips
            options={APPETITE_OPTIONS}
            selected={a.appetite}
            onSelect={(v) => pick("appetite", v)}
          />
        </Q>
      );
  }
}
