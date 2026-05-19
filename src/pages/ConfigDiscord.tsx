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
import { useT } from "@/i18n";
import { Bot, KeyRound } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";

const schema = z.object({
  discord_token: z.string().optional(),
  discord_client_id: z.string().optional(),
  discord_client_secret: z.string().optional(),
  support_server_url: z.string().url("Enter a valid Discord URL").or(z.literal("")).optional(),
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
  const { t } = useT();
  const isConfigured = typeof savedValue === "boolean" ? savedValue : !!savedValue;
  return (
    <div className="space-y-1">
      <Input
        type="password"
        placeholder={isConfigured ? `••••••••  (${t("configDiscord_configured")})` : placeholder}
        value={field.value || ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
        autoComplete="new-password"
      />
      {isConfigured && !field.value && (
        <p className="text-xs text-green-600 dark:text-green-400">✓ {t("configDiscord_configured")} — {t("configDiscord_leaveBlank")}</p>
      )}
    </div>
  );
}

export function ConfigDiscord() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { discord_token: "", discord_client_id: "", discord_client_secret: "", support_server_url: "" },
  });

  useEffect(() => {
    if (config)
      form.reset({
        discord_token: "",
        discord_client_id: config.discord_client_id || "",
        discord_client_secret: "",
        support_server_url: config.support_server_url || "",
      });
  }, [config]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => savePartial(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      toast({ title: t("toast_saved"), description: t("toast_discordBotSaved") });
    },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_saveFailed") }),
  });

  const isConfigured = !!config?.has_discord_token;

  return (
    <PageContainer size="sm">
      <PageHeader title={t("configDiscord_title")} description={t("configDiscord_desc")} icon={Bot}>
        {isConfigured && (
          <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
            ✓ {t("configDiscord_connected")}
          </Badge>
        )}
      </PageHeader>

      {!isLoading && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="w-4 h-4" /> {t("configDiscord_authInfo")}
                </CardTitle>
                <CardDescription>
                  {t("configDiscord_getFrom")}{" "}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary"
                  >
                    {t("configDiscord_devPortal")}
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="discord_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("configDiscord_botToken")}</FormLabel>
                      <FormControl>
                        <MaskedField field={field} placeholder="MTc..." savedValue={config?.has_discord_token} />
                      </FormControl>
                      <FormDescription>
                        {t("configDiscord_tokenDesc")}
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
                        <FormLabel>{t("configDiscord_oauth2ClientId")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder={
                              config?.discord_client_id
                                ? `${String(config.discord_client_id).slice(0, 8)}...`
                                : t("configDiscord_applicationId")
                            }
                          />
                        </FormControl>
                        <FormDescription>{t("configDiscord_generalInfoAppId")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discord_client_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("configDiscord_oauth2ClientSecret")}</FormLabel>
                        <FormControl>
                          <MaskedField
                            field={field}
                            placeholder={t("configDiscord_clientSecretPlaceholder")}
                            savedValue={config?.has_discord_client_secret}
                          />
                        </FormControl>
                        <FormDescription>{t("configDiscord_oauth2ClientSecretDesc")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="support_server_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("configDiscord_supportServerLink")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="https://discord.gg/your-support"
                        />
                      </FormControl>
                      <FormDescription>
                        {t("configDiscord_supportServerDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-1">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? t("saving") : t("save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </PageContainer>
  );
}
