import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoggingConfig } from "./LoggingConfig";
import { LogViewer } from "./LogViewer";
import { Settings2, ScrollText, FileText } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";

export default function LoggingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "config";

  return (
    <PageContainer size="sm">
      <PageHeader title="Logging" description="Configure event logging and view logs" icon={FileText} />
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="config" className="flex items-center gap-1.5 px-3">
            <Settings2 className="h-3.5 w-3.5" /> Config
          </TabsTrigger>
          <TabsTrigger value="viewer" className="flex items-center gap-1.5 px-3">
            <ScrollText className="h-3.5 w-3.5" /> Log Viewer
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <LoggingConfig />
        </TabsContent>
        <TabsContent value="viewer" className="mt-4">
          <LogViewer />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
