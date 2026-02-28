"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

export function CSVUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return;

    // Simple CSV parsing — handles quoted fields
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const hdrs = parseLine(lines[0]);
    setHeaders(hdrs);

    const rows = lines.slice(1, 6).map((line) => {
      const values = parseLine(line);
      const row: Record<string, string> = {};
      hdrs.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });
    setPreview(rows);
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(f);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(f);
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadCSV(file);
      toast.success(`Uploaded ${result.count} applicants`);
      setFile(null);
      setPreview([]);
      setHeaders([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <CardContent
          className="flex flex-col items-center justify-center py-12 cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-1">
            Drag and drop your CSV file here
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse files
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setHeaders([]);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            {preview.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Preview (first {preview.length} rows)
                </p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map((h) => (
                          <TableHead key={h} className="whitespace-nowrap">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((row, i) => (
                        <TableRow key={i}>
                          {headers.map((h) => (
                            <TableCell key={h} className="whitespace-nowrap">
                              {row[h]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <Button
              className="mt-4 w-full"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
