import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { Terminal } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";

export function ConfigPrefix() {
  const { t } = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cmdPrefix, setCmdPrefix] = useState("!");
  const { selectedGuildId } = useGuild();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiFetch("/api/config", {
      credentials: "include",
      headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
    }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (config?.command_prefix) setCmdPrefix(config.command_prefix);
  }, [config]);

  const prefixMutation = useMutation({
    mutationFn: () => apiFetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ command_prefix: cmdPrefix }),
    }).then(r => { if (!r.ok) throw new Error("Save failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      toast({ title: t("toast_saved"), description: `${t("configPrefix_changedTo")} "${cmdPrefix}"` });
    },
    onError: () => {
      toast({ variant: "destructive", title: t("error"), description: t("toast_prefixFailed") });
    },
  });

  if (isLoading) return <div>{t("loading")}</div>;

  return (
    <PageContainer size="sm">
      <PageHeader title={t("configPrefix_title")} icon={Terminal} description={t("configPrefix_desc")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("configPrefix_title")}</CardTitle>
          <CardDescription>{t("configPrefix_cardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2 flex-1 max-w-[220px]">
              <label className="text-sm font-medium">{t("configPrefix_prefixLabel")}</label>
              <Input
                value={cmdPrefix}
                onChange={(e) => setCmdPrefix(e.target.value.slice(0, 5))}
                placeholder="!"
                className="font-mono text-lg"
              />
            </div>
            <Button onClick={() => prefixMutation.mutate()} disabled={prefixMutation.isPending} size="sm">
              {prefixMutation.isPending ? t("saving") : t("configPrefix_savePrefix")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("configPrefix_withPrefix")} <code className="bg-muted px-1 rounded">{cmdPrefix || "!"}</code>, {t("configPrefix_usersType")} <code className="bg-muted px-1 rounded">{cmdPrefix || "!"}hug @user</code> {t("configPrefix_toRun")}
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
