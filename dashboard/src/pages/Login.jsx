export default function Login() {
  return (
    <div className="login-body">
      <div className="login-card glass-panel">
        <div className="login-logo">
          <span>M</span>
        </div>
        <h2 className="brand-wordmark">MAIN</h2>
        <p>Manage every server Main protects from one dashboard.</p>

        <a href="/api/auth/discord/login" className="btn-discord">
          <i className="fa-brands fa-discord" /> Login with Discord
        </a>

        <p className="login-footnote">Main Dashboard</p>
      </div>
    </div>
  );
}
