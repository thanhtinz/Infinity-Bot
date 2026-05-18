import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifyMembers } from "./VerifyMembers";
import { VerifyConfig } from "./VerifyConfig";
import { VerifyPull } from "./VerifyPull";
import { VerifyStats } from "./VerifyStats";

export default function VerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "members";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verification</h1>
        <p className="text-muted-foreground">Manage server verification</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="pull">Pull</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <VerifyMembers />
        </TabsContent>
        <TabsContent value="config">
          <VerifyConfig />
        </TabsContent>
        <TabsContent value="pull">
          <VerifyPull />
        </TabsContent>
        <TabsContent value="stats">
          <VerifyStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}
