import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { RoleSelect } from "@/components/RoleSelect";
import { Shield, Plus, Pencil, Trash2, Users, X } from "lucide-react";

interface StaffPerm {
  id: number;
  role_id: string;
  role_name: string | null;
  can_shop: boolean;
  can_moderation: boolean;
  can_verification: boolean;
  can_community: boolean;
  can_embeds: boolean;
  can_roles: boolean;
  can_utilities: boolean;
  can_backup: boolean;
  can_config: boolean;
  can_ai: boolean;
}

const PERM_LABELS: { key: keyof StaffPerm; label: string; desc: string }[] = [
  { key: "can_shop", label: "Shop", desc: "Products, orders, coupons, milestones" },
  { key: "can_moderation", label: "Moderation", desc: "Cases, warnings, notes" },
  { key: "can_verification", label: "Verification", desc: "Verified members, pull, config" },
  { key: "can_community", label: "Community", desc: "Giveaways, invites, feedback" },
  { key: "can_embeds", label: "Embeds", desc: "Embed templates, custom embeds" },
  { key: "can_roles", label: "Roles", desc: "Auto role, button/select/reaction roles" },
  { key: "can_utilities", label: "Utilities", desc: "Sticky, automod, logging, starboard" },
  { key: "can_backup", label: "Backup", desc: "Server backups, restore, schedule" },
  { key: "can_config", label: "Config", desc: "Bot settings, channels, PayOS" },
  { key: "can_ai", label: "AI Chat", desc: "AI assistant config, training, history" },
];

const emptyPerms: Record<string, boolean> = {
  can_shop: false,
  can_moderation: false,
  can_verification: false,
  can_community: false,
  can_embeds: false,
  can_roles: false,
  can_utilities: false,
  can_backup: false,
  can_config: false,
  can_ai: false,
};

export function StaffPermissions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [roleId, setRoleId] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>(emptyPerms);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: staffPerms = [], isLoading } = useQuery<StaffPerm[]>({
    queryKey: ["staff-permissions", selectedGuildId],
    queryFn: () => apiFetch("/api/staff-permissions").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { role_id: roleId, ...perms };
      if (editId) {
        await apiFetch(`/api/staff-permissions/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/staff-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-permissions"] });
      setDialogOpen(false);
      toast({ title: editId ? "Updated" : "Added staff role" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/staff-permissions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-permissions"] });
      setDeleteId(null);
      toast({ title: "Removed staff role" });
    },
  });

  function openCreate() {
    setEditId(null);
    setRoleId("");
    setPerms({ ...emptyPerms });
    setDialogOpen(true);
  }

  function openEdit(sp: StaffPerm) {
    setEditId(sp.id);
    setRoleId(sp.role_id);
    const p: Record<string, boolean> = {};
    for (const { key } of PERM_LABELS) {
      p[key] = sp[key] as boolean;
    }
    setPerms(p);
    setDialogOpen(true);
  }

  const activeCount = (sp: StaffPerm) =>
    PERM_LABELS.filter(({ key }) => sp[key]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Grant dashboard access to specific roles without giving full admin
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Role
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : staffPerms.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No staff roles configured</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {staffPerms.map((sp) => (
            <Card key={sp.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                  <Shield className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {sp.role_name || sp.role_id}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activeCount(sp)}/{PERM_LABELS.length} permissions enabled
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(sp)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(sp.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Staff Role" : "Add Staff Role"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="space-y-4 py-2">
              {!editId && (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <RoleSelect
                    value={roleId}
                    onChange={setRoleId}
                    guildId={selectedGuildId || undefined}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-sm font-medium">Permissions</Label>
                <div className="rounded-lg border divide-y">
                  {PERM_LABELS.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2.5"
                    >
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                      <Switch
                        checked={perms[key] ?? false}
                        onCheckedChange={(v) =>
                          setPerms({ ...perms, [key]: v })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    for (const { key } of PERM_LABELS) all[key] = true;
                    setPerms(all);
                  }}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPerms({ ...emptyPerms })}
                >
                  Clear All
                </Button>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={(!editId && !roleId) || save.isPending}
            >
              {save.isPending ? "Saving..." : editId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove staff role?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This role will lose all dashboard access permissions.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && remove.mutate(deleteId)}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Alias để embed vào BotSettings accordion */
export { StaffPermissions as StaffPermissionsSection };
