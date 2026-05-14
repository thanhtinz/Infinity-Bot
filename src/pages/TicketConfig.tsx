import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

interface TicketConfig {
  id?: number;
  guild_id?: string;
  category_id?: string;
  log_channel_id?: string;
  support_role_ids?: string[];
  ticket_limit?: number;
  cooldown_minutes?: number;
  auto_close_hours?: number;
  naming_format?: string;
}

interface ConfigForm {
  support_role_ids: string;
  log_channel_id: string;
  category_id: string;
  ticket_limit: number;
  cooldown_minutes: number;
  auto_close_hours: number;
  naming_format: string;
}

const emptyForm = (): ConfigForm => ({
  support_role_ids: "",
  log_channel_id: "",
  category_id: "",
  ticket_limit: 3,
  cooldown_minutes: 5,
  auto_close_hours: 48,
  naming_format: "ticket-{number}",
});

export function TicketConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<ConfigForm>(emptyForm());

  const { data: config, isLoading } = useQuery<TicketConfig | null>({
    queryKey: ["ticket-config"],
    queryFn: () =>
      fetch("/api/ticket-config", { credentials: "include" }).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Không thể tải cấu hình");
        return r.json();
      }),
  });

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setForm({
        support_role_ids: Array.isArray(config.support_role_ids)
          ? config.support_role_ids.join(", ")
          : "",
        log_channel_id: config.log_channel_id ?? "",
        category_id: config.category_id ?? "",
        ticket_limit: config.ticket_limit ?? 3,
        cooldown_minutes: config.cooldown_minutes ?? 5,
        auto_close_hours: config.auto_close_hours ?? 48,
        naming_format: config.naming_format ?? "ticket-{number}",
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-config"] });
      toast({ title: "Đã lưu cấu hình ticket" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const handleSave = () => {
    const roleIds = form.support_role_ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    saveMutation.mutate({
      support_role_ids: roleIds,
      log_channel_id: form.log_channel_id || undefined,
      category_id: form.category_id || undefined,
      ticket_limit: form.ticket_limit,
      cooldown_minutes: form.cooldown_minutes,
      auto_close_hours: form.auto_close_hours,
      naming_format: form.naming_format || undefined,
    });
  };

  const setField = <K extends keyof ConfigForm>(field: K, value: ConfigForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-muted-foreground py-12">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Cấu hình Ticket
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cài đặt hệ thống ticket cho server
        </p>
      </div>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cài đặt chung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Role ID hỗ trợ (phân cách bằng dấu phẩy)</Label>
            <Textarea
              placeholder="Ví dụ: 123456789, 987654321"
              value={form.support_role_ids}
              onChange={(e) => setField("support_role_ids", e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Các role này sẽ có quyền xem và xử lý ticket.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label>Log Channel ID</Label>
              <Input
                placeholder="Nhập channel ID..."
                value={form.log_channel_id}
                onChange={(e) => setField("log_channel_id", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Channel ghi log khi ticket được tạo/đóng.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Category ID mặc định cho ticket</Label>
              <Input
                placeholder="Nhập category ID..."
                value={form.category_id}
                onChange={(e) => setField("category_id", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Channel ticket sẽ được tạo trong category này.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label>Số ticket tối đa / người</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.ticket_limit}
                onChange={(e) => setField("ticket_limit", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cooldown giữa các ticket (phút)</Label>
              <Input
                type="number"
                min={0}
                max={1440}
                value={form.cooldown_minutes}
                onChange={(e) => setField("cooldown_minutes", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tự động đóng sau (giờ, 0 = tắt)</Label>
              <Input
                type="number"
                min={0}
                max={720}
                value={form.auto_close_hours}
                onChange={(e) => setField("auto_close_hours", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Định dạng tên channel</Label>
            <Input
              placeholder="ticket-{number}"
              value={form.naming_format}
              onChange={(e) => setField("naming_format", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Hỗ trợ biến: {"{number}"}, {"{username}"}, {"{date}"}
            </p>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
