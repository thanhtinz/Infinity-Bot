/**
 * VerifyMembersPage — layout matching VaultCord reference design.
 * - "Pull members" blue button → opens Pull Members dialog
 * - "Delete Unauthorized" + "Transfer members" full-width dark action buttons
 * - Stats card (Pullable / Deauthorized / Total) + "View deauthorized" → dialog
 * - Search + member table below
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDownToLine, Trash2, Search, Ban, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowRightLeft, Loader2,
  RefreshCw, Play, Square, Eye, Info, Share2, RotateCcw,
  Users,
} from "lucide-react";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  fetchMembers, fetchStats, blacklistMember, deleteMember,
  deleteUnauthorized, transferMembers, formatDate, riskBadge,
  startPull, stopPull, fetchPullStatus, fetchPullHistory,
} from "./shared";
import type { VerifiedMember } from "./shared";

const PER_PAGE = 20;

export function VerifyMembersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  // ── Dialog states ──
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [deauthDialogOpen, setDeauthDialogOpen] = useState(false);
  const [deleteUnauthorizedOpen, setDeleteUnauthorizedOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSource, setTransferSource] = useState("");
  const [selectedMember, setSelectedMember] = useState<VerifiedMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Pull form state ──
  const [pullDelay, setPullDelay] = useState(0);
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Members table state ──
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showBlacklisted, setShowBlacklisted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Queries ──
  const statsQuery = useQuery({ queryKey: ["verification-stats"], queryFn: fetchStats });

  const membersQuery = useQuery({
    queryKey: ["verification-members", page, PER_PAGE, debouncedSearch, showBlacklisted],
    queryFn: () => fetchMembers(page, PER_PAGE, debouncedSearch, showBlacklisted ? true : undefined),
    placeholderData: (prev) => prev,
  });

  // Deauthorized members = blacklisted filter as proxy, or use separate fetch if available
  const deauthQuery = useQuery({
    queryKey: ["verification-members-deauth"],
    queryFn: () => fetchMembers(1, 100, "", true),
    enabled: deauthDialogOpen,
  });

  const pullStatusQuery = useQuery({
    queryKey: ["member-pull-status"],
    queryFn: fetchPullStatus,
    refetchInterval: pullDialogOpen ? 3000 : false,
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pullStatusQuery.data?.log?.length]);

  // ── Mutations ──
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

  const blacklistMutation = useMutation({
    mutationFn: ({ id, blacklisted }: { id: number; blacklisted: boolean }) =>
      blacklistMember(id, blacklisted),
    onSuccess: (_, vars) => {
      toast({ title: vars.blacklisted ? "Member blacklisted" : "Member unblacklisted" });
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      setDetailOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => {
      toast({ title: "Member deleted" });
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      setDetailOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteUnauthorizedMutation = useMutation({
    mutationFn: deleteUnauthorized,
    onSuccess: (data) => {
      toast({ title: `Deleted ${data.deleted} unauthorized member(s)` });
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      setDeleteUnauthorizedOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: () => transferMembers(transferSource),
    onSuccess: (data) => {
      toast({ title: `Transferred ${data.transferred}, skipped ${data.skipped}` });
      qc.invalidateQueries({ queryKey: ["verification-members"] });
      setTransferDialogOpen(false);
      setTransferSource("");
    },
    onError: (err) => toast({ title: "Transfer failed", description: err.message, variant: "destructive" }),
  });

  const openDetail = useCallback((m: VerifiedMember) => {
    setSelectedMember(m);
    setDetailOpen(true);
  }, []);

  const totalPages = membersQuery.data ? Math.ceil(membersQuery.data.total / PER_PAGE) : 1;
  const pullActive = pullStatusQuery.data?.active ?? false;

  return (
    <div className="space-y-3 max-w-3xl">

      {/* ── Pull members button ── */}
      <div>
        <Button
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 text-base font-semibold rounded-xl"
          onClick={() => setPullDialogOpen(true)}
        >
          <ArrowDownToLine className="h-5 w-5" />
          Pull members
        </Button>
      </div>

      {/* ── Action buttons ── */}
      <button
        className="w-full flex items-center justify-center gap-3 bg-card hover:bg-muted/50 border border-border rounded-xl h-14 text-base font-semibold transition-colors"
        onClick={() => setDeleteUnauthorizedOpen(true)}
      >
        <Trash2 className="h-5 w-5" />
        Delete Unauthorized
      </button>

      <button
        className="w-full flex items-center justify-center gap-3 bg-card hover:bg-muted/50 border border-border rounded-xl h-14 text-base font-semibold transition-colors"
        onClick={() => setTransferDialogOpen(true)}
      >
        <ArrowRightLeft className="h-5 w-5" />
        Transfer members
      </button>

      {/* ── Stats card ── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 text-sm">
            {statsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div>
                  <span className="font-semibold">Pullable: </span>
                  <span className="text-muted-foreground">{statsQuery.data?.pullable ?? "—"}</span>
                </div>
                <div>
                  <span className="font-semibold">Deauthorized: </span>
                  <span className="text-muted-foreground">{statsQuery.data?.deauthorized ?? "—"}</span>
                </div>
                <div>
                  <span className="font-semibold">Pullable: </span>
                  <span className="text-muted-foreground">{statsQuery.data?.total ?? "—"}</span>
                </div>
              </>
            )}
          </div>
          <button
            className="text-blue-500 underline text-sm font-medium mt-0.5 hover:text-blue-400 transition-colors"
            onClick={() => setDeauthDialogOpen(true)}
          >
            View deauthorized
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Enter Discord ID, username, IP address, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent"
            onKeyDown={(e) => e.key === "Enter" && setDebouncedSearch(search)}
          />
          <Button
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 h-10 w-10 shrink-0"
            onClick={() => setDebouncedSearch(search)}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Search for a member with Discord ID/Username/IP/Email.
        </p>
      </div>

      {/* ── Show blacklisted toggle ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <Switch
          id="show-blacklisted"
          checked={showBlacklisted}
          onCheckedChange={(v) => { setShowBlacklisted(v); setPage(1); }}
        />
        <Label htmlFor="show-blacklisted">Blacklisted only</Label>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => qc.invalidateQueries({ queryKey: ["verification-members"] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Members table ── */}
      {membersQuery.isLoading ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-foreground">Discord ID</TableHead>
                <TableHead className="text-muted-foreground">Username</TableHead>
                <TableHead className="text-muted-foreground">Verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-white/10">
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : !membersQuery.data?.members.length ? (
        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium">No members found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {debouncedSearch ? "Try a different search term." : "Members appear here once they verify."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-foreground font-medium">Discord ID</TableHead>
                <TableHead className="text-muted-foreground font-medium">Username</TableHead>
                <TableHead className="text-muted-foreground font-medium">Verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.data.members.map((m) => (
                <TableRow
                  key={m.id}
                  className="border-white/10 cursor-pointer hover:bg-white/5"
                  onClick={() => openDetail(m)}
                >
                  <TableCell className="font-mono text-sm py-5">{m.discord_id}</TableCell>
                  <TableCell className="text-sm py-5">
                    <span>{m.username}</span>
                    {m.is_blacklisted && (
                      <Badge variant="destructive" className="ml-2 text-[10px] py-0">Blacklisted</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground py-5">
                    {formatDate(m.verified_at).split(",")[0]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DIALOGS
      ══════════════════════════════════════════════ */}

      {/* ── Pull Members Dialog ── */}
      <Dialog open={pullDialogOpen} onOpenChange={setPullDialogOpen}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Pull Members</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tutorial link */}
            <a
              href="#"
              className="flex items-center gap-1.5 text-blue-500 text-sm hover:underline"
            >
              Need help? Tutorial video here
              <Share2 className="h-3.5 w-3.5" />
            </a>

            {/* Select a server */}
            <div className="border border-blue-500 rounded-lg px-4 py-3 flex items-center justify-between bg-transparent cursor-pointer hover:bg-muted/30 transition-colors">
              <span className="text-sm text-muted-foreground">Select a server</span>
              <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
            </div>

            {/* Select roles */}
            <div className="border border-border rounded-lg px-4 py-3 flex items-center justify-between bg-transparent cursor-pointer hover:bg-muted/30 transition-colors">
              <span className="text-sm text-muted-foreground">Select role(s) to give</span>
              <div className="flex gap-0.5">
                <ChevronLeft className="h-3 w-3 text-muted-foreground rotate-90" />
                <ChevronLeft className="h-3 w-3 text-muted-foreground -rotate-90" />
              </div>
            </div>

            {/* Number of members */}
            <Input
              placeholder="Number of members (Leave blank = all)"
              className="bg-transparent"
            />

            {/* Join Delay */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                Join Delay
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3">
                <div className="border border-border rounded-lg px-3 py-1.5 w-16 text-center text-sm bg-transparent">
                  {pullDelay}
                </div>
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
              <Slider
                value={[pullDelay]}
                onValueChange={([v]) => setPullDelay(v)}
                min={0}
                max={30}
                step={1}
                className="w-full"
              />
            </div>

            {/* Active pull progress */}
            {pullActive && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    {pullStatusQuery.data?.pulled_members} / {pullStatusQuery.data?.total_members} pulled
                  </span>
                  <span>
                    {pullStatusQuery.data?.total_members
                      ? Math.round((pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress
                  value={
                    pullStatusQuery.data?.total_members
                      ? (pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100
                      : 0
                  }
                />
                {pullStatusQuery.data?.log && pullStatusQuery.data.log.length > 0 && (
                  <ScrollArea className="h-28 rounded-lg border border-white/10 bg-black/30 p-2">
                    {pullStatusQuery.data.log.map((entry, i) => (
                      <div key={i} className="text-[10px] font-mono py-0.5 flex gap-2">
                        <span className={entry.status === "success" ? "text-emerald-400" : "text-red-400"}>
                          {entry.status === "success" ? "✓" : "✗"}
                        </span>
                        <span className="text-muted-foreground">{entry.username}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Invite Discord bot */}
            <button className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-lg h-10 text-sm font-medium transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.102.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Invite Discord bot
            </button>

            {/* Refresh buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-lg h-9 text-sm font-medium transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
                Refresh servers
              </button>
              <button className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-lg h-9 text-sm font-medium transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
                Refresh roles
              </button>
            </div>

            {/* Prevent duplicates */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="prevent-duplicates"
                checked={preventDuplicates}
                onCheckedChange={(v) => setPreventDuplicates(!!v)}
                className="border-white/30"
              />
              <Label htmlFor="prevent-duplicates" className="text-sm cursor-pointer">
                Prevent duplicate members
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {pullActive ? (
              <Button
                variant="destructive"
                onClick={() => stopPullMutation.mutate()}
                disabled={stopPullMutation.isPending}
                className="gap-2"
              >
                {stopPullMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Stop
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setPullDialogOpen(false)}>
                  Close
                </Button>
                <PremiumGate feature="pull_members" featureLabel="Pull Members" hasAccess={hasFeature("pull_members")} isLoading={entLoading}>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                    onClick={() =>
                      startPullMutation.mutate({ restore_roles: preventDuplicates, join_delay_seconds: pullDelay })
                    }
                    disabled={startPullMutation.isPending}
                  >
                    {startPullMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start Pulling
                  </Button>
                </PremiumGate>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deauthorized Users Dialog ── */}
      <Dialog open={deauthDialogOpen} onOpenChange={setDeauthDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-base">Deauthorized Users</DialogTitle>
            <DialogDescription className="text-center text-xs">
              List of users who Unauthorized your Discord app. Make VaultCord remove roles from these
              types of users with{" "}
              <a href="#" className="text-blue-500 underline">
                this setting (here)
              </a>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            {deauthQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : !deauthQuery.data?.members.length ? (
              <p className="text-center text-sm text-muted-foreground py-8">No deauthorized users.</p>
            ) : (
              <div className="space-y-2">
                {deauthQuery.data.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between bg-muted/40 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{m.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined: {formatDate(m.verified_at).split(",")[0]}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono mt-1">{m.discord_id}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Delete Unauthorized Alert ── */}
      <AlertDialog open={deleteUnauthorizedOpen} onOpenChange={setDeleteUnauthorizedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unauthorized Members</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all members who are no longer in the Discord server. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUnauthorizedMutation.mutate()}
              disabled={deleteUnauthorizedMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUnauthorizedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Transfer Dialog ── */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Members
            </DialogTitle>
            <DialogDescription>
              Import verified members from another guild into this one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Source Guild ID</Label>
            <Input
              placeholder="e.g. 123456789012345678"
              value={transferSource}
              onChange={(e) => setTransferSource(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!transferSource.trim() || transferMutation.isPending}
              onClick={() => transferMutation.mutate()}
              className="gap-2"
            >
              {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Member Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Member Detail
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedMember.avatar && <AvatarImage src={selectedMember.avatar} alt={selectedMember.username} />}
                  <AvatarFallback>{selectedMember.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedMember.username}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedMember.discord_id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p>{selectedMember.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">IP</p>
                  <p className="font-mono text-xs">{selectedMember.ip_address ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Verified</p>
                  <p>{formatDate(selectedMember.verified_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Risk</p>
                  <Badge variant="outline" className={`text-[10px] ${riskBadge(selectedMember.risk_score).cls}`}>
                    {selectedMember.risk_score} — {riskBadge(selectedMember.risk_score).label}
                  </Badge>
                </div>
              </div>
              {selectedMember.roles.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Roles</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedMember.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => selectedMember && blacklistMutation.mutate({
                id: selectedMember.id,
                blacklisted: !selectedMember.is_blacklisted,
              })}
              disabled={blacklistMutation.isPending}
            >
              {selectedMember?.is_blacklisted ? (
                <><ShieldCheck className="h-4 w-4" /> Unblacklist</>
              ) : (
                <><Ban className="h-4 w-4" /> Blacklist</>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => selectedMember && deleteMutation.mutate(selectedMember.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
