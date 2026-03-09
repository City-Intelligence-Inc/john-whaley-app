"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { JUDGE_PERSONAS, type JudgePersona } from "@/lib/judge-personas";

interface RoundtableSelectorProps {
  panelSize: 3 | 6 | 9 | 12;
  judgeIds: string[];
  personaEdits: Record<string, string>;
  judgeTemperatures?: Record<string, number>;
  onToggleJudge: (judgeId: string) => void;
  onUpdatePersonaEdit: (judgeId: string, text: string) => void;
  onResetPersonaEdit: (judgeId: string) => void;
  onSaveCustomJudge?: (judgeId: string, description: string) => void;
  onUpdateTemperature?: (judgeId: string, temp: number) => void;
}

const SIZE_CONFIG: Record<number, { radius: number; seat: number }> = {
  3: { radius: 70, seat: 48 },
  6: { radius: 85, seat: 44 },
  9: { radius: 100, seat: 38 },
  12: { radius: 110, seat: 34 },
};

function ShapedEmoji({ persona, size }: { persona: JudgePersona; size: number }) {
  const dim = `${size}px`;
  const fontSize = Math.max(12, Math.round(size * 0.45));

  const style: React.CSSProperties = { width: dim, height: dim, fontSize };

  if (persona.shape === "diamond") {
    return (
      <div className="flex items-center justify-center" style={style}>
        <div
          className={`${persona.color} flex items-center justify-center rotate-45 rounded-sm`}
          style={{ width: "85%", height: "85%" }}
        >
          <span className="-rotate-45 leading-none" style={{ fontSize }}>{persona.emoji}</span>
        </div>
      </div>
    );
  }

  if (persona.shape === "hexagon") {
    return (
      <div
        className={`${persona.color} flex items-center justify-center`}
        style={{ ...style, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
      >
        <span className="leading-none" style={{ fontSize }}>{persona.emoji}</span>
      </div>
    );
  }

  const shapeClasses: Record<string, string> = {
    circle: "rounded-full",
    square: "rounded-sm",
    rounded: "rounded-xl",
    pill: "rounded-full",
  };

  return (
    <div
      className={`${persona.color} ${shapeClasses[persona.shape] || "rounded-full"} flex items-center justify-center`}
      style={style}
    >
      <span className="leading-none" style={{ fontSize }}>{persona.emoji}</span>
    </div>
  );
}

function EmptySeat({
  x,
  y,
  seatSize,
  availableJudges,
  onSelect,
}: {
  x: number;
  y: number;
  seatSize: number;
  availableJudges: JudgePersona[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="absolute flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary/50 hover:text-primary/70 transition-colors bg-background"
          style={{
            width: seatSize,
            height: seatSize,
            left: x - seatSize / 2,
            top: y - seatSize / 2,
          }}
        >
          <Plus className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="center" side="right">
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {availableJudges.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">All judges selected</p>
            ) : (
              availableJudges.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm shrink-0">{p.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{p.specialty}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function FilledSeat({
  x,
  y,
  seatSize,
  persona,
  personaEdit,
  temperature,
  onRemove,
  onUpdateEdit,
  onResetEdit,
  onSaveCustom,
  onUpdateTemperature,
}: {
  x: number;
  y: number;
  seatSize: number;
  persona: JudgePersona;
  personaEdit?: string;
  temperature?: number;
  onRemove: () => void;
  onUpdateEdit: (text: string) => void;
  onResetEdit: () => void;
  onSaveCustom?: (description: string) => void;
  onUpdateTemperature?: (temp: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasEdit = personaEdit !== undefined && personaEdit !== persona.description;
  const labelWidth = Math.max(seatSize + 16, 56);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="absolute flex flex-col items-center transition-transform hover:scale-110"
          style={{
            left: x - labelWidth / 2,
            top: y - seatSize / 2,
            width: labelWidth,
          }}
        >
          <div className="flex items-center justify-center mx-auto">
            <ShapedEmoji persona={persona} size={seatSize} />
          </div>
          <span
            className="text-[9px] leading-tight text-center text-muted-foreground mt-0.5 truncate w-full"
          >
            {persona.name.replace(/^The\s+/, "")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center" side="right">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{persona.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{persona.name}</div>
              <div className="text-xs text-muted-foreground">{persona.specialty}</div>
            </div>
          </div>

          {/* Persona prompt editor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Evaluation prompt</label>
            <Textarea
              className="text-xs min-h-[80px] resize-y"
              value={personaEdit ?? persona.description}
              onChange={(e) => onUpdateEdit(e.target.value)}
            />
            {hasEdit && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onResetEdit}
                  className="text-[10px] text-primary hover:underline"
                >
                  Reset to default
                </button>
                {onSaveCustom && (
                  <button
                    onClick={() => {
                      onSaveCustom(personaEdit ?? persona.description);
                      setOpen(false);
                    }}
                    className="text-[10px] text-green-600 hover:underline"
                  >
                    Save as custom judge
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Temperature slider */}
          {onUpdateTemperature && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Temperature</label>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{(temperature ?? 0.7).toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature ?? 0.7]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={([v]) => onUpdateTemperature(v)}
                className="w-full"
              />
              <p className="text-[9px] text-muted-foreground">Lower = more consistent, higher = more creative</p>
            </div>
          )}

          {/* Remove button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-destructive hover:text-destructive"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          >
            <X className="size-3 mr-1" />
            Remove from panel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RoundtableSelector({
  panelSize,
  judgeIds,
  personaEdits,
  judgeTemperatures,
  onToggleJudge,
  onUpdatePersonaEdit,
  onResetPersonaEdit,
  onSaveCustomJudge,
  onUpdateTemperature,
}: RoundtableSelectorProps) {
  const config = SIZE_CONFIG[panelSize];
  const seatSize = config.seat;
  const radius = config.radius;

  // Container must fit: center + radius + half a seat + label overhang on each side
  const padding = seatSize / 2 + 20; // extra space for labels
  const containerSize = (radius + padding) * 2;
  const center = containerSize / 2;

  const seats = Array.from({ length: panelSize }, (_, i) => {
    const angle = (i / panelSize) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    const judgeId = judgeIds[i] ?? null;
    const persona = judgeId ? JUDGE_PERSONAS.find((p) => p.id === judgeId) ?? null : null;
    return { i, x, y, judgeId, persona };
  });

  const availableJudges = JUDGE_PERSONAS.filter((p) => !judgeIds.includes(p.id));
  const hasEmptySeats = judgeIds.length < panelSize;

  // Center circle size
  const centerRadius = Math.max(28, radius * 0.35);

  return (
    <div className="flex flex-col items-center gap-1">
      {hasEmptySeats && (
        <p className="text-[10px] text-muted-foreground text-center">
          Click <span className="inline-flex items-center justify-center size-3.5 rounded-full border border-dashed border-muted-foreground/40 text-[8px] align-middle">+</span> to add judges to the panel
        </p>
      )}
      <div className="relative" style={{ width: containerSize, height: containerSize }}>
        {/* Center decoration */}
        <div
          className="absolute rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center"
          style={{
            width: centerRadius * 2,
            height: centerRadius * 2,
            left: center - centerRadius,
            top: center - centerRadius,
          }}
        >
          <span className="text-[10px] text-muted-foreground font-medium">
            {judgeIds.length}/{panelSize}
          </span>
        </div>

        {/* Seats */}
        {seats.map(({ i, x, y, judgeId, persona }) =>
          persona ? (
            <FilledSeat
              key={judgeId}
              x={x}
              y={y}
              seatSize={seatSize}
              persona={persona}
              personaEdit={personaEdits[judgeId!]}
              temperature={judgeTemperatures?.[judgeId!]}
              onRemove={() => onToggleJudge(judgeId!)}
              onUpdateEdit={(text) => onUpdatePersonaEdit(judgeId!, text)}
              onResetEdit={() => onResetPersonaEdit(judgeId!)}
              onSaveCustom={onSaveCustomJudge ? (desc) => onSaveCustomJudge(judgeId!, desc) : undefined}
              onUpdateTemperature={onUpdateTemperature ? (temp) => onUpdateTemperature(judgeId!, temp) : undefined}
            />
          ) : (
            <EmptySeat
              key={`empty-${i}`}
              x={x}
              y={y}
              seatSize={seatSize}
              availableJudges={availableJudges}
              onSelect={onToggleJudge}
            />
          )
        )}
      </div>
    </div>
  );
}
