export default function EmptyState({ icon = 'fa-inbox', title = 'Nothing here yet', message, action }) {
  return (
    <div className="state-block state-empty">
      <div className="state-icon">
        <i className={`fa-solid ${icon}`} />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
