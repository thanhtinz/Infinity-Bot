import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ScrollText, Mic, ShieldCheck, Users, Server, Filter, X, FileText } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader } from "@/components/yuri";

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
  const { t } = useT();
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
          placeholder={t("selectChannel")}
          filter="text"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
            aria-label={t("delete")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function LoggingConfig() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const { data, isLoading } = useQuery({
    queryKey: ["logging-config", selectedGuildId],
    queryFn: fetchLoggingConfig,
    staleTime: 60_000,
    enabled: !!selectedGuildId,
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
      qc.invalidateQueries({ queryKey: ["logging-config", selectedGuildId] });
      toast({ title: t("toast_saved"), description: t("toast_loggingSaved") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("toast_saveFailed"), variant: "destructive" });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <PageContainer>
      <PageHeader title={t("logging_title")} icon={FileText} description={t("logging_configDesc")} />

      {/* Log Channels Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logging_logChannels")}</CardTitle>
          <CardDescription>
            {t("logging_logChannelsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChannelField
              label={t("logging_messageLog")}
              description={t("logging_messageLogDesc")}
              icon={<ScrollText className="h-4 w-4 text-muted-foreground" />}
              value={messageLog}
              onChange={setMessageLog}
            />
            <ChannelField
              label={t("logging_voiceLog")}
              description={t("logging_voiceLogDesc")}
              icon={<Mic className="h-4 w-4 text-muted-foreground" />}
              value={voiceLog}
              onChange={setVoiceLog}
            />
            <ChannelField
              label={t("logging_modLog")}
              description={t("logging_modLogDesc")}
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              value={modLog}
              onChange={setModLog}
            />
            <ChannelField
              label={t("logging_memberLog")}
              description={t("logging_memberLogDesc")}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              value={memberLog}
              onChange={setMemberLog}
            />
            <ChannelField
              label={t("logging_serverLog")}
              description={t("logging_serverLogDesc")}
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
            <Filter className="w-4 h-4" /> {t("logging_filters")}
          </CardTitle>
          <CardDescription>
            {t("logging_filtersDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("logging_ignoredRoles")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("logging_ignoredRolesDesc")}
            </p>
            <MultiRoleSelect
              value={ignoredRoles}
              onChange={setIgnoredRoles}
              placeholder={t("logging_selectRolesToIgnore")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("logging_ignoredChannels")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("logging_ignoredChannelsDesc")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? t("saving") : t("save")}
      </Button>
    </PageContainer>
  );
}
