import { useState, useRef, useEffect } from 'react';

// A button that requires a second confirming click within a small popover,
// used for destructive actions (delete/expunge/cancel).
export default function ConfirmButton({ label, confirmLabel = 'Confirm', icon = 'fa-trash', onConfirm, className = 'btn-danger-ghost' }) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setConfirming(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (confirming) {
    return (
      <div className="confirm-inline" ref={ref}>
        <button type="button" className="btn-danger" onClick={() => { setConfirming(false); onConfirm?.(); }}>
          {confirmLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setConfirming(true)}>
      <i className={`fa-solid ${icon}`} /> {label}
    </button>
  );
}
