import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function BackupList({ getBackups, loadBackup, deleteBackup }: {
  getBackups: () => { id: string; name: string; timestamp: string; data: object }[];
  loadBackup: (data: Record<string, unknown>) => void;
  deleteBackup: (id: string) => void;
}) {
  const [list, setList] = useState(() => getBackups());
  const refresh = () => setList(getBackups());
  if (!list.length) return <p className="text-sm text-muted-foreground text-center py-6">Chưa có backup nào. Nhấn "Lưu backup hiện tại".</p>;
  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto">
      {list.map(b => (
        <div key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{b.name}</div>
            <div className="text-xs text-muted-foreground">{new Date(b.timestamp).toLocaleString("vi-VN")}</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => loadBackup(b.data as Record<string, unknown>)}>Load</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => { deleteBackup(b.id); refresh(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
