"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// Only show these columns in preview (in order)
const PREVIEW_COLS = ["name", "email", "linkedin_url", "status", "company", "title"];
const COL_LABELS: Record<string, string> = {
  name: "Name", email: "Email", linkedin_url: "LinkedIn",
  status: "Status", company: "Company", title: "Title",
};

function normalizeHeader(h: string): string {
  const low = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (low === "full_name" || low === "attendee" || low === "candidate") return "name";
  if (low.includes("linkedin")) return "linkedin_url";
  if (low === "approval_status" || low === "rsvp_status") return "status";
  return low;
}

export function CSVUploader({ onUploadSuccess, sessionId }: {
  onUploadSuccess?: (count: number, sessionId: string) => void;
  sessionId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else current += c;
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = useCallback((text: string) => {
    const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = cleaned.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(normalizeHeader);
    setTotalRows(lines.length - 1);

    // Auto-detect linkedin URL in values for columns not caught by header normalization
    const rows = lines.slice(1, 6).map((line) => {
      const values = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        const val = values[i] || "";
        if (h === "linkedin_url" || val.includes("linkedin.com/")) {
          row["linkedin_url"] = val;
        }
        row[h] = val;
      });
      // Build name from first_name + last_name if missing
      if (!row["name"] && (row["first_name"] || row["last_name"])) {
        row["name"] = `${row["first_name"] || ""} ${row["last_name"] || ""}`.trim();
      }
      return row;
    });
    setPreview(rows);
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) { toast.error("Please select a CSV file"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target?.result as string);
    reader.readAsText(f);
  }, [parseCSV]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadCSV(file, sessionId);
      const enrichMsg = (result as Record<string, unknown>).enriched
        ? ` (${(result as Record<string, unknown>).enriched} enriched from LinkedIn DB)`
        : "";
      toast.success(`Imported ${result.count} guests${enrichMsg}`);
      onUploadSuccess?.(result.count, result.session_id);
      setFile(null);
      setPreview([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Which preview columns actually have data?
  const visibleCols = PREVIEW_COLS.filter((col) =>
    preview.some((row) => row[col] && row[col].trim())
  );

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragOver ? "border-gold bg-gold/5" : "border-border/50 hover:border-gold/30 hover:bg-gold/5"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Luma exports, spreadsheets, or any CSV with names and emails</p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          {/* File header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-gold" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {totalRows} {totalRows === 1 ? "row" : "rows"}
              </span>
            </div>
            <button onClick={() => { setFile(null); setPreview([]); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>

          {/* Clean preview - only key columns */}
          {preview.length > 0 && visibleCols.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {visibleCols.map((col) => (
                      <th key={col} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        {COL_LABELS[col] || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      {visibleCols.map((col) => (
                        <td key={col} className="px-4 py-2 text-sm truncate max-w-[200px]">
                          {col === "linkedin_url" && row[col] ? (
                            <span className="text-blue-500 text-xs">{row[col].replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}</span>
                          ) : (
                            row[col] || <span className="text-muted-foreground/30">--</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalRows > 5 && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/30">
                  + {totalRows - 5} more rows
                </p>
              )}
            </div>
          )}

          {/* Upload button */}
          <div className="px-4 py-3 border-t border-border/50">
            <Button onClick={handleUpload} disabled={uploading}
              className="w-full bg-gold hover:bg-gold/90 text-gold-foreground">
              {uploading ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Importing...</>
              ) : (
                <><Check className="size-4 mr-2" />Import {totalRows} Guests</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
