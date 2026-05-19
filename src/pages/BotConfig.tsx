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
import { useT } from "@/i18n";
import { Key } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";

// ─── Schemas ────────────────────────────────────────────────
const discordSchema = z.object({
  discord_token: z.string().optional(),
  discord_client_id: z.string().optional(),
  discord_client_secret: z.string().optional(),
});
const payosSchema = z.object({
  payos_client_id: z.string().optional(),
  payos_api_key: z.string().optional(),
  payos_checksum_key: z.string().optional(),
});
const serverSchema = z.object({
  guild_id: z.string().optional(),
  admin_role_id: z.string().optional(),
  don_hang_channel_id: z.string().optional(),
  feedback_channel_id: z.string().optional(),
  coupon_channel_id: z.string().optional(),
  bang_gia_channel_id: z.string().optional(),
  welcome_channel_id: z.string().optional(),
});

type DiscordValues = z.infer<typeof discordSchema>;
type PayosValues = z.infer<typeof payosSchema>;
type ServerValues = z.infer<typeof serverSchema>;

// ─── Save helper ────────────────────────────────────────────
async function savePartial(partial: Record<string, unknown>) {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

// ─── Masked field helper ─────────────────────────────────────
function MaskedField({
  field,
  placeholder,
  savedValue,
}: {
  field: { value: string | undefined; onChange: (v: string) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> };
  placeholder?: string;
  savedValue?: string | boolean | null;
}) {
  const isConfigured = typeof savedValue === "boolean" ? savedValue : !!savedValue;
  return (
    <div className="space-y-1">
      <Input
        type="password"
        placeholder={isConfigured ? "••••••••  (configured)" : placeholder}
        value={field.value || ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
        autoComplete="new-password"
      />
      {isConfigured && !field.value && (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Configured — leave blank to keep unchanged</p>
      )}
    </div>
  );
}

function DiscordSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
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
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Main component ──────────────────────────────────────────
export function BotConfig() {
  const { toast } = useToast();
  const { t } = useT();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  // ── Form: Discord Bot ──
  const discordForm = useForm<DiscordValues>({
    resolver: zodResolver(discordSchema),
    defaultValues: { discord_token: "", discord_client_id: "", discord_client_secret: "" },
  });
  useEffect(() => { if (config) discordForm.reset({ discord_token: "", discord_client_id: config.discord_client_id || "", discord_client_secret: "" }); }, [config]);

  // ── Form: PayOS ──
  const payosForm = useForm<PayosValues>({
    resolver: zodResolver(payosSchema),
    defaultValues: { payos_client_id: "", payos_api_key: "", payos_checksum_key: "" },
  });
  useEffect(() => { if (config) payosForm.reset({ payos_client_id: config.payos_client_id || "", payos_api_key: "", payos_checksum_key: "" }); }, [config]);

  // ── Form: Server & Channels ── (must be before queries that watch it)
  const serverForm = useForm<ServerValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: { guild_id: "", admin_role_id: "", don_hang_channel_id: "", feedback_channel_id: "", coupon_channel_id: "", bang_gia_channel_id: "", welcome_channel_id: "" },
  });
  useEffect(() => { if (config) serverForm.reset({ guild_id: config.guild_id || "", admin_role_id: config.admin_role_id || "", don_hang_channel_id: config.don_hang_channel_id || "", feedback_channel_id: config.feedback_channel_id || "", coupon_channel_id: config.coupon_channel_id || "", bang_gia_channel_id: config.bang_gia_channel_id || "", welcome_channel_id: config.welcome_channel_id || "" }); }, [config]);

  const { data: guilds = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_guilds"],
    queryFn: () => fetch("/api/discord/guilds", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.has_discord_token,
    retry: false,
    staleTime: 60_000,
  });

  // Watch selected guild_id from form to load channels/roles immediately on selection
  const selectedGuildId = serverForm.watch("guild_id");
  const activeGuildId = selectedGuildId || config?.guild_id;

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_channels", activeGuildId],
    queryFn: () => fetch(`/api/discord/channels?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.has_discord_token && !!activeGuildId,
    retry: false,
    staleTime: 60_000,
  });

  const { data: roles = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_roles", activeGuildId],
    queryFn: () => fetch(`/api/discord/roles?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.has_discord_token && !!activeGuildId,
    retry: false,
    staleTime: 60_000,
  });

  // ── Mutations ──
  const makeToast = (_label: string, savedKey: string) => ({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config"] }); toast({ title: t("save"), description: t(savedKey) }); },
    onError: () => { toast({ variant: "destructive", title: t("error"), description: t("toast_configFailed") }); },
  });

  const discordMutation = useMutation({ mutationFn: (v: DiscordValues) => savePartial(v), ...makeToast("Discord Bot", "toast_discordBotSaved") });
  const payosMutation = useMutation({ mutationFn: (v: PayosValues) => savePartial(v), ...makeToast("PayOS", "toast_payosSaved") });
  const serverMutation = useMutation({
    mutationFn: (v: ServerValues) => savePartial(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["discord_channels"] });
      queryClient.invalidateQueries({ queryKey: ["discord_roles"] });
      toast({ title: t("save"), description: t("toast_channelsSaved") });
    },
    onError: () => { toast({ variant: "destructive", title: t("error"), description: t("toast_configFailed") }); },
  });

  if (isLoading) return <div>{t("loading")}</div>;

  return (
    <PageContainer>
      <PageHeader title={t("botConfig_discordBot")} icon={Key} description={t("botConfig_tokenDesc")} />

      {/* ── Card: Discord Bot ── */}
      <Form {...discordForm}>
        <form onSubmit={discordForm.handleSubmit((v) => discordMutation.mutate(v))}>
          <Card>
            <CardHeader>
              <CardTitle>{t("botConfig_discordBot")}</CardTitle>
              <CardDescription>{t("botConfig_tokenDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={discordForm.control} name="discord_token" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_botToken")}</FormLabel>
                  <FormControl>
                    <MaskedField field={field} placeholder="MTC..." savedValue={config?.has_discord_token} />
                  </FormControl>
                  <FormDescription>{t("botConfig_tokenDesc")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={discordForm.control} name="discord_client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_clientId")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""}
                      placeholder={config?.discord_client_id ? `${config.discord_client_id.slice(0, 6)}...  (configured)` : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={discordForm.control} name="discord_client_secret" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_clientSecret")}</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.has_discord_client_secret} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={discordMutation.isPending} size="sm">
                {discordMutation.isPending ? t("saving") : t("botConfig_saveDiscord")}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* ── Card: PayOS ── */}
      <Form {...payosForm}>
        <form onSubmit={payosForm.handleSubmit((v) => payosMutation.mutate(v))}>
          <Card>
            <CardHeader>
              <CardTitle>{t("botConfig_payos")}</CardTitle>
              <CardDescription>{t("botConfig_callbackUrl")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={payosForm.control} name="payos_client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_clientId")}</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payosForm.control} name="payos_api_key" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_supportLink")}</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.has_payos_api_key} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payosForm.control} name="payos_checksum_key" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_callbackUrl")}</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.has_payos_checksum_key} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={payosMutation.isPending} size="sm">
                {payosMutation.isPending ? t("saving") : t("botConfig_savePayos")}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* ── Card: Permissions & Channels ── */}
      <Form {...serverForm}>
        <form onSubmit={serverForm.handleSubmit((v) => serverMutation.mutate(v))}>
          <Card>
            <CardHeader>
              <CardTitle>{t("botConfig_channelsPerms")}</CardTitle>
              <CardDescription>{t("botConfig_adminRoleDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={serverForm.control} name="guild_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botStatus_servers")}</FormLabel>
                  <FormControl>
                    {guilds.length > 0 ? (
                      <DiscordSelect value={field.value} onChange={field.onChange} options={guilds} placeholder={t("botConfig_channelsPerms")} />
                    ) : (
                      <Input placeholder="ID server..." {...field} value={field.value || ""} />
                    )}
                  </FormControl>
                  <FormDescription>{t("botConfig_adminRoleDesc")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={serverForm.control} name="admin_role_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("botConfig_adminRole")}</FormLabel>
                  <FormControl>
                    {roles.length > 0 ? (
                      <DiscordSelect value={field.value} onChange={field.onChange} options={roles} placeholder={t("botConfig_adminRole")} />
                    ) : (
                      <Input placeholder={activeGuildId ? t("loading") : t("botConfig_channelsPerms")} disabled={!activeGuildId} {...field} value={field.value || ""} />
                    )}
                  </FormControl>
                  <FormDescription>{t("botConfig_adminRoleDesc")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { name: "don_hang_channel_id" as const, label: t("botConfig_orderChannel") },
                  { name: "feedback_channel_id" as const, label: t("botConfig_notifChannels") },
                  { name: "coupon_channel_id" as const, label: t("botConfig_notifChannels") },
                  { name: "bang_gia_channel_id" as const, label: t("botConfig_notifChannels") },
                  { name: "welcome_channel_id" as const, label: t("botConfig_welcomeChannel") },
                ].map(({ name, label }) => (
                  <FormField key={name} control={serverForm.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        {channels.length > 0 ? (
                          <DiscordSelect value={field.value} onChange={field.onChange} options={channels.map((c) => ({ id: c.id, name: `#${c.name}` }))} placeholder={t("channel")} />
                        ) : (
                          <Input placeholder={activeGuildId ? t("loading") : t("botConfig_channelsPerms")} disabled={!activeGuildId} {...field} value={field.value || ""} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <Button type="submit" disabled={serverMutation.isPending} size="sm">
                {serverMutation.isPending ? t("saving") : t("botConfig_saveChannels")}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </PageContainer>
  );
}
