"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { TABS, type TabId } from "./tabs";
import { TabBar } from "./tab-bar";
import { OfflineIndicator } from "./offline-indicator";
import { useProfile } from "@/hooks/use-profile";
import { TodayPanel } from "@/components/panels/today";
import { WeightPanel } from "@/components/panels/weight";
import { FoodPanel } from "@/components/panels/food";
import { LiftPanel } from "@/components/panels/lift";

const TabSwitchContext = createContext<(id: TabId) => void>(() => {});

/** Lets panel content (e.g. Today's cards) jump to another tab. */
export function useTabSwitch() {
  return useContext(TabSwitchContext);
}

const PANELS: Record<TabId, React.ComponentType<{ isActive: boolean }>> = {
  today: TodayPanel,
  weight: WeightPanel,
  food: FoodPanel,
  lift: LiftPanel,
};

/**
 * All four panels stay mounted — scroll position and half-finished entries
 * survive tab switches. Switching is a 120ms crossfade: the incoming panel
 * fades in above while the outgoing one holds still underneath, then hides.
 * Tab taps use replaceState (native tab bars never grow the back stack);
 * popstate keeps URL and UI in sync for edge-swipe navigation.
 */
export function TabShell({ initialTab }: { initialTab: TabId }) {
  const [active, setActive] = useState<TabId>(initialTab);
  const router = useRouter();
  const { data: profile } = useProfile();

  // First run: no completed questionnaire → straight to /setup (skippable).
  // Until the profile resolves (no cache), render only the canvas — never
  // flash Today ahead of a redirect.
  const skipped =
    typeof window !== "undefined" &&
    window.localStorage.getItem("surplus_setup_skipped") === "1";
  const needsSetup = profile?.completedAt === null && !skipped;
  useEffect(() => {
    if (needsSetup) router.replace("/setup");
  }, [needsSetup, router]);

  const switchTab = useCallback((id: TabId) => {
    setActive(id);
  }, []);

  // URL follows committed state — never mutated inside a state updater
  useEffect(() => {
    const tab = TABS.find((t) => t.id === active)!;
    if (window.location.pathname !== tab.path) {
      window.history.replaceState(null, "", tab.path);
    }
  }, [active]);

  useEffect(() => {
    const onPopState = () => {
      const slug = window.location.pathname.replace(/^\//, "").split("/")[0];
      const tab = TABS.find((t) => t.slug === slug) ?? TABS[0];
      setActive(tab.id);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (profile === undefined || needsSetup) {
    // canvas only — visually identical to the splash
    return <div className="app-shell bg-canvas" />;
  }

  return (
    <TabSwitchContext.Provider value={switchTab}>
      <div className="app-shell flex flex-col lg:flex-row">
        <TabBar active={active} onSelect={switchTab} />
        <div className="relative min-h-0 flex-1 overflow-hidden lg:order-last">
          {TABS.map(({ id }) => {
            const Panel = PANELS[id];
            const isActive = id === active;
            return (
              <motion.div
                key={id}
                className="absolute inset-0 min-h-0 bg-canvas"
                initial={false}
                animate={
                  isActive
                    ? {
                        opacity: 1,
                        visibility: "visible",
                        zIndex: 2,
                        transition: {
                          visibility: { duration: 0 },
                          opacity: { duration: 0.12, ease: "linear" },
                        },
                      }
                    : {
                        opacity: 0,
                        visibility: "hidden",
                        zIndex: 1,
                        transition: {
                          opacity: { duration: 0, delay: 0.15 },
                          visibility: { delay: 0.15 },
                        },
                      }
                }
                inert={!isActive}
              >
                <Panel isActive={isActive} />
              </motion.div>
            );
          })}
        </div>
      </div>
      <OfflineIndicator />
    </TabSwitchContext.Provider>
  );
}
