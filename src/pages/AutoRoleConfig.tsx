import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { UserPlus, Bot } from "lucide-react";

interface AutoRoleData {
  join_roles: string[];
  bot_roles: string[];
}

async function fetchAutoRole(): Promise<AutoRoleData> {
  const res = await fetch("/api/welcome/autorole", { credentials: "include" });
  if (!res.ok) throw new Error("Tải cấu hình thất bại");
  return res.json();
}

async function saveAutoRole(data: AutoRoleData): Promise<{ ok: boolean }> {
  const res = await fetch("/api/welcome/autorole", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Lưu thất bại");
  return res.json();
}

export function AutoRoleConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["autorole"],
    queryFn: fetchAutoRole,
    staleTime: 60_000,
  });

  const [joinRoles, setJoinRoles] = useState<string[]>([]);
  const [botRoles, setBotRoles] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setJoinRoles(data.join_roles ?? []);
      setBotRoles(data.bot_roles ?? []);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => saveAutoRole({ join_roles: joinRoles, bot_roles: botRoles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autorole"] });
      toast({ title: "Đã lưu", description: "Cấu hình Auto Role đã được cập nhật." });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể lưu cấu hình.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Auto Role</h2>
        <p className="text-muted-foreground">
          Tự động gán role cho thành viên mới khi tham gia server.
        </p>
      </div>

      {/* Join roles card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4" /> Role cho thành viên
          </CardTitle>
          <CardDescription>
            Các role sẽ được gán tự động khi thành viên mới tham gia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={joinRoles}
            onChange={setJoinRoles}
            placeholder="Chọn roles cho thành viên..."
          />
        </CardContent>
      </Card>

      {/* Bot roles card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" /> Role cho bot
          </CardTitle>
          <CardDescription>
            Các role sẽ được gán khi bot mới được thêm vào server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={botRoles}
            onChange={setBotRoles}
            placeholder="Chọn roles cho bot..."
          />
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </div>
  );
}
