import { useState } from 'react';

export default function TagInput({ tags, onAdd, onRemove, placeholder = 'Add a word and press Enter' }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    onAdd?.(value);
    setDraft('');
  };

  return (
    <div className="tag-input">
      <div className="tag-input-chips">
        {(tags || []).length === 0 && <span className="control-hint">No entries yet.</span>}
        {(tags || []).map((tag, index) => (
          <span key={`${tag}-${index}`} className="tag-chip">
            {tag}
            <button type="button" onClick={() => onRemove?.(index)} aria-label={`Remove ${tag}`}>
              <i className="fa-solid fa-xmark" />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" className="btn-secondary" onClick={commit}>
          Add
        </button>
      </div>
    </div>
  );
}
