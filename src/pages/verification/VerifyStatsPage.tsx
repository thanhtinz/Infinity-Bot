import { BarChart3 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { VerifyStats } from "./VerifyStats";

export default function VerifyStatsPage() {
  return (
    <PageContainer size="lg">
      <PageHeader title="Verification Statistics" icon={BarChart3} description="Overview of verification activity and member status." />
      <VerifyStats />
    </PageContainer>
  );
}
