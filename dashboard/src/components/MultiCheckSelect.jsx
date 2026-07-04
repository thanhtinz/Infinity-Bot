// Renders a scrollable list of checkboxes for picking multiple ids (channels or roles).
export default function MultiCheckSelect({ items, selected, onToggle, labelPrefix = '#', emptyLabel = 'Nothing available' }) {
  const selectedSet = new Set(selected || []);

  if (!items || items.length === 0) {
    return <p className="control-hint">{emptyLabel}</p>;
  }

  return (
    <div className="multi-check-list">
      {items.map((item) => (
        <label key={item.id} className="multi-check-row">
          <input
            type="checkbox"
            checked={selectedSet.has(item.id)}
            onChange={() => onToggle?.(item.id)}
          />
          <span>{labelPrefix}{item.name}</span>
        </label>
      ))}
    </div>
  );
}
