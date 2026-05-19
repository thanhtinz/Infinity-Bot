import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { ModerationCases } from "./ModerationCases";
import { ModerationNotes } from "./ModerationNotes";
import { ModerationActive } from "./ModerationActive";
import { ModerationSettings } from "./ModerationSettings";
import { Gavel, StickyNote, Clock, Settings2 } from "lucide-react";

export default function ModerationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "cases";

  return (
    <PageContainer>
      <PageHeader title="Moderation" icon={Shield} description="Manage moderation cases and settings" />
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="cases" className="flex items-center gap-1.5 px-3">
            <Gavel className="h-3.5 w-3.5" /> Cases
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5 px-3">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-1.5 px-3">
            <Clock className="h-3.5 w-3.5" /> Active
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5 px-3">
            <Settings2 className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cases" className="mt-4">
          <ModerationCases />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <ModerationNotes />
        </TabsContent>
        <TabsContent value="active" className="mt-4">
          <ModerationActive />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <ModerationSettings />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
