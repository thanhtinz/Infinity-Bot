import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Save, Key, Image, Eye, EyeOff, Bot, Sparkles,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { DEFAULT_CONFIG } from "./shared";
import type { AIChatConfig } from "./shared";

function SaveBtn({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <Button size="sm" onClick={onClick} disabled={pending} className="gap-1.5 ml-auto shrink-0">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">Save</span>
    </Button>
  );
}

export function AIImageGenPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<AIChatConfig>(DEFAULT_CONFIG);
  const [showImageKey, setShowImageKey] = useState(false);

  const { data: cfg, isLoading: cfgLoading } = useQuery<AIChatConfig>({
    queryKey: ["ai-chat-config"],
    queryFn: () => apiFetch("/api/ai-chat/config").then(r => r.json()),
  });

  const { data: modelsData } = useQuery<{
    providers: Record<string, { value: string; label: string }[]>;
    image_providers: Record<string, { value: string; label: string }[]>;
  }>({
    queryKey: ["ai-chat-models"],
    queryFn: () => apiFetch("/api/ai-chat/models").then(r => r.json()),
    staleTime: Infinity,
  });

  useEffect(() => { if (cfg) setForm(cfg); }, [cfg]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<AIChatConfig>) =>
      apiFetch("/api/ai-chat/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-chat-config"] });
      toast({ title: "Saved!" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const imageModels = modelsData?.image_providers[form.image_provider ?? "openai"] ?? [];

  if (cfgLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <PageContainer>
      <PageHeader title="Image Generation" icon={Image} description="Configure AI image generation for your server" />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4" />Image Generation
              </CardTitle>
              <CardDescription>
                Allow users to generate images with <code className="text-xs bg-muted px-1 rounded">/ai imagine</code>
              </CardDescription>
            </div>
            <SaveBtn onClick={() => saveMutation.mutate({ image_gen_enabled: form.image_gen_enabled, image_provider: form.image_provider, image_api_key: form.image_api_key })} pending={saveMutation.isPending} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="img-en"
              checked={form.image_gen_enabled}
              onCheckedChange={v => setForm(f => ({ ...f, image_gen_enabled: v }))}
            />
            <Label htmlFor="img-en">Enable Image Generation</Label>
          </div>

          {form.image_gen_enabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Image Provider</Label>
                  <Select
                    value={form.image_provider ?? "openai"}
                    onValueChange={v => setForm(f => ({ ...f, image_provider: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">
                        <span className="flex items-center gap-1.5"><Bot className="h-4 w-4" />OpenAI DALL·E</span>
                      </SelectItem>
                      <SelectItem value="gemini">
                        <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" />Google Imagen</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Image Model</Label>
                  <Select
                    value={form.model ?? "__default"}
                    onValueChange={v => setForm(f => ({ ...f, model: v === "__default" ? null : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">Default</SelectItem>
                      {imageModels.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />Image API Key
                  {form.image_api_key_set && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">Configured</Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-normal">(optional — uses main key if empty)</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showImageKey ? "text" : "password"}
                    placeholder={form.image_api_key_set ? "••••••••••••••••" : "Optional separate key…"}
                    value={form.image_api_key ?? ""}
                    onChange={e => setForm(f => ({ ...f, image_api_key: e.target.value }))}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImageKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showImageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 border p-3 text-sm">
                <p className="font-medium mb-1">Bot command</p>
                <code className="text-xs bg-background px-1.5 py-0.5 rounded border">/ai imagine prompt: A futuristic city at sunset</code>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
