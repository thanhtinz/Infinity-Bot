import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";

export function RefundPage() {
  return (
    <div className="min-h-screen bg-white text-gray-700">
      <LandingNavbar />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: May 20, 2026</p>

        <div className="prose-custom">
          <h2>1. Scope</h2>
          <p>
            This policy applies to all Premium plan purchases for Infinity Bot
            made through PayOS.
          </p>

          <h2>2. Eligible Refunds</h2>
          <p>You may request a refund if:</p>
          <ul>
            <li>The request is made within <strong>7 days</strong> of the payment date.</li>
            <li>The Service did not work as described and we were unable to resolve the issue.</li>
            <li>You were charged in error or a duplicate payment was made.</li>
          </ul>

          <h2>3. Non-Refundable Cases</h2>
          <ul>
            <li>You have used Premium features for more than 7 days.</li>
            <li>Your account was terminated due to a violation of the Terms of Service.</li>
            <li>Change of mind after actively using the Service.</li>
            <li>Dissatisfaction with features that were clearly described before purchase.</li>
          </ul>

          <h2>4. Refund Process</h2>
          <ol>
            <li>Contact us via the support Discord server and provide your transaction code.</li>
            <li>Our support team will review your request within <strong>3 business days</strong>.</li>
            <li>If eligible, the refund will be processed via PayOS within <strong>5–7 business days</strong>.</li>
          </ol>

          <h2>5. Cancellation</h2>
          <p>
            You may cancel your Premium plan at any time. After cancellation, you will retain
            access to Premium features until the end of your paid period. No refund is issued
            for the remaining time upon voluntary cancellation.
          </p>

          <h2>6. Contact</h2>
          <p>
            To request a refund or if you have any questions, please reach out to our support team
            via the official Discord server.
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-6">
          <Link to="/terms" className="hover:text-[#6C5CE7] transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-[#6C5CE7] transition-colors">Privacy</Link>
          <Link to="/refund" className="hover:text-[#6C5CE7] transition-colors">Refund</Link>
        </div>
        <p className="mt-3">© 2025 Infinity Bot. All rights reserved.</p>
      </footer>
    </div>
  );
}
