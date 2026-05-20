import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-700">
      <LandingNavbar />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: May 20, 2026</p>

        <div className="prose-custom">
          <h2>1. Introduction</h2>
          <p>
            Welcome to Infinity Bot ("Service"). By using our Discord bot and management dashboard,
            you agree to comply with the terms outlined below.
          </p>

          <h2>2. Eligibility</h2>
          <ul>
            <li>You must have a valid Discord account to use the Service.</li>
            <li>You must be at least 13 years old (or the minimum age required by Discord in your country).</li>
            <li>You are responsible for keeping your login credentials and bot token secure.</li>
          </ul>

          <h2>3. Acceptable Use</h2>
          <p>When using the Service, you <strong>must not</strong>:</p>
          <ul>
            <li>Use the bot for spamming, scamming, or any illegal activity.</li>
            <li>Attempt unauthorized access to our systems or other users' data.</li>
            <li>Exploit security vulnerabilities without reporting them to us.</li>
            <li>Resell or redistribute the Service without written permission.</li>
          </ul>

          <h2>4. Premium Plans</h2>
          <p>
            Premium plans are paid via PayOS. Upon successful payment, the plan is activated automatically.
            Premium features apply only to the registered Discord server.
          </p>

          <h2>5. User Data</h2>
          <p>
            We store data necessary to operate the Service (guild ID, user ID, server configuration).
            See our <Link to="/privacy" className="text-[#6C5CE7] hover:underline">Privacy Policy</Link> for details.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            The Service is provided "as-is." We do not guarantee 100% uptime or error-free operation.
            We are not liable for any damages arising from your use or inability to use the Service.
          </p>

          <h2>7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access if we detect a violation of these terms.
            You may stop using the Service at any time by removing the bot from your server.
          </p>

          <h2>8. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Significant changes will be announced
            via our support Discord server or the dashboard.
          </p>

          <h2>9. Contact</h2>
          <p>
            If you have any questions about these terms, please reach out through our support Discord server.
          </p>
        </div>
      </main>

      <PolicyFooter />
    </div>
  );
}

function PolicyFooter() {
  return (
    <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
      <div className="flex items-center justify-center gap-6">
        <Link to="/terms" className="hover:text-[#6C5CE7] transition-colors">Terms</Link>
        <Link to="/privacy" className="hover:text-[#6C5CE7] transition-colors">Privacy</Link>
        <Link to="/refund" className="hover:text-[#6C5CE7] transition-colors">Refund</Link>
      </div>
      <p className="mt-3">© 2025 Infinity Bot. All rights reserved.</p>
    </footer>
  );
}
