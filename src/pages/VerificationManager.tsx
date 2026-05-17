import { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import {
  Users,
  Settings2,
  UserPlus,
  BarChart3,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Ban,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Play,
  Square,
  Palette,
  Lock,
  Globe,
  Eye,
  UserX,
  Clock,
  ArrowDownToLine,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Mail,
  Hash,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface VerifiedMember {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  email: string | null;
  ip_address: string | null;
  roles: string[];
  verified_at: string;
  last_seen: string;
  is_blacklisted: boolean;
  risk_score: number;
}

interface MembersResponse {
  total: number;
  page: number;
  per_page: number;
  members: VerifiedMember[];
}

interface VerificationConfig {
  enabled: boolean;
  verified_role_id: string;
  unverified_role_id: string;
  verify_channel_id: string;
  log_channel_id: string;
  page_title: string;
  page_description: string;
  page_color: string;
  page_logo_url: string;
  page_background_url: string;
  button_text: string;
  success_message: string;
  captcha_enabled: boolean;
  min_account_age_days: number;
  block_vpn: boolean;
  kick_on_deauth: boolean;
  close_page_after_verify: boolean;
}

interface VerificationStats {
  total: number;
  today: number;
  this_week: number;
  blacklisted: number;
  pullable: number;
}

interface MemberPullStatus {
  active: boolean;
  id: number | null;
  status: string;
  total_members: number;
  pulled_members: number;
  failed_members: number;
  restore_roles: boolean;
  started_at: string | null;
  completed_at: string | null;
  log: PullLogEntry[];
}

interface PullLogEntry {
  discord_id: string;
  username: string;
  status: string;
  error?: string;
  timestamp: string;
}

interface PullHistoryItem {
  id: number;
  status: string;
  total_members: number;
  pulled_members: number;
  failed_members: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function riskBadge(score: number): { cls: string; label: string } {
  if (score >= 80) return { cls: "bg-red-500/15 text-red-600 border-red-500/30", label: "High" };
  if (score >= 40) return { cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", label: "Medium" };
  return { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Low" };
}

const DEFAULT_CONFIG: VerificationConfig = {
  enabled: false,
  verified_role_id: "",
  unverified_role_id: "",
  verify_channel_id: "",
  log_channel_id: "",
  page_title: "Verify Your Account",
  page_description: "Please verify your Discord account to gain access to the server.",
  page_color: "#5865F2",
  page_logo_url: "",
  page_background_url: "",
  button_text: "Verify with Discord",
  success_message: "You have been verified successfully!",
  captcha_enabled: false,
  min_account_age_days: 0,
  block_vpn: false,
  kick_on_deauth: false,
  close_page_after_verify: false,
};

// ── API ────────────────────────────────────────────────────────────────────

async function fetchMembers(
  page: number,
  perPage: number,
  search: string,
  blacklisted?: boolean
): Promise<MembersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    search,
  });
  if (blacklisted !== undefined) params.set("blacklisted", String(blacklisted));
  const res = await apiFetch(`/api/verification/members?${params}`);
  if (!res.ok) throw new Error("Failed to load members");
  return res.json();
}

async function fetchMemberDetail(id: number): Promise<VerifiedMember> {
  const res = await apiFetch(`/api/verification/members/${id}`);
  if (!res.ok) throw new Error("Failed to load member");
  return res.json();
}

async function blacklistMember(id: number, blacklisted: boolean): Promise<void> {
  const res = await apiFetch(`/api/verification/members/${id}/blacklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blacklisted }),
  });
  if (!res.ok) throw new Error("Failed to update blacklist");
}

async function deleteMember(id: number): Promise<void> {
  const res = await apiFetch(`/api/verification/members/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete member");
}

async function fetchConfig(): Promise<VerificationConfig> {
  const res = await apiFetch("/api/verification/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function updateConfig(data: VerificationConfig): Promise<VerificationConfig> {
  const res = await apiFetch("/api/verification/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save config");
  return res.json();
}

async function fetchStats(): Promise<VerificationStats> {
  const res = await apiFetch("/api/verification/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

async function startPull(data: { restore_roles: boolean; join_delay_seconds: number }): Promise<void> {
  const res = await apiFetch("/api/member-pull/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to start pull");
}

async function stopPull(): Promise<void> {
  const res = await apiFetch("/api/member-pull/stop", { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop pull");
}

async function fetchPullStatus(): Promise<MemberPullStatus> {
  const res = await apiFetch("/api/member-pull/status");
  if (!res.ok) throw new Error("Failed to load pull status");
  return res.json();
}

async function fetchPullHistory(): Promise<PullHistoryItem[]> {
  const res = await apiFetch("/api/member-pull/history");
  if (!res.ok) throw new Error("Failed to load pull history");
  return res.json();
}

// ── Component ──────────────────────────────────────────────────────────────

export function VerificationManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Members tab state ──
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<VerifiedMember | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const perPage = 50;

  // ── Config tab state ──
  const [configForm, setConfigForm] = useState<VerificationConfig | null>(null);

  // ── Pull tab state ──
  const [pullRestoreRoles, setPullRestoreRoles] = useState(true);
  const [pullDelay, setPullDelay] = useState(5);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ──
  const membersQuery = useQuery({
    queryKey: ["verification-members", memberPage, memberSearch],
    queryFn: () => fetchMembers(memberPage, perPage, memberSearch),
  });

  const configQuery = useQuery({
    queryKey: ["verification-config"],
    queryFn: fetchConfig,
  });

  const statsQuery = useQuery({
    queryKey: ["verification-stats"],
    queryFn: fetchStats,
  });

  const pullStatusQuery = useQuery({
    queryKey: ["member-pull-status"],
    queryFn: fetchPullStatus,
    refetchInterval: 3000,
  });

  const pullHistoryQuery = useQuery({
    queryKey: ["member-pull-history"],
    queryFn: fetchPullHistory,
  });

  // Initialize config form
  useEffect(() => {
    if (configQuery.data && !configForm) {
      setConfigForm(configQuery.data);
    }
  }, [configQuery.data, configForm]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pullStatusQuery.data?.log?.length]);

  // ── Mutations ──
  const blacklistMutation = useMutation({
    mutationFn: ({ id, blacklisted }: { id: number; blacklisted: boolean }) =>
      blacklistMember(id, blacklisted),
    onSuccess: () => {
      toast({ title: "Member updated" });
      qc.invalidateQueries({ queryKey: ["verification-members"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMemberMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      toast({ title: "Member deleted" });
      setMemberDetailOpen(false);
      setSelectedMember(null);
      qc.invalidateQueries({ queryKey: ["verification-members"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      qc.invalidateQueries({ queryKey: ["verification-config"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startPullMutation = useMutation({
    mutationFn: startPull,
    onSuccess: () => {
      toast({ title: "Member pull started" });
      qc.invalidateQueries({ queryKey: ["member-pull-status"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stopPullMutation = useMutation({
    mutationFn: stopPull,
    onSuccess: () => {
      toast({ title: "Member pull stopped" });
      qc.invalidateQueries({ queryKey: ["member-pull-status"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──
  async function openMemberDetail(m: VerifiedMember) {
    setSelectedMember(m);
    setMemberDetailOpen(true);
  }

  function handleSaveConfig() {
    if (!configForm) return;
    configMutation.mutate(configForm);
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="pull" className="gap-1.5">
            <ArrowDownToLine className="h-4 w-4" />
            Member Pull
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        {/* ── Members Tab ── */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Verified Members</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Manage members who have verified their accounts.
              </p>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or IP..."
                value={memberSearch}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setMemberSearch(e.target.value);
                  setMemberPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          {membersQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !membersQuery.data?.members.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No members found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {memberSearch ? "Try a different search term." : "Members will appear here once they verify."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Username</TableHead>
                      <TableHead className="hidden md:table-cell">Discord ID</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead className="hidden xl:table-cell">IP</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="hidden md:table-cell">Verified</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersQuery.data.members.map((m) => {
                      const risk = riskBadge(m.risk_score);
                      return (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer"
                          onClick={() => openMemberDetail(m)}
                        >
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              {m.avatar ? (
                                <AvatarImage src={m.avatar} alt={m.username} />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {m.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {m.username}
                              {m.is_blacklisted && (
                                <Ban className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-mono">
                            {m.discord_id}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                            {m.email || "—"}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-muted-foreground text-xs font-mono">
                            {m.ip_address || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {m.roles.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {formatDate(m.verified_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${risk.cls}`}>
                              {risk.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  blacklistMutation.mutate({
                                    id: m.id,
                                    blacklisted: !m.is_blacklisted,
                                  })
                                }
                                title={m.is_blacklisted ? "Unblacklist" : "Blacklist"}
                              >
                                {m.is_blacklisted ? (
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteMemberMutation.mutate(m.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {membersQuery.data.total} member{membersQuery.data.total !== 1 ? "s" : ""} total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={memberPage <= 1}
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {memberPage} of {Math.max(1, Math.ceil(membersQuery.data.total / perPage))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={memberPage >= Math.ceil(membersQuery.data.total / perPage)}
                    onClick={() => setMemberPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Configuration Tab ── */}
        <TabsContent value="config" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Verification Configuration</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure how members verify their accounts and customize the verification page.
            </p>
          </div>

          {configQuery.isLoading || !configForm ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enable toggle */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Enable Verification</Label>
                      <p className="text-sm text-muted-foreground">
                        Require members to verify before accessing the server
                      </p>
                    </div>
                    <Switch
                      checked={configForm.enabled}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, enabled: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Role & Channel Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Roles & Channels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Verified Role ID</Label>
                      <Input
                        placeholder="e.g. 1234567890"
                        value={configForm.verified_role_id}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, verified_role_id: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Role assigned after verification</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unverified Role ID</Label>
                      <Input
                        placeholder="e.g. 1234567890"
                        value={configForm.unverified_role_id}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, unverified_role_id: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">Role assigned before verification</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Verify Channel ID</Label>
                      <Input
                        placeholder="e.g. 1234567890"
                        value={configForm.verify_channel_id}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, verify_channel_id: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Log Channel ID</Label>
                      <Input
                        placeholder="e.g. 1234567890"
                        value={configForm.log_channel_id}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, log_channel_id: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Branding */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Verification Page Branding
                  </CardTitle>
                  <CardDescription>Customize the look and feel of the verification page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Page Title</Label>
                      <Input
                        value={configForm.page_title}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, page_title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Button Text</Label>
                      <Input
                        value={configForm.button_text}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, button_text: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Page Description</Label>
                    <Input
                      value={configForm.page_description}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, page_description: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Success Message</Label>
                    <Input
                      value={configForm.success_message}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, success_message: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={configForm.page_color}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setConfigForm({ ...configForm, page_color: e.target.value })
                          }
                          className="h-9 w-12 rounded border cursor-pointer"
                        />
                        <Input
                          value={configForm.page_color}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setConfigForm({ ...configForm, page_color: e.target.value })
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo URL</Label>
                      <Input
                        placeholder="https://..."
                        value={configForm.page_logo_url}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setConfigForm({ ...configForm, page_logo_url: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Background Image URL</Label>
                    <Input
                      placeholder="https://..."
                      value={configForm.page_background_url}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, page_background_url: e.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">CAPTCHA Verification</Label>
                      <p className="text-xs text-muted-foreground">Require CAPTCHA before Discord OAuth</p>
                    </div>
                    <Switch
                      checked={configForm.captcha_enabled}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, captcha_enabled: v })}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Minimum Account Age (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={configForm.min_account_age_days}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, min_account_age_days: Number(e.target.value) })
                      }
                      className="max-w-[200px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Discord accounts younger than this will be rejected. Set to 0 to disable.
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Block VPN/Proxy</Label>
                      <p className="text-xs text-muted-foreground">Reject verification from VPN or proxy connections</p>
                    </div>
                    <Switch
                      checked={configForm.block_vpn}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, block_vpn: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Kick on De-auth</Label>
                      <p className="text-xs text-muted-foreground">Kick members who remove their Discord authorization</p>
                    </div>
                    <Switch
                      checked={configForm.kick_on_deauth}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, kick_on_deauth: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Close Page After Verify</Label>
                      <p className="text-xs text-muted-foreground">Automatically close the verification page after successful verification</p>
                    </div>
                    <Switch
                      checked={configForm.close_page_after_verify}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, close_page_after_verify: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveConfig}
                  disabled={configMutation.isPending}
                  className="gap-1.5"
                >
                  {configMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Member Pull Tab ── */}
        <TabsContent value="pull" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Member Pull</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Pull verified members back into the Discord server.
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2.5">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pullable Members</p>
                  <p className="text-2xl font-bold">{statsQuery.data?.pullable ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Pull Status</p>
                  <p className="text-2xl font-bold capitalize">
                    {pullStatusQuery.data?.status?.replace("_", " ") ?? "None"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Start pull controls */}
          {!pullStatusQuery.data?.active && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Start Member Pull</CardTitle>
                <CardDescription>
                  Pull all verified members back into the Discord server with a join delay to avoid rate limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Restore Roles</Label>
                    <p className="text-xs text-muted-foreground">Re-assign roles to pulled members</p>
                  </div>
                  <Switch
                    checked={pullRestoreRoles}
                    onCheckedChange={setPullRestoreRoles}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Join Delay</Label>
                    <span className="text-sm text-muted-foreground">{pullDelay} seconds</span>
                  </div>
                  <Slider
                    value={[pullDelay]}
                    onValueChange={([v]) => setPullDelay(v)}
                    min={1}
                    max={30}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay between each member join to avoid Discord rate limits
                  </p>
                </div>

                <Button
                  onClick={() => startPullMutation.mutate({ restore_roles: pullRestoreRoles, join_delay_seconds: pullDelay })}
                  disabled={startPullMutation.isPending}
                  className="gap-1.5"
                >
                  {startPullMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Start Pull
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Active pull progress */}
          {pullStatusQuery.data?.active && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    Pull in Progress
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => stopPullMutation.mutate()}
                    disabled={stopPullMutation.isPending}
                    className="gap-1.5"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {pullStatusQuery.data.pulled_members} / {pullStatusQuery.data.total_members} members
                    </span>
                    <span className="text-muted-foreground">
                      {pullStatusQuery.data.total_members > 0
                        ? Math.round(
                            (pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      pullStatusQuery.data.total_members > 0
                        ? (pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100
                        : 0
                    }
                  />
                  {pullStatusQuery.data.failed_members > 0 && (
                    <p className="text-xs text-destructive">
                      {pullStatusQuery.data.failed_members} failed
                    </p>
                  )}
                </div>

                {/* Live log */}
                {pullStatusQuery.data.log.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Live Log</Label>
                    <ScrollArea className="h-48 rounded-lg border bg-muted/30 p-2">
                      {pullStatusQuery.data.log.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs py-0.5 font-mono"
                        >
                          <span className="text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="font-medium">{entry.username}</span>
                          {entry.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          {entry.error && (
                            <span className="text-destructive">— {entry.error}</span>
                          )}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pull history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pull History</CardTitle>
            </CardHeader>
            <CardContent>
              {pullHistoryQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !pullHistoryQuery.data?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pull history yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pulled</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pullHistoryQuery.data.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-sm">
                          {formatDate(h.started_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              h.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                : h.status === "failed"
                                ? "bg-red-500/15 text-red-600 border-red-500/30"
                                : "bg-blue-500/15 text-blue-600 border-blue-500/30"
                            }
                          >
                            {h.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{h.pulled_members}</TableCell>
                        <TableCell>{h.failed_members}</TableCell>
                        <TableCell>{h.total_members}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Statistics Tab ── */}
        <TabsContent value="stats" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Verification Statistics</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of verification activity and member status.
            </p>
          </div>

          {statsQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : statsQuery.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2.5">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Verified</p>
                    <p className="text-2xl font-bold">{statsQuery.data.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Today</p>
                    <p className="text-2xl font-bold">{statsQuery.data.today}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2.5">
                    <Clock className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold">{statsQuery.data.this_week}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2.5">
                    <Ban className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Blacklisted</p>
                    <p className="text-2xl font-bold">{statsQuery.data.blacklisted}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2.5">
                    <ArrowDownToLine className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pullable</p>
                    <p className="text-2xl font-bold">{statsQuery.data.pullable}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* ── Member Detail Dialog ── */}
      <Dialog open={memberDetailOpen} onOpenChange={setMemberDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
            <DialogDescription>Detailed information about this verified member.</DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {selectedMember.avatar ? (
                    <AvatarImage src={selectedMember.avatar} alt={selectedMember.username} />
                  ) : null}
                  <AvatarFallback className="text-lg">
                    {selectedMember.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedMember.username}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selectedMember.discord_id}</p>
                  {selectedMember.is_blacklisted && (
                    <Badge variant="outline" className="mt-1 bg-red-500/15 text-red-600 border-red-500/30">
                      <Ban className="h-3 w-3 mr-1" /> Blacklisted
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate">{selectedMember.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">IP:</span>
                  <span className="font-mono text-xs">{selectedMember.ip_address || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Verified:</span>
                  <span>{formatDate(selectedMember.verified_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last seen:</span>
                  <span>{formatDate(selectedMember.last_seen)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Risk:</span>
                  <Badge variant="outline" className={riskBadge(selectedMember.risk_score).cls}>
                    {selectedMember.risk_score} — {riskBadge(selectedMember.risk_score).label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Roles:</span>
                  <Badge variant="outline">{selectedMember.roles.length}</Badge>
                </div>
              </div>

              {selectedMember.roles.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role IDs</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedMember.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs font-mono">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedMember && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    blacklistMutation.mutate({
                      id: selectedMember.id,
                      blacklisted: !selectedMember.is_blacklisted,
                    })
                  }
                  className="gap-1.5"
                >
                  {selectedMember.is_blacklisted ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Unblacklist
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" /> Blacklist
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMemberMutation.mutate(selectedMember.id)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
