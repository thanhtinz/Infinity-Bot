import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModerationCases } from "./ModerationCases";
import { ModerationNotes } from "./ModerationNotes";
import { ModerationActive } from "./ModerationActive";
import { ModerationSettings } from "./ModerationSettings";

export default function ModerationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "cases";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="text-muted-foreground">Manage moderation cases and settings</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="cases">
          <ModerationCases />
        </TabsContent>
        <TabsContent value="notes">
          <ModerationNotes />
        </TabsContent>
        <TabsContent value="active">
          <ModerationActive />
        </TabsContent>
        <TabsContent value="settings">
          <ModerationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
