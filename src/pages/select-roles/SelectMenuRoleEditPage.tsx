import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RoleSelect } from "@/components/RoleSelect";
import { EmbedBuilder, EMBED_DEFAULTS } from "@/components/EmbedBuilder";
import type { EmbedFormData, EmbedField } from "@/components/EmbedBuilder";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ArrowLeft, Plus, X } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SelectMenuOption {
  label: string;
  emoji: string;
  role_id: string;
  description: string;
}

interface SelectRolePanel {
  id: number;
  name: string;
  placeholder: string;
  options: SelectMenuOption[];
  min_values: number;
  max_values: number;
  channel_id?: string;
  message_id?: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  created_at: string;
}

interface PanelForm {
  name: string;
  placeholder: string;
  min_values: number;
  max_values: number;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  options: SelectMenuOption[];
}

interface OptionForm {
  label: string;
  emoji: string;
  role_id: string;
  description: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const emptyPanelForm = (): PanelForm => ({
  name: "",
  placeholder: "Chọn role...",
  min_values: 1,
  max_values: 1,
  embed_title: "",
  embed_description: "",
  embed_color: EMBED_DEFAULTS.color,
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  embed_fields: [],
  options: [],
});

const emptyOptionForm = (): OptionForm => ({
  label: "",
  emoji: "",
  role_id: "",
  description: "",
});

// ─── Component ───────────────────────────────────────────────────────────────

export function SelectMenuRoleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

  // ── Fetch list, find item by id ──
  const { data: panels, isLoading } = useQuery<SelectRolePanel[]>({
    queryKey: ["select-roles"],
    queryFn: () =>
      apiFetch("/api/welcome/select-roles").then((r) =>
        r.json()
      ),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const item = id ? panels?.find((x) => String(x.id) === id) : undefined;

  // Populate form when item loads
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        placeholder: item.placeholder ?? "Chọn role...",
        min_values: item.min_values ?? 1,
        max_values: item.max_values ?? 1,
        embed_title: item.embed_title ?? "",
        embed_description: item.embed_description ?? "",
        embed_color: item.embed_color ?? EMBED_DEFAULTS.color,
        embed_footer: item.embed_footer ?? "",
        embed_image_url: item.embed_image_url ?? "",
        embed_thumbnail_url: item.embed_thumbnail_url ?? "",
        embed_fields: item.embed_fields ?? [],
        options: item.options?.map((o) => ({ ...o })) ?? [],
      });
    }
  }, [item?.id]);

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/welcome/select-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
      navigate(-1);
      toast({ title: "Đã tạo panel thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo panel",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: panelId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/welcome/select-roles/${panelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
      navigate(-1);
      toast({ title: "Đã cập nhật panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const body = {
      name: form.name,
      placeholder: form.placeholder,
      min_values: form.min_values,
      max_values: form.max_values,
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      embed_footer: form.embed_footer,
      embed_image_url: form.embed_image_url,
      embed_thumbnail_url: form.embed_thumbnail_url,
      embed_fields: form.embed_fields,
      options: form.options,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Option form helpers ──
  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, emptyOptionForm()],
    }));
  };

  const removeOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const updateOption = (idx: number, patch: Partial<OptionForm>) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Tạo mới" : "Edit"} Panel Select Menu Role</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label>Tên panel</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="VD: Chọn màu sắc"
          />
        </div>

        {/* Placeholder */}
        <div className="space-y-2">
          <Label>Placeholder</Label>
          <Input
            value={form.placeholder}
            onChange={(e) => setForm((p) => ({ ...p, placeholder: e.target.value }))}
            placeholder="VD: Chọn role bạn muốn..."
          />
        </div>

        {/* Min / Max values */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Giá trị tối thiểu</Label>
            <Input
              type="number"
              min={0}
              max={25}
              value={form.min_values}
              onChange={(e) =>
                setForm((p) => ({ ...p, min_values: Number(e.target.value) }))
              }
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label>Giá trị tối đa</Label>
            <Input
              type="number"
              min={1}
              max={25}
              value={form.max_values}
              onChange={(e) =>
                setForm((p) => ({ ...p, max_values: Number(e.target.value) }))
              }
              className="h-9"
            />
          </div>
        </div>

        <Separator />

        {/* Embed settings */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Cài đặt Embed</p>
          <EmbedBuilder
            data={{
              title: form.embed_title,
              description: form.embed_description,
              color: form.embed_color,
              footer: form.embed_footer,
              image_url: form.embed_image_url,
              thumbnail_url: form.embed_thumbnail_url,
              fields: form.embed_fields,
            }}
            onChange={(ed: EmbedFormData) => {
              setForm((p) => ({
                ...p,
                embed_title: ed.title,
                embed_description: ed.description,
                embed_color: ed.color,
                embed_footer: ed.footer,
                embed_image_url: ed.image_url,
                embed_thumbnail_url: ed.thumbnail_url,
                embed_fields: ed.fields,
              }));
            }}
            compact
          />
        </div>

        <Separator />

        {/* Options builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Lựa chọn Menu</p>
            <Button variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Thêm lựa chọn
            </Button>
          </div>

          {form.options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Chưa có lựa chọn nào. Nhấn "Thêm lựa chọn" để bắt đầu.
            </p>
          )}

          <div className="space-y-3">
            {form.options.map((opt, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-muted/30 p-3 space-y-3"
              >
                {/* Option header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Lựa chọn #{idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeOption(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Label + Emoji */}
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nhãn</Label>
                    <Input
                      value={opt.label}
                      onChange={(e) =>
                        updateOption(idx, { label: e.target.value })
                      }
                      placeholder="VD: Đỏ"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Emoji</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={opt.emoji}
                        onChange={(e) =>
                          updateOption(idx, { emoji: e.target.value })
                        }
                        placeholder="🔴"
                        className="h-8 text-sm"
                      />
                      <EmojiPicker onSelect={(emoji) => updateOption(idx, { emoji })} />
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <RoleSelect
                    value={opt.role_id}
                    onChange={(v) => updateOption(idx, { role_id: v })}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={opt.description}
                    onChange={(e) =>
                      updateOption(idx, { description: e.target.value })
                    }
                    placeholder="Mô tả ngắn cho lựa chọn này"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
