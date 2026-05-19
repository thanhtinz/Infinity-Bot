import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Hash, Shield } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

const schema = z.object({
  admin_role_id: z.string().optional(),
  don_hang_channel_id: z.string().optional(),
  feedback_channel_id: z.string().optional(),
  coupon_channel_id: z.string().optional(),
  bang_gia_channel_id: z.string().optional(),
  welcome_channel_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function DiscordSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConfigChannels() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiFetch("/api/config", {
      credentials: "include",
    }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      admin_role_id: "", don_hang_channel_id: "",
      feedback_channel_id: "", coupon_channel_id: "", bang_gia_channel_id: "", welcome_channel_id: "",
    },
  });

  useEffect(() => {
    if (config)
      form.reset({
        admin_role_id: config.admin_role_id || "",
        don_hang_channel_id: config.don_hang_channel_id || "",
        feedback_channel_id: config.feedback_channel_id || "",
        coupon_channel_id: config.coupon_channel_id || "",
        bang_gia_channel_id: config.bang_gia_channel_id || "",
        welcome_channel_id: config.welcome_channel_id || "",
      });
  }, [config]);

  const activeGuildId = selectedGuildId || config?.guild_id;

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_channels", activeGuildId],
    queryFn: () =>
      apiFetch(`/api/discord/channels?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!activeGuildId,
    staleTime: 60_000,
  });

  const { data: roles = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_roles", activeGuildId],
    queryFn: () =>
      apiFetch(`/api/discord/roles?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!activeGuildId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => apiFetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(v),
    }).then(r => { if (!r.ok) throw new Error("Save failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["discord_channels"] });
      qc.invalidateQueries({ queryKey: ["discord_roles"] });
      toast({ title: t("savedSuccess"), description: t("toast_channelsSaved") });
    },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_saveFailed") }),
  });

  const channelFields: { name: keyof FormValues; label: string }[] = [
    { name: "don_hang_channel_id", label: t("configChannels_channelOrders") },
    { name: "feedback_channel_id", label: t("configChannels_feedbackChannel") },
    { name: "coupon_channel_id", label: t("configChannels_couponLogChannel") },
    { name: "bang_gia_channel_id", label: t("configChannels_priceListChannel") },
    { name: "welcome_channel_id", label: t("configChannels_channelWelcome") },
  ];

  if (isLoading) return <div className="text-muted-foreground text-sm">{t("loading")}</div>;

  return (
    <PageContainer size="md">
      <PageHeader title={t("configChannels_channelsPerms")} icon={Hash} description={t("configChannels_channelsPermsDesc")} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
          {/* Server & Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-4 h-4" /> {t("configChannels_permissionAdmin")}
              </CardTitle>
              <CardDescription>{t("configChannels_configForServer")} <strong>{activeGuildId}</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="admin_role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("configChannels_dashboardAdminRole")}</FormLabel>
                    <FormControl>
                      {roles.length > 0 ? (
                        <DiscordSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={roles}
                          placeholder={t("configChannels_selectRole")}
                        />
                      ) : (
                        <Input
                          placeholder={activeGuildId ? t("configChannels_loadingRoles") : t("configChannels_selectServerFirst")}
                          disabled={!activeGuildId}
                          {...field}
                          value={field.value || ""}
                        />
                      )}
                    </FormControl>
                    <FormDescription>{t("configChannels_adminRoleDesc")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Notification Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="w-4 h-4" /> {t("configChannels_notifChannels")}
              </CardTitle>
              <CardDescription>{t("configChannels_notifDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelFields.map(({ name, label }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          {channels.length > 0 ? (
                            <DiscordSelect
                              value={field.value}
                              onChange={field.onChange}
                              options={channels.map((c) => ({ id: c.id, name: `#${c.name}` }))}
                              placeholder={t("configChannels_selectChannel")}
                            />
                          ) : (
                            <Input
                              placeholder={activeGuildId ? t("configChannels_loadingChannels") : t("configChannels_selectServerFirst")}
                              disabled={!activeGuildId}
                              {...field}
                              value={field.value || ""}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("saving") : t("configChannels_saveConfig")}
          </Button>
        </form>
      </Form>
    </PageContainer>
  );
}
