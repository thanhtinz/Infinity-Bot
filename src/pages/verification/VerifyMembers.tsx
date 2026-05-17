import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Trash2,
  ArrowRightLeft,
  Search,
  ShieldCheck,
  Ban,
  ChevronLeft,
  ChevronRight,
  Mail,
  Globe,
  Eye,
  AlertTriangle,
  Hash,
  Square,
  Loader2,
  Users,
} from "lucide-react";
import {
  fetchMembers,
  blacklistMember,
  deleteMember,
  deleteUnauthorized,
  transferMembers,
  fetchStats,
  startPull,
  stopPull,
  fetchPullStatus,
  formatDate,
  riskBadge,
} from "./shared";
import type { VerifiedMember } from "./shared";

export function VerifyMembers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<VerifiedMember | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [showDeauthorized, setShowDeauthorized] = useState(false);

  // Pull dialog
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [pullRestoreRoles, setPullRestoreRoles] = useState(true);
  const [pullDelay, setPullDelay] = useState(5);

  // Delete unauthorized dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Transfer dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferGuildId, setTransferGuildId] = useState("");

  const perPage = 50;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Debounced search ───────────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setMemberSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setMemberPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────
  const statsQuery = useQuery({
    queryKey: ["verification-stats"],
    queryFn: fetchStats,
  });

  const membersQuery = useQuery({
    queryKey: ["verification-members", memberPage, debouncedSearch, showDeauthorized],
    queryFn: () => fetchMembers(memberPage, perPage, debouncedSearch, showDeauthorized || undefined),
  });

  const pullStatusQuery = useQuery({
    queryKey: ["member-pull-status"],
    queryFn: fetchPullStatus,
    refetchInterval: 3000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
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

  const deleteUnauthorizedMutation = useMutation({
    mutationFn: deleteUnauthorized,
    onSuccess: (data) => {
      toast({ title: `Deleted ${data.deleted} unauthorized member${data.deleted !== 1 ? "s" : ""}` });
      setDeleteDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      qc.invalidateQueries({ queryKey: ["verification-stats"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: transferMembers,
    onSuccess: (data) => {
      toast({ title: `Transferred ${data.transferred} member${data.transferred !== 1 ? "s" : ""}`, description: `${data.skipped} skipped` });
      setTransferDialogOpen(false);
      setTransferGuildId("");
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      qc.invalidateQueries({ queryKey: ["verification-stats"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startPullMutation = useMutation({
    mutationFn: startPull,
    onSuccess: () => {
      toast({ title: "Member pull started" });
      setPullDialogOpen(false);
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

  // ── Helpers ────────────────────────────────────────────────────────────
  function openMemberDetail(m: VerifiedMember) {
    setSelectedMember(m);
    setMemberDetailOpen(true);
  }

  const pullActive = pullStatusQuery.data?.active ?? false;
  const pullProgress = pullStatusQuery.data
    ? pullStatusQuery.data.total_members > 0
      ? Math.round((pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100)
      : 0
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Action Buttons ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {pullActive ? (
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">
                  Pulling members… {pullStatusQuery.data?.pulled_members ?? 0}/{pullStatusQuery.data?.total_members ?? 0}
                </span>
                <span className="text-sm text-muted-foreground">{pullProgress}%</span>
              </div>
              <Progress value={pullProgress} className="h-2" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopPullMutation.mutate()}
              disabled={stopPullMutation.isPending}
              className="gap-1.5 shrink-0"
            >
              {stopPullMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setPullDialogOpen(true)}
            className="gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white"
            size="lg"
          >
            <RefreshCw className="h-4 w-4" />
            Pull members
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => setDeleteDialogOpen(true)}
          className="gap-2"
          size="lg"
        >
          <Trash2 className="h-4 w-4" />
          Delete Unauthorized
        </Button>

        <Button
          variant="outline"
          onClick={() => setTransferDialogOpen(true)}
          className="gap-2"
          size="lg"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer members
        </Button>
      </div>

      {/* ── Stats Card ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pullable:</span>
              <span className="text-lg font-bold text-emerald-500">
                {statsQuery.isLoading ? <Skeleton className="inline-block h-6 w-8" /> : statsQuery.data?.pullable ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Deauthorized:</span>
              <span className="text-lg font-bold text-orange-500">
                {statsQuery.isLoading ? <Skeleton className="inline-block h-6 w-8" /> : statsQuery.data?.deauthorized ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="text-lg font-bold">
                {statsQuery.isLoading ? <Skeleton className="inline-block h-6 w-8" /> : statsQuery.data?.total ?? 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeauthorized((prev) => !prev);
                setMemberPage(1);
              }}
              className="text-sm text-[#5865F2] hover:underline ml-auto"
            >
              {showDeauthorized ? "View all members" : "View deauthorized"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter Discord ID, username, IP address, or email"
            value={memberSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setDebouncedSearch(memberSearch);
            setMemberPage(1);
          }}
          className="gap-1.5 shrink-0"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      {/* ── Member Table ────────────────────────────────────────────────── */}
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
              {debouncedSearch ? "Try a different search term." : "Members will appear here once they verify."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discord ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="hidden md:table-cell">Verified</TableHead>
                  <TableHead className="hidden lg:table-cell">Risk</TableHead>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.discord_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {m.avatar ? (
                              <AvatarImage src={m.avatar} alt={m.username} />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {m.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{m.username}</span>
                          {m.is_blacklisted && (
                            <Ban className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDate(m.verified_at)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
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
                            onClick={() => openMemberDetail(m)}
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
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

      {/* ── Pull Members Dialog ─────────────────────────────────────────── */}
      <Dialog open={pullDialogOpen} onOpenChange={setPullDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pull Members</DialogTitle>
            <DialogDescription>
              Pull members from your Discord server into the verification database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Restore roles</Label>
                <p className="text-xs text-muted-foreground">Re-assign roles to returning members</p>
              </div>
              <Switch
                checked={pullRestoreRoles}
                onCheckedChange={setPullRestoreRoles}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Join delay</Label>
                <span className="text-sm text-muted-foreground">{pullDelay}s</span>
              </div>
              <Slider
                value={[pullDelay]}
                onValueChange={([v]) => setPullDelay(v)}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Delay between each member join (1–10 seconds)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPullDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                startPullMutation.mutate({
                  restore_roles: pullRestoreRoles,
                  join_delay_seconds: pullDelay,
                })
              }
              disabled={startPullMutation.isPending}
              className="gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white"
            >
              {startPullMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Start Pull
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Unauthorized Dialog ──────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Unauthorized Members</DialogTitle>
            <DialogDescription>
              This will permanently remove all deauthorized members from the database. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUnauthorizedMutation.mutate()}
              disabled={deleteUnauthorizedMutation.isPending}
              className="gap-1.5"
            >
              {deleteUnauthorizedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All Unauthorized
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Members Dialog ─────────────────────────────────────── */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Members</DialogTitle>
            <DialogDescription>
              Import verified members from another Discord server.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="transfer-guild-id">Source Server ID</Label>
            <Input
              id="transfer-guild-id"
              placeholder="Enter source guild ID"
              value={transferGuildId}
              onChange={(e) => setTransferGuildId(e.target.value)}
              className="font-mono"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => transferMutation.mutate(transferGuildId)}
              disabled={!transferGuildId.trim() || transferMutation.isPending}
              className="gap-1.5"
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Member Detail Dialog ────────────────────────────────────────── */}
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
