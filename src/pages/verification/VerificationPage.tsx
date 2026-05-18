import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VerifyMembers } from "./VerifyMembers";
import { VerifyConfig } from "./VerifyConfig";
import { VerifyPull } from "./VerifyPull";
import { VerifyStats } from "./VerifyStats";

export default function VerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "members";

  return (
    <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
      <TabsList>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>

      {/* Members + Pull merged */}
      <TabsContent value="members" className="space-y-6">
        <VerifyMembers />
        <Separator />
        <VerifyPull />
      </TabsContent>

      <TabsContent value="config">
        <VerifyConfig />
      </TabsContent>

      <TabsContent value="stats">
        <VerifyStats />
      </TabsContent>
    </Tabs>
  );
}
