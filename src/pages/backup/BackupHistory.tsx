import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ShieldCheck } from "lucide-react";

export function BackupHistory() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">Restore History</h2>
      </div>
      <p className="text-muted-foreground text-sm -mt-4">
        View history of all restore operations performed on this server.
      </p>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No restore history</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Restore operations will appear here once you restore a backup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
