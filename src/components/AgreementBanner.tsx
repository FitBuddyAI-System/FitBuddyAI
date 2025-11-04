import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hasAcceptedTos, hasAcceptedPrivacy, hasAcceptedAll, migrateAnonToUser } from '../services/tosService';
import './Terms.css';

type Props = { userData?: any };

export default function AgreementBanner({ userData }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If the user just signed in, migrate any anonymous acceptances into their record
    if (userData?.id) { try { migrateAnonToUser(userData.id); } catch (e) {} }
    const checkLocalThenServer = async () => {
      try {
        // local quick check
        const localAccepted = hasAcceptedAll(userData?.id);
        if (localAccepted) { setVisible(false); return; }
        // If user is signed in, ask server for authoritative acceptance state
        const uid = userData?.id;
        if (!uid) { setVisible(true); return; }
        const init = await import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid }) }));
        const res = await fetch('/api/userdata/load', init);
        if (!res.ok) { setVisible(true); return; }
        const text = await res.text();
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }
        const payload = parsed?.stored ?? parsed?.payload ?? parsed ?? {};
        // If server explicitly indicates accepted_terms and accepted_privacy, hide banner
        const serverAccepted = payload && payload.accepted_terms && payload.accepted_privacy;
        setVisible(!serverAccepted);
      } catch (e) {
        // Fallback to local check
        const accepted = hasAcceptedAll(userData?.id);
        setVisible(!accepted);
      }
    };
    checkLocalThenServer();

    const handleTos = () => {
      if (hasAcceptedAll(userData?.id)) setVisible(false);
      else setVisible(true);
    };
    const handlePrivacy = () => {
      if (hasAcceptedAll(userData?.id)) setVisible(false);
      else setVisible(true);
    };

    window.addEventListener('fitbuddyai-tos-accepted', handleTos);
    window.addEventListener('fitbuddyai-privacy-accepted', handlePrivacy);
    return () => {
      window.removeEventListener('fitbuddyai-tos-accepted', handleTos);
      window.removeEventListener('fitbuddyai-privacy-accepted', handlePrivacy);
    };
  }, [userData?.id]);

  if (!visible) return null;

  const tosAccepted = hasAcceptedTos(userData?.id);
  const privacyAccepted = hasAcceptedPrivacy(userData?.id);

  return (
    <div className="tos-banner compact" role="region" aria-label="Terms and Privacy banner">
      <div className="tos-inner inline">
        <div className="tos-left">
          <div className="tos-info" aria-hidden="true">ℹ️</div>
          <div className="tos-text">
            Please read and accept our <Link to="/terms" className={tosAccepted ? 'tos-link accepted' : 'tos-link'}>Terms of Service</Link> and <Link to="/privacy" className={privacyAccepted ? 'tos-link accepted' : 'tos-link'}>Privacy Policy</Link>. This banner will remain until both are accepted.
          </div>
        </div>
      </div>
    </div>
  );
}
