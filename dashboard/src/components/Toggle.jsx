export default function Toggle({ checked, onChange, disabled, size }) {
  return (
    <label className={`toggle-switch ${size === 'sm' ? 'toggle-sm' : ''}`}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="slider" />
    </label>
  );
}
