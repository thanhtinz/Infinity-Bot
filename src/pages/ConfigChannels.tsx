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
import { useGuild } from "@/contexts/GuildContext";

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => fetch("/api/config", {
      credentials: "include",
      headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
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
      fetch(`/api/discord/channels?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!activeGuildId,
    staleTime: 60_000,
  });

  const { data: roles = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_roles", activeGuildId],
    queryFn: () =>
      fetch(`/api/discord/roles?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    enabled: !!activeGuildId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {}),
      },
      credentials: "include",
      body: JSON.stringify(v),
    }).then(r => { if (!r.ok) throw new Error("Lưu thất bại"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["discord_channels"] });
      qc.invalidateQueries({ queryKey: ["discord_roles"] });
      toast({ title: "Saved", description: "Cấu hình kênh & quyền đã được lưu." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Lưu thất bại." }),
  });

  const channelFields: { name: keyof FormValues; label: string }[] = [
    { name: "don_hang_channel_id", label: "Kênh Đơn hàng" },
    { name: "feedback_channel_id", label: "Kênh Feedback" },
    { name: "coupon_channel_id", label: "Kênh Coupon" },
    { name: "bang_gia_channel_id", label: "Kênh Bảng giá" },
    { name: "welcome_channel_id", label: "Kênh Welcome" },
  ];

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Hash className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Kênh & Phân quyền</h1>
          <p className="text-sm text-muted-foreground">Chọn server, role admin và các kênh thông báo.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
          {/* Server & Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-4 h-4" /> Quyền Admin
              </CardTitle>
              <CardDescription>Cấu hình cho server đang chọn: <strong>{activeGuildId}</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="admin_role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Admin Dashboard</FormLabel>
                    <FormControl>
                      {roles.length > 0 ? (
                        <DiscordSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={roles}
                          placeholder="Select role..."
                        />
                      ) : (
                        <Input
                          placeholder={activeGuildId ? "Đang tải roles..." : "Select a server first"}
                          disabled={!activeGuildId}
                          {...field}
                          value={field.value || ""}
                        />
                      )}
                    </FormControl>
                    <FormDescription>User có role này mới được đăng nhập dashboard.</FormDescription>
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
                <Hash className="w-4 h-4" /> Kênh thông báo
              </CardTitle>
              <CardDescription>Bot will send notifications to these channels.</CardDescription>
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
                              placeholder="Select channel..."
                            />
                          ) : (
                            <Input
                              placeholder={activeGuildId ? "Đang tải kênh..." : "Select a server first"}
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
            {mutation.isPending ? "Saving..." : "Lưu cấu hình"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
