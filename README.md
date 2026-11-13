# Deal Analyzer v2.5 — Acquisitions & Wholesaling Workspace

A single-page real-estate deal analyzer: paste an address + seller conversation, get a **locked, deterministic**
ARV / Rehab / MAO calculation, a tailored seller script, a live call whisperer co-pilot, and a 20x
wholesaling power suite — with a full **interactive Arabic usage guide (📖 شرح الاستخدام)** built in.

## Layers

1. **Layer 1 — Deterministic Calculator (pure code, no LLM math drift)**
   `MAO = round(ARV × 70% − Repairs − Assignment Fee)`, Opening = MAO − cushion %, Target = MAO, Walk-Away = MAO.
2. **Layer 2 — Smart Auto-ARV & Rehab engine** from address + conversation (roof/HVAC credits, kitchen,
   foundation, plumbing, cleanout, pool, sqft/price-per-sqft market modes).
3. **Layer 3 — Seller playbooks & market modes** (distressed, inherited/probate, tired landlord, out-of-state /
   retiring, pre-foreclosure, retail-minded) + Tarrant County TX / South Florida / National baselines.

## Features

- Two-input quick workspace → **⚡ Easy 1-Click: Auto-Calculate ARV + Rehab + Generate Script Now**
- Instant calculator strip (ARV, Repairs, MAO, Opening, Target, Walk-Away, Asking − MAO)
- Tailored seller script with objection handlers + follow-up SMS, conversation read, offer strategy, next 3 actions
- Property snapshot with click-to-cycle verification badges (Verified / Estimate / Unverified)
- **🎧 Live Call Whisperer (<15ms)** — hands-free listening, voiceprint calibration, smart pause vs. seller
  barge-in detection, seller tone detection, 8 one-tap seller objection moments, live offer slider, panic de-escalation
- **🚀 20x Power Tools** — auto rehab breakdown, deal score, seller net sheet, creative finance (Sub-To / Seller
  Carry), 3-option LOI, 12-item rehab checklist, seller net check + probate split, flip/BRRRR ROI, comp adjuster,
  30-day drip, trilingual pitch, CSV/JSON CRM export
- **✨ Dispo & Contract** — wholesale assignment agreement + cash-buyer SMS blast
- Saved deals history with follow-up reminders, JSON/localStorage persistence, dark/light theme
- **📖 شرح الاستخدام (عربي)** — interactive step-by-step Arabic guide with progress tracking

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Live Call Whisperer note

Browser speech recognition (Web Speech API) requires Chrome or Edge. A custom Gemini API key can be added in
**More Tools → Gemini API Key Settings**; without one, the co-pilot uses the instant local reply engine (<15ms).
