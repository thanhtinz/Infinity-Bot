import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Zap } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useCurrency } from "@/hooks/useCurrency";
import type { Product } from "@/types";

interface FlashSale {
  id: number;
  product_id: number;
  product_name: string | null;
  package_name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  quantity_limit: number | null;
  quantity_used: number;
  allow_coupon: boolean;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

interface FlashSaleForm {
  product_id: number | null;
  package_name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  quantity_limit: number;
  allow_coupon: boolean;
  starts_at: string;
  ends_at: string;
}

const emptyForm: FlashSaleForm = {
  product_id: null,
  package_name: "",
  discount_type: "percent",
  discount_value: 0,
  quantity_limit: 0,
  allow_coupon: false,
  starts_at: "",
  ends_at: "",
};

function getStatus(sale: FlashSale): "Upcoming" | "Active" | "Ended" {
  if (!sale.active) return "Ended";
  if (new Date(sale.starts_at) > new Date()) return "Upcoming";
  return "Active";
}

function statusBadge(status: "Upcoming" | "Active" | "Ended") {
  const cls = {
    Upcoming: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary/80",
    Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Ended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  }[status];
  return <Badge className={cls} variant="secondary">{status}</Badge>;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toDatetimeLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date/time state helpers
const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const MONTHS = [
  { v: "1", l: "Jan" }, { v: "2", l: "Feb" }, { v: "3", l: "Mar" },
  { v: "4", l: "Apr" }, { v: "5", l: "May" }, { v: "6", l: "Jun" },
  { v: "7", l: "Jul" }, { v: "8", l: "Aug" }, { v: "9", l: "Sep" },
  { v: "10", l: "Oct" }, { v: "11", l: "Nov" }, { v: "12", l: "Dec" },
];
const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(CUR_YEAR - 1 + i));

function buildDatetime(year: string, month: string, day: string, hour: string, min: string) {
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
}

function parseDt(iso: string) {
  if (!iso) return { y: String(CUR_YEAR), mo: "1", d: "1", h: "0", m: "0" };
  const dt = toDatetimeLocal(iso);
  const [datePart, timePart] = dt.split("T");
  const [y, mo, d] = (datePart ?? "").split("-");
  const [hh, mm] = (timePart ?? "00:00").split(":");
  return {
    y: y ?? String(CUR_YEAR),
    mo: String(parseInt(mo || "1")),
    d: String(parseInt(d || "1")),
    h: String(parseInt(hh || "0")),
    m: String(parseInt(mm || "0")),
  };
}

export function FlashSales() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { formatPrice } = useCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FlashSale | null>(null);
  const [form, setForm] = useState<FlashSaleForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<FlashSale | null>(null);

  // Date/time parts state
  const [startDay, setStartDay]   = useState("1");
  const [startMonth, setStartMonth] = useState("1");
  const [startYear, setStartYear] = useState(String(CUR_YEAR));
  const [startHour, setStartHour] = useState("0");
  const [startMin, setStartMin]   = useState("0");
  const [endDay, setEndDay]       = useState("1");
  const [endMonth, setEndMonth]   = useState("1");
  const [endYear, setEndYear]     = useState(String(CUR_YEAR));
  const [endHour, setEndHour]     = useState("0");
  const [endMin, setEndMin]       = useState("0");

  // Sync date/time parts khi open edit dialog
  useEffect(() => {
    if (editing) {
      const s = parseDt(editing.starts_at);
      setStartDay(s.d); setStartMonth(s.mo); setStartYear(s.y);
      setStartHour(s.h); setStartMin(s.m);
      const e = parseDt(editing.ends_at);
      setEndDay(e.d); setEndMonth(e.mo); setEndYear(e.y);
      setEndHour(e.h); setEndMin(e.m);
    } else {
      setStartDay("1"); setStartMonth("1"); setStartYear(String(CUR_YEAR));
      setStartHour("0"); setStartMin("0");
      setEndDay("1"); setEndMonth("1"); setEndYear(String(CUR_YEAR));
      setEndHour("0"); setEndMin("0");
    }
  }, [editing]);

  const { data: sales = [], isLoading } = useQuery<FlashSale[]>({
    queryKey: ["flash-sales"],
    queryFn: () => apiFetch("/api/flash-sales").then((r) => r.json()),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    staleTime: 60_000,
  });

  const activeProducts = products.filter((p) => p.active);
  const selectedProduct = activeProducts.find((p) => p.id === form.product_id);
  const packages = selectedProduct?.packages?.filter((pkg) => pkg.active) ?? [];

  const createMutation = useMutation({
    mutationFn: (values: FlashSaleForm) =>
      apiFetch("/api/flash-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-sales"] });
      closeDialog();
      toast({ title: "Flash sale created." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: FlashSaleForm & { id: number }) =>
      apiFetch(`/api/flash-sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-sales"] });
      closeDialog();
      toast({ title: "Flash sale updated." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/flash-sales/${id}`, { method: "DELETE" })
        .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-sales"] });
      setDeleteTarget(null);
      toast({ title: "Flash sale deleted." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(sale: FlashSale) {
    setEditing(sale);
    setForm({
      product_id: sale.product_id,
      package_name: sale.package_name,
      discount_type: sale.discount_type,
      discount_value: sale.discount_value,
      quantity_limit: sale.quantity_limit ?? 0,
      allow_coupon: sale.allow_coupon,
      starts_at: toDatetimeLocal(sale.starts_at),
      ends_at: toDatetimeLocal(sale.ends_at),
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setStartDay("1"); setStartMonth("1"); setStartYear(String(CUR_YEAR));
    setStartHour("0"); setStartMin("0");
    setEndDay("1"); setEndMonth("1"); setEndYear(String(CUR_YEAR));
    setEndHour("0"); setEndMin("0");
  }

  function handleSubmit() {
    const payload = {
      ...form,
      quantity_limit: form.quantity_limit || 0,
      starts_at: buildDatetime(startYear, startMonth, startDay, startHour, startMin),
      ends_at: buildDatetime(endYear, endMonth, endDay, endHour, endMin),
    };
    const apiPayload = { ...payload, quantity_limit: payload.quantity_limit || null };
    if (editing) {
      updateMutation.mutate({ ...apiPayload, id: editing.id } as FlashSaleForm & { id: number });
    } else {
      createMutation.mutate(apiPayload as FlashSaleForm);
    }
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-orange-500" /> Flash Sales
        </h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Flash Sale
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product / Package</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Qty Used / Limit</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No flash sales yet.
                  </TableCell>
                </TableRow>
              )}
              {sales.map((sale) => {
                const status = getStatus(sale);
                return (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="font-medium">{sale.product_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{sale.package_name}</div>
                    </TableCell>
                    <TableCell>
                      {sale.discount_type === "percent"
                        ? `${sale.discount_value}%`
                        : formatPrice(sale.discount_value)}
                    </TableCell>
                    <TableCell>
                      {sale.quantity_used} / {sale.quantity_limit ?? "∞"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{formatDate(sale.starts_at)}</div>
                      <div className="text-muted-foreground">→ {formatDate(sale.ends_at)}</div>
                    </TableCell>
                    <TableCell>
                      {sale.allow_coupon ? "✅" : "❌"}
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sale)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(sale)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Flash Sale" : "New Flash Sale"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={form.product_id ? String(form.product_id) : ""}
                onValueChange={(v) => {
                  const pid = Number(v);
                  setForm((f) => ({ ...f, product_id: pid, package_name: "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {activeProducts.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Package</Label>
              <Select
                value={form.package_name}
                onValueChange={(v) => setForm((f) => ({ ...f, package_name: v }))}
                disabled={!form.product_id}
              >
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.name} value={pkg.name}>{pkg.name} — {formatPrice(pkg.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Discount Type</Label>
              <RadioGroup
                value={form.discount_type}
                onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v as "percent" | "fixed" }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percent" id="percent" />
                  <Label htmlFor="percent">Percent %</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed">Fixed amount</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input
                type="number"
                min={0}
                value={form.discount_value || ""}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Quantity Limit <span className="text-muted-foreground text-xs">(0 = unlimited)</span></Label>
              <Input
                type="number"
                min={0}
                value={form.quantity_limit || ""}
                onChange={(e) => setForm((f) => ({ ...f, quantity_limit: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Allow Coupon</Label>
              <Switch
                checked={form.allow_coupon}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allow_coupon: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date/Time</Label>
              <div className="flex gap-1.5">
                <Select value={startDay} onValueChange={setStartDay}>
                  <SelectTrigger className="w-[58px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={startYear} onValueChange={setStartYear}>
                  <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={startHour} onValueChange={setStartHour}>
                  <SelectTrigger className="w-[62px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={h}>{h.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={startMin} onValueChange={setStartMin}>
                  <SelectTrigger className="w-[62px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={m}>{m.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>End Date/Time</Label>
              <div className="flex gap-1.5">
                <Select value={endDay} onValueChange={setEndDay}>
                  <SelectTrigger className="w-[58px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={endMonth} onValueChange={setEndMonth}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={endYear} onValueChange={setEndYear}>
                  <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={endHour} onValueChange={setEndHour}>
                  <SelectTrigger className="w-[62px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={h}>{h.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={endMin} onValueChange={setEndMin}>
                  <SelectTrigger className="w-[62px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={m}>{m.padStart(2,"0")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.product_id || !form.package_name}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flash Sale</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the flash sale for <strong>{deleteTarget?.product_name}</strong> — <strong>{deleteTarget?.package_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
