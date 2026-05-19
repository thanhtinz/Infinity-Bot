import { Shield } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { VerifyConfig } from "./VerifyConfig";

export default function VerificationPage() {
  return (
    <PageContainer size="full">
      <PageHeader title="Verification" icon={Shield} description="Configure member verification for your server" />
      <VerifyConfig />
    </PageContainer>
  );
}
