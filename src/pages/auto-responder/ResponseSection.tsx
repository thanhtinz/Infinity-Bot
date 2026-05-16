import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  Plus,
  X,
  Type,
  Layout,
  Smile,
  Variable,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { AutoResponderRule, EmbedField, RuleForm } from "./arTypes";
import { PRESET_COLORS, VARIABLE_GROUPS } from "./arConstants";

interface ResponseSectionProps {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  hasText: boolean;
  hasEmbed: boolean;
  hasReact: boolean;
  varsOpen: boolean;
  setVarsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFocusedInput: React.Dispatch<React.SetStateAction<"text" | "embed_desc" | null>>;
  addField: () => void;
  removeField: (idx: number) => void;
  updateField: (idx: number, patch: Partial<EmbedField>) => void;
  addEmoji: (emoji: string) => void;
  removeEmoji: (emoji: string) => void;
  insertVariable: (key: string) => void;
}

export function ResponseSection({
  form,
  setForm,
  hasText,
  hasEmbed,
  hasReact,
  varsOpen,
  setVarsOpen,
  setFocusedInput,
  addField,
  removeField,
  updateField,
  addEmoji,
  removeEmoji,
  insertVariable,
}: ResponseSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Layout className="h-3.5 w-3.5" />
        Phản hồi
      </p>

      {/* Response type toggles */}
      <div className="space-y-2">
        <Label>Loại phản hồi</Label>
        <div className="flex flex-wrap gap-3">
          {([
            { key: "text" as const, label: "Text", icon: Type },
            { key: "embed" as const, label: "Embed", icon: Layout },
            { key: "react" as const, label: "Reaction", icon: Smile },
          ] as const).map(({ key, label, icon: Icon }) => {
            const active =
              key === "text" ? hasText :
              key === "embed" ? hasEmbed :
              hasReact;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setForm((p) => {
                    let t = p.response_type === "react" && key !== "react" ? "" : p.response_type;
                    let text = t.includes("text");
                    let embed = t.includes("embed");
                    let react = t === "react" || t.includes("+react");
                    if (key === "text") { text = !text; if (text) embed = false; }
                    if (key === "embed") { embed = !embed; if (embed) text = false; }
                    if (key === "react") react = !react;
                    let newType: AutoResponderRule["response_type"] = "text";
                    if (text && react) newType = "text+react";
                    else if (embed && react) newType = "embed+react";
                    else if (text) newType = "text";
                    else if (embed) newType = "embed";
                    else if (react) newType = "react";
                    else newType = "text";
                    return { ...p, response_type: newType };
                  });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 transition-all text-xs",
                  active
                    ? "border-foreground bg-foreground/5"
                    : "border-transparent bg-muted/30 hover:bg-muted/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Chọn nhiều loại cùng lúc. Text và Embed không thể bật đồng thời.
        </p>
      </div>

      {/* Variables Reference Panel */}
      <div className="rounded-lg border bg-muted/20">
        <button
          type="button"
          onClick={() => setVarsOpen(!varsOpen)}
          className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-indigo-500" />
            Biến số (Variables)
          </span>
          {varsOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {varsOpen && (
          <div className="px-3 pb-3 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Nhấn vào biến để chèn vào nội dung. Click vào ô văn bản trước để chọn vị trí chèn.
            </p>
            {VARIABLE_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3 w-3" />
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {group.vars.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-mono hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                        title={v.desc}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Text response */}
      {hasText && (
        <div className="space-y-2">
          <Label>Nội dung phản hồi</Label>
          <Textarea
            value={form.response_text}
            onChange={(e) =>
              setForm((p) => ({ ...p, response_text: e.target.value }))
            }
            onFocus={() => setFocusedInput("text")}
            placeholder="Nội dung bot sẽ gửi khi tin nhắn khớp điều kiện..."
            rows={5}
          />
        </div>
      )}

      {/* Embed response */}
      {hasEmbed && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tiêu đề Embed</Label>
            <Input
              value={form.response_embed.title}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    title: e.target.value,
                  },
                }))
              }
              placeholder="Tiêu đề embed"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.response_embed.description}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    description: e.target.value,
                  },
                }))
              }
              onFocus={() => setFocusedInput("embed_desc")}
              placeholder="Nội dung embed"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Màu</Label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        response_embed: { ...p.response_embed, color: c },
                      }))
                    }
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      form.response_embed.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={form.response_embed.color}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    response_embed: {
                      ...p.response_embed,
                      color: e.target.value,
                    },
                  }))
                }
                className="h-7 w-10 p-0 border-0 cursor-pointer"
              />
            </div>
          </div>

          <Separator />

          {/* Embed extras */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Tùy chọn thêm</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Author</Label>
                <Input
                  value={form.response_embed.author_name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      response_embed: {
                        ...p.response_embed,
                        author_name: e.target.value,
                      },
                    }))
                  }
                  placeholder="Tên tác giả"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Author Icon URL</Label>
                <Input
                  value={form.response_embed.author_icon_url}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      response_embed: {
                        ...p.response_embed,
                        author_icon_url: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Footer</Label>
                <Input
                  value={form.response_embed.footer}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      response_embed: {
                        ...p.response_embed,
                        footer: e.target.value,
                      },
                    }))
                  }
                  placeholder="Footer"
                  className="h-8 text-sm"
                />
              </div>
              <div />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Thumbnail URL</Label>
                <Input
                  value={form.response_embed.thumbnail_url}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      response_embed: {
                        ...p.response_embed,
                        thumbnail_url: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input
                  value={form.response_embed.image_url}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      response_embed: {
                        ...p.response_embed,
                        image_url: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Fields builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Fields</p>
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Thêm field
              </Button>
            </div>

            {form.response_embed.fields.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Chưa có field nào. Nhấn "Thêm field" để bắt đầu.
              </p>
            )}

            <div className="space-y-3">
              {form.response_embed.fields.map((field, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border bg-muted/30 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Field #{idx + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeField(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={field.name}
                        onChange={(e) =>
                          updateField(idx, { name: e.target.value })
                        }
                        placeholder="Tên field"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Giá trị</Label>
                      <Input
                        value={field.value}
                        onChange={(e) =>
                          updateField(idx, { value: e.target.value })
                        }
                        placeholder="Nội dung"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.inline}
                      onCheckedChange={(checked) =>
                        updateField(idx, { inline: checked })
                      }
                      className="scale-75"
                    />
                    <Label className="text-xs">Inline</Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reaction emojis */}
      {hasReact && (
        <div className="space-y-2">
          <Label>Reaction emojis</Label>
          <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border bg-background">
            {form.reaction_emojis.map((emoji) => (
              <Badge
                key={emoji}
                variant="secondary"
                className="gap-1 text-sm pr-1"
              >
                {emoji}
                <button
                  type="button"
                  onClick={() => removeEmoji(emoji)}
                  className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <EmojiPicker
              onSelect={addEmoji}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Thêm
              </Button>
            </EmojiPicker>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Chọn emoji để react vào tin nhắn gốc
          </p>
        </div>
      )}
    </div>
  );
}
