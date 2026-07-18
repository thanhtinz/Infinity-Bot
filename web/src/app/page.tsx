import Link from "next/link";

const features = [
  {
    title: "Trò chuyện với AI",
    description:
      "Chat tự nhiên với Gemini, OpenAI hoặc Claude — dùng đúng API key của riêng bạn, không giới hạn bởi key dùng chung.",
  },
  {
    title: "Nền tảng lập trình AI",
    description:
      "Không gian code có trợ lý AI kiểu Claude Code / Cursor, với hệ thống AI-skills để tự động hoá các tác vụ lập trình.",
  },
  {
    title: "Riêng tư & bảo mật",
    description:
      "API key được mã hoá tại chỗ. Dữ liệu và cấu hình của bạn không chia sẻ cho ai khác — đây là công cụ cho riêng bạn.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="w-full border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Infinity</span>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-accent px-4 py-2 text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Đăng ký
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="rounded-full border border-border bg-surface px-4 py-1 text-xs font-medium text-muted">
            Trợ lý AI cá nhân
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Chat và lập trình cùng AI, theo cách của riêng bạn
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Infinity gộp chung một giao diện chat AI và một nền tảng lập trình có trợ lý
            AI vào một chỗ duy nhất — được xây dựng riêng cho bạn, dùng key AI của chính
            bạn.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/register"
              className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-8 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-hover sm:w-auto"
            >
              Bắt đầu miễn phí
            </Link>
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface px-8 text-base font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:w-auto"
            >
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>

        <div className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-surface p-6 text-left"
            >
              <h2 className="text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full border-t border-border px-6 py-6 text-center text-xs text-muted">
        Infinity — dự án cá nhân, không phát hành công khai.
      </footer>
    </div>
  );
}
