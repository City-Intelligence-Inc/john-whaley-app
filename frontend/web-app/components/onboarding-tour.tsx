"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Settings2,
  Upload,
  Brain,
  BarChart3,
  Sparkles,
} from "lucide-react";

// ── Tour step definitions ──

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  icon: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    target: "session-picker",
    title: "Sessions",
    description:
      "Organize applicants into sessions — one per event or cohort. Select a session here or view all at once.",
    icon: <BarChart3 className="size-5" />,
    position: "bottom",
  },
  {
    target: "settings-btn",
    title: "Configure AI Provider",
    description:
      "Add your API key (Anthropic or OpenAI), choose a model, and set up selection rules like venue capacity and attendee mix.",
    icon: <Settings2 className="size-5" />,
    position: "bottom",
  },
  {
    target: "import-btn",
    title: "Import Applicants",
    description:
      "Upload a CSV file or connect a Google Sheet to import your guest list. You can also sync from Luma or Eventbrite.",
    icon: <Upload className="size-5" />,
    position: "bottom",
  },
  {
    target: "run-analysis-btn",
    title: "Run AI Analysis",
    description:
      "Once applicants are imported, run the AI analysis. It classifies each person (VC, Founder, Operator, etc.), verifies claims against LinkedIn, and scores them.",
    icon: <Brain className="size-5" />,
    position: "bottom",
  },
  {
    target: "score-cutoff",
    title: "Adjust Score Cutoff",
    description:
      "Use the slider to set a minimum AI score. Everyone above the cutoff is accepted; below is rejected. Fine-tune until the numbers match your venue capacity.",
    icon: <Sparkles className="size-5" />,
    position: "top",
  },
  {
    target: "applicant-table",
    title: "Review & Adjust",
    description:
      "Review each applicant's classification, AI score, and verification status. Click any row to expand details, or override decisions manually.",
    icon: <BarChart3 className="size-5" />,
    position: "top",
  },
];

const STORAGE_KEY = "onboarding-tour-completed";

// ── Spotlight overlay + tooltip ──

function SpotlightOverlay({
  targetRect,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  targetRect: DOMRect;
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const pad = 8;
  const sx = targetRect.left - pad;
  const sy = targetRect.top - pad;
  const sw = targetRect.width + pad * 2;
  const sh = targetRect.height + pad * 2;

  // Calculate tooltip position
  const pos = step.position || "bottom";
  let tooltipStyle: React.CSSProperties = {};
  const tooltipWidth = 360;

  if (pos === "bottom") {
    tooltipStyle = {
      top: sy + sh + 12,
      left: Math.max(8, Math.min(sx + sw / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8)),
    };
  } else if (pos === "top") {
    tooltipStyle = {
      bottom: window.innerHeight - sy + 12,
      left: Math.max(8, Math.min(sx + sw / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8)),
    };
  } else if (pos === "right") {
    tooltipStyle = {
      top: sy + sh / 2 - 60,
      left: sx + sw + 12,
    };
  } else {
    tooltipStyle = {
      top: sy + sh / 2 - 60,
      right: window.innerWidth - sx + 12,
    };
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              rx="8"
              ry="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Clickable backdrop to dismiss */}
      <div
        className="absolute inset-0"
        onClick={onSkip}
        style={{ cursor: "default" }}
      />

      {/* Spotlight ring */}
      <div
        className="absolute rounded-lg ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent pointer-events-none"
        style={{
          top: sy,
          left: sx,
          width: sw,
          height: sh,
        }}
      />

      {/* Tooltip card */}
      <div
        className="absolute bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5"
        style={{ ...tooltipStyle, width: tooltipWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              {step.icon}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{step.title}</h3>
              <span className="text-[11px] text-muted-foreground">
                Step {stepIndex + 1} of {totalSteps}
              </span>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.description}
        </p>

        {/* Progress dots + navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`size-1.5 rounded-full transition-colors ${
                  i === stepIndex
                    ? "bg-blue-500"
                    : i < stepIndex
                      ? "bg-blue-300 dark:bg-blue-700"
                      : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 text-xs">
                <ChevronLeft className="size-3 mr-1" />
                Back
              </Button>
            )}
            {stepIndex === 0 && (
              <Button variant="ghost" size="sm" onClick={onSkip} className="h-8 text-xs text-muted-foreground">
                Skip tour
              </Button>
            )}
            <Button size="sm" onClick={onNext} className="h-8 text-xs">
              {stepIndex === totalSteps - 1 ? "Done" : "Next"}
              {stepIndex < totalSteps - 1 && <ChevronRight className="size-3 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main tour component ──

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number>(0);

  // Only mount on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  // Find and track the target element
  const updateRect = useCallback(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view if needed
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      // Element not visible (maybe behind empty state) — skip to next available
      setTargetRect(null);
    }
  }, [active, stepIndex]);

  useEffect(() => {
    updateRect();
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [updateRect]);

  const handleNext = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      setActive(false);
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex]);

  const handlePrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleSkip = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  if (!mounted || !active || !targetRect) return null;

  return createPortal(
    <SpotlightOverlay
      targetRect={targetRect}
      step={STEPS[stepIndex]}
      stepIndex={stepIndex}
      totalSteps={STEPS.length}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={handleSkip}
    />,
    document.body
  );
}

// ── Re-trigger hook (for a "Restart Tour" button) ──

export function useRestartTour() {
  return useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);
}
