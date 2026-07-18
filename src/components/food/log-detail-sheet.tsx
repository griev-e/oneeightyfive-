"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { MacroFields, type MacroValues } from "./macro-fields";
import {
  useDeleteFoodLog,
  useLogFood,
  useUpdateFoodLog,
  type FoodLog,
} from "@/hooks/use-food";
import { useToast } from "@/components/ui/toast";

/** Tap a logged row → edit or delete it. Delete gets a 5-second Undo. */
export function LogDetailSheet({
  log,
  onClose,
  date,
}: {
  log: FoodLog | null;
  onClose: () => void;
  date: string;
}) {
  if (!log) return null;
  // key by id: fresh state per entry, initialized from props — no sync effect
  return <LogDetailBody key={log.id} log={log} onClose={onClose} date={date} />;
}

function LogDetailBody({
  log,
  onClose,
  date,
}: {
  log: FoodLog;
  onClose: () => void;
  date: string;
}) {
  const [values, setValues] = useState<MacroValues>(() => ({
    calories: log.calories,
    proteinG: log.proteinG,
    carbsG: log.carbsG,
    fatG: log.fatG,
  }));
  const update = useUpdateFoodLog(date);
  const del = useDeleteFoodLog(date);
  const relog = useLogFood(date);
  const toast = useToast();

  const save = () => {
    if (values.calories < 1) return;
    update.mutate({ id: log.id, ...values });
    onClose();
  };

  const remove = () => {
    const snapshot = log;
    del.mutate(snapshot.id);
    onClose();
    toast.show(`Deleted ${snapshot.name}`, {
      label: "Undo",
      onPress: () =>
        relog.mutate({
          date: snapshot.date,
          name: snapshot.name,
          calories: snapshot.calories,
          proteinG: snapshot.proteinG,
          carbsG: snapshot.carbsG,
          fatG: snapshot.fatG,
          mealId: snapshot.mealId,
          loggedAt: snapshot.loggedAt,
        }),
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={log.name}>
      <div className="pt-4 pb-2">
        <div className="px-4 pb-3">
          <div className="type-headline">{log.name}</div>
        </div>
        <MacroFields values={values} onChange={setValues} />
        <div className="mt-3 space-y-2 px-4">
          <Button className="w-full" disabled={values.calories < 1} onClick={save}>
            Save
          </Button>
          <ConfirmSwap
            label="Delete entry"
            confirmLabel="Delete"
            onConfirm={remove}
          />
        </div>
      </div>
    </Sheet>
  );
}
