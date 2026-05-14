import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

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
  if (!res.ok) throw new Error("Lưu thất bại");
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
  savedValue?: string | null;
}) {
  return (
    <div className="space-y-1">
      <Input
        type="password"
        placeholder={savedValue ? "••••••••  (đã cấu hình)" : placeholder}
        {...field}
        value={field.value || ""}
        autoComplete="new-password"
      />
      {savedValue && !field.value && (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Đã cấu hình — để trống nếu không muốn thay đổi</p>
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
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then((r) => r.json()),
  });

  // ── Form: Discord Bot ──
  const discordForm = useForm<DiscordValues>({
    resolver: zodResolver(discordSchema),
    defaultValues: { discord_token: "", discord_client_id: "", discord_client_secret: "" },
  });
  useEffect(() => { if (config) discordForm.reset({ discord_token: config.discord_token || "", discord_client_id: config.discord_client_id || "", discord_client_secret: config.discord_client_secret || "" }); }, [config]);

  // ── Form: PayOS ──
  const payosForm = useForm<PayosValues>({
    resolver: zodResolver(payosSchema),
    defaultValues: { payos_client_id: "", payos_api_key: "", payos_checksum_key: "" },
  });
  useEffect(() => { if (config) payosForm.reset({ payos_client_id: config.payos_client_id || "", payos_api_key: config.payos_api_key || "", payos_checksum_key: config.payos_checksum_key || "" }); }, [config]);

  // ── Form: Server & Channels ── (must be before queries that watch it)
  const serverForm = useForm<ServerValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: { guild_id: "", admin_role_id: "", don_hang_channel_id: "", feedback_channel_id: "", coupon_channel_id: "", bang_gia_channel_id: "" },
  });
  useEffect(() => { if (config) serverForm.reset({ guild_id: config.guild_id || "", admin_role_id: config.admin_role_id || "", don_hang_channel_id: config.don_hang_channel_id || "", feedback_channel_id: config.feedback_channel_id || "", coupon_channel_id: config.coupon_channel_id || "", bang_gia_channel_id: config.bang_gia_channel_id || "" }); }, [config]);

  const { data: guilds = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_guilds"],
    queryFn: () => fetch("/api/discord/guilds", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.discord_token,
    retry: false,
  });

  // Watch selected guild_id from form to load channels/roles immediately on selection
  const selectedGuildId = serverForm.watch("guild_id");
  const activeGuildId = selectedGuildId || config?.guild_id;

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_channels", activeGuildId],
    queryFn: () => fetch(`/api/discord/channels?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.discord_token && !!activeGuildId,
    retry: false,
  });

  const { data: roles = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_roles", activeGuildId],
    queryFn: () => fetch(`/api/discord/roles?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.discord_token && !!activeGuildId,
    retry: false,
  });

  // ── Mutations ──
  const makeToast = (label: string) => ({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config"] }); toast({ title: "Đã lưu", description: `Cấu hình ${label} đã được lưu.` }); },
    onError: () => { toast({ variant: "destructive", title: "Lỗi", description: "Lưu thất bại." }); },
  });

  const discordMutation = useMutation({ mutationFn: (v: DiscordValues) => savePartial(v), ...makeToast("Discord Bot") });
  const payosMutation = useMutation({ mutationFn: (v: PayosValues) => savePartial(v), ...makeToast("PayOS") });
  const serverMutation = useMutation({
    mutationFn: (v: ServerValues) => savePartial(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["discord_channels"] });
      queryClient.invalidateQueries({ queryKey: ["discord_roles"] });
      toast({ title: "Đã lưu", description: "Cấu hình phân quyền & kênh đã được lưu." });
    },
    onError: () => { toast({ variant: "destructive", title: "Lỗi", description: "Lưu thất bại." }); },
  });

  // ── Temp Voice ──
  const [tvEnabled, setTvEnabled] = useState(false);
  const [tvJoinChannel, setTvJoinChannel] = useState("");
  const [tvCategory, setTvCategory] = useState("");

  const { data: tvConfig } = useQuery({
    queryKey: ["tempvoice_config"],
    queryFn: () => fetch("/api/tempvoice/config", { credentials: "include" }).then((r) => r.json()),
  });
  useEffect(() => {
    if (tvConfig) {
      setTvEnabled(tvConfig.enabled ?? false);
      setTvJoinChannel(tvConfig.join_channel_id || "");
      setTvCategory(tvConfig.category_id || "");
    }
  }, [tvConfig]);

  const { data: allChannels = [] } = useQuery<{ id: string; name: string; type: number }[]>({
    queryKey: ["discord_channels_all", activeGuildId],
    queryFn: () => fetch(`/api/discord/channels/all?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!config?.discord_token && !!activeGuildId,
    retry: false,
  });

  const tvCategories = allChannels.filter((c) => c.type === 4);
  const tvVoiceChannels = allChannels.filter((c) => c.type === 2);

  const tvMutation = useMutation({
    mutationFn: () =>
      fetch("/api/tempvoice/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: tvEnabled, join_channel_id: tvJoinChannel, category_id: tvCategory }),
      }).then((r) => { if (!r.ok) throw new Error("Lưu thất bại"); return r.json(); }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tempvoice_config"] }); toast({ title: "Đã lưu", description: "Cấu hình Temp Voice đã được lưu." }); },
    onError: () => { toast({ variant: "destructive", title: "Lỗi", description: "Lưu thất bại." }); },
  });

  if (isLoading) return <div>Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cấu hình Hệ thống</h1>
        <p className="text-muted-foreground">Thiết lập token và các khóa API cần thiết.</p>
      </div>

      {/* ── Card: Discord Bot ── */}
      <Form {...discordForm}>
        <form onSubmit={discordForm.handleSubmit((v) => discordMutation.mutate(v))}>
          <Card>
            <CardHeader>
              <CardTitle>Discord Bot</CardTitle>
              <CardDescription>Token và OAuth để kết nối Discord.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={discordForm.control} name="discord_token" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Token</FormLabel>
                  <FormControl>
                    <MaskedField field={field} placeholder="MTC..." savedValue={config?.discord_token} />
                  </FormControl>
                  <FormDescription>Lấy từ Discord Developer Portal.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={discordForm.control} name="discord_client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>OAuth Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""}
                      placeholder={config?.discord_client_id ? `${config.discord_client_id.slice(0, 6)}...  (đã cấu hình)` : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={discordForm.control} name="discord_client_secret" render={({ field }) => (
                <FormItem>
                  <FormLabel>OAuth Client Secret</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.discord_client_secret} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={discordMutation.isPending} size="sm">
                {discordMutation.isPending ? "Đang lưu..." : "Lưu Discord"}
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
              <CardTitle>PayOS (Thanh toán)</CardTitle>
              <CardDescription>Cấu hình cổng thanh toán tạo mã QR.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={payosForm.control} name="payos_client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payosForm.control} name="payos_api_key" render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.payos_api_key} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payosForm.control} name="payos_checksum_key" render={({ field }) => (
                <FormItem>
                  <FormLabel>Checksum Key</FormLabel>
                  <FormControl>
                    <MaskedField field={field} savedValue={config?.payos_checksum_key} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={payosMutation.isPending} size="sm">
                {payosMutation.isPending ? "Đang lưu..." : "Lưu PayOS"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* ── Card: Phân quyền & Kênh ── */}
      <Form {...serverForm}>
        <form onSubmit={serverForm.handleSubmit((v) => serverMutation.mutate(v))}>
          <Card>
            <CardHeader>
              <CardTitle>Phân quyền & Kênh</CardTitle>
              <CardDescription>Chọn Server, Role Admin và các kênh thông báo. Cần nhập Bot Token trước.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={serverForm.control} name="guild_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Server (Guild)</FormLabel>
                  <FormControl>
                    {guilds.length > 0 ? (
                      <DiscordSelect value={field.value} onChange={field.onChange} options={guilds} placeholder="Chọn server..." />
                    ) : (
                      <Input placeholder="ID server..." {...field} value={field.value || ""} />
                    )}
                  </FormControl>
                  <FormDescription>Bot phải có trong server này.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={serverForm.control} name="admin_role_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Role</FormLabel>
                  <FormControl>
                    {roles.length > 0 ? (
                      <DiscordSelect value={field.value} onChange={field.onChange} options={roles} placeholder="Chọn role..." />
                    ) : (
                      <Input placeholder={activeGuildId ? "Đang tải roles..." : "Chọn Server trước"} disabled={!activeGuildId} {...field} value={field.value || ""} />
                    )}
                  </FormControl>
                  <FormDescription>User có role này sẽ được login.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { name: "don_hang_channel_id" as const, label: "Kênh Đơn hàng" },
                  { name: "feedback_channel_id" as const, label: "Kênh Feedback" },
                  { name: "coupon_channel_id" as const, label: "Kênh Coupon" },
                  { name: "bang_gia_channel_id" as const, label: "Kênh Bảng giá" },
                ].map(({ name, label }) => (
                  <FormField key={name} control={serverForm.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        {channels.length > 0 ? (
                          <DiscordSelect value={field.value} onChange={field.onChange} options={channels.map((c) => ({ id: c.id, name: `#${c.name}` }))} placeholder="Chọn kênh..." />
                        ) : (
                          <Input placeholder={activeGuildId ? "Đang tải kênh..." : "Chọn Server trước"} disabled={!activeGuildId} {...field} value={field.value || ""} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <Button type="submit" disabled={serverMutation.isPending} size="sm">
                {serverMutation.isPending ? "Đang lưu..." : "Lưu Phân quyền & Kênh"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* ── Card: Temp Voice ── */}
      <Card>
        <CardHeader>
          <CardTitle>🎙 Temp Voice</CardTitle>
          <CardDescription>Khi user join kênh này, bot tự tạo voice room riêng cho họ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Bật tính năng</p>
              <p className="text-sm text-muted-foreground">Kích hoạt tự động tạo voice room.</p>
            </div>
            <Switch checked={tvEnabled} onCheckedChange={setTvEnabled} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            {tvCategories.length > 0 ? (
              <DiscordSelect value={tvCategory} onChange={setTvCategory} options={tvCategories.map((c) => ({ id: c.id, name: c.name }))} placeholder="Chọn category..." />
            ) : (
              <Input placeholder={activeGuildId ? "Đang tải categories..." : "Chọn Server trước"} disabled={!activeGuildId} value={tvCategory} onChange={(e) => setTvCategory(e.target.value)} />
            )}
            <p className="text-xs text-muted-foreground">Voice room sẽ được tạo trong category này.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Kênh "Join to Create"</label>
            {tvVoiceChannels.length > 0 ? (
              <DiscordSelect value={tvJoinChannel} onChange={setTvJoinChannel} options={tvVoiceChannels.map((c) => ({ id: c.id, name: `🔊 ${c.name}` }))} placeholder="Chọn kênh voice..." />
            ) : (
              <Input placeholder={activeGuildId ? "Đang tải voice channels..." : "Chọn Server trước"} disabled={!activeGuildId} value={tvJoinChannel} onChange={(e) => setTvJoinChannel(e.target.value)} />
            )}
            <p className="text-xs text-muted-foreground">User join kênh này → bot tạo room riêng.</p>
          </div>
          <Button onClick={() => tvMutation.mutate()} disabled={tvMutation.isPending} size="sm">
            {tvMutation.isPending ? "Đang lưu..." : "Lưu Temp Voice"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
