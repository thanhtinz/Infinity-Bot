import RegisterForm from "./RegisterForm";

function sanitizeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value) return "/app";
  // Only allow same-origin relative paths to avoid open-redirect via `next`.
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeNext(next);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Tạo tài khoản</h1>
          <p className="mt-1 text-sm text-muted">Bắt đầu sử dụng Infinity miễn phí.</p>
        </div>
        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
