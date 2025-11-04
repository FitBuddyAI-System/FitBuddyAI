import React, { useEffect, useState } from 'react';
import { hasAcceptedAll, hasAcceptedTos, hasAcceptedPrivacy, acceptTos, acceptPrivacy } from '../services/tosService';
import './AgreementGuard.css';

type Props = { userData?: any; children: React.ReactNode };

export default function AgreementGuard({ userData, children }: Props) {
  const [visible, setVisible] = useState(false);
  

  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    const check = () => {
      setTosAccepted(hasAcceptedTos(userData?.id));
      setPrivacyAccepted(hasAcceptedPrivacy(userData?.id));
      setVisible(!hasAcceptedAll(userData?.id));
    };
    check();
    const onTos = () => { setTosAccepted(true); setVisible(!hasAcceptedAll(userData?.id)); };
    const onPrivacy = () => { setPrivacyAccepted(true); setVisible(!hasAcceptedAll(userData?.id)); };
    window.addEventListener('fitbuddyaiai-tos-accepted', onTos);
    window.addEventListener('fitbuddyaiai-privacy-accepted', onPrivacy);
    return () => {
      window.removeEventListener('fitbuddyaiai-tos-accepted', onTos);
      window.removeEventListener('fitbuddyaiai-privacy-accepted', onPrivacy);
    };
  }, [userData?.id]);

  if (!visible) return <>{children}</>;

  const handleAgree = () => {
    // Mark both as accepted locally (migrated to user if signed in by tosService)
    try { acceptTos(userData?.id); } catch (e) { /* noop */ }
    try { acceptPrivacy(userData?.id); } catch (e) { /* noop */ }
    // If user is signed in, persist acceptance to the server as well
    if (userData?.id) {
      try {
        import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userData.id, accepted_terms: true, accepted_privacy: true }) })).then(init => {
          fetch('/api/userdata/save', init).catch(() => { /* ignore server errors quietly */ });
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }
    setVisible(false);
  };

  return (
    <div className="agreement-guard-wrapper" aria-hidden="false">
      {/* Render children but visually de-emphasize while modal is active */}
      <div className="agreement-guard-underlay" aria-hidden="true">{children}</div>
      <div className="agreement-guard-backdrop" role="dialog" aria-modal="true" aria-label="Terms and Privacy agreement">
        <div className="agreement-guard-modal" role="document">
          <h2 className="agreement-guard-title">Before you continue</h2>
          <p className="agreement-guard-body">To continue, please agree to our <a className={tosAccepted? 'agreement-accepted' : ''} href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a className={privacyAccepted? 'agreement-accepted' : ''} href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. Both will open in a new tab if you want to review them.</p>
          <div className="agreement-guard-actions">
            <button className="btn btn-agree" onClick={handleAgree}>I have read and agree</button>
          </div>
        </div>
      </div>
    </div>
  );
}
