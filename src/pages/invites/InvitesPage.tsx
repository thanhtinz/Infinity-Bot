import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteLeaderboard } from "./InviteLeaderboard";
import { InviteLog } from "./InviteLog";

export default function InvitesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "leaderboard";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invites</h1>
        <p className="text-muted-foreground">Track invite leaderboard and logs</p>
      </div>
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
    </div>
  );
}
