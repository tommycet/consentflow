import { useState } from 'react';
import { IconShield, IconFileText, IconLock, IconDatabase, IconCode, IconCheck, IconHash, IconGlobe } from '../components/Icons';

const sections = [
  ['overview', 'Overview', IconShield],
  ['contracts', 'Smart contracts', IconCode],
  ['api', 'Backend API', IconGlobe],
  ['cleanverse', 'Cleanverse rails', IconDatabase],
  ['testing', 'Testing', IconCheck],
  ['security', 'Security', IconLock],
] as const;

const Code = ({ children }: { children: string }) => <pre className="cf-doc-code"><code>{children}</code></pre>;
const SectionTitle = ({ label, title, id }: { label: string; title: string; id?: string }) => <div id={id} className="cf-doc-title"><span>{label}</span><h2>{title}</h2></div>;

export function Docs() {
  const [active, setActive] = useState('overview');
  const jump = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <main className="cf-docs cf-container">
    <aside className="cf-doc-sidebar">
      <p className="cf-kicker">Technical reference</p>
      <h1>ConsentFlow<br/><em>docs</em></h1>
      <p className="cf-doc-summary">A patient-controlled consent rail on Monad testnet, with Cleanverse compliance checks before access settlement.</p>
      <nav aria-label="Documentation sections">
        {sections.map(([id, label, Icon]) => <button key={id} className={active === id ? 'is-active' : ''} onClick={() => jump(id)}><Icon size={15}/>{label}</button>)}
      </nav>
      <a className="cf-doc-github" href="https://github.com/tommycet/consentflow" target="_blank" rel="noreferrer">View source <span>↗</span></a>
    </aside>

    <div className="cf-doc-content">
      <section id="overview" className="cf-doc-section"><SectionTitle id="overview" label="01 / system" title="Consent is a state transition."/><p className="cf-doc-lede">ConsentFlow makes clinical-trial consent explicit, revocable, and inspectable. A participant enrolls through Cleanverse CVI, the consent lifecycle is recorded by ConsentRegistry, and CCP runs immediately before an access request can settle.</p><div className="cf-doc-facts"><div><b>Monad testnet</b><span>chain ID 10143</span></div><div><b>React + Vite</b><span>ethers.js v6 frontend</span></div><div><b>Express adapter</b><span>localhost:4000</span></div></div><Code>{`participant → CVI A-Pass → ConsentRegistry
researcher  → access request → CCP verify_apass → settlement`}</Code></section>

      <section id="contracts" className="cf-doc-section"><SectionTitle id="contracts" label="02 / on-chain" title="Two contracts, one lifecycle."/><p>Contract calls carry the durable state. ConsentRegistry handles consent and access requests. ContributionReceipt issues wallet-bound proof of contribution.</p><div className="cf-doc-contract-list"><article><div className="cf-doc-card-head"><IconCode/><span>ConsentRegistry</span></div><code>0xE64495D37859cF5fC0629023146764D5c01208c0</code><ul><li>createConsent</li><li>revokeConsent</li><li>queueAccessRequest</li><li>settleAccessRequest</li><li>getConsent / getActiveConsents</li><li>batchCreateConsent / batchSettleRequests</li></ul></article><article><div className="cf-doc-card-head"><IconHash/><span>ContributionReceipt</span></div><code>0x57EB95F57bBA38aABE9f29d26395BCA74Ab28c84</code><ul><li>issueReceipt</li><li>getReceipt</li><li>getReceiptsForParticipant</li><li>batchIssueReceipts</li><li>Ownable registry binding</li></ul></article></div></section>

      <section id="api" className="cf-doc-section"><SectionTitle id="api" label="03 / adapter" title="The API keeps credentials server-side."/><p>The browser talks to the local Express adapter. Cleanverse credentials are never sent to the frontend.</p><h3>CVI · identity</h3><Code>{`POST /api/cvi/:wallet/generate
GET  /api/cvi/:wallet/status
POST /api/cvi/:wallet/freeze
POST /api/cvi/:wallet/unfreeze`}</Code><h3>CVA · asset policy</h3><Code>{`POST /api/cva/rule
GET  /api/cva/:wallet/rules
POST /api/cva/atoken
GET  /api/cva/balance/:wallet`}</Code><h3>CCP · settlement gate</h3><Code>{`POST /api/ccp/verify
# code 1: A-Token not found
# code 2: no A-Pass
# code 3: frozen or expired
# code 4: success / transfer allowed`}</Code><h3>Contract proxy</h3><Code>{`POST /api/contract/create-consent
POST /api/contract/queue-request
POST /api/contract/settle-request
GET  /api/contract/consent/:id
GET  /api/contract/consents/active`}</Code></section>

      <section id="cleanverse" className="cf-doc-section"><SectionTitle id="cleanverse" label="04 / integration" title="Three rails, one decision."/><div className="cf-doc-rail"><div><b>CVI</b><p>Cleanverse Verified Identity supplies the A-Pass enrollment and its active/frozen state.</p></div><div><b>CVA</b><p>Cleanverse Verified Asset binds purpose rules and contribution receipts to an A-Token.</p></div><div><b>CCP</b><p>Compliance Pre-Check is the final server-side verification before settlement.</p></div></div><p className="cf-doc-callout">A participant can freeze the A-Pass after a request is queued. The next CCP check observes that state and settlement fails closed.</p></section>

      <section id="testing" className="cf-doc-section"><SectionTitle id="testing" label="05 / evidence" title="The test suite is part of the interface."/><div className="cf-doc-test-grid"><div><b>55</b><span>Solidity tests</span></div><div><b>10</b><span>Backend integration tests</span></div><div><b>11</b><span>Prism findings fixed</span></div></div><p>Coverage includes lifecycle, revocation, expiry, batches, query indexes, pause controls, access control, reentrancy, fuzzing, invariants, and end-to-end settlement.</p><Code>{`forge test -vv
cd backend && npm test
# all recorded project checks passing`}</Code></section>

      <section id="security" className="cf-doc-section"><SectionTitle id="security" label="06 / safeguards" title="Fail closed. Leave evidence."/><div className="cf-doc-safeguards"><span><IconCheck size={15}/> ReentrancyGuard on value paths</span><span><IconCheck size={15}/> Pausable emergency control</span><span><IconCheck size={15}/> AccessControl role separation</span><span><IconCheck size={15}/> Expiry and purpose checks</span><span><IconCheck size={15}/> Input validation in adapter</span><span><IconCheck size={15}/> On-chain audit trail</span></div><a href="https://github.com/tommycet/consentflow" target="_blank" rel="noreferrer" className="cf-glow-btn mt-8 inline-flex">Read the source <IconFileText size={15}/></a></section>
    </div>
  </main>;
}
