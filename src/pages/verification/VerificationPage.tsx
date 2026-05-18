import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifyMembers } from "./VerifyMembers";
import { VerifyConfig } from "./VerifyConfig";
import { VerifyPull } from "./VerifyPull";

export default function VerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "members";

  return (
    <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
      <TabsList className="mb-4">
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="pull">Pull Members</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <VerifyMembers />
      </TabsContent>

      <TabsContent value="pull">
        <VerifyPull />
      </TabsContent>

      <TabsContent value="config">
        <VerifyConfig />
      </TabsContent>
    </Tabs>
  );
}
