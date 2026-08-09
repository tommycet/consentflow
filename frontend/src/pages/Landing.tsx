import { Link } from 'react-router-dom';
import { IconShield, IconUser, IconDatabase, IconCode, IconCheck, IconArrowRight, IconGlobe, IconLock, IconHash } from '../components/Icons';

const contracts = [
  { name: 'ConsentRegistry', address: '0xE64495D37859cF5fC0629023146764D5c01208c0', detail: 'Consent lifecycle, revocation, expiry, and access settlement.', methods: 'createConsent · revokeConsent · queueAccessRequest · settleAccessRequest' },
  { name: 'ContributionReceipt', address: '0x57EB95F57bBA38aABE9f29d26395BCA74Ab28c84', detail: 'Purpose-bound contribution receipts locked to the participant wallet.', methods: 'issueReceipt · getReceipt · batchIssueReceipts' },
];

function Architecture() {
  return <div className="cf-architecture" aria-label="ConsentFlow architecture diagram">
    <div className="cf-arch-node participant"><IconUser/><b>Participant</b><span>enroll · revoke</span></div>
    <div className="cf-arch-link"><i></i><span>attests</span></div>
    <div className="cf-arch-node cvi"><IconShield/><b>Cleanverse CVI</b><span>A-Pass identity</span></div>
    <div className="cf-arch-link"><i></i><span>anchors</span></div>
    <div className="cf-arch-node chain"><IconDatabase/><b>Monad 10143</b><span>ConsentRegistry</span></div>
    <div className="cf-arch-receipt"><IconCode/><b>ContributionReceipt</b><span>non-transferable proof</span></div>
    <div className="cf-arch-oracle"><span>CVA</span><span>CCP</span><small>asset rules + compliance gate</small></div>
  </div>;
}

export function Landing() {
  return <main className="cf-landing">
    <section className="cf-hero cf-reveal">
      <div className="cf-hero-copy">
        <p className="cf-kicker"><span className="cf-pulse-dot"></span> Consent infrastructure for clinical research</p>
        <h1>Consent that stays<br/><em>in your hands.</em></h1>
        <p className="cf-hero-lead">A patient-controlled consent rail for clinical trials. Enroll with Cleanverse, record consent on Monad, and revoke access before compliance settlement.</p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link to="/participant" className="cf-glow-btn">Launch participant demo <IconArrowRight size={16}/></Link>
          <Link to="/docs" className="cf-quiet-btn">Read the technical docs</Link>
        </div>
        <p className="cf-hero-note"><IconLock size={14}/> No API keys leave the ConsentFlow backend.</p>
      </div>
      <div className="cf-hero-mark" aria-hidden="true"><div className="cf-orbit orbit-a"></div><div className="cf-orbit orbit-b"></div><div className="cf-orbit orbit-c"></div><div className="cf-mark-core"><IconShield size={54}/></div><span className="cf-mark-label">REVOCABLE<br/>BY DESIGN</span></div>
    </section>

    <section className="cf-live-strip cf-reveal-delay">
      <div><b>55</b><span>Solidity tests</span></div><div><b>10</b><span>Backend tests</span></div><div><b>2</b><span>Deployed contracts</span></div><div><b>10143</b><span>Monad testnet</span></div><div><b>3</b><span>Cleanverse rails</span></div>
    </section>

    <section className="cf-section cf-reveal"><div className="cf-section-intro"><p className="cf-kicker">The consent rail</p><h2>Make the permission<br/>verifiable.</h2><p>ConsentFlow turns a paper-era promise into a machine-checkable state. The participant controls the identity signal. The contract records the boundary. The compliance gate decides whether settlement can happen.</p></div><Architecture/></section>

    <section className="cf-section cf-reveal"><div className="cf-section-heading"><p className="cf-kicker">One state transition</p><h2>From consent<br/>to settlement.</h2></div><div className="cf-flow"><article><span className="cf-flow-index">A</span><IconUser/><h3>Participant enrolls</h3><p>Generate an A-Pass through CVI. Consent is created with hashed study and purpose identifiers.</p></article><article><span className="cf-flow-index">B</span><IconGlobe/><h3>Researcher requests</h3><p>Queue an access request with compensation. The requested purpose must match the consent record.</p></article><article><span className="cf-flow-index">C</span><IconCheck/><h3>CCP verifies</h3><p>verify_apass runs before settlement. Frozen, expired, or mismatched requests cannot pass.</p></article></div></section>

    <section className="cf-section cf-integration cf-reveal"><div className="cf-section-heading"><p className="cf-kicker">Cleanverse integration</p><h2>Identity. Assets.<br/>Compliance.</h2></div><div className="cf-rail-list"><div><b>CVI</b><strong>Verified identity</strong><span>A-Pass enrollment and freeze state.</span><code>POST /api/cvi/:wallet/generate</code></div><div><b>CVA</b><strong>Verified asset rules</strong><span>Purpose-bound A-Token policy and receipt balance.</span><code>POST /api/cva/rule</code></div><div><b>CCP</b><strong>Compliance pre-check</strong><span>Final gate before access settlement.</span><code>POST /api/ccp/verify</code></div></div></section>

    <section className="cf-section cf-reveal"><div className="cf-section-heading"><p className="cf-kicker">Deployed on Monad</p><h2>Two contracts.<br/>One auditable lifecycle.</h2></div><div className="cf-contracts">{contracts.map((c)=><article key={c.name} className="cf-contract"><div className="flex justify-between items-start"><IconCode className="text-cf-teal"/><a href={`https://testnet.monadexplorer.com/address/${c.address}`} target="_blank" rel="noreferrer"><IconArrowRight size={16}/></a></div><h3>{c.name}</h3><p>{c.detail}</p><code>{c.address}</code><small>{c.methods}</small></article>)}</div></section>

    <section className="cf-section cf-security cf-reveal"><div><p className="cf-kicker">Security posture</p><h2>Fail closed.<br/>Leave evidence.</h2></div><div className="cf-security-copy"><p>ConsentFlow was tested across lifecycle, batch, fuzz, invariant, pause, access-control, and reentrancy paths. The Prism review found 11 issues; all were fixed before this build.</p><div className="cf-checks"><span><IconCheck size={15}/> Reentrancy guards</span><span><IconCheck size={15}/> Pausable controls</span><span><IconCheck size={15}/> AccessControl roles</span><span><IconCheck size={15}/> Expiry enforcement</span></div></div></section>

    <section className="cf-final cf-reveal"><p className="cf-kicker">Start with the live flow</p><h2>Consent is a state.<br/><em>Make it yours.</em></h2><Link to="/participant" className="cf-glow-btn">Open the demo <IconArrowRight size={16}/></Link></section>
  </main>;
}
