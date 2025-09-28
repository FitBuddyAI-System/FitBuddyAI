import React from 'react';
import './ActionConfirmModal.css';

interface Props {
  open: boolean;
  summary: string;
  details?: any;
  onConfirm: (selectedUpdates: any[]) => void;
  onCancel: () => void;
}

const ActionConfirmModal: React.FC<Props> = ({ open, summary, details, onConfirm, onCancel }) => {
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    // reset selection when modal opens
    if (open) setSelected({});
  }, [open]);

  if (!open) return null;

  const updates = details?.updates ?? [];

  return (
    <div className="acm-backdrop" role="dialog" aria-modal="true">
      <div className="acm-modal">
        <h3>Confirm Buddy's changes</h3>
        <p className="acm-summary">{summary}</p>
        <div className="acm-details-list">
          {updates.length === 0 && <div className="acm-no-updates">No explicit updates found.</div>}
          {updates.map((u: any, idx: number) => (
            <label key={idx} className="acm-update-row">
              <input type="checkbox" checked={!!selected[idx]} onChange={() => setSelected(s => ({ ...s, [idx]: !s[idx] }))} />
              <span className="acm-update-desc">{u.op} {u.path} {u.value ? JSON.stringify(u.value) : ''}</span>
            </label>
          ))}
        </div>
        <div className="acm-actions">
          <button className="acm-btn acm-cancel" onClick={onCancel}>Cancel</button>
          <button className="acm-btn acm-confirm" onClick={() => onConfirm(updates.filter((_: any, i: number) => selected[i] || updates.length === 1))}>Apply selected changes</button>
        </div>
      </div>
    </div>
  );
};

export default ActionConfirmModal;
