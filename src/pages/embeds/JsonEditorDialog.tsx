import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileJson } from "lucide-react";
import type { EmbedData } from "./embedTypes";

interface JsonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  embeds: EmbedData[];
  onApply: (content: string, embeds: EmbedData[]) => void;
}

export function JsonEditorDialog({ open, onOpenChange, content, embeds, onApply }: JsonEditorDialogProps) {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setJsonText(JSON.stringify({ content, embeds }, null, 2));
    }
    onOpenChange(isOpen);
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText) as { content?: string; embeds?: EmbedData[] };
      if (!Array.isArray(parsed.embeds)) throw new Error("embeds phải là array");
      onApply(parsed.content ?? content, parsed.embeds!);
      onOpenChange(false);
      toast({ title: "Đã áp dụng JSON" });
    } catch (e) {
      toast({ title: "JSON không hợp lệ", description: String(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" />JSON Editor</DialogTitle>
          <DialogDescription>Chỉnh sửa trực tiếp JSON của tin nhắn. Nhấn Áp dụng để cập nhật form.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={18}
          className="font-mono text-xs resize-y"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(jsonText); toast({ title: "Đã copy!" }); }}>
            <Copy className="h-4 w-4 mr-1" />Copy
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleApply}>Áp dụng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
