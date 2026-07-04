export default function Login() {
  return (
    <div className="login-body">
      <div className="login-card glass-panel">
        <div className="login-logo">
          <span>I</span>
        </div>
        <h2 className="brand-wordmark">INFINITY</h2>
        <p>Manage every server Infinity Bot protects from one dashboard.</p>

        <a href="/api/auth/discord/login" className="btn-discord">
          <i className="fa-brands fa-discord" /> Login with Discord
        </a>

        <p className="login-footnote">Infinity Bot Dashboard</p>
      </div>
    </div>
  );
}
