import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Code2, Copy } from "lucide-react";
import type { CustomFormState } from "./embedTypes";

interface CodeGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CustomFormState;
}

function generatePythonCode(form: CustomFormState): string {
  const lines: string[] = ["import discord", ""];
  form.embeds.forEach((emb, i) => {
    const varName = form.embeds.length === 1 ? "embed" : `embed${i + 1}`;
    const colorHex = (emb.color || "#5865F2").replace("#", "");
    lines.push(`${varName} = discord.Embed(`);
    if (emb.title) lines.push(`    title=${JSON.stringify(emb.title)},`);
    if (emb.description) lines.push(`    description=${JSON.stringify(emb.description)},`);
    lines.push(`    color=0x${colorHex},`);
    lines.push(")");
    if (emb.author) lines.push(`${varName}.set_author(name=${JSON.stringify(emb.author)}${emb.author_icon_url ? `, icon_url=${JSON.stringify(emb.author_icon_url)}` : ""})`);
    if (emb.footer) lines.push(`${varName}.set_footer(text=${JSON.stringify(emb.footer)})`);
    if (emb.thumbnail_url) lines.push(`${varName}.set_thumbnail(url=${JSON.stringify(emb.thumbnail_url)})`);
    if (emb.image_url) lines.push(`${varName}.set_image(url=${JSON.stringify(emb.image_url)})`);
    emb.fields.forEach(f => {
      lines.push(`${varName}.add_field(name=${JSON.stringify(f.name)}, value=${JSON.stringify(f.value)}, inline=${f.inline ? "True" : "False"})`);
    });
    lines.push("");
  });
  if (form.components.length > 0) {
    lines.push("view = discord.ui.View(timeout=None)");
    form.components.forEach((row, ri) => {
      row.components.forEach(btn => {
        const style = { 1: "primary", 2: "secondary", 3: "success", 4: "danger", 5: "link" }[btn.style] ?? "secondary";
        if (btn.style === 5) {
          lines.push(`view.add_item(discord.ui.Button(style=discord.ButtonStyle.link, label=${JSON.stringify(btn.label)}, url=${JSON.stringify(btn.url || "")}, row=${ri}))`);
        } else {
          lines.push(`view.add_item(discord.ui.Button(style=discord.ButtonStyle.${style}, label=${JSON.stringify(btn.label)}, custom_id=${JSON.stringify(btn.custom_id || btn.label)}, row=${ri}))`);
        }
      });
    });
    lines.push("");
  }
  const embedVars = form.embeds.length === 1 ? "embed" : form.embeds.map((_, i) => `embed${i + 1}`).join(", ");
  const sendArgs = [`embeds=[${embedVars}]`];
  if (form.content) sendArgs.unshift(`content=${JSON.stringify(form.content)}`);
  if (form.components.length > 0) sendArgs.push("view=view");
  lines.push(`await channel.send(${sendArgs.join(", ")})`);
  return lines.join("\n");
}

function generateJSCode(form: CustomFormState): string {
  const lines: string[] = [
    'const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");',
    "",
  ];
  form.embeds.forEach((emb, i) => {
    const varName = form.embeds.length === 1 ? "embed" : `embed${i + 1}`;
    const colorHex = (emb.color || "#5865F2").replace("#", "0x");
    lines.push(`const ${varName} = new EmbedBuilder()`);
    if (emb.title) lines.push(`  .setTitle(${JSON.stringify(emb.title)})`);
    if (emb.description) lines.push(`  .setDescription(${JSON.stringify(emb.description)})`);
    lines.push(`  .setColor(${colorHex})`);
    if (emb.author) lines.push(`  .setAuthor({ name: ${JSON.stringify(emb.author)}${emb.author_icon_url ? `, iconURL: ${JSON.stringify(emb.author_icon_url)}` : ""} })`);
    if (emb.footer) lines.push(`  .setFooter({ text: ${JSON.stringify(emb.footer)} })`);
    if (emb.thumbnail_url) lines.push(`  .setThumbnail(${JSON.stringify(emb.thumbnail_url)})`);
    if (emb.image_url) lines.push(`  .setImage(${JSON.stringify(emb.image_url)})`);
    if (emb.fields.length > 0) {
      const fieldsStr = emb.fields.map(f => `{ name: ${JSON.stringify(f.name)}, value: ${JSON.stringify(f.value)}, inline: ${f.inline} }`).join(", ");
      lines.push(`  .addFields(${fieldsStr})`);
    }
    lines.push(";");
    lines.push("");
  });
  if (form.components.length > 0) {
    form.components.forEach((row, ri) => {
      lines.push(`const row${ri + 1} = new ActionRowBuilder().addComponents(`);
      row.components.forEach((btn, bi) => {
        const styleMap: Record<number, string> = { 1: "Primary", 2: "Secondary", 3: "Success", 4: "Danger", 5: "Link" };
        const style = styleMap[btn.style] ?? "Secondary";
        lines.push(`  new ButtonBuilder().setLabel(${JSON.stringify(btn.label)}).setStyle(ButtonStyle.${style})${btn.style === 5 ? `.setURL(${JSON.stringify(btn.url || "")})` : `.setCustomId(${JSON.stringify(btn.custom_id || btn.label)})`}${bi < row.components.length - 1 ? "," : ""}`);
      });
      lines.push(");");
    });
    lines.push("");
  }
  const embedVars = form.embeds.length === 1 ? "embed" : form.embeds.map((_, i) => `embed${i + 1}`).join(", ");
  const rowVars = form.components.map((_, i) => `row${i + 1}`).join(", ");
  lines.push("await channel.send({");
  if (form.content) lines.push(`  content: ${JSON.stringify(form.content)},`);
  lines.push(`  embeds: [${embedVars}],`);
  if (form.components.length > 0) lines.push(`  components: [${rowVars}],`);
  lines.push("});");
  return lines.join("\n");
}

export function CodeGeneratorDialog({ open, onOpenChange, form }: CodeGeneratorDialogProps) {
  const { toast } = useToast();
  const pythonCode = generatePythonCode(form);
  const jsCode = generateJSCode(form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" />Code Generator</DialogTitle>
          <DialogDescription>Generate code from the current message to use in the bot.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="python">
          <TabsList className="mb-2">
            <TabsTrigger value="python">Python (discord.py)</TabsTrigger>
            <TabsTrigger value="js">JavaScript (discord.js)</TabsTrigger>
          </TabsList>
          <TabsContent value="python">
            <div className="relative">
              <Textarea value={pythonCode} readOnly rows={20} className="font-mono text-xs resize-y bg-muted" />
              <Button size="sm" variant="outline" className="absolute top-2 right-2"
                onClick={() => { navigator.clipboard.writeText(pythonCode); toast({ title: "Copied!" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1" />Copy
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="js">
            <div className="relative">
              <Textarea value={jsCode} readOnly rows={20} className="font-mono text-xs resize-y bg-muted" />
              <Button size="sm" variant="outline" className="absolute top-2 right-2"
                onClick={() => { navigator.clipboard.writeText(jsCode); toast({ title: "Copied!" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1" />Copy
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
