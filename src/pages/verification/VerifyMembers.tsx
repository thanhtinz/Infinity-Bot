import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Trash2, Search, ShieldCheck, Ban,
  ChevronLeft, ChevronRight, Mail, Globe, Eye,
  AlertTriangle, Hash, Users, ArrowRightLeft, Loader2,
} from "lucide-react";
import {
  fetchMembers, blacklistMember, deleteMember,
  deleteUnauthorized, transferMembers, formatDate, riskBadge,
} from "./shared";
import type { VerifiedMember } from "./shared";

const PER_PAGE = 20;

export function VerifyMembers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [selectedMember, setSelectedMember] = useState<VerifiedMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteUnauthorizedOpen, setDeleteUnauthorizedOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSource, setTransferSource] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const membersQuery = useQuery({
    queryKey: ["verification-members", page, PER_PAGE, debouncedSearch, showBlacklisted],
    queryFn: () => fetchMembers(page, PER_PAGE, debouncedSearch, showBlacklisted ? true : undefined),
    placeholderData: (prev) => prev,
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

  const totalPages = membersQuery.data
    ? Math.ceil(membersQuery.data.total / PER_PAGE)
    : 1;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, username, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            id="show-blacklisted"
            checked={showBlacklisted}
            onCheckedChange={(v) => { setShowBlacklisted(v); setPage(1); }}
          />
          <Label htmlFor="show-blacklisted">Blacklisted only</Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setDeleteUnauthorizedOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete Unauthorized
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setTransferDialogOpen(true)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => qc.invalidateQueries({ queryKey: ["verification-members"] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Total badge ── */}
      {membersQuery.data && (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {membersQuery.data.total.toLocaleString()} member{membersQuery.data.total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      {membersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !membersQuery.data?.members.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium">No members found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {debouncedSearch
                ? "Try a different search term."
                : "Members appear here once they verify."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Discord ID</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Verified</TableHead>
                <TableHead className="hidden lg:table-cell">Risk</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.data.members.map((m) => {
                const risk = riskBadge(m.risk_score);
                return (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(m)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {m.avatar && <AvatarImage src={m.avatar} alt={m.username} />}
                          <AvatarFallback className="text-[10px]">
                            {m.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{m.username}</span>
                        {m.is_blacklisted && (
                          <Badge variant="destructive" className="text-[10px] py-0">Blacklisted</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {m.discord_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                      {m.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">
                      {formatDate(m.verified_at)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className={`text-[10px] ${risk.cls}`}>
                        {m.risk_score} — {risk.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); openDetail(m); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
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
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {selectedMember.avatar && <AvatarImage src={selectedMember.avatar} />}
                  <AvatarFallback>{selectedMember.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedMember.username}</p>
                  <p className="text-xs font-mono text-muted-foreground">{selectedMember.discord_id}</p>
                </div>
                {selectedMember.is_blacklisted && <Badge variant="destructive" className="ml-auto">Blacklisted</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{selectedMember.email ?? "No email"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{selectedMember.ip_address ?? "No IP"}</span>
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
                      <Badge key={r} variant="outline" className="text-xs font-mono">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Verified: {formatDate(selectedMember.verified_at)}</p>
                <p>Last seen: {formatDate(selectedMember.last_seen)}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedMember && (
              <>
                <Button
                  variant="outline"
                  disabled={blacklistMutation.isPending}
                  onClick={() => blacklistMutation.mutate({ id: selectedMember.id, blacklisted: !selectedMember.is_blacklisted })}
                  className="gap-1.5"
                >
                  {blacklistMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : selectedMember.is_blacklisted
                      ? <><ShieldCheck className="h-4 w-4" /> Unblacklist</>
                      : <><Ban className="h-4 w-4" /> Blacklist</>
                  }
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(selectedMember.id)}
                  className="gap-1.5"
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Trash2 className="h-4 w-4" /> Delete</>
                  }
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Unauthorized AlertDialog ── */}
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
    </div>
  );
}
