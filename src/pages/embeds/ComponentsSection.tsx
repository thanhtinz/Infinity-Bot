import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ExternalLink, LayoutGrid } from "lucide-react";
import type { CustomFormState, ComponentButton, ActionRow } from "./embedTypes";
import { emptyButton } from "./customMessagesHelpers";

interface ComponentsSectionProps {
  components: ActionRow[];
  onChange: (components: ActionRow[]) => void;
}

export function ComponentsSection({ components, onChange }: ComponentsSectionProps) {
  if (components.length === 0) return null;

  const updateRows = (updater: (rows: ActionRow[]) => ActionRow[]) => {
    onChange(updater(components));
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <LayoutGrid className="h-3.5 w-3.5" />Components
      </div>
      {components.map((row, rowIdx) => (
        <div key={rowIdx} className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
            <span className="text-xs font-semibold flex-1">Row {rowIdx + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Thêm button"
              disabled={row.components.length >= 5}
              onClick={() => {
                updateRows(rows => rows.map((r, i) => i === rowIdx ? { ...r, components: [...r.components, emptyButton()] } : r));
              }}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Xóa row"
              onClick={() => updateRows(rows => rows.filter((_, i) => i !== rowIdx))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Button previews + edit */}
          <div className="px-3 py-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {row.components.map((btn, btnIdx) => {
                const styleColors: Record<number, string> = {
                  1: "bg-[#5865F2] hover:bg-[#4752c4] text-white",
                  2: "bg-[#4E5058] hover:bg-[#6D6F78] text-white",
                  3: "bg-[#2D7D46] hover:bg-[#256137] text-white",
                  4: "bg-[#DA373C] hover:bg-[#a12828] text-white",
                  5: "bg-[#4E5058] hover:bg-[#6D6F78] text-white",
                };
                return (
                  <div key={btnIdx} className="flex items-center gap-1">
                    <div className={`px-3 py-1 rounded text-xs font-medium ${styleColors[btn.style] ?? styleColors[2]} ${btn.disabled ? "opacity-40" : ""}`}>
                      {btn.emoji && <span className="mr-1">{btn.emoji}</span>}
                      {btn.label || "Button"}
                      {btn.style === 5 && <ExternalLink className="h-3 w-3 ml-1 inline" />}
                    </div>
                    <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground"
                      onClick={() => {
                        updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                          ...r,
                          components: r.components.filter((_, bi) => bi !== btnIdx),
                        } : r));
                      }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
            {/* Button editor */}
            {row.components.map((btn, btnIdx) => (
              <div key={btnIdx} className="rounded-md border p-2 space-y-2 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium w-12 shrink-0">Btn {btnIdx + 1}</span>
                  <Select value={String(btn.style)} onValueChange={(v) => {
                    updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                      ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, style: Number(v) as ComponentButton["style"] } : b),
                    } : r));
                  }}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">🟣 Primary</SelectItem>
                      <SelectItem value="2">⬜ Secondary</SelectItem>
                      <SelectItem value="3">🟢 Success</SelectItem>
                      <SelectItem value="4">🔴 Danger</SelectItem>
                      <SelectItem value="5">🔗 Link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch checked={!!btn.disabled}
                    onCheckedChange={(v) => {
                      updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                        ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, disabled: v } : b),
                      } : r));
                    }} />
                  <span className="text-[10px] text-muted-foreground">Disabled</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Label</Label>
                    <Input className="h-7 text-xs" placeholder="Button label" value={btn.label}
                      onChange={(e) => {
                        updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                          ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, label: e.target.value } : b),
                        } : r));
                      }} />
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Emoji</Label>
                    <Input className="h-7 text-xs" placeholder="😀" value={btn.emoji ?? ""}
                      onChange={(e) => {
                        updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                          ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, emoji: e.target.value } : b),
                        } : r));
                      }} />
                  </div>
                </div>
                {btn.style === 5 ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">URL</Label>
                    <Input className="h-7 text-xs" placeholder="https://..." value={btn.url ?? ""}
                      onChange={(e) => {
                        updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                          ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, url: e.target.value } : b),
                        } : r));
                      }} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Custom ID</Label>
                    <Input className="h-7 text-xs font-mono" placeholder="my_button_id" value={btn.custom_id ?? ""}
                      onChange={(e) => {
                        updateRows(rows => rows.map((r, ri) => ri === rowIdx ? {
                          ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, custom_id: e.target.value } : b),
                        } : r));
                      }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
