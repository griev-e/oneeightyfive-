"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  EditValueSheet,
  TARGET_META,
  type ValueFieldMeta,
} from "./edit-value-sheet";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useExportData } from "@/hooks/use-export";
import { useProfile, useSavePlan, type Profile } from "@/hooks/use-profile";
import { useWeighIns } from "@/hooks/use-weight";
import { usePlanEvents, type PlanEvent } from "@/hooks/use-plan-events";
import { useAppDate } from "@/hooks/use-app-date";
import {
  buildPlan,
  effectiveTrainingMonths,
  planWeightLbs,
  tierOf,
  type PlanInputs,
} from "@/lib/plan";
import { computePace } from "@/lib/stats";
import { formatInt } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";
import {
  APPETITE_OPTIONS,
  BODYFAT_OPTIONS,
  BULK_OPTIONS,
  CARDIO_OPTIONS,
  LIFT_DAYS_OPTIONS,
  NEAT_OPTIONS,
  SESSION_OPTIONS,
  optionLabel,
  projectionLine,
} from "@/lib/plan-options";

/**
 * The always-available plan screen: live targets (editable without re-running
 * the questionnaire), the "why these numbers" rationale recomputed from the
 * saved profile, profile edits that rebuild the plan server-side, and the
 * plan_events audit trail.
 */

type TargetKey = "calories" | "protein" | "carbs" | "fat" | "goalWeight" | "rate" | "months";

const VALUE_META: Record<TargetKey, ValueFieldMeta> = {
  calories: TARGET_META.calories,
  protein: TARGET_META.protein,
  carbs: TARGET_META.carbs,
  fat: TARGET_META.fat,
  goalWeight: { label: "Goal weight", unit: "lbs", min: 80, max: 400, digits: 3 },
  rate: { label: "Weekly pace", unit: "lb/wk", min: 0.1, max: 1, digits: 4, decimal: true },
  months: { label: "Consistent lifting", unit: "months", min: 0, max: 600, digits: 3 },
};

type OptionKey = "neat" | "liftDays" | "session" | "cardio" | "bodyfat" | "bulkStyle" | "appetite";

export function PlanView({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const today = useAppDate();
  const settings = useSettings();
  const { data: profile } = useProfile();
  const { data: weighIns = [] } = useWeighIns();
  const { data: events = [] } = usePlanEvents();
  const updateSettings = useUpdateSettings();
  const savePlan = useSavePlan();
  const exportData = useExportData(today);

  const [editingValue, setEditingValue] = useState<TargetKey | null>(null);
  const [editingOption, setEditingOption] = useState<OptionKey | null>(null);

  const answers = useMemo(() => completedAnswers(profile), [profile]);
  const currentWeight = weighIns.length > 0 ? planWeightLbs(weighIns, 0) : null;
  const effectiveMonths =
    answers !== null
      ? Math.round(
          effectiveTrainingMonths(
            answers.trainingMonths,
            answers.trainingMonthsAsOf,
            today,
          ),
        )
      : null;

  // Same pure recompute the /setup preview runs — rationale only, never applied.
  const plan = useMemo(() => {
    if (answers === null || currentWeight === null) return null;
    const inputs: PlanInputs = {
      ...answers,
      currentWeightLbs: currentWeight,
      goalWeightLbs: settings.goalWeightLbs ?? Math.round(currentWeight),
      rateOverride:
        settings.goalRateSource === "custom" && settings.goalRateLbsPerWeek >= 0.1
          ? settings.goalRateLbsPerWeek
          : null,
    };
    const pace = computePace(weighIns, settings.goalRateLbsPerWeek);
    return buildPlan(inputs, {
      today,
      weighIns,
      currentCalorieTarget: settings.calorieTarget,
      paceBand: pace.status === "ready" ? pace.band : null,
      observed: null,
    });
  }, [answers, currentWeight, weighIns, settings, today]);

  const observedEvent = events.find((e) => e.observedTdee !== null) ?? null;

  const saveProfile = (patch: Partial<SavePlanAnswers>) => {
    if (answers === null || currentWeight === null || effectiveMonths === null) {
      return;
    }
    savePlan.mutate(
      {
        effectiveDate: today,
        answers: {
          sex: answers.sex,
          birthDate: answers.birthDate,
          heightIn: answers.heightIn,
          currentWeightLbs: currentWeight,
          bodyFatPct: answers.bodyFatPct,
          neatTier: answers.neatTier,
          liftDaysPerWeek: answers.liftDaysPerWeek,
          sessionMin: answers.sessionMin,
          cardioMinPerWeek: answers.cardioMinPerWeek,
          // send the self-advanced value — the PUT re-stamps its as-of date,
          // which would otherwise reset the training clock
          trainingMonths: effectiveMonths,
          appetite: answers.appetite,
          bulkStyle: answers.bulkStyle,
          goalWeightLbs: settings.goalWeightLbs ?? Math.round(currentWeight),
          rateOverride:
            settings.goalRateSource === "custom" &&
            settings.goalRateLbsPerWeek >= 0.1
              ? settings.goalRateLbsPerWeek
              : null,
          ...patch,
        },
      },
      { onError: () => toast.show("Couldn't save — try again") },
    );
    setEditingOption(null);
    setEditingValue(null);
  };

  const saveValue = (key: TargetKey, v: number) => {
    if (key === "months") {
      saveProfile({ trainingMonths: v });
      return;
    }
    updateSettings.mutate(
      key === "calories"
        ? { calorieTarget: v }
        : key === "protein"
          ? { proteinTargetG: v }
          : key === "carbs"
            ? { carbTargetG: v }
            : key === "fat"
              ? { fatTargetG: v }
              : key === "goalWeight"
                ? { goalWeightLbs: v }
                : { goalRateLbsPerWeek: v, goalRateSource: "custom" },
    );
    setEditingValue(null);
  };

  const valueFor = (key: TargetKey): number =>
    key === "calories"
      ? settings.calorieTarget
      : key === "protein"
        ? settings.proteinTargetG
        : key === "carbs"
          ? settings.carbTargetG
          : key === "fat"
            ? settings.fatTargetG
            : key === "goalWeight"
              ? (settings.goalWeightLbs ??
                (currentWeight !== null ? Math.round(currentWeight) : 185))
              : key === "rate"
                ? settings.goalRateLbsPerWeek
                : (effectiveMonths ?? 0);

  const projection = plan === null ? null : projectionLine(plan.projection);

  const customized = plan !== null && settings.calorieTarget !== plan.calorieTarget;

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-screen pb-tab-clearance">
      <header className="mx-auto max-w-2xl pt-[calc(env(safe-area-inset-top)+20px)]">
        <m.button
          type="button"
          onClick={onBack}
          whileTap={{ scale: press.row }}
          transition={springs.instant}
          className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-text-secondary"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
          <span className="type-body">Today</span>
        </m.button>
        <h1 className="type-title mt-1">Plan</h1>
      </header>

      <div className="mx-auto mt-6 max-w-2xl space-y-8">
        {/* live targets — the numbers every screen judges against */}
        <section>
          <div className="type-label mb-2 text-text-tertiary">Targets</div>
          <Card className="divide-y divide-border-subtle p-0 px-4">
            <SettingRow
              label="Calories"
              value={`${formatInt(settings.calorieTarget)} cal`}
              onClick={() => setEditingValue("calories")}
            />
            <SettingRow
              label="Protein"
              value={`${settings.proteinTargetG} g`}
              onClick={() => setEditingValue("protein")}
            />
            <SettingRow
              label="Carbs"
              value={`${settings.carbTargetG} g`}
              onClick={() => setEditingValue("carbs")}
            />
            <SettingRow
              label="Fat"
              value={`${settings.fatTargetG} g`}
              onClick={() => setEditingValue("fat")}
            />
            <SettingRow
              label="Goal weight"
              value={
                settings.goalWeightLbs !== null
                  ? `${formatInt(settings.goalWeightLbs)} lbs`
                  : "—"
              }
              onClick={() => setEditingValue("goalWeight")}
            />
            <SettingRow
              label="Weekly pace"
              value={`+${settings.goalRateLbsPerWeek.toFixed(2)} lb/wk`}
              onClick={() => setEditingValue("rate")}
            />
          </Card>
          <p className="type-footnote mt-2 text-text-tertiary">
            Edits apply from today, are recorded in history, and mark the plan
            custom.
          </p>
        </section>

        {/* the why — recomputed live from the saved profile */}
        {plan !== null && (
          <section>
            <div className="type-label mb-2 text-text-tertiary">
              Why these numbers
            </div>
            <p className="type-body text-text-secondary">
              {plan.flags.atGoal
                ? projection
                : `Built for +${plan.rateLbsPerWeek.toFixed(2)} lb/week. ${projection}`}
            </p>
            {customized && (
              <>
                <p className="type-footnote mt-2 text-text-tertiary">
                  Your targets are hand-tuned — the formula currently says{" "}
                  {formatInt(plan.calorieTarget)} cal.
                </p>
                <button
                  type="button"
                  onClick={() => saveProfile({})}
                  className="type-body mt-1 flex min-h-11 items-center text-text-secondary"
                >
                  Reset to recommended
                </button>
              </>
            )}
            <Card className="mt-3 divide-y divide-border-subtle p-0 px-4">
              {(
                [
                  ["Base metabolism", `${formatInt(plan.bmr)} cal`, plan.explain.tdee],
                  ["Gain rate", `${plan.rateLbsPerWeek.toFixed(2)} lb/wk`, plan.explain.rate],
                  ["Calories", formatInt(plan.calorieTarget), plan.explain.calories],
                  ["Protein", `${plan.proteinG} g`, plan.explain.protein],
                  ["Fat", `${plan.fatG} g`, plan.explain.fat],
                  ["Carbs", `${plan.carbG} g`, plan.explain.carbs],
                ] as const
              ).map(([label, value, why]) => (
                <div key={label} className="py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="type-body text-text-primary">{label}</span>
                    <span className="type-body tabular-nums text-text-secondary">
                      {value}
                    </span>
                  </div>
                  <p className="type-footnote mt-0.5 text-text-tertiary">{why}</p>
                </div>
              ))}
              {observedEvent !== null && (
                <div className="py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="type-body text-text-primary">
                      Observed TDEE
                    </span>
                    <span className="type-body tabular-nums text-text-secondary">
                      ~{formatInt(observedEvent.observedTdee!)} cal
                    </span>
                  </div>
                  <p className="type-footnote mt-0.5 text-text-tertiary">
                    Estimated from your own logs and weight trend on{" "}
                    {formatShortDate(observedEvent.date)}.
                  </p>
                </div>
              )}
            </Card>
          </section>
        )}

        {/* the inputs — editable without re-running all 13 steps */}
        {answers !== null && (
          <section>
            <div className="type-label mb-2 text-text-tertiary">About you</div>
            <Card className="divide-y divide-border-subtle p-0 px-4">
              <SettingRow
                label="Day-to-day activity"
                value={optionLabel(NEAT_OPTIONS, answers.neatTier)}
                onClick={() => setEditingOption("neat")}
              />
              <SettingRow
                label="Lifting days"
                value={`${answers.liftDaysPerWeek}/week`}
                onClick={() => setEditingOption("liftDays")}
              />
              <SettingRow
                label="Session length"
                value={`${answers.sessionMin} min`}
                onClick={() => setEditingOption("session")}
              />
              <SettingRow
                label="Cardio"
                value={
                  answers.cardioMinPerWeek === 0
                    ? "None"
                    : `${answers.cardioMinPerWeek} min/week`
                }
                onClick={() => setEditingOption("cardio")}
              />
              <SettingRow
                label="Body fat"
                value={
                  answers.bodyFatPct !== null ? `~${answers.bodyFatPct}%` : "Not sure"
                }
                onClick={() => setEditingOption("bodyfat")}
              />
              <SettingRow
                label="Training age"
                value={
                  effectiveMonths !== null
                    ? `${effectiveMonths} mo · ${tierOf(effectiveMonths)}`
                    : "—"
                }
                onClick={() => setEditingValue("months")}
              />
              <SettingRow
                label="Bulk style"
                value={optionLabel(BULK_OPTIONS, answers.bulkStyle)}
                onClick={() => setEditingOption("bulkStyle")}
              />
              <SettingRow
                label="Appetite"
                value={optionLabel(APPETITE_OPTIONS, answers.appetite)}
                onClick={() => setEditingOption("appetite")}
              />
            </Card>
            <p className="type-footnote mt-2 text-text-tertiary">
              Any change rebuilds the plan — a bulk in progress never gets cut
              unless your pace is already ahead.
            </p>
            <button
              type="button"
              onClick={() => router.push("/setup")}
              className="type-body mt-3 flex min-h-11 items-center gap-1 text-text-secondary"
            >
              Retake the questionnaire
              <ChevronRight size={16} strokeWidth={1.75} className="text-text-tertiary" />
            </button>
          </section>
        )}

        {/* audit trail — every time the target moved */}
        {events.length > 0 && (
          <section>
            <div className="type-label mb-2 text-text-tertiary">History</div>
            <Card className="divide-y divide-border-subtle p-0 px-4">
              {events.map((e) => (
                <HistoryRow key={e.id} event={e} />
              ))}
            </Card>
          </section>
        )}

        {/* the insurance policy — everything, as one file */}
        <section>
          <div className="type-label mb-2 text-text-tertiary">Data</div>
          <Card className="p-0 px-4">
            <m.button
              type="button"
              onClick={() => exportData.mutate()}
              whileTap={{ scale: press.row }}
              transition={springs.instant}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span>
                <span className="type-body block text-text-primary">
                  Export data
                </span>
                <span className="type-footnote block text-text-tertiary">
                  Weigh-ins, food, training — one JSON backup
                </span>
              </span>
              <Download
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-text-tertiary"
              />
            </m.button>
          </Card>
        </section>
      </div>

      <EditValueSheet
        meta={editingValue ? VALUE_META[editingValue] : null}
        value={editingValue ? valueFor(editingValue) : 0}
        onClose={() => setEditingValue(null)}
        onSave={(v) => editingValue && saveValue(editingValue, v)}
      />

      <OptionSheet
        title="Day-to-day activity"
        open={editingOption === "neat"}
        options={NEAT_OPTIONS}
        selected={answers?.neatTier}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ neatTier: v })}
      />
      <OptionSheet
        title="Lifting days per week"
        open={editingOption === "liftDays"}
        options={LIFT_DAYS_OPTIONS}
        selected={answers?.liftDaysPerWeek}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ liftDaysPerWeek: v })}
      />
      <OptionSheet
        title="Typical session length"
        open={editingOption === "session"}
        options={SESSION_OPTIONS}
        selected={answers?.sessionMin}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ sessionMin: v })}
      />
      <OptionSheet
        title="Deliberate cardio"
        open={editingOption === "cardio"}
        options={CARDIO_OPTIONS}
        selected={answers?.cardioMinPerWeek}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ cardioMinPerWeek: v })}
      />
      <OptionSheet
        title="Body-fat estimate"
        open={editingOption === "bodyfat"}
        options={BODYFAT_OPTIONS}
        selected={answers?.bodyFatPct}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ bodyFatPct: v })}
      />
      <OptionSheet
        title="How do you want to gain?"
        open={editingOption === "bulkStyle"}
        options={BULK_OPTIONS}
        selected={answers?.bulkStyle}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ bulkStyle: v })}
      />
      <OptionSheet
        title="How hard is eating enough?"
        open={editingOption === "appetite"}
        options={APPETITE_OPTIONS}
        selected={answers?.appetite}
        onClose={() => setEditingOption(null)}
        onSelect={(v) => saveProfile({ appetite: v })}
      />
    </div>
  );
}

type SavePlanAnswers = Omit<PlanInputs, "trainingMonthsAsOf" | "rateOverride"> & {
  rateOverride: number | null;
};

/** The saved questionnaire, narrowed — null until every answer exists. */
function completedAnswers(profile: Profile | undefined) {
  if (
    !profile ||
    profile.completedAt === null ||
    profile.birthDate === null ||
    profile.heightIn === null ||
    profile.neatTier === null ||
    profile.liftDaysPerWeek === null ||
    profile.sessionMin === null ||
    profile.cardioMinPerWeek === null ||
    profile.trainingMonths === null ||
    profile.appetite === null ||
    profile.bulkStyle === null
  ) {
    return null;
  }
  return {
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightIn: profile.heightIn,
    bodyFatPct: profile.bodyFatPct,
    neatTier: profile.neatTier,
    liftDaysPerWeek: profile.liftDaysPerWeek,
    sessionMin: profile.sessionMin,
    cardioMinPerWeek: profile.cardioMinPerWeek,
    trainingMonths: profile.trainingMonths,
    trainingMonthsAsOf: profile.trainingMonthsAsOf ?? profile.birthDate,
    appetite: profile.appetite,
    bulkStyle: profile.bulkStyle,
  };
}

function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: press.row }}
      transition={springs.instant}
      className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="type-body text-text-primary">{label}</span>
      <span className="flex items-center gap-2">
        <span className="type-body tabular-nums text-text-secondary">{value}</span>
        <ChevronRight size={16} strokeWidth={1.75} className="text-text-tertiary" />
      </span>
    </m.button>
  );
}

function HistoryRow({ event }: { event: PlanEvent }) {
  const label =
    event.action === "questionnaire"
      ? "Questionnaire"
      : event.action === "dismissed"
        ? "Suggestion dismissed"
        : event.observedTdee !== null
          ? "Recalibrated"
          : "Target updated";
  const detail =
    event.action === "dismissed"
      ? event.targetBefore !== null
        ? `Kept ${formatInt(event.targetBefore)}`
        : ""
      : event.targetSuggested !== null
        ? event.targetBefore !== null && event.targetBefore !== event.targetSuggested
          ? `${formatInt(event.targetBefore)} → ${formatInt(event.targetSuggested)}`
          : formatInt(event.targetSuggested)
        : "";
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2">
      <span>
        <span className="type-body block text-text-primary">{label}</span>
        <span className="type-footnote block text-text-tertiary">
          {formatShortDate(event.date)}
        </span>
      </span>
      <span className="type-footnote tabular-nums text-text-secondary">{detail}</span>
    </div>
  );
}

function OptionSheet<T>({
  title,
  open,
  options,
  selected,
  onClose,
  onSelect,
}: {
  title: string;
  open: boolean;
  options: readonly { value: T; label: string; helper?: string }[];
  selected: T | null | undefined;
  onClose: () => void;
  onSelect: (v: T) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      <div className="space-y-2 px-4 pt-4 pb-2">
        <div className="type-label mb-1 text-center text-text-tertiary">
          {title}
        </div>
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
    </Sheet>
  );
}
