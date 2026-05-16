/**
 * BotSettings.tsx — Unified Bot Settings
 * Accordion: General
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n";
import { Settings, Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "@/hooks/useApi";

// ─── shared query ────────────────────────────────────────────────────────────

function useConfig() {
  const { selectedGuildId } = useGuild();
  return useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/config", {
        credentials: "include",
        headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
      }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });
}

// ─── Section: General ────────────────────────────────────────────────────────

function GeneralSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { data: config } = useConfig();
  const { setLang: setI18nLang } = useT();

  const [lang, setLang] = useState<"en" | "vi">("en");
  const [prefix, setPrefix] = useState("!");
  const [adminRoles, setAdminRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.language) setLang(config.language as "en" | "vi");
      if (config.command_prefix) setPrefix(config.command_prefix);
      if (config.admin_role_id) {
        setAdminRoles(config.admin_role_id.split(",").map((s: string) => s.trim()).filter(Boolean));
      }
    }
  }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {}),
        },
        body: JSON.stringify({
          language: lang,
          command_prefix: prefix,
          admin_role_id: adminRoles.join(","),
        }),
      });
      setI18nLang(lang); // sync dashboard language immediately
      qc.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      toast({ title: "Saved", description: "General settings updated." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Bot Language</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Language used for bot notifications, welcome messages, and auto-replies.
            Change anytime with <code className="bg-muted px-1 rounded">/language</code> in Discord.
          </p>
        </div>
        <div className="flex gap-3">
          {(["en", "vi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                lang === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span className="text-lg">{l === "en" ? "🇬🇧" : "🇻🇳"}</span>
              {l === "en" ? "English" : "Vietnamese"}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Prefix */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Command Prefix</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            For legacy prefix commands. Slash commands are unaffected.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.slice(0, 5))}
            placeholder="!"
            className="font-mono text-lg w-28"
          />
          <p className="text-xs text-muted-foreground">
            e.g. <code className="bg-muted px-1 rounded">{prefix || "!"}hug @user</code>
          </p>
        </div>
      </div>

      <Separator />

      {/* Admin Roles */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Admin Roles
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Members with any of these roles can access the dashboard and use admin commands.
          </p>
        </div>
        <MultiRoleSelect
          value={adminRoles}
          onChange={setAdminRoles}
          guildId={selectedGuildId || undefined}
          placeholder="Select roles..."
        />
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-2">
        <Save className="w-3.5 h-3.5" />
        {saving ? "Saving..." : "Save General"}
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function BotSettings() {
  return (
    <div className="space-y-4 max-w-3xl">
      <Accordion type="multiple" defaultValue={["general"]} className="space-y-2">

        <AccordionItem value="general" className="border rounded-xl px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <Settings className="w-4 h-4 text-muted-foreground" />
              General
              <span className="text-xs font-normal text-muted-foreground">Language · Prefix · Admin roles</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <GeneralSection />
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
