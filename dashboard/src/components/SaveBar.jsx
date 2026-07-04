export default function SaveBar({ visible, saving, onRevert, onSave, message = 'You have unsaved changes.' }) {
  return (
    <div className={`save-bar-container ${visible ? 'visible' : ''}`}>
      <div className="save-bar">
        <div className="save-bar-text">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>{message}</span>
        </div>
        <div className="save-bar-actions">
          <button type="button" className="btn-revert" onClick={onRevert} disabled={saving}>
            Revert
          </button>
          <button type="button" className="btn-save" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
