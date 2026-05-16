import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const setupSchema = z.object({
  discord_client_id: z.string().min(1, "Client ID là bắt buộc"),
  discord_client_secret: z.string().min(1, "Client Secret là bắt buộc"),
  public_app_url: z.string().url("Phải là URL hợp lệ, ví dụ: https://abc.preview.workshop.ai"),
});

type SetupValues = z.infer<typeof setupSchema>;

export function InitialSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      discord_client_id: "",
      discord_client_secret: "",
      public_app_url: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: SetupValues) => {
      const currentConfigResponse = await fetch("/api/config");
      if (!currentConfigResponse.ok) {
        throw new Error("Không thể tải cấu hình hiện tại");
      }

      const currentConfig = await currentConfigResponse.json();
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentConfig,
          discord_client_id: values.discord_client_id,
          discord_client_secret: values.discord_client_secret,
          public_app_url: values.public_app_url.replace(/\/$/, ""),
        }),
      });

      if (!response.ok) {
        throw new Error("Không thể lưu cấu hình đăng nhập Discord");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setup_status"] });
      await queryClient.invalidateQueries({ queryKey: ["config"] });
      toast({
        title: "Đã lưu cấu hình",
        description: "Bạn có thể đăng nhập Discord để vào dashboard.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Lưu thất bại",
        description: "Kiểm tra lại Client ID và Client Secret rồi thử lại.",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Thiết lập lần đầu</CardTitle>
              <CardDescription>
                Nhập Discord OAuth Client ID và Client Secret để bật đăng nhập dashboard.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="discord_client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord OAuth Client ID</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discord_client_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord OAuth Client Secret</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="public_app_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL App (Callback Base URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://abc.preview.workshop.ai" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      URL này phải được thêm vào Discord Developer Portal → OAuth2 → Redirects dưới dạng:<br />
                      <code className="bg-muted px-1 rounded">{field.value ? `${field.value}/api/auth/callback` : "https://your-domain/api/auth/callback"}</code>
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Lưu và tiếp tục"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
