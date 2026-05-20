import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-700">
      <LandingNavbar />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: May 20, 2026</p>

        <div className="prose-custom">
          <h2>1. Data We Collect</h2>
          <p>When you use Infinity Bot, we collect and store:</p>
          <ul>
            <li><strong>Discord information</strong>: User ID, username, avatar, guild ID, guild name.</li>
            <li><strong>Server configuration</strong>: Bot settings, products, orders, custom embeds.</li>
            <li><strong>Activity data</strong>: Order history, XP statistics, moderation logs.</li>
            <li><strong>Payment data</strong>: PayOS transaction codes (we do not store card information).</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <p>Your data is used to:</p>
          <ul>
            <li>Operate bot features (shop, giveaways, moderation, leveling, etc.).</li>
            <li>Display the management dashboard for server owners.</li>
            <li>Process payments and activate Premium plans.</li>
            <li>Improve and develop the Service.</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>
            We do <strong>not</strong> sell or share your personal data with third parties,
            except in the following cases:
          </p>
          <ul>
            <li>Payment provider (PayOS) — only necessary transaction data.</li>
            <li>When required by law enforcement.</li>
          </ul>

          <h2>4. Storage & Security</h2>
          <p>
            Data is stored on a PostgreSQL database (Neon) with SSL-encrypted connections.
            We apply reasonable security measures to protect your data.
          </p>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong>: View your data through the dashboard.</li>
            <li><strong>Delete</strong>: Request full data deletion by contacting support or removing the bot from your server.</li>
            <li><strong>Export</strong>: Use the Backup feature on the dashboard to download your data.</li>
          </ul>

          <h2>6. Data Retention</h2>
          <p>
            Server configuration data is retained when the bot is kicked and will be restored
            if the bot is re-added. If you want permanent deletion, please contact support.
          </p>

          <h2>7. Cookies</h2>
          <p>
            The dashboard uses session cookies to maintain login state.
            We do not use tracking or advertising cookies.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            This policy may be updated. Significant changes will be announced
            via our support Discord server.
          </p>

          <h2>9. Contact</h2>
          <p>
            For any data privacy questions, please contact us through our support Discord server.
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
