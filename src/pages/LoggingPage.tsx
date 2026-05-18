import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoggingConfig } from "./LoggingConfig";
import { LogViewer } from "./LogViewer";

export default function LoggingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "config";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logging</h1>
        <p className="text-muted-foreground">Configure event logging and view logs</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="viewer">Log Viewer</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <LoggingConfig />
        </TabsContent>
        <TabsContent value="viewer">
          <LogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
