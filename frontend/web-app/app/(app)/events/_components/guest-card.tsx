"use client";

import {
  CheckCircle2, XCircle, Linkedin, MapPin, Building2, Sparkles,
  ScanSearch, Loader2, CircleCheck, AlertTriangle, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Applicant } from "@/lib/api";

interface Agent { id: string; name: string; description: string; }

interface GuestCardProps {
  applicant: Applicant;
  agents: Agent[];
  investigating: boolean;
  onStatusChange: (id: string, status: string) => void;
  onInvestigate: (id: string, agentId: string) => void;
  onSelect: (id: string) => void;
}

function getName(a: Applicant): string {
  return a.name || (a[`linkedin_name`] as string) || a.email || "No name";
}

export function GuestCard({ applicant: a, agents, investigating, onStatusChange, onInvestigate, onSelect }: GuestCardProps) {
  const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
  const headline = (a[`linkedin_headline`] as string) || a.title || "";
  const company = a.company || (a[`linkedin_company`] as string) || "";
  const location = a.location || (a[`linkedin_location`] as string) || "";
  const score = a.ai_score ? parseInt(a.ai_score) : 0;
  const isPending = a.status === "pending";
  const name = getName(a);
  const issues = (a[`linkedin_issues`] as string) || "";
  const isClean = issues === "clean";
  const hasIssues = issues && !isClean;

  // Extract investigation results
  const investigations = Object.entries(a)
    .filter(([k]) => k.startsWith("investigation_"))
    .map(([k, v]) => {
      const agentId = k.replace("investigation_", "");
      const agentName = agents.find(ag => ag.id === agentId)?.name || agentId;
      const text = String(v);
      // Extract first line as summary
      const firstLine = text.split("\n")[0].trim();
      return { agentId, agentName, summary: firstLine, full: text };
    });

  return (
    <Card className="group hover:border-border/80 transition-all">
      <CardContent className="p-4 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelect(a.applicant_id)}>
          {photo ? (
            <img src={photo} alt="" className="size-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground/40">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{name}</span>
              {score > 0 && (
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500"}`}>{score}</Badge>
              )}
            </div>
            {headline && <p className="text-xs text-muted-foreground truncate">{headline}</p>}
          </div>
        </div>

        {/* Meta */}
        {(company || location) && (
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            {company && <span className="flex items-center gap-1 truncate"><Building2 className="size-3 shrink-0" />{company}</span>}
            {location && <span className="flex items-center gap-1 truncate"><MapPin className="size-3 shrink-0" />{location}</span>}
          </div>
        )}

        {/* AI reasoning */}
        {a.ai_reasoning && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 flex items-start gap-1.5">
            <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />{a.ai_reasoning}
          </p>
        )}

        {/* Investigation results (inline, collapsible) */}
        {investigations.length > 0 && (
          <div className="space-y-1">
            {investigations.map(inv => (
              <Collapsible key={inv.agentId}>
                <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left group/inv">
                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                    <ScanSearch className="size-2.5" />
                    {inv.agentName}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate flex-1">{inv.summary}</span>
                  <ChevronDown className="size-3 text-muted-foreground group-data-[state=open]/inv:rotate-180 transition-transform shrink-0" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1 rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {inv.full}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Issues */}
        {isClean && (
          <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10 text-[10px] h-5">
            <CircleCheck className="size-3 mr-0.5" />Verified
          </Badge>
        )}
        {hasIssues && (
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <AlertTriangle className="size-3 shrink-0" />
            {issues.split("; ").map(i => i.replace("missing_", "No ").replace(/_/g, " ")).join(" / ")}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {a.linkedin_url && (
              <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:text-blue-400">
                <Linkedin className="size-3.5" />
              </a>
            )}
            {/* Investigate dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-muted-foreground hover:text-gold" disabled={investigating}>
                  {investigating ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                {agents.map(ag => (
                  <DropdownMenuItem key={ag.id} onClick={() => onInvestigate(a.applicant_id, ag.id)}>
                    <div>
                      <div className="text-xs font-medium">{ag.name}</div>
                      <div className="text-[10px] text-muted-foreground">{ag.description}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {isPending ? (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onStatusChange(a.applicant_id, "accepted")}
                className="h-6 px-2 text-[10px] text-emerald-500 hover:bg-emerald-500/10">
                <CheckCircle2 className="size-3 mr-0.5" />Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onStatusChange(a.applicant_id, "rejected")}
                className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-500/10">
                <XCircle className="size-3 mr-0.5" />Decline
              </Button>
            </div>
          ) : (
            <Badge variant="secondary" className={`text-[10px] ${a.status === "accepted" ? "text-emerald-500" : a.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
              {a.status === "accepted" ? "Going" : a.status === "rejected" ? "Not Going" : a.status === "waitlisted" ? "Waitlisted" : "Pending"}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
