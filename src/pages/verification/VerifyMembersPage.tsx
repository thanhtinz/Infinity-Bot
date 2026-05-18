/**
 * VerifyMembersPage — combined Members table + Pull section on one page.
 * No tabs — Members table on top, Pull section below with a divider.
 */
import { Separator } from "@/components/ui/separator";
import { VerifyMembers } from "./VerifyMembers";
import { VerifyPull } from "./VerifyPull";

export function VerifyMembersPage() {
  return (
    <div className="space-y-8">
      <VerifyMembers />
      <Separator />
      <VerifyPull />
    </div>
  );
}
