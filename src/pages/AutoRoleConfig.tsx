import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { UserPlus, Bot } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

interface AutoRoleData {
  join_roles: string[];
  bot_roles: string[];
}

async function fetchAutoRole(): Promise<AutoRoleData> {
  const res = await apiFetch("/api/welcome/autorole");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveAutoRole(data: AutoRoleData): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/welcome/autorole", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Save failed");
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
      toast({ title: "Saved", description: "Auto Role config updated." });
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
        <h2 className="text-2xl font-bold tracking-tight">Auto Role</h2>
        <p className="text-muted-foreground">
          Automatically assign roles to new members when they join.
        </p>
      </div>

      {/* Join roles card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4" /> Member roles
          </CardTitle>
          <CardDescription>
            These roles will be auto-assigned when new members join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={joinRoles}
            onChange={setJoinRoles}
            placeholder="Select member roles..."
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
            These roles will be assigned when a bot joins the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={botRoles}
            onChange={setBotRoles}
            placeholder="Select bot roles..."
          />
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving..." : "Save Config"}
      </Button>
    </div>
  );
}
