import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, KeyRound } from "lucide-react";

const schema = z.object({
  discord_token: z.string().optional(),
  discord_client_id: z.string().optional(),
  discord_client_secret: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

async function savePartial(partial: Record<string, unknown>) {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

function MaskedField({
  field,
  placeholder,
  savedValue,
}: {
  field: { value: string | undefined; onChange: (v: string) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> };
  placeholder?: string;
  savedValue?: string | boolean | null;
}) {
  const isConfigured = typeof savedValue === "boolean" ? savedValue : !!savedValue;
  return (
    <div className="space-y-1">
      <Input
        type="password"
        placeholder={isConfigured ? "••••••••  (configured)" : placeholder}
        value={field.value || ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
        autoComplete="new-password"
      />
      {isConfigured && !field.value && (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Configured — leave blank to keep unchanged</p>
      )}
    </div>
  );
}

export function ConfigDiscord() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { discord_token: "", discord_client_id: "", discord_client_secret: "" },
  });

  useEffect(() => {
    if (config)
      form.reset({
        discord_token: "",
        discord_client_id: config.discord_client_id || "",
        discord_client_secret: "",
      });
  }, [config]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => savePartial(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      toast({ title: "Saved", description: "Discord Bot config saved." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Save failed." }),
  });

  const isConfigured = !!config?.has_discord_token;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Discord Bot</h1>
          <p className="text-sm text-muted-foreground">Token and OAuth to connect the bot with Discord.</p>
        </div>
        {isConfigured && (
          <Badge className="ml-auto bg-green-500/15 text-green-600 border-green-500/30">
            ✓ Connected
          </Badge>
        )}
      </div>

      {!isLoading && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="w-4 h-4" /> Auth info
                </CardTitle>
                <CardDescription>
                  Get from{" "}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary"
                  >
                    Discord Developer Portal
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="discord_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bot Token</FormLabel>
                      <FormControl>
                        <MaskedField field={field} placeholder="MTc..." savedValue={config?.has_discord_token} />
                      </FormControl>
                      <FormDescription>
                        Bot → Token → Reset Token. Never share this token.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discord_client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OAuth2 Client ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder={
                              config?.discord_client_id
                                ? `${String(config.discord_client_id).slice(0, 8)}...`
                                : "Application ID"
                            }
                          />
                        </FormControl>
                        <FormDescription>General Information → Application ID</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discord_client_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OAuth2 Client Secret</FormLabel>
                        <FormControl>
                          <MaskedField
                            field={field}
                            placeholder="Client secret..."
                            savedValue={config?.has_discord_client_secret}
                          />
                        </FormControl>
                        <FormDescription>OAuth2 → Client Secret</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-1">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : "Save Config"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}
