import { useState } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Calendar, Loader2, Save } from "lucide-react";
import type { BackupSchedule as BackupScheduleType } from "./shared";
import { fetchSchedule, updateSchedule, formatDate } from "./shared";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";

export function BackupSchedule() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  const [scheduleForm, setScheduleForm] = useState<BackupScheduleType | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ["server-backup-schedule"],
    queryFn: fetchSchedule,
  });

  // Initialize schedule form when data loads
  if (scheduleQuery.data && !scheduleForm) {
    setScheduleForm(scheduleQuery.data);
  }

  const scheduleMutation = useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => {
      toast({ title: "Schedule saved", description: "Backup schedule has been updated." });
      qc.invalidateQueries({ queryKey: ["server-backup-schedule"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSaveSchedule() {
    if (!scheduleForm) return;
    scheduleMutation.mutate(scheduleForm);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">Backup Schedule</h2>
        <PremiumBadge />
      </div>
      <p className="text-muted-foreground text-sm -mt-4">
        Configure automatic backup schedules to keep your server data safe.
      </p>

      <PremiumGate
        feature="scheduled_backup"
        featureLabel="Sao lưu tự động"
        hasAccess={hasFeature("scheduled_backup")}
        isLoading={entLoading}
      >

      {scheduleQuery.isLoading || !scheduleForm ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable Scheduled Backups</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create backups at regular intervals
                </p>
              </div>
              <Switch
                checked={scheduleForm.enabled}
                onCheckedChange={(v) =>
                  setScheduleForm({ ...scheduleForm, enabled: v })
                }
              />
            </div>

            <Separator />

            {/* Interval + Max backups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Backup Interval</Label>
                <Select
                  value={String(scheduleForm.interval_hours)}
                  onValueChange={(v) =>
                    setScheduleForm({ ...scheduleForm, interval_hours: Number(v) })
                  }
                  disabled={!scheduleForm.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Every 6 hours</SelectItem>
                    <SelectItem value="12">Every 12 hours</SelectItem>
                    <SelectItem value="24">Every 24 hours</SelectItem>
                    <SelectItem value="48">Every 48 hours</SelectItem>
                    <SelectItem value="72">Every 72 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Backups to Keep</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={scheduleForm.max_backups}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScheduleForm({
                      ...scheduleForm,
                      max_backups: Number(e.target.value),
                    })
                  }
                  disabled={!scheduleForm.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Oldest backups will be automatically deleted when limit is reached
                </p>
              </div>
            </div>

            <Separator />

            {/* Include options */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Include in Backup</Label>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Include Messages</Label>
                  <p className="text-xs text-muted-foreground">
                    Save recent messages from all channels
                  </p>
                </div>
                <Switch
                  checked={scheduleForm.include_messages}
                  onCheckedChange={(v) =>
                    setScheduleForm({ ...scheduleForm, include_messages: v })
                  }
                  disabled={!scheduleForm.enabled}
                />
              </div>

              {scheduleForm.include_messages && (
                <div className="ml-6 space-y-2">
                  <Label className="text-sm">Message Limit per Channel</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={scheduleForm.message_limit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setScheduleForm({
                        ...scheduleForm,
                        message_limit: Number(e.target.value),
                      })
                    }
                    disabled={!scheduleForm.enabled}
                    className="max-w-[200px]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Include Bot Configuration</Label>
                  <p className="text-xs text-muted-foreground">
                    Save all bot settings and configurations
                  </p>
                </div>
                <Switch
                  checked={scheduleForm.include_bot_config}
                  onCheckedChange={(v) =>
                    setScheduleForm({ ...scheduleForm, include_bot_config: v })
                  }
                  disabled={!scheduleForm.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Include Verified Members</Label>
                  <p className="text-xs text-muted-foreground">
                    Save verified member data and verification records
                  </p>
                </div>
                <Switch
                  checked={scheduleForm.include_verified_members}
                  onCheckedChange={(v) =>
                    setScheduleForm({ ...scheduleForm, include_verified_members: v })
                  }
                  disabled={!scheduleForm.enabled}
                />
              </div>
            </div>

            <Separator />

            {/* Last / Next backup info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Backup</p>
                  <p className="text-sm font-medium">
                    {scheduleForm.last_backup_at
                      ? formatDate(scheduleForm.last_backup_at)
                      : "Never"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Next Backup</p>
                  <p className="text-sm font-medium">
                    {scheduleForm.next_backup_at
                      ? formatDate(scheduleForm.next_backup_at)
                      : "Not scheduled"}
                  </p>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveSchedule}
                disabled={scheduleMutation.isPending}
                className="gap-1.5"
              >
                {scheduleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </PremiumGate>
    </div>
  );
}
