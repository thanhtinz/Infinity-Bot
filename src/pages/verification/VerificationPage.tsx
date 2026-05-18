import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifyMembersPage } from "./VerifyMembersPage";
import { VerifyConfig } from "./VerifyConfig";

export default function VerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "members";

  return (
    <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
      <TabsList className="mb-4">
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <VerifyMembersPage />
      </TabsContent>

      <TabsContent value="config">
        <VerifyConfig />
      </TabsContent>
    </Tabs>
  );
}
