# ConsentFlow Demo Video Plan

| Section | Duration | What's shown on screen | Narration topic |
|---|---:|---|---|
| 1. Hero | 0:00–0:16 | Landing hero, orbital mark, CTA | ConsentFlow's purpose: patient-controlled clinical-trial consent |
| 2. Architecture | 0:16–0:31 | Scroll to architecture diagram | Participant → CVI → ConsentRegistry → receipt/oracle layer |
| 3. Evidence | 0:31–0:43 | Metrics, contracts, security section | 55 Solidity tests, 10 backend tests, Monad deployment, Prism fixes |
| 4. Participant demo | 0:43–1:03 | Participant page with showcase wallet connected | Demo wallet, A-Pass action, consent form |
| 5. Create consent | 1:03–1:23 | Filled Study ID/purpose and on-chain action panel | Hashed purpose/study data and revocation control |
| 6. Researcher demo | 1:23–1:43 | Researcher page, request form, CCP section | Researcher queues compensated access request |
| 7. Audit trail | 1:43–1:57 | Audit page and event filters | Consent and access events remain inspectable |
| 8. Docs + close | 1:57–2:10 | Docs sidebar and security section | CVI/CVA/CCP endpoints and fail-closed settlement |

## Sync rules

- Narration is generated before recording.
- Every section transition is a visible browser action at the table boundary.
- Hold each target section for its narration duration; no looping footage.
- Record at 1920×1080 on Xvfb with Cap.so only.
- Export with Cap.so; no Playwright and no ffmpeg.
