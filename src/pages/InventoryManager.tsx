import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmojiTextarea } from "@/components/EmojiInput";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Package, Upload, Trash2, Loader2, AlertTriangle, Warehouse } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { PageContainer, PageHeader } from "@/components/infinity";
import type { Product } from "@/types";

interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string | null;
  package_name: string;
  content: string;
  delivered_order_id: number | null;
  status: "available" | "delivered";
}

interface InventoryStat {
  product_id: number;
  product_name: string | null;
  package_name: string;
  total: number;
  available: number;
  delivered: number;
}

export function InventoryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const [tab, setTab] = useState("overview");

  // Upload dialog
  const [uploadTarget, setUploadTarget] = useState<{ product_id: number; package_name: string; product_name: string | null } | null>(null);
  const [uploadContent, setUploadContent] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [clearTarget, setClearTarget] = useState<{ product_id: number; package_name: string } | null>(null);

  // History filters
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Queries
  const { data: statsRaw = [], isLoading: statsLoading } = useQuery<InventoryStat[]>({
    queryKey: ["inventory-stats", selectedGuildId],
    queryFn: () => apiFetch("/api/inventory/stats").then((r) => r.ok ? r.json() : []),
    enabled: !!selectedGuildId,
  });
  const stats: InventoryStat[] = Array.isArray(statsRaw) ? statsRaw : [];

  const queryParams = new URLSearchParams();
  if (filterProduct !== "all") queryParams.set("product_id", filterProduct);
  if (filterPackage !== "all") queryParams.set("package_name", filterPackage);
  if (filterStatus !== "all") queryParams.set("status", filterStatus);

  const { data: itemsRaw = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", selectedGuildId, filterProduct, filterPackage, filterStatus],
    queryFn: () => apiFetch(`/api/inventory?${queryParams.toString()}`).then((r) => r.ok ? r.json() : []),
    enabled: !!selectedGuildId,
  });
  const items: InventoryItem[] = Array.isArray(itemsRaw) ? itemsRaw : [];

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", selectedGuildId],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  // Load config for low stock threshold display
  const { data: config } = useQuery<Record<string, unknown>>({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiFetch("/api/config").then((r) => r.json()),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });
  const configThreshold = (config?.inventory_low_stock_threshold as number) ?? 5;

  // Merge: packages with use_inventory=true that have no stats entry yet → show as 0 stock
  const allInventoryRows: InventoryStat[] = (() => {
    const statsMap = new Map(stats.map((s) => [`${s.product_id}::${s.package_name}`, s]));
    const rows: InventoryStat[] = [...stats];
    for (const product of products) {
      const pkgs: { name: string; use_inventory?: boolean }[] = product.packages ?? [];
      for (const pkg of pkgs) {
        if (pkg.use_inventory) {
          const key = `${product.id}::${pkg.name}`;
          if (!statsMap.has(key)) {
            rows.push({ product_id: product.id, product_name: product.name, package_name: pkg.name, total: 0, available: 0, delivered: 0 });
          }
        }
      }
    }
    return rows;
  })();

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: ({ product_id, package_name, contents }: { product_id: number; package_name: string; contents: string[] }) =>
      apiFetch("/api/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, package_name, contents }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["inventory", selectedGuildId] });
      setUploadTarget(null);
      setUploadContent("");
      toast({ title: "Stock uploaded." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/inventory/${id}`, { method: "DELETE" })
        .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["inventory", selectedGuildId] });
      setDeleteTarget(null);
      toast({ title: "Item deleted." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const clearMutation = useMutation({
    mutationFn: ({ product_id, package_name }: { product_id: number; package_name: string }) =>
      apiFetch("/api/inventory/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, package_name }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["inventory", selectedGuildId] });
      setClearTarget(null);
      toast({ title: "Available stock cleared." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const uploadLines = uploadContent.split("\n").map((l) => l.trim()).filter(Boolean);

  // Filter packages based on selected product for history tab
  const selectedFilterProduct = products.find((p) => String(p.id) === filterProduct);
  const filterPackages = selectedFilterProduct?.packages ?? [];

  if (statsLoading && tab === "overview") {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;
  }

  return (
    <PageContainer size="md">
      <PageHeader title="Inventory" icon={Warehouse} />


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Stock Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Stock Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {allInventoryRows.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No inventory data yet. Upload stock to get started.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allInventoryRows.map((stat) => {
              const isLow = stat.available < configThreshold;
              return (
                <Card key={`${stat.product_id}-${stat.package_name}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>{stat.product_name || "—"}</span>
                      <span className="text-muted-foreground">/ {stat.package_name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" variant="secondary">
                        {stat.available} available
                      </Badge>
                      <Badge variant="secondary">{stat.delivered} delivered</Badge>
                      <Badge variant="outline">{stat.total} total</Badge>
                      {isLow && (
                        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" variant="secondary">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Low stock
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUploadTarget({ product_id: stat.product_id, package_name: stat.package_name, product_name: stat.product_name });
                          setUploadContent("");
                        }}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> Upload Stock
                      </Button>
                      {stat.available > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setClearTarget({ product_id: stat.product_id, package_name: stat.package_name })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Available
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Tab 2: History ── */}
        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterProduct} onValueChange={(v) => { setFilterProduct(v); setFilterPackage("all"); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPackage} onValueChange={setFilterPackage}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All packages" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All packages</SelectItem>
                {filterPackages.map((pkg) => (
                  <SelectItem key={pkg.name} value={pkg.name}>{pkg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {itemsLoading ? (
                <div className="p-4"><Skeleton className="h-40 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No items found.
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{item.id}</TableCell>
                        <TableCell>{item.product_name || "—"}</TableCell>
                        <TableCell>{item.package_name}</TableCell>
                        <TableCell>
                          <span title={item.content} className="max-w-[200px] truncate block">
                            {item.content.length > 50 ? item.content.slice(0, 50) + "…" : item.content}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={item.status === "available"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }
                            variant="secondary"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.delivered_order_id ? `#${item.delivered_order_id}` : "—"}</TableCell>
                        <TableCell className="text-right">
                          {item.status === "available" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={!!uploadTarget} onOpenChange={(v) => { if (!v) { setUploadTarget(null); setUploadContent(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upload Stock — {uploadTarget?.product_name} / {uploadTarget?.package_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items <span className="text-muted-foreground text-xs">(one item per line)</span></Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".txt,.csv,.doc,.docx,.text"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        setUploadContent((prev) => prev ? prev + "\n" + text : text);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                    <Upload className="h-3.5 w-3.5" /> Import file
                  </span>
                </label>
              </div>
              <EmojiTextarea
                rows={8}
                placeholder={"key1\nkey2\nhttps://example.com/code3"}
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {uploadLines.length} item{uploadLines.length !== 1 ? "s" : ""} to upload
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUploadTarget(null); setUploadContent(""); }}>Cancel</Button>
            <Button
              onClick={() => uploadTarget && uploadMutation.mutate({
                product_id: uploadTarget.product_id,
                package_name: uploadTarget.package_name,
                contents: uploadLines,
              })}
              disabled={uploadMutation.isPending || uploadLines.length === 0}
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Upload {uploadLines.length} item{uploadLines.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete inventory item #{deleteTarget?.id}? This cannot be undone.
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

      {/* Clear Available Dialog */}
      <Dialog open={!!clearTarget} onOpenChange={(v) => { if (!v) setClearTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Available Stock</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete all available (undelivered) items for this product/package. Are you sure?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => clearTarget && clearMutation.mutate(clearTarget)} disabled={clearMutation.isPending}>
              {clearMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Clear All Available
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
