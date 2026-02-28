"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";

export default function UploadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [profileLink, setProfileLink] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAddManual = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setAdding(true);
    try {
      const extra: Record<string, string> = {};
      if (email) extra.email = email;
      if (profileLink) extra.linkedin_url = profileLink;
      if (company) extra.company = company;
      if (title) extra.title = title;
      if (location) extra.location = location;
      if (platform) extra.social_platform = platform;

      await api.createApplicant({ name: name.trim(), extra });
      toast.success(`Added ${name.trim()}`);
      setName("");
      setEmail("");
      setProfileLink("");
      setCompany("");
      setTitle("");
      setLocation("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add applicant");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload Applicants</h2>
        <p className="text-muted-foreground">
          Add applicants via CSV upload or manually one by one
        </p>
      </div>

      <CSVUploader />

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground uppercase">
          or add manually
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Participant</CardTitle>
          <CardDescription>Manually add a single applicant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Social Platform <span className="text-destructive">*</span>
              </Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="x">X (Twitter)</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileLink">Profile Link</Label>
              <Input
                id="profileLink"
                value={profileLink}
                onChange={(e) => setProfileLink(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>
          </div>

          <Button
            onClick={handleAddManual}
            disabled={adding || !name.trim()}
            className="w-full"
          >
            {adding ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            Add Participant
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
