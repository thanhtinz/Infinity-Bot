import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ScrollText, Mic, ShieldCheck, Users, Server, Filter, X } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

interface LoggingConfigData {
  message_log_channel_id: string;
  voice_log_channel_id: string;
  mod_log_channel_id: string;
  member_log_channel_id: string;
  server_log_channel_id: string;
  ignored_channels: string[];
  ignored_roles: string[];
}

async function fetchLoggingConfig(): Promise<LoggingConfigData> {
  const res = await apiFetch("/api/logging/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveLoggingConfig(data: LoggingConfigData): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/logging/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

interface ChannelFieldProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}

function ChannelField({ label, description, icon, value, onChange }: ChannelFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-1.5">
        <ChannelSelect
          value={value}
          onChange={onChange}
          placeholder="Select channel..."
          filter="text"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
            aria-label="Delete channel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function LoggingConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["logging-config"],
    queryFn: fetchLoggingConfig,
    staleTime: 60_000,
  });

  const [messageLog, setMessageLog] = useState("");
  const [voiceLog, setVoiceLog] = useState("");
  const [modLog, setModLog] = useState("");
  const [memberLog, setMemberLog] = useState("");
  const [serverLog, setServerLog] = useState("");
  const [ignoredRoles, setIgnoredRoles] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setMessageLog(data.message_log_channel_id ?? "");
      setVoiceLog(data.voice_log_channel_id ?? "");
      setModLog(data.mod_log_channel_id ?? "");
      setMemberLog(data.member_log_channel_id ?? "");
      setServerLog(data.server_log_channel_id ?? "");
      setIgnoredRoles(data.ignored_roles ?? []);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveLoggingConfig({
        message_log_channel_id: messageLog,
        voice_log_channel_id: voiceLog,
        mod_log_channel_id: modLog,
        member_log_channel_id: memberLog,
        server_log_channel_id: serverLog,
        ignored_channels: data?.ignored_channels ?? [],
        ignored_roles: ignoredRoles,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logging-config"] });
      toast({ title: "Saved", description: "Log configuration updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save configuration.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Logging System</h2>
        <p className="text-muted-foreground">
          Configure log channels for each event type.
        </p>
      </div>

      {/* Log Channels Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Channels</CardTitle>
          <CardDescription>
            Select the channel that will receive logs for each event type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChannelField
              label="Message Log"
              description="Messages deleted/edited"
              icon={<ScrollText className="h-4 w-4 text-muted-foreground" />}
              value={messageLog}
              onChange={setMessageLog}
            />
            <ChannelField
              label="Voice Log"
              description="Voice join/leave"
              icon={<Mic className="h-4 w-4 text-muted-foreground" />}
              value={voiceLog}
              onChange={setVoiceLog}
            />
            <ChannelField
              label="Mod Log"
              description="Ban/kick/warn"
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              value={modLog}
              onChange={setModLog}
            />
            <ChannelField
              label="Member Log"
              description="Join/leave/nick/role"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              value={memberLog}
              onChange={setMemberLog}
            />
            <ChannelField
              label="Server Log"
              description="Channels created/deleted"
              icon={<Server className="h-4 w-4 text-muted-foreground" />}
              value={serverLog}
              onChange={setServerLog}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
          <CardDescription>
            Ignore logs for specific roles or channels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ignored Roles</Label>
            <p className="text-xs text-muted-foreground">
              Skip logging actions from these roles
            </p>
            <MultiRoleSelect
              value={ignoredRoles}
              onChange={setIgnoredRoles}
              placeholder="Select roles to ignore..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ignored Channels</Label>
            <p className="text-xs text-muted-foreground">
              Skip logging events from these channels.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving..." : "Save Config"}
      </Button>
    </div>
  );
}
