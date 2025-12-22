import React from 'react';
import './ActionConfirmModal.css';

// JSX intrinsic elements are declared in a dedicated types file

type Update = {
  op: string;
  path: string;
  value?: unknown;
};

interface Props {
  open: boolean;
  summary: string;
  details?: { updates?: Update[] } | null;
  onConfirm: (selectedUpdates: Update[]) => void;
  onCancel: () => void;
}

const ActionConfirmModal: React.FC<Props> = ({ open, summary, details, onConfirm, onCancel }) => {
  if (!open) return null;

  const updateList = details?.updates;
  const updates: Update[] = Array.isArray(updateList) ? updateList : [];
  const formatValue = (value: unknown) => (value === undefined ? '' : JSON.stringify(value));
  const handleConfirm = () => {
    if (updates.length === 0) return;
    onConfirm(updates);
  };

  return (
    <div className="acm-backdrop" role="dialog" aria-modal="true">
      <div className="acm-modal">
        <h3>Confirm Buddy's changes</h3>
        <p className="acm-summary">{summary}</p>
        <div className="acm-details-list">
          {updates.length === 0 && <div className="acm-no-updates">No explicit updates found.</div>}
          {updates.map((u, idx) => (
            <div key={idx} className="acm-update-row">
              <span className="acm-update-desc">{u.op} {u.path} {formatValue(u.value)}</span>
            </div>
          ))}
        </div>
        <div className="acm-actions">
          <button className="acm-btn acm-cancel" onClick={onCancel}>Cancel</button>
          <button className="acm-btn acm-confirm" onClick={handleConfirm} disabled={updates.length === 0}>Apply changes</button>
        </div>
      </div>
    </div>
  );
};

export default ActionConfirmModal;
