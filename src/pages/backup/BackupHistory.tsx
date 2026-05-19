import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ShieldCheck } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";

export function BackupHistory() {
  return (
    <PageContainer>
      <PageHeader title="Restore History" icon={ScrollText} description="View history of all restore operations performed on this server." />

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No restore history</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Restore operations will appear here once you restore a backup.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
