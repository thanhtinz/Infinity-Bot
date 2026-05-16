import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserCheck2, Save, UserX } from "lucide-react";
import { ChannelSelect } from "@/components/ChannelSelect";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClaimConfig {
  enabled: boolean;
  exclusive: boolean;
  notify: boolean;
  notify_channel_id?: string;
}

interface ClaimedTicket {
  id: number;
  subject?: string;
  claimed_by?: string;
  claimed_at?: string;
  status: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketClaiming() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Config state ──
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [cfgExclusive, setCfgExclusive] = useState(false);
  const [cfgNotify, setCfgNotify] = useState(false);
  const [cfgNotifyChannel, setCfgNotifyChannel] = useState("");
  const [configSynced, setConfigSynced] = useState(false);

  // ── Queries ──
  const { data: claimConfig, isLoading: configLoading } = useQuery<ClaimConfig>({
    queryKey: ["ticket-claim-config"],
    queryFn: () => apiFetch("/api/ticket-claim-config").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const { data: claimedTickets, isLoading: ticketsLoading } = useQuery<ClaimedTicket[]>({
    queryKey: ["tickets-claimed"],
    queryFn: () => apiFetch("/api/tickets?claimed=true").then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  // Sync config on load
  if (claimConfig && !configSynced) {
    setCfgEnabled(claimConfig.enabled);
    setCfgExclusive(claimConfig.exclusive);
    setCfgNotify(claimConfig.notify);
    setCfgNotifyChannel(claimConfig.notify_channel_id ?? "");
    setConfigSynced(true);
  }

  // ── Mutations ──
  const saveConfigMutation = useMutation({
    mutationFn: (payload: ClaimConfig) =>
      apiFetch("/api/ticket-claim-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-claim-config"] });
      toast({ title: "Claiming settings saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const unclaimMutation = useMutation({
    mutationFn: (ticketId: number) =>
      fetch(`/api/tickets/${ticketId}/unclaim`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-claimed"] });
      toast({ title: "Claim released" });
    },
    onError: () => toast({ title: "Unclaim failed", variant: "destructive" }),
  });

  // ── Stats ──
  const totalClaimed = claimedTickets?.length ?? 0;
  const inProgress = claimedTickets?.filter((t) => t.status === "open").length ?? 0;
  const resolved = claimedTickets?.filter((t) => t.status === "closed").length ?? 0;

  // ── Render ──
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <UserCheck2 className="w-6 h-6" /> Claiming & Assignment
      </h1>

      {/* ── Config Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings Claiming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {configLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 rounded" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable claiming</Label>
                  <p className="text-xs text-muted-foreground">Staff can claim a ticket to take responsibility for it</p>
                </div>
                <Switch checked={cfgEnabled} onCheckedChange={setCfgEnabled} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Only claimer can reply</Label>
                  <p className="text-xs text-muted-foreground">Prevent other staff from sending messages in a claimed ticket</p>
                </div>
                <Switch checked={cfgExclusive} onCheckedChange={setCfgExclusive} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Notify on claim</Label>
                  <p className="text-xs text-muted-foreground">Send a notification when a ticket is claimed</p>
                </div>
                <Switch checked={cfgNotify} onCheckedChange={setCfgNotify} />
              </div>

              {cfgNotify && (
                <div className="space-y-2">
                  <Label>Claim notification channel</Label>
                  <ChannelSelect
                    filter="text"
                    value={cfgNotifyChannel}
                    onChange={(v) => setCfgNotifyChannel(v === "__clear__" ? "" : v)}
                    placeholder="Select notification channel..."
                  />
                </div>
              )}

              <Button
                size="sm"
                disabled={saveConfigMutation.isPending}
                onClick={() =>
                  saveConfigMutation.mutate({
                    enabled: cfgEnabled,
                    exclusive: cfgExclusive,
                    notify: cfgNotify,
                    notify_channel_id: cfgNotifyChannel || undefined,
                  })
                }
              >
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Stats Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total claimed</p>
            <p className="text-2xl font-bold">{totalClaimed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-500">{inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Resolved</p>
            <p className="text-2xl font-bold text-green-500">{resolved}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Claimed Tickets Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currently claimed tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : !claimedTickets?.length ? (
            <p className="text-center text-muted-foreground py-8">No tickets currently claimed</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Claimed by</TableHead>
                  <TableHead>Date claim</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimedTickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">#{t.id}</TableCell>
                    <TableCell>{t.subject || "—"}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.claimed_by || "—"}</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.claimed_at ? new Date(t.claimed_at).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={unclaimMutation.isPending}
                        onClick={() => unclaimMutation.mutate(t.id)}
                      >
                        <UserX className="w-4 h-4 mr-1" /> Unclaim
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
