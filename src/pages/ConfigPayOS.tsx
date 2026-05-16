import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ExternalLink, Zap, Loader2 } from "lucide-react";
import { useState } from "react";
import { useGuild } from "@/contexts/GuildContext";

const schema = z.object({
  payos_client_id: z.string().optional(),
  payos_api_key: z.string().optional(),
  payos_checksum_key: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function MaskedField({
  field,
  savedValue,
  placeholder,
}: {
  field: { value: string | undefined; onChange: (v: string) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> };
  savedValue?: string | boolean | null;
  placeholder?: string;
}) {
  const isConfigured = typeof savedValue === "boolean" ? savedValue : !!savedValue;
  return (
    <div className="space-y-1">
      <Input
        type="password"
        placeholder={isConfigured ? "••••••••  (đã cấu hình)" : placeholder}
        value={field.value || ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
        autoComplete="new-password"
      />
      {isConfigured && !field.value && (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Đã cấu hình</p>
      )}
    </div>
  );
}

export function ConfigPayOS() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const { selectedGuildId } = useGuild();

  const { data: config, isLoading } = useQuery({
    queryKey: ["payos_config", selectedGuildId],
    queryFn: () => fetch("/api/payos/config", {
      credentials: "include",
      headers: { "X-Guild-ID": selectedGuildId! },
    }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { payos_client_id: "", payos_api_key: "", payos_checksum_key: "" },
  });

  useEffect(() => {
    if (config)
      form.reset({
        payos_client_id: config.payos_client_id || "",
        payos_api_key: "",
        payos_checksum_key: "",
      });
  }, [config]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => fetch("/api/payos/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guild-ID": selectedGuildId! },
      credentials: "include",
      body: JSON.stringify(v),
    }).then(r => { if (!r.ok) throw new Error("Lưu thất bại"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payos_config", selectedGuildId] });
      toast({ title: "Saved", description: "Cấu hình PayOS đã được lưu." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Lưu thất bại." }),
  });

  const isConfigured = !!config?.has_payos_api_key;

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/payos/test", {
        method: "POST",
        credentials: "include",
        headers: { "X-Guild-ID": selectedGuildId! },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Lỗi không xác định");
      toast({ title: "Kết nối thành công", description: data.message });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi kết nối";
      toast({ variant: "destructive", title: "Test thất bại", description: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">PayOS</h1>
          <p className="text-sm text-muted-foreground">Cổng thanh toán tạo mã QR cho đơn hàng.</p>
        </div>
        {isConfigured && (
          <Badge className="ml-auto bg-green-500/15 text-green-600 border-green-500/30">
            ✓ Đã cấu hình
          </Badge>
        )}
      </div>

      {!isLoading && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin API</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  Lấy từ{" "}
                  <a
                    href="https://my.payos.vn"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline text-primary"
                  >
                    my.payos.vn <ExternalLink className="w-3 h-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="payos_client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder={
                            config?.payos_client_id
                              ? `${String(config.payos_client_id).slice(0, 8)}...`
                              : "Client ID"
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payos_api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <MaskedField field={field} savedValue={config?.has_payos_api_key} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payos_checksum_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Checksum Key</FormLabel>
                      <FormControl>
                        <MaskedField field={field} savedValue={config?.has_payos_checksum_key} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-1 flex items-center gap-2">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : "Lưu cấu hình"}
                  </Button>
                  {isConfigured && (
                    <Button type="button" variant="outline" disabled={testing} onClick={handleTest}>
                      {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
                      {testing ? "Đang test..." : "Test kết nối"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}
