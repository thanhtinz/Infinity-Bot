export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="state-block state-error glass-panel">
      <div className="state-icon">
        <i className="fa-solid fa-triangle-exclamation" />
      </div>
      <h3>Unable to load this page</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          <i className="fa-solid fa-rotate-right" /> Retry
        </button>
      )}
    </div>
  );
}
