// Using JSX runtime, no default React import required
import './Terms.css';
import { setAcceptanceFlags } from '../services/localStorage';

type Props = { onClose: () => void; onAccept?: () => void };

export default function TermsModal({ onClose, onAccept }: Props) {
  const handleAccept = async () => {
    try {
      // Update local flags and trigger scheduled backup
      setAcceptanceFlags({ accepted_terms: true, accepted_privacy: true });
      // Immediately POST accepted flags so server persists them
      try {
        const raw = localStorage.getItem('fitbuddy_user_data');
        const userId = raw ? (JSON.parse(raw).data?.id || null) : null;
        if (userId) {
          const init = await import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, accepted_terms: true, accepted_privacy: true }) }));
          await fetch('/api/userdata/save', init);
        }
      } catch (e) { /* ignore */ }
      if (onAccept) onAccept();
    } catch (e) {
      if (onAccept) onAccept();
    }
  };

  return (
    <div className="terms-modal" role="dialog" aria-modal="true">
      <div className="terms-modal-inner">
        <button className="terms-close" onClick={onClose} aria-label="Close">×</button>
        <h2>Terms of Service</h2>
        <p>Short summary: use responsibly. Not medical advice. Data may be stored.</p>
        <div className="terms-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAccept}>I accept</button>
        </div>
      </div>
    </div>
  );
}
