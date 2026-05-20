import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGuild } from "@/contexts/GuildContext";
import { Clock, Copy, Check, User, Database, Download, Upload, Loader2, Bot, Gem } from "lucide-react";
import { useState, useRef } from "react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader, SectionCard } from "@/components/infinity";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Singapore", "Asia/Seoul", "Asia/Kolkata",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

export function ProfilePage() {
  const { selectedGuildId } = useGuild();
  const [timezone, setTimezone] = useState(() => localStorage.getItem("tz") || "Asia/Ho_Chi_Minh");
  const [copied, setCopied] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [backupType, setBackupType] = useState("full");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const { data: plan } = useQuery<{ name: string; features: string[] }>({
    queryKey: ["my_plan"],
    queryFn: () => apiFetch("/api/premium/my-plan").then(r => r.ok ? r.json() : { name: "Free", features: [] }),
    retry: false,
  });

  const handleTimezone = (tz: string) => {
    setTimezone(tz);
    localStorage.setItem("tz", tz);
  };

  const copyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Backup: download JSON
  const backupMut = useMutation({
    mutationFn: async () => {
      const url = backupType === "full" ? "/api/backup" : `/api/backup?type=${backupType}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Backup failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `backup_${backupType}_${selectedGuildId}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    },
    onSuccess: () => toast({ title: "Backup downloaded" }),
    onError: (e) => toast({ title: "Backup failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" }),
  });

  // Restore: upload JSON
  const restoreMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await apiFetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Restore failed");
      return res.json();
    },
    onSuccess: (data) => {
      setRestoreMsg({ ok: true, text: `Restored ${Object.values(data.restored || {}).reduce((a: number, b: unknown) => a + (b as number), 0)} records` });
      qc.invalidateQueries();
    },
    onError: (e) => {
      setRestoreMsg({ ok: false, text: e instanceof Error ? e.message : "Restore failed" });
    },
  });

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) restoreMut.mutate(file);
    e.target.value = "";
  };

  if (!user) return null;

  return (
    <PageContainer size="md">
      <PageHeader title="Profile" description="Your account information" icon={User} />

      {/* User Info */}
      <SectionCard>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-4 ring-primary/10">
              <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full ring-2 ring-white" />
          </div>
          <div className="text-center sm:text-left flex-1 space-y-2">
            <div>
              <h2 className="text-xl font-bold text-card-foreground">{user.username}</h2>
              <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start flex-wrap">
                <Badge variant="outline" className="text-xs">{user.is_owner ? "Bot Owner" : "Staff"}</Badge>
                {plan && <Badge className="text-xs bg-primary/10 text-primary border-0">{plan.name}</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{user.id}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyId}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Preferences — only timezone */}
      <SectionCard title="Preferences" accent="primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <Label className="flex items-center gap-2 text-[14px]">
              <Clock className="w-4 h-4 text-primary" />
              Timezone
            </Label>
            <p className="text-[12px] text-muted-foreground mt-0.5">Used for displaying timestamps</p>
          </div>
          <Select value={timezone} onValueChange={handleTimezone}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Backup & Restore */}
      <SectionCard title="Backup & Restore" icon={Database} accent="amber">
        <p className="text-[13px] text-muted-foreground mb-4">
          Download your bot configuration as a JSON file, or restore from a previous backup.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Backup type</Label>
            <Select value={backupType} onValueChange={setBackupType}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full backup</SelectItem>
                <SelectItem value="commands">Commands</SelectItem>
                <SelectItem value="roles">Role panels</SelectItem>
                <SelectItem value="embeds">Embed templates</SelectItem>
                <SelectItem value="moderation">Moderation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => backupMut.mutate()}
            disabled={backupMut.isPending || !selectedGuildId}
          >
            {backupMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={restoreMut.isPending || !selectedGuildId}
          >
            {restoreMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Restore
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
        </div>
        {restoreMsg && (
          <p className={`text-[13px] mt-3 ${restoreMsg.ok ? "text-emerald-600" : "text-destructive"}`}>
            {restoreMsg.text}
          </p>
        )}
        {!selectedGuildId && (
          <p className="text-[12px] text-amber-600 mt-2">Select a server first to use backup/restore.</p>
        )}
      </SectionCard>

      {/* Custom Bot — Premium */}
      <SectionCard title="Custom Bot" icon={Bot} accent="primary">
        {plan && plan.name !== "Free" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Customize your bot's appearance — name, avatar, and status.
            </p>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Your Bot</p>
                <p className="text-xs text-muted-foreground">Configure in Bot Settings → General</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/bot-settings"}>
                Configure
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Gem className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Custom Bot</p>
              <p className="text-xs text-muted-foreground">Upgrade to Premium to customize your bot's name, avatar, and status.</p>
            </div>
            <Button size="sm" onClick={() => window.location.href = "/my-plan"}>
              Upgrade
            </Button>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
