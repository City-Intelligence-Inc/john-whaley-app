"use client";

import { CSVUploader } from "@/components/csv-uploader";

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload CSV</h2>
        <p className="text-muted-foreground">
          Upload a CSV file with applicant data. Expected columns: name, email, linkedin_url, company, title, location
        </p>
      </div>
      <CSVUploader />
    </div>
  );
}
