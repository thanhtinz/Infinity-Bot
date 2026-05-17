import { useState } from "react";
import type { ChangeEvent } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  ShieldCheck,
  Trash2,
  Ban,
  ChevronLeft,
  ChevronRight,
  Mail,
  Globe,
  Eye,
  AlertTriangle,
  Hash,
} from "lucide-react";
import {
  fetchMembers,
  blacklistMember,
  deleteMember,
  formatDate,
  riskBadge,
} from "./shared";
import type { VerifiedMember } from "./shared";

export function VerifyMembers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<VerifiedMember | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const perPage = 50;

  const membersQuery = useQuery({
    queryKey: ["verification-members", memberPage, memberSearch],
    queryFn: () => fetchMembers(memberPage, perPage, memberSearch),
  });

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

  function openMemberDetail(m: VerifiedMember) {
    setSelectedMember(m);
    setMemberDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Verified Members
          </h2>
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

      {/* Member Detail Dialog */}
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
