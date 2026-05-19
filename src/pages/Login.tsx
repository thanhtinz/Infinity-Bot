import { LandingNavbar } from "@/components/LandingNavbar";
import { Bot } from "lucide-react";

const DISCORD_OAUTH_URL = "/api/auth/login";

export function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E1E2D] to-[#262932] flex flex-col animate-fade-in">
      <LandingNavbar />
      <div className="flex-1 flex items-center justify-center px-6 pt-[72px]">
        <div className="w-full max-w-[400px]">
          <div className="bg-[#262932] rounded-[10px] p-8 shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)] text-center">
            {/* Bot logo */}
            <div className="w-16 h-16 rounded-[10px] bg-[#009DB5] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#009DB5]/25">
              <Bot className="w-8 h-8 text-white" />
            </div>

            {/* Heading */}
            <h1 className="text-[22px] font-bold text-white mb-1.5">Welcome back</h1>
            <p className="text-[13px] text-[#9FA8C1] mb-8">Sign in to manage your server</p>

            {/* Discord OAuth button */}
            <a
              href={DISCORD_OAUTH_URL}
              className="flex items-center justify-center gap-3 w-full py-3.5 rounded-[8px] bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-[#5865F2]/20"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Continue with Discord
            </a>
          </div>

          {/* Footer */}
          <p className="text-center text-[12px] text-[#9FA8C1]/50 mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
