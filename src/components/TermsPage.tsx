// Using JSX runtime; no default React import required
import { useState, useEffect } from 'react';
import { acceptTos, hasAcceptedTos } from '../services/tosService';
import { burstConfetti } from '../services/confetti';
import { Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import './Terms.css';

export default function TermsPage() {
  const initialAccepted = hasAcceptedTos(undefined);
  const [agreed, setAgreed] = useState(initialAccepted);

  const [accepted, setAccepted] = useState(initialAccepted);

  useEffect(() => {
    const onAccepted = () => {
      setAccepted(true);
      setAgreed(true);
    };
    window.addEventListener('fitbuddyai-tos-accepted', onAccepted);
    return () => window.removeEventListener('fitbuddyai-tos-accepted', onAccepted);
  }, []);

  const onAccept = () => {
    if (!agreed) return;
    acceptTos(undefined);
    setAccepted(true);
    try { burstConfetti({count: 40}); } catch (e) { /* noop */ }
    // intentionally do not redirect; banner will hide when both accepted
    // Immediately persist acceptance to server if signed in
    try {
      import('../services/localStorage').then(m => {
        try {
          const parsed = m.loadUserData();
          const userId = parsed?.id;
          if (userId) {
            import('../services/apiAuth').then(m2 => m2.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, accepted_terms: true }) })).then(init => fetch('/api/userdata/save', init)).catch(()=>{});
          }
        } catch (e) {}
      }).catch(()=>{});
    } catch (e) {}
  };

  return (
    <div className="terms-page">
      <header className="terms-hero">
        <div className="terms-hero-inner">
          <div className="hero-logo"><Dumbbell size={36} color="#fff" /></div>
          <div>
            <h1 className="hero-title">FitBuddyAI Terms of Service</h1>
            <p className="hero-sub">Short, clear summary about how to use the app safely and what we store.</p>
          </div>
        </div>
      </header>

      <main className="terms-container">
        <article className="terms-card">
          <h2>1. Use of the Service</h2>
          <p>FitBuddyAI provides workout suggestions and educational material to help you train safely. This is not medical advice. If you have a medical condition, please consult a healthcare professional before acting on any exercise recommendation.</p>
        </article>

        <article className="terms-card">
          <h2>2. AI & Content</h2>
          <p>Some content or workout suggestions may be generated or assisted by AI. AI outputs are best-effort guidance and should be used in combination with your own judgment and professional advice.</p>
        </article>

        <article className="terms-card">
          <h2>3. Data & Privacy</h2>
          <p>We store workout plans and profile data locally for convenience. If you create an account, data may be backed up to our servers for sync across devices. See the <Link to="/privacy" className="tos-link">Privacy Policy</Link> for details.</p>
        </article>

        <article className="terms-card">
          <h2>4. Liability</h2>
          <p>By using FitBuddyAI you acknowledge that you are voluntarily participating in physical activity and accept responsibility for any risks. We are not liable for injuries caused while following the app.</p>
        </article>

        {/* removed top CTA; final accept button moved below the full terms */}
      </main>

      <section className="terms-full">
        <div className="terms-full-inner">
          <h2>Full Terms of Service</h2>
          <p>The following terms ("Agreement") constitute a legally binding agreement between you ("User") and FitBuddyAI, LLC ("FitBuddyAI", "we", "us" or "our"), governing your access to and use of the FitBuddyAI website, mobile applications, services, software, APIs and associated content (collectively, the "Service"). By accessing, browsing, or using the Service you acknowledge that you have read, understood, and agree to be bound by this Agreement. If you do not agree to these terms, do not access or use the Service.</p>

          <h3>1. Definitions</h3>
          <p>"Content" means any information, text, graphics, images, audio, video, code, algorithms, workout plans, recommendations, comments, and other materials provided by FitBuddyAI or Users. "User Content" means Content submitted or transmitted by Users. "Personal Data" means information that identifies or can be used to identify an individual, subject to the Privacy Policy.</p>

          <h3>2. Scope of Service</h3>
          <p>FitBuddyAI provides fitness and wellness related guidance, educational materials, personalized workout plans, and software tools. The Service may include content generated or assisted by artificial intelligence. The Service is provided on an "as is" and "as available" basis. FitBuddyAI reserves the right to modify, suspend, or discontinue any aspect of the Service at any time without prior notice.</p>

          <h3>3. User Eligibility and Conduct</h3>
          <p>Users represent and warrant that they are at least the minimum age required to use the Service under applicable law and that they have full authority to accept this Agreement. Users shall not misuse the Service or interfere with its operation. Prohibited conduct includes, but is not limited to: circumventing technical restrictions; attempting to access other Users' accounts; uploading malicious code; impersonating others; or using the Service for unlawful or harmful activities.</p>

          <h3>4. Medical Disclaimer and Assumption of Risk</h3>
          <p>The Service provides general fitness information and recommendations which are not a substitute for professional medical advice, diagnosis, or treatment. Users should consult a qualified healthcare professional before beginning any exercise program or if they have health concerns. By using the Service, Users acknowledge and assume all risks associated with participating in physical activity and agree that FitBuddyAI is not responsible for any injury, loss, or damage arising from use of the Service.</p>

          <h3>5. AI-Generated Content and Accuracy</h3>
          <p>Some Content may be generated or assisted by machine learning models, third‑party APIs, or algorithmic systems. While FitBuddyAI strives for accuracy and utility, AI outputs may be incomplete, imprecise, or contextually inappropriate. FitBuddyAI disclaims any warranty regarding the suitability, reliability, or accuracy of AI-generated Content. Reliance on such Content is at the User's own risk.</p>

          <h3>6. Intellectual Property</h3>
          <p>FitBuddyAI and its licensors retain all right, title, and interest in and to the Service and Content provided by FitBuddyAI, including intellectual property rights. Users are granted a limited, non-exclusive, non-sublicensable, revocable license to access and use the Service for personal, non-commercial purposes in accordance with this Agreement. Users shall not reproduce, distribute, modify, create derivative works, reverse engineer, or otherwise exploit FitBuddyAI's intellectual property except as expressly authorized herein.</p>

          <h3>7. User Content and License to FitBuddyAI</h3>
          <p>By submitting User Content, Users grant FitBuddyAI a worldwide, royalty-free, sublicensable, transferable, perpetual, irrevocable license to use, host, store, reproduce, modify, create derivative works, communicate, publish, and distribute such User Content for the purposes of operating, improving, and promoting the Service. Users warrant that they have the rights to grant such license and that User Content does not violate third-party rights.</p>

          <h3>8. Payments and Subscriptions</h3>
          <p>Paid features of the Service are governed by separate subscription terms and payment agreements. Users agree to provide accurate billing information and authorize recurring charges as applicable. Refunds, cancellations, and dispute procedures are governed by the posted subscription terms and any applicable laws.</p>

          <h3>9. Third-Party Services and Links</h3>
          <p>The Service may contain links to third-party websites, services, or content. FitBuddyAI does not endorse and is not responsible for third-party offerings, practices, or privacy policies. Users access third-party resources at their own risk and should review the third-party terms and privacy policies.</p>

          <h3>10. Privacy and Data</h3>
          <p>Use of Personal Data is governed by FitBuddyAI’s Privacy Policy. By using the Service, Users consent to FitBuddyAI’s collection, processing, storage, and transfer of Personal Data in accordance with the Privacy Policy. FitBuddyAI will take commercially reasonable measures to secure User Data but cannot guarantee absolute security.</p>

          <h3>11. Warranties and Disclaimers</h3>
          <p>EXCEPT AS EXPRESSLY PROVIDED HEREIN, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. FITBUDDYAI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. FITBUDDYAI DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>

          <h3>12. Limitation of Liability</h3>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL FITBUDDYAI, ITS AFFILIATES, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THE SERVICE, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. FITBUDDYAI'S AGGREGATE LIABILITY FOR DIRECT DAMAGES SHALL NOT EXCEED THE AMOUNTS PAID BY THE USER TO FITBUDDYAI IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS (USD $100), WHICHEVER IS GREATER.</p>

          <h3>13. Indemnification</h3>
          <p>Users agree to indemnify, defend, and hold harmless FitBuddyAI and its officers, directors, employees, agents, and affiliates from and against any and all losses, liabilities, claims, demands, damages, costs, and expenses (including reasonable attorneys’ fees) arising out of or relating to: (a) User's breach of this Agreement; (b) User’s violation of any law or third-party rights; or (c) User Content.</p>

          <h3>14. Termination</h3>
          <p>FitBuddyAI may suspend or terminate a User's access to the Service at any time, with or without cause, and without liability. Upon termination, license rights granted to the User will immediately cease. Sections concerning ownership, disclaimers, limitations of liability, indemnity, and dispute resolution will survive termination.</p>

          <h3>15. Governing Law; Dispute Resolution</h3>
          <p>This Agreement shall be governed by and construed in accordance with the laws of the state in which FitBuddyAI is incorporated, without regard to conflict of laws principles. Any dispute arising out of or related to this Agreement shall be resolved exclusively through final and binding arbitration, except where prohibited by law. The arbitrator's decision will be final and binding and may be entered as a judgment in any court of competent jurisdiction.</p>

          <h3>16. Changes to Terms</h3>
          <p>FitBuddyAI may update these Terms from time to time. We will provide notice of material changes, for example by email to registered accounts or prominent notice within the Service. Continued use of the Service after changes constitute acceptance of the revised Terms.</p>

          <h3>17. Miscellaneous</h3>
          <p>This Agreement, together with the Privacy Policy and any other legal notices published by FitBuddyAI, constitutes the entire agreement between the parties concerning the subject matter herein. If any provision is found unenforceable, the remaining provisions will remain in full force. Failure to enforce a right is not a waiver of that right.</p>

          <p><em>Effective Date:</em> The effective date of these Terms is the date you first use the Service. For questions regarding these Terms, please contact our support team.</p>
        </div>
      </section>
      <div className="terms-cta-bottom">
        <div className="terms-cta-inner">
          <label className="terms-checkbox">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I have read and agree to the Terms of Service</span>
          </label>
        </div>
        <div className="terms-cta-inner stack">
          <button className={"btn btn-primary btn-lg" + (accepted ? ' accepted-btn' : '')} onClick={onAccept} disabled={!agreed || accepted} aria-disabled={!agreed || accepted}>{accepted ? 'Accepted' : 'Accept'}</button>
        </div>
      </div>
    </div>
  );
}
