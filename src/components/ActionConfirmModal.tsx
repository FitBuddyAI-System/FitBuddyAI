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
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (open) setSelected({});
  }, [open]);

  if (!open) return null;

  const updateList = details?.updates;
  const updates: Update[] = Array.isArray(updateList) ? updateList : [];
  const autoSelectSingle = updates.length === 1;

  const toggleSelection = (idx: number) => setSelected(s => ({ ...s, [idx]: !s[idx] }));
  const formatValue = (value: unknown) => (value === undefined ? '' : JSON.stringify(value));
  const handleConfirm = () => {
    const selectedUpdates = autoSelectSingle ? updates : updates.filter((_, i) => selected[i]);
    if (selectedUpdates.length === 0) return;
    onConfirm(selectedUpdates);
  };

  return (
    <div className="acm-backdrop" role="dialog" aria-modal="true">
      <div className="acm-modal">
        <h3>Confirm Buddy's changes</h3>
        <p className="acm-summary">{summary}</p>
        <div className="acm-details-list">
          {updates.length === 0 && <div className="acm-no-updates">No explicit updates found.</div>}
          {updates.map((u, idx) => (
            <label key={idx} className="acm-update-row">
              <input type="checkbox" checked={autoSelectSingle || !!selected[idx]} onChange={() => toggleSelection(idx)} />
              <span className="acm-update-desc">{u.op} {u.path} {formatValue(u.value)}</span>
            </label>
          ))}
        </div>
        <div className="acm-actions">
          <button className="acm-btn acm-cancel" onClick={onCancel}>Cancel</button>
          <button className="acm-btn acm-confirm" onClick={handleConfirm}>Apply selected changes</button>
        </div>
      </div>
    </div>
  );
};

export default ActionConfirmModal;
