export default function Spinner({ label = 'Loading...' }) {
  return (
    <div className="state-block state-loading">
      <div className="loading-spinner" />
      <p>{label}</p>
    </div>
  );
}
