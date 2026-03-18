"use client";

import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Agent { id: string; name: string; description: string; }

interface BulkInvestigateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  applicantCount: number;
  onRun: (agentIds: string[]) => void;
  bulkInvestigating: boolean;
  bulkProgress: { completed: number; total: number } | null;
}

export function BulkInvestigateDialog({
  open, onOpenChange, agents, applicantCount, onRun, bulkInvestigating, bulkProgress,
}: BulkInvestigateDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(agents.map(a => a.id)));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pct = bulkProgress ? Math.round((bulkProgress.completed / bulkProgress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-4 text-gold" />Investigate All Guests
          </DialogTitle>
          <DialogDescription>
            Run AI agents on all {applicantCount} guests. Select which agents to use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {agents.map(ag => (
            <label key={ag.id} className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={selected.has(ag.id)} onCheckedChange={() => toggle(ag.id)} className="mt-0.5" />
              <div>
                <Label className="text-sm font-medium cursor-pointer">{ag.name}</Label>
                <p className="text-xs text-muted-foreground">{ag.description}</p>
              </div>
            </label>
          ))}
        </div>

        {bulkProgress && (
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {bulkProgress.completed} / {bulkProgress.total} ({pct}%)
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulkInvestigating}>Cancel</Button>
          <Button onClick={() => onRun([...selected])} disabled={bulkInvestigating || selected.size === 0}
            className="bg-gold hover:bg-gold/90 text-gold-foreground">
            {bulkInvestigating ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Running...</> : <><Brain className="size-3.5 mr-1.5" />Run on {applicantCount} guests</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
