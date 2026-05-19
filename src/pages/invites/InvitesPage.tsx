import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { InviteLeaderboard } from "./InviteLeaderboard";
import { InviteLog } from "./InviteLog";

export default function InvitesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "leaderboard";

  return (
    <PageContainer>
      <PageHeader title="Invites" icon={Users} description="Track invite leaderboard and logs" />
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>
        <TabsContent value="leaderboard">
          <InviteLeaderboard />
        </TabsContent>
        <TabsContent value="log">
          <InviteLog />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
