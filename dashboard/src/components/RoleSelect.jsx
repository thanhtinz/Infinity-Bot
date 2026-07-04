export default function RoleSelect({ roles, value, onChange, placeholder = 'Select a role', allowNone = true, disabled }) {
  return (
    <select
      className="control-select"
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value || null)}
    >
      {allowNone && <option value="">{placeholder}</option>}
      {(roles || []).map((role) => (
        <option key={role.id} value={role.id}>
          @{role.name}
        </option>
      ))}
    </select>
  );
}
