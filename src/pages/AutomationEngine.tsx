import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  List,
  Play,
} from "lucide-react";
import { PageContainer, PageHeader, EmptyState } from "@/components/infinity";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogOption {
  value: string;
  label: string;
}

interface AutomationCatalog {
  trigger_types: CatalogOption[];
  action_types: CatalogOption[];
  condition_operators: CatalogOption[];
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  action_type: string;
  config: string;
}

interface AutomationRule {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  conditions: Condition[];
  actions: Action[];
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

interface AutomationLog {
  id: number;
  rule_id: number;
  trigger_data: Record<string, unknown>;
  actions_taken: Record<string, unknown>[];
  success: boolean;
  error: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return "Never";
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateJson(obj: unknown, maxLen = 80): string {
  const s = JSON.stringify(obj, null, 0);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function buildRulePayload(form: RuleFormData) {
  return {
    name: form.name,
    description: form.description || null,
    enabled: form.enabled,
    trigger_type: form.trigger_type,
    conditions: form.conditions.filter((c) => c.field && c.operator && c.value),
    actions: form.actions
      .filter((a) => a.action_type)
      .map((a) => ({
        action_type: a.action_type,
        config: a.config ? JSON.parse(a.config) : {},
      })),
  };
}

// ─── Rule Form State ─────────────────────────────────────────────────────────

interface RuleFormData {
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  conditions: Condition[];
  actions: Action[];
}

const EMPTY_FORM: RuleFormData = {
  name: "",
  description: "",
  enabled: true,
  trigger_type: "",
  conditions: [],
  actions: [{ action_type: "", config: "" }],
};

function ruleToForm(rule: AutomationRule): RuleFormData {
  return {
    name: rule.name,
    description: rule.description || "",
    enabled: rule.enabled,
    trigger_type: rule.trigger_type,
    conditions: rule.conditions.length
      ? rule.conditions.map((c) => ({ ...c }))
      : [],
    actions: rule.actions.length
      ? rule.actions.map((a) => ({
          action_type: a.action_type,
          config: typeof a.config === "string" ? a.config : JSON.stringify(a.config, null, 2),
        }))
      : [{ action_type: "", config: "" }],
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AutomationEngine() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [logFilterRuleId, setLogFilterRuleId] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // ── Queries ──

  const { data: catalog, isLoading: catalogLoading } = useQuery<AutomationCatalog>({
    queryKey: ["automation-catalog"],
    queryFn: () => apiFetch("/api/automation/catalog").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ["automation-rules"],
    queryFn: () => apiFetch("/api/automation/rules").then((r) => r.json()),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<AutomationLog[]>({
    queryKey: ["automation-logs", logFilterRuleId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (logFilterRuleId && logFilterRuleId !== "all") {
        params.set("rule_id", logFilterRuleId);
      }
      return apiFetch(`/api/automation/logs?${params}`).then((r) => r.json());
    },
  });

  // ── Derived ──

  const triggerLabel = useMemo(() => {
    if (!catalog) return new Map<string, string>();
    return new Map(catalog.trigger_types.map((t) => [t.value, t.label]));
  }, [catalog]);

  const ruleNameMap = useMemo(() => {
    return new Map(rules.map((r) => [r.id, r.name]));
  }, [rules]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildRulePayload>) =>
      apiFetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules"] });
      setEditorOpen(false);
      toast({ title: "Rule created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReturnType<typeof buildRulePayload> }) =>
      apiFetch(`/api/automation/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules"] });
      setEditorOpen(false);
      setEditingRule(null);
      toast({ title: "Rule updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/automation/rules/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules"] });
      setConfirmDeleteId(null);
      toast({ title: "Rule deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/automation/rules/${id}/toggle`, { method: "POST" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-rules"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──

  function openCreate() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setForm(ruleToForm(rule));
    setEditorOpen(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.trigger_type) {
      toast({ title: "Validation", description: "Name and trigger type are required.", variant: "destructive" });
      return;
    }
    const validActions = form.actions.filter((a) => a.action_type);
    if (validActions.length === 0) {
      toast({ title: "Validation", description: "At least one action is required.", variant: "destructive" });
      return;
    }
    // Validate JSON configs
    for (const a of validActions) {
      if (a.config.trim()) {
        try {
          JSON.parse(a.config);
        } catch {
          toast({ title: "Invalid JSON", description: `Action "${a.action_type}" has invalid config JSON.`, variant: "destructive" });
          return;
        }
      }
    }
    const payload = buildRulePayload(form);
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ── Form helpers ──

  function updateForm<K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCondition() {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "", value: "" }],
    }));
  }

  function removeCondition(idx: number) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== idx),
    }));
  }

  function updateCondition(idx: number, key: keyof Condition, value: string) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));
  }

  function addAction() {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { action_type: "", config: "" }],
    }));
  }

  function removeAction(idx: number) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== idx),
    }));
  }

  function updateAction(idx: number, key: keyof Action, value: string) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === idx ? { ...a, [key]: value } : a)),
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <PageHeader title="Automation Engine" description="Build IF/THEN rules for your Discord bot" icon={Zap}>
        <Button onClick={openCreate} className="bg-black text-white hover:bg-black/90">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Rule
        </Button>
      </PageHeader>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* ── Rules Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="rules" className="space-y-3 mt-4">
          {rulesLoading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading rules…</div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No automation rules yet"
              description="Create your first IF/THEN rule to automate actions in your server."
            >
              <Button onClick={openCreate} className="bg-black text-white hover:bg-black/90">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Rule
              </Button>
            </EmptyState>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
                <CardContent className="px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[15px] text-foreground">{rule.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {triggerLabel.get(rule.trigger_type) || rule.trigger_type}
                        </Badge>
                        {!rule.enabled && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-[13px] text-muted-foreground line-clamp-1">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}</span>
                        <span>{rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {rule.run_count} run{rule.run_count !== 1 ? "s" : ""}
                        </span>
                        {rule.last_run_at && (
                          <span>Last: {formatDate(rule.last_run_at)}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleMutation.mutate(rule.id)}
                        disabled={toggleMutation.isPending}
                        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(rule)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {confirmDeleteId === rule.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => deleteMutation.mutate(rule.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Confirm?
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(rule.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Logs Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0">Filter by rule</Label>
            <Select value={logFilterRuleId} onValueChange={setLogFilterRuleId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All rules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rules</SelectItem>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {logsLoading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading logs…</div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={List}
              title="No execution logs"
              description="Automation logs will appear here once rules are triggered."
            />
          ) : (
            <div className="bg-card rounded-[10px] shadow-[var(--card-shadow)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Trigger Data</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      >
                        <TableCell className="font-medium">
                          {ruleNameMap.get(log.rule_id) || `Rule #${log.rule_id}`}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-xs text-muted-foreground font-mono">
                            {truncateJson(log.trigger_data)}
                          </span>
                        </TableCell>
                        <TableCell>{log.actions_taken.length}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </TableCell>
                      </TableRow>
                      {expandedLogId === log.id && (
                        <TableRow key={`${log.id}-detail`} className="bg-muted/30">
                          <TableCell colSpan={5} className="p-4">
                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="font-semibold text-foreground">Trigger Data:</span>
                                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-auto max-h-40">
                                  {JSON.stringify(log.trigger_data, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">Actions Taken:</span>
                                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-auto max-h-40">
                                  {JSON.stringify(log.actions_taken, null, 2)}
                                </pre>
                              </div>
                              {log.error && (
                                <div>
                                  <span className="font-semibold text-destructive">Error:</span>
                                  <pre className="mt-1 p-3 bg-destructive/10 rounded-md text-xs font-mono overflow-auto max-h-40 text-destructive">
                                    {log.error}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Rule Editor Dialog ──────────────────────────────────────────────── */}
      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open) { setEditorOpen(false); setEditingRule(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create Rule"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g. Welcome new members"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-desc">Description (optional)</Label>
              <Textarea
                id="rule-desc"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="What does this rule do?"
                rows={2}
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-enabled">Enabled</Label>
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => updateForm("enabled", checked)}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-1.5">
              <Label>Trigger Type</Label>
              <Select value={form.trigger_type} onValueChange={(v) => updateForm("trigger_type", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger…" />
                </SelectTrigger>
                <SelectContent>
                  {catalog?.trigger_types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {catalogLoading && (
                <p className="text-xs text-muted-foreground">Loading triggers…</p>
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (optional)</Label>
                <Button variant="outline" size="sm" onClick={addCondition} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Condition
                </Button>
              </div>
              {form.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground">No conditions — rule fires on every trigger event.</p>
              )}
              {form.conditions.map((cond, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Field</Label>
                    <Input
                      value={cond.field}
                      onChange={(e) => updateCondition(idx, "field", e.target.value)}
                      placeholder="e.g. order.total"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-[140px] space-y-1">
                    <Label className="text-xs text-muted-foreground">Operator</Label>
                    <Select
                      value={cond.operator}
                      onValueChange={(v) => updateCondition(idx, "operator", v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Op" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog?.condition_operators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    <Input
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, "value", e.target.value)}
                      placeholder="e.g. 100"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeCondition(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Actions (at least 1)</Label>
                <Button variant="outline" size="sm" onClick={addAction} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Action
                </Button>
              </div>
              {form.actions.map((action, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Action Type</Label>
                      <Select
                        value={action.action_type}
                        onValueChange={(v) => updateAction(idx, "action_type", v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select action…" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog?.action_types.map((a) => (
                            <SelectItem key={a.value} value={a.value}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeAction(idx)}
                      disabled={form.actions.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Config (JSON)</Label>
                    <Textarea
                      value={action.config}
                      onChange={(e) => updateAction(idx, "config", e.target.value)}
                      placeholder='{"key": "value"}'
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditorOpen(false); setEditingRule(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-black text-white hover:bg-black/90">
              {isSaving ? "Saving…" : editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
