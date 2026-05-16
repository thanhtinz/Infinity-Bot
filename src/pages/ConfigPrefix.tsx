import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGuild } from "@/contexts/GuildContext";

export function ConfigPrefix() {
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
      toast({ title: "Saved", description: `Prefix changed to "${cmdPrefix}"` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save prefix." });
    },
  });

  if (isLoading) return <div>Loading config...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Command Prefix</h1>
            <p className="text-muted-foreground">Configure a custom prefix for message-based commands.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Command Prefix</CardTitle>
          <CardDescription>Example: !hug @user, .kiss @user. Slash commands still work normally.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2 flex-1 max-w-[220px]">
              <label className="text-sm font-medium">Prefix</label>
              <Input
                value={cmdPrefix}
                onChange={(e) => setCmdPrefix(e.target.value.slice(0, 5))}
                placeholder="!"
                className="font-mono text-lg"
              />
            </div>
            <Button onClick={() => prefixMutation.mutate()} disabled={prefixMutation.isPending} size="sm">
              {prefixMutation.isPending ? "Saving..." : "Save Prefix"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            With prefix <code className="bg-muted px-1 rounded">{cmdPrefix || "!"}</code>, users type <code className="bg-muted px-1 rounded">{cmdPrefix || "!"}hug @user</code> to run the prefix command.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
