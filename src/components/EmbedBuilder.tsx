/**
 * Shared Embed Builder component — full Discord-style embed editor with live preview.
 * Reusable across Welcome, Button Roles, Select Menu Roles, Reaction Roles, etc.
 */
import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiInput, EmojiTextarea } from "@/components/EmojiInput";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight, Image } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedFormData {
  title: string;
  description: string;
  color: string;
  footer: string;
  image_url: string;
  thumbnail_url: string;
  fields: EmbedField[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#5865F2", "#57f287", "#fee75c", "#ed4245", "#eb459e",
  "#2b2d31", "#3498db", "#e67e22", "#9b59b6", "#1abc9c",
];

export const EMBED_DEFAULTS: EmbedFormData = {
  title: "",
  description: "",
  color: "#5865F2",
  footer: "",
  image_url: "",
  thumbnail_url: "",
  fields: [],
};

// ─── Discord Preview ─────────────────────────────────────────────────────────

interface PreviewProps {
  data: EmbedFormData;
  varsMap?: Record<string, string>;
}

function substituteVars(text: string, varsMap?: Record<string, string>): string {
  if (!varsMap) return text;
  let result = text;
  for (const [key, val] of Object.entries(varsMap)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

export function DiscordEmbedPreview({ data, varsMap }: PreviewProps) {
  const colorHex = data.color || "#5865F2";
  const hasContent = data.title || data.description || data.fields.length > 0 || data.footer;

  if (!hasContent) {
    return (
      <div className="rounded-md bg-[#313338] p-6 text-center">
        <p className="text-sm text-[#B5BAC1]">Embed preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#313338] p-4 flex gap-3">
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
      />
      <div className="flex-1 min-w-0 space-y-2">
        {data.title && (
          <p className="font-semibold text-[#F2F3F5] text-sm leading-snug">
            {substituteVars(data.title, varsMap)}
          </p>
        )}
        {data.description && (
          <p className="text-[#B5BAC1] text-sm whitespace-pre-wrap leading-snug">
            {substituteVars(data.description, varsMap)}
          </p>
        )}
        {data.fields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {data.fields.map((f, i) => (
              <div key={i} className={f.inline ? "" : "col-span-2"}>
                <p className="font-semibold text-[#F2F3F5] text-xs">
                  {substituteVars(f.name, varsMap)}
                </p>
                <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap">
                  {substituteVars(f.value, varsMap)}
                </p>
              </div>
            ))}
          </div>
        )}
        {data.image_url && (
          <div className="pt-1">
            <img
              src={data.image_url}
              alt=""
              className="rounded max-h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        {data.footer && (
          <p className="text-[#B5BAC1] text-[11px] pt-1">
            {substituteVars(data.footer, varsMap)}
          </p>
        )}
      </div>
      {data.thumbnail_url && (
        <img
          src={data.thumbnail_url}
          alt=""
          className="w-16 h-16 rounded object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

// ─── Embed Builder ───────────────────────────────────────────────────────────

interface EmbedBuilderProps {
  data: EmbedFormData;
  onChange: (data: EmbedFormData) => void;
  /** Variable hint text to show below description */
  variableHint?: string;
  /** Variable map for preview substitution */
  varsMap?: Record<string, string>;
  /** Show image/thumbnail URL inputs (default: true) */
  showImages?: boolean;
  /** Show fields section (default: true) */
  showFields?: boolean;
  /** Max fields count (default: 10) */
  maxFields?: number;
  /** Compact mode: collapsible advanced section (default: false) */
  compact?: boolean;
}

export function EmbedBuilder({
  data,
  onChange,
  variableHint,
  varsMap,
  showImages = true,
  showFields = true,
  maxFields = 10,
  compact = false,
}: EmbedBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<EmbedFormData>) => {
    onChange({ ...data, ...partial });
  };

  const addField = () => {
    if (data.fields.length >= maxFields) return;
    update({ fields: [...data.fields, { name: "", value: "", inline: false }] });
  };

  const removeField = (idx: number) => {
    update({ fields: data.fields.filter((_, i) => i !== idx) });
  };

  const updateField = (idx: number, key: keyof EmbedField, val: string | boolean) => {
    update({
      fields: data.fields.map((f, i) => (i === idx ? { ...f, [key]: val } : f)),
    });
  };

  const colorSection = (
    <div className="space-y-2">
      <Label className="text-sm">Embed color</Label>
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(
              "w-7 h-7 rounded-full border-2 transition-all",
              data.color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
            )}
            style={{ backgroundColor: c }}
            onClick={() => update({ color: c })}
          />
        ))}
        <Input
          type="color"
          value={data.color || "#5865F2"}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update({ color: e.target.value })}
          className="w-8 h-8 p-0 border-0 cursor-pointer"
        />
      </div>
    </div>
  );

  const titleSection = (
    <div className="space-y-2">
      <Label className="text-sm">Title</Label>
      <EmojiInput
        value={data.title}
        onChange={(e: ChangeEvent<HTMLInputElement>) => update({ title: e.target.value })}
        placeholder="Embed title"
      />
    </div>
  );

  const descriptionSection = (
    <div className="space-y-2">
      <Label className="text-sm">Description</Label>
      <EmojiTextarea
        value={data.description}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update({ description: e.target.value })}
        placeholder="Embed content..."
        rows={3}
      />
      {variableHint && (
        <p className="text-xs text-muted-foreground">{variableHint}</p>
      )}
    </div>
  );

  const footerSection = (
    <div className="space-y-2">
      <Label className="text-sm">Footer</Label>
      <EmojiInput
        value={data.footer}
        onChange={(e: ChangeEvent<HTMLInputElement>) => update({ footer: e.target.value })}
        placeholder="Footer text..."
      />
    </div>
  );

  const imageSection = showImages ? (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5" /> Large Image
        </Label>
        <Input
          value={data.image_url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update({ image_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5" /> Thumbnail
        </Label>
        <Input
          value={data.thumbnail_url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update({ thumbnail_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  ) : null;

  const fieldsSection = showFields ? (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Fields</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          disabled={data.fields.length >= maxFields}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Field
        </Button>
      </div>
      {data.fields.length === 0 && (
        <p className="text-xs text-muted-foreground">No fields yet.</p>
      )}
      <div className="space-y-3">
        {data.fields.map((field, idx) => (
          <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Field {idx + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive"
                onClick={() => removeField(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <EmojiInput
              value={field.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(idx, "name", e.target.value)}
              placeholder="Field name"
              className="text-sm"
            />
            <EmojiTextarea
              value={field.value}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField(idx, "value", e.target.value)}
              placeholder="Field value"
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={field.inline}
                onCheckedChange={(val: boolean) => updateField(idx, "inline", val)}
              />
              <Label className="text-xs">Inline</Label>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Compact mode wraps footer/image/fields in a collapsible section
  if (compact) {
    return (
      <div className="space-y-4">
        {colorSection}
        {titleSection}
        {descriptionSection}

        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
          onClick={() => setShowAdvanced(!showAdvanced)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowAdvanced(!showAdvanced); } }}
        >
          {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Advanced (footer, images, fields)
        </div>

        {showAdvanced && (
          <div className="space-y-4 pl-2 border-l-2 border-muted">
            {footerSection}
            {imageSection}
            {fieldsSection}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <DiscordEmbedPreview data={data} varsMap={varsMap} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {colorSection}
      {titleSection}
      {descriptionSection}
      {footerSection}
      {imageSection}
      {fieldsSection}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <DiscordEmbedPreview data={data} varsMap={varsMap} />
      </div>
    </div>
  );
}
