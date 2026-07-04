export default function ChannelSelect({ channels, value, onChange, placeholder = 'Select a channel', allowNone = true, disabled }) {
  return (
    <select
      className="control-select"
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value || null)}
    >
      {allowNone && <option value="">{placeholder}</option>}
      {(channels || []).map((channel) => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}
