# Deal Analyzer v2.5 — Limitations & Caveats: Enhanced Specification

**Scope:** [Deal Analyzer v2.5](https://jasonwade45.github.io/Deal-analysis/) — fixed-code cash-offer calculator, seller-script generator, live call co-pilot, creative-finance tools.
**Audience:** developer + UX + copy review.
**Status:** copy and acceptance-criteria spec. No application code is changed by this document.
**Rule for this document:** every legal, tax, or financial statement is **not advice** and must be verified with a qualified professional. Nothing here creates a legal conclusion.

Existing caveats are preserved and marked **♻**; all other rows are new or expanded.

---

## A. Executive summary — the 5 caveat upgrades that matter most

1. **Turn "ESTIMATE ONLY" into a hard gate, not a label.** Today it appears only when ARV or repairs are empty. Expand it to missing/invalid/implausible inputs, fewer than 3 documented comps, repaired-value > 60% of ARV, MAO ≤ 0, and any required verification badge left unverified. While active, block "Copy Contract / LOI", mark saved deals "Estimate Only", and show a persistent results banner (not the 5.5-second toast).
2. **Expose the two biggest hidden assumptions in the UI: the 70% rule and the $10,000 fee.** Both are defaults, not facts. The 70% rule is a rule of thumb that varies by market, exit strategy, condition, and buyer demand; the fee must be confirmed against real buyer demand and closing structure. Put inline warnings beside the MAO % and Fee fields, and echo both in every exported artifact.
3. **Stop confidence badges from manufacturing certainty.** The Property Snapshot lets a user cycle any row to `VERIFIED` with no evidence. Change to: evidence required, note + source + timestamp stored, `VERIFIED` impossible for ARV/repairs/ownership without attached proof, and every export prints the badge state. This is the single highest-risk UX pattern in the tool.
4. **Add legal/compliance guardrails where the tool currently gives operational output:** recording/transcription consent before the mic starts, "scripts are templates — claims must be true" beside every script, fair-housing and marketing (TCPA/DNC/CAN-SPAM) warnings on drip/WhatsApp copy, and a "not advice" banner on creative-finance (Sub-To / seller-carry) terms.
5. **Warnings must survive copy, print, and language switching.** Copied scripts/net sheets currently arrive at the seller or buyer with no disclaimer. Automatically append the short disclaimer to every copy action, include warnings in print/PDF output, and require human-reviewed Arabic copy so the AR disclaimer is not a machine translation of the EN one.

---

## B. Enhanced Limitations & Caveats table

Legend — **Severity:** Critical = can cause a materially wrong price, unenforceable deal, legal exposure, or misleading a protected party. High = can cause a bad deal or lost money without immediate illegality. Medium = degrades judgment or usability.
**Placement** options: inline warning, tooltip, modal, results banner, footer disclaimer, checklist item.

### B1. Calculation and input risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| C-01 ♻ | Fixed-formula math is only as good as its inputs | Computes MAO, opening, spreads deterministically; does **not** validate that ARV, repairs, fee, or asking price are true | Precise-looking output creates false precision from wrong inputs | Source every input; attach the document or note that produced it | High | Results banner + MAO tooltip |
| C-02 | 70% MAO rule is not universal | Applies a single MAO % to every market, condition, and exit; does not adjust for market heat, rental/BRRRR exits, or buyer demand | Deals that look safe at 70% can be unprofitable at 65% in slow markets, or need 75–80% in competitive ones | Set MAO % per market and exit; record the rationale; stress-test at ±5 points | High | Inline warning beside MAO % + results banner |
| C-03 | $10,000 assignment fee is an assumption | Prefills a default fee and subtracts it from MAO; does not know your real spread, double-close costs, or buyer demand | Overstating the fee suppresses your offer; understating it leaves no profit and kills the contract | Confirm the fee against an actual buyer, contract terms, and closing costs | High | Inline warning beside Fee field |
| C-04 | Number parsing and auto-fill can silently change meaning | Strips non-numeric characters, supports "250k"/"280", and the Analyze button overwrites ARV/Repairs/Asking; does not show a diff | A value typed as 250 when 250,000 was meant is a 1000x error; re-running Analyze can overwrite verified numbers | Confirm the parsed values echoed back; review and lock verified fields before re-analysis | Critical | Inline validation + confirm modal before overwrite |
| C-05 | No guardrail on nonsensical outcomes | Will display zero or negative MAO, or MAO below known payoff, without blocking | You can copy a contract for an unfundable or loss-making deal | Reject any MAO ≤ 0 or MAO below payoff + closing costs; re-underwrite | High | Results banner + hard stop on copy/contract |
| C-06 | Single-point output, no sensitivity | Produces one number set; no range, scenario table, or sensitivity analysis | Users treat one number as the answer, then discover the deal only works at the optimistic edge | Run at least base/upside/downside scenarios (ARV ±5–10%, repairs ±20%) | Medium | Results banner note + tooltip |
| C-07 | Missing asking price / missing gap | Still shows MAO when asking is blank; gap and "below MAO" indicator stay unknown | Users assume a spread exists when it was never measured | Obtain asking price or payoff before quoting a gap | Medium | Inline "Gap unavailable" state |
| C-08 | Rounding and fee-in-MAO affect the effective percentage | Rounds MAO and subtracts the fee from the same formula; does not show the effective all-in percentage | The headline "70%" is not the actual percentage of ARV in the deal | Read the effective % shown; do not quote "70% of ARV" as the offer | Medium | Tooltip on MAO cell |

### B2. Property-data verification risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| P-01 ♻ | Beds, baths, sqft, year built are inferred | Parses text and defaults (e.g., 1,600 sqft); does **not** verify county appraiser or tax roll | Wrong sqft changes ARV and rehab by large amounts; wrong year triggers lead/asbestos and insurance issues | Verify every row against the county appraiser before presenting numbers | High | Snapshot badges + tooltip + inline source note |
| P-02 | Market pricing is a keyword heuristic | Picks $/sqft from address keywords (TX, FL, CA, OH) and market mode; does not use real comps or MLS data | A misclassified address can shift ARV by tens of thousands | Confirm market mode manually and reconcile with actual sold comps | High | Inline warning under address + market selector |
| P-03 | No parcel/APN match; typos pass through | Accepts any address text; no parcel ID, zoning, HOA, flood zone, or historic-overlay check | Wrong property, uninsurable property, or illegal use discovered after contract | Verify APN, zoning, flood zone, HOA, and use restrictions | High | Checklist item + inline warning |
| P-04 | Condition, occupancy, and access are unknown | Infers condition from seller statements; does not inspect, walk through, or confirm occupancy | Hidden damage, occupants, or no access can turn a 2-week close into a 6-month problem | Physical walkthrough or trusted photos/video before finalizing | High | Results banner + checklist |
| P-05 | Mechanical "young/good" credits rely on seller claims | Awards $0 roof/HVAC deductions when the seller says "2.5 years old"; does not verify permits or install dates | A seller-stated roof age can be false or unpermitted; insurance may still refuse | Verify age via permits, serial numbers, or inspection | High | Inline note on snapshot mechanical row |
| P-06 | No MLS or county API integration | All data is user-entered or text-parsed; no live feeds, no automated comps | Data goes stale and unverified while looking official | Treat every field as unverified until a human confirms | Medium | Footer disclaimer + About panel |
| P-07 | Insurability and code upgrades not modeled | Ignores roof-age insurance rules, 4-point inspections, permits, code compliance, and lender-required repairs | A deal can be unsellable to your buyer list or uninsurable at closing | Order insurance quote and code/permit check before contract | High | Checklist item |

### B3. ARV, comps, and repair-estimate risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| A-01 ♻ | ARV is not an appraisal | Estimates ARV from sqft × regional $/sqft, regex-captured comps, or asking-price multipliers; does not perform a USPAP appraisal or BPO | Overstated ARV inflates MAO and can make a losing deal look profitable | Obtain 3 sold comps + an appraisal or BPO before a binding offer | Critical | Results banner + modal before contract copy |
| A-02 | Comps are parsed, never verified or adjusted | Regex pulls "sold/comp/worth" figures from notes; no MLS verification, no time/distance/condition adjustments, no distressed-sale filtering | A single bad comp can move ARV by 10–20%; listing or Zestimate values can be parsed as sold prices | Verify each comp: address, sold date, sqft, condition, source; adjust explicitly | Critical | Inline near comps/notes + checklist |
| A-03 | Fewer than 3 comps is accepted silently | Will calculate with zero or one comp and still show a full MAO | The output looks authoritative without a supportable value | Do not rely on ARV until at least 3 verified sold comps exist; otherwise keep ESTIMATE ONLY | High | ESTIMATE ONLY gate + results banner |
| A-04 | Repairs are line-item assumptions, not bids | Applies regional default costs (roof, HVAC, kitchen, foundation, etc.) with a standard contingency in some cases; no contractor scope, permits, or change orders | Real bids commonly land 20–40% above defaults; scope creep is the norm in distressed property | Obtain at least one contractor walkthrough or itemized bid and add a contingency | Critical | Inline warning on repairs + results banner |
| A-05 | Unknown hazards are not assessed | Does not test for asbestos, lead paint (pre-1978), mold, radon, structural movement, or underground tanks | Hidden remediation can exceed the entire rehab budget and delay closing | Order inspections/testing where age or condition suggests risk | High | Modal before offer + checklist |
| A-06 | Rehab can exceed what the deal supports | Computes repairs without capping them against ARV or MAO | A heavy-rehab deal can show a negative real spread while the UI still shows numbers | Re-underwrite or walk away when repairs exceed the supported budget | High | Hard-stop banner |
| A-07 | Selling/exit costs use fixed assumptions | Net-sheet uses 6% commissions, 2% closing, 4 months holding, $5,500 credits as defaults | Actual costs vary widely by market and buyer type; the comparison can be wrong either way | Replace defaults with market-specific quotes before showing a seller | Medium | Tooltip on net sheet + inline note |

### B4. Due-diligence, title, and lien risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| D-01 ♻ | Not a substitute for due diligence | Generates analysis and scripts; performs no title search, lien search, inspection, or legal review | The tool's confident output can substitute psychologically for the work that actually protects the deal | Complete title, lien, inspection, and legal review before signing anything | Critical | Results banner + footer + contract modal |
| D-02 | Payoff, arrears, and foreclosure timelines are unverified | Computes MAO and seller net without confirming the mortgage payoff or trustee sale date | A deal can close with insufficient funds to clear liens, or miss the auction deadline entirely | Obtain a written payoff statement and confirm the sale date with the trustee | Critical | Results banner + pre-foreclosure modal |
| D-03 | Probate and signing authority are not verified | Generates inherited/probate scripts from keywords; does not confirm executor authority, heir consent, or court approval | An agreement signed by the wrong party is unenforceable and can delay the estate for months | Confirm letters testamentary, heir consent, and court requirements with counsel | Critical | Modal when seller type = inherited |
| D-04 | Occupancy, leases, and eviction exposure are unknown | Assumes tenant-in-place is acceptable when mentioned; does not check lease terms or local eviction rules | Buying a tenancy can mean months of no access and legal cost | Obtain lease, payment history, and local eviction counsel input | High | Inline in tired-landlord mode + checklist |
| D-05 | Survey, easements, environmental, and insurability are unchecked | No boundary, access, flood, wetland, or insurance review | Access or flood issues can make the property unsellable or uninsurable | Order survey/flood determination and insurance quote before removing contingencies | High | Checklist item |
| D-06 | Contract terms are illustrative | Displays an assignment agreement draft and EMD/inspection terms; does not provide jurisdiction-specific forms or advice | Using an unqualified form can create unenforceable or non-compliant contracts | Have a local attorney or title company review all documents | High | Modal before copy/print + footer |

### B5. Negotiation script and seller-motivation risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| N-01 | Motivation score is subjective | Produces a 4–10 score from keyword heuristics (behind, probate, Zillow, etc.); not a behavioral or financial assessment | Users may over-prioritize a "9/10" lead with no real urgency, or drop a quiet but motivated seller | Treat the score as a conversation prompt; confirm motivation with evidence | High | Tooltip beside score + results banner |
| N-02 | Scripts are templates, not guarantees | Generates opening, bridge, offer, objections, and close copy with locked numbers | A script that lands badly can burn a lead; results are not predictable | Adapt tone and language to the seller; rehearse; do not read mechanically | High | Inline warning above script |
| N-03 | Script claims must be true and supportable | Includes statements like "saved you $19,000", "close in 14–21 days", "all closing costs covered" | Unverifiable or false claims can be misrepresentation and create legal exposure | Verify every claim before saying it; remove anything you cannot prove | Critical | Inline warning + script checklist |
| N-04 | Pressure, urgency, and fair-housing compliance | Uses urgency framing ("auction clock", "before the 1st") and property/owner targeting; no compliance filter | High-pressure tactics or protected-class targeting can violate fair housing, licensing, or consumer-protection rules | Keep urgency factual; never reference protected classes; follow local solicitation rules | Critical | Modal before first script + footer |
| N-05 | Recording and transcription consent | Live mic, dictation, and co-pilot capture audio; does not obtain or track consent | One-party vs all-party consent laws vary; recording without consent can be illegal | Confirm consent and legal basis before enabling the mic or recording | Critical | Consent modal on mic start |
| N-06 | Optional Gemini co-pilot can fabricate wording | Sends live context to Gemini for suggested replies; numbers are locked in the prompt but the model can still produce wrong or non-compliant sentences | A hallucinated number or claim said on a live call is your liability | Read every suggestion before speaking; never read a number you did not verify | High | Persistent banner on Live tab |
| N-07 | Tone/voice classification is heuristic | Estimates speaker tone and voice match from pitch/energy; not biometric-grade and can mislabel | Misread tone can push the wrong response at the wrong moment | Use as a hint only; rely on the actual words and context | Medium | Tooltip on tone panel |

### B6. Creative-finance / seller-carry risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| F-01 | LOI and three-option terms are illustrative only | Generates non-binding option summaries; does not draft notes, mortgages, deeds of trust, or disclosures | Treating a summary as an enforceable contract creates disputes and unenforceable terms | Have counsel draft and review all creative-finance documents | Critical | Modal before copying the LOI |
| F-02 | Sub-To carries due-on-sale and acceleration risk | Shows a Sub-To option price; does not check the existing loan's due-on-sale clause, escrow, or lender consent | Lender can accelerate the loan; the seller and you can both lose the property | Review the note and lender requirements with counsel before proposing Sub-To | Critical | Modal + checklist |
| F-03 | Payment math is simple division | Divides the financed balance by months; no interest, amortization, balloon, servicing, or late-fee modeling | The quoted monthly payment can be materially wrong, and interest/tax treatment changes the economics | Build an amortization schedule with a professional; verify affordability | High | Inline warning beside term inputs |
| F-04 | Seller-finance compliance is not assessed | No check for Dodd-Frank/SAFE Act, licensing, usury, disclosure, or state-specific seller-financing limits | Non-compliant seller financing can be void, penalized, or criminal in some states | Confirm compliance with a licensed attorney or mortgage professional | Critical | Modal + footer |
| F-05 | Default remedy and loan documents are absent | Does not produce note terms, default clauses, or foreclosure remedies | If the buyer defaults, the seller may have no enforceable remedy | Document default, late fees, insurance, and remedies with counsel | High | Checklist item |
| F-06 | Tax treatment is unknown | Does not model installment-sale treatment, interest income, depreciation recapture, or withholding | Tax surprises can erase the benefit of a higher headline price | Get tax advice before proposing or accepting terms | High | "Not advice" inline note |
| F-07 | Down payment and arrears math may not clear liens | Computes a down payment and payoff estimate from user inputs; does not verify the actual payoff or lien releases | Seller may not net the promised amount, and liens may survive closing | Verify payoff letters and lien releases before promising net figures | High | Inline warning in creative section |

### B7. Market, legal, tax, and compliance risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| M-01 | No market, absorption, or rental analysis | Does not measure days on market, investor demand, vacancy, or rents | A mathematically valid MAO can still be unsellable or unrentable in that submarket | Pull local DOM, investor activity, and rent comps before committing | High | Results banner note |
| M-02 | No tax computation | Does not calculate prorations, reassessment, transfer taxes, capital gains, 1031, or entity tax effects | Net proceeds shown are pre-tax and pre-proration; the seller's real net may differ | Have a tax professional review the actual transaction | High | Footer + net-sheet note |
| M-03 | No legal advice; wholesaling rules vary | Provides scripts and contract drafts; does not determine licensing, disclosure, or marketing legality in your state | Some states restrict or regulate wholesaling and assignment fees; unlicensed activity can be penalized | Confirm requirements with local counsel and your broker | Critical | Footer + About + contract modal |
| M-04 | Marketing and outreach compliance | Generates drip SMS, WhatsApp shares, and call scripts; does not check consent, DNC, or fair housing | TCPA/CAN-SPAM/DNC violations and discriminatory targeting carry real penalties | Use compliant consent-based outreach and approved messaging | Critical | Modal on drip/WhatsApp copy |
| M-05 | Privacy of locally stored data | Stores deals, API key, and conversation text in browser localStorage; no encryption or access control | Shared devices or browser profiles can expose seller PII and your key | Use a dedicated device/profile; clear data when done; do not store sensitive PII | High | Privacy note in API settings + footer |
| M-06 | No sync, backup, or browser guarantee | Data stays in one browser; speech features require Chrome/Edge | Clearing data or switching devices loses the pipeline; unsupported browsers silently fail | Export CSV/JSON regularly; verify browser support before a call block | Medium | History panel note + Live tab |

### B8. UI/UX warning-placement risks

| ID | Limitation | What the tool does / does not do | Why it matters (failure mode) | Required user action before relying | Severity | Suggested UI placement |
|---|---|---|---|---|---|---|
| U-01 | Critical states appear as auto-dismissing toasts | The top notification hides after ~5.5 seconds; the same component is used for approvals, warnings, and rejections | A rejection or missing-prerequisite warning can disappear before it is read | Make Critical states persistent until dismissed; keep toasts for confirmations only | High | Results banner for Critical |
| U-02 | ESTIMATE ONLY is visually weak next to precise figures | Renders as a small pill while dollar amounts are large and bold | Users copy numbers and miss the caveat entirely | Add a results banner, prefix outputs with "Est.", and disable contract/LOI copy | High | Results banner + disabled actions |
| U-03 | Verification badges can be self-assigned | Any row can be clicked to VERIFIED with no evidence, note, or timestamp | Creates false assurance and undermines the whole data-quality model | Require evidence + note; make VERIFIED non-selectable where proof is mandatory; store audit trail | Critical | Snapshot badges + modal |
| U-04 | Copied and exported text loses all warnings | Copy actions output scripts, net sheets, and LOIs without disclaimers | The warning stays in the app while the claim travels to the seller or buyer | Append the short disclaimer to every copy/export automatically | Critical | Inline + export template |
| U-05 | Print/PDF can omit warnings | Header is print-hidden and warnings live inside interactive components | A printed package can look clean while omitting the caveats | Include a dated disclaimer block in print output | High | Print stylesheet + footer block |
| U-06 | Modal, a11y, RTL, and mobile gaps | Long disclaimers can be skipped; focus is not trapped; Arabic and English mix without dir handling; small screens truncate labels | Users skip the warning or cannot read it; assistive tech misses it | Scroll-to-end acknowledgment on critical modals; focus trap; 4.5:1 contrast; test at 360px | High | Modal + QA checklist |
| U-07 | Arabic and English disclaimer parity | Arabic copy exists for the guide but not for all legal/risk text; machine translation risk | A weaker or mistranslated Arabic warning is not equivalent protection | Human-review the Arabic disclaimer; show both languages where risk is Critical | High | Footer + modal language toggle |

**Preserved-caveat map:** C-01 (fixed, not AI math), P-01 (county-appraiser verification), A-01 (not an appraisal / due diligence), D-01 (not a substitute for due diligence), U-02 (ESTIMATE ONLY). All remain, expanded in place.

---

## C. Revised on-page copy (long version)

> Use this as the "Limitations & Caveats" page/section. Keep section headings and severity labels; do not collapse. Every legal/tax note ends with the same sentence: **Not advice — verify with a qualified professional.**

### Limitations & Caveats

**Read this before you use any number on this page.**

Deal Analyzer is a calculator and a script generator. It is not an appraisal, a title search, an inspection, a contract, or professional advice. Its output is only as good as the data you type into it, and most of that data has not been verified by anyone. Every figure below is a working estimate for a conversation — not a commitment, not a valuation, and not a green light to sign.

The math itself is fixed code, not AI: `MAO = round(ARV × 70% − Repairs − Assignment Fee)`. That removes arithmetic drift, not data risk. If ARV or repairs are wrong, the output will be wrong with perfect precision.

#### 1. Calculation and input risks

- **The 70% rule is a rule of thumb, not a law (High).** Investors use different percentages by market, condition, exit strategy, and buyer demand. A deal that pencils at 70% can be unprofitable at 65% or unnecessarily conservative at 80%. Set the percentage deliberately, record why, and stress-test it ±5 points.
- **The $10,000 assignment fee is a default assumption (High).** Confirm it against a real buyer, real closing costs, and your actual spread before you subtract it from an offer.
- **The opening offer is a negotiation position, not a valuation (Medium).** The cushion percentage exists to create room to concede. It says nothing about what the property is worth or what the seller will accept.
- **Parsing and auto-fill can change your numbers (Critical).** The tool accepts shorthand like "250" or "250k" and the Analyze button can overwrite ARV and repairs. Check the parsed values and lock verified fields before re-running analysis.
- **No guardrail on impossible deals (High).** The tool will display a zero or negative MAO, or an MAO below the mortgage payoff. Stop and re-underwrite; do not copy a contract from that state.
- **One number set is not a range (Medium).** There is no sensitivity analysis. Run base, upside, and downside cases before relying on the output.
- **Rounding changes the effective percentage (Medium).** The fee is included inside the MAO formula, so the actual percentage of ARV differs from the headline number.

#### 2. Property-data verification risks

- **Beds, baths, square footage, and year built are inferred (High).** Defaults and text parsing are not county records. Wrong square footage moves ARV and rehab by tens of thousands; a wrong build year changes lead/asbestos and insurance exposure. Verify every row against the county appraiser and tax roll.
- **Market pricing is keyword-based (High).** The tool chooses a price per square foot from the address and market mode, not from live comps. Confirm the market manually and reconcile with actual sales.
- **No parcel match, zoning, flood, or HOA check (High).** Typos pass straight through. Verify APN, zoning, use restrictions, HOA rules, and flood zone.
- **Condition, occupancy, and access are unknown (High).** The tool cannot see the property. Walk it or review current photos and video before you finalize an offer.
- **"Young roof / good HVAC" credits rely on the seller (High).** Verify install dates, permits, and serial numbers; insurance may still require replacement.
- **No MLS or county integration (Medium).** Every field is user-supplied and unverified. Treat it that way. Not advice — verify with a qualified professional.

#### 3. ARV, comps, and repair risks

- **ARV is not an appraisal (Critical).** Values come from heuristics, parsed comps, or asking-price multipliers. Get three verified sold comps and an appraisal or BPO before a binding offer.
- **Comps are parsed, never adjusted (Critical).** The tool pulls numbers out of text; it cannot tell a sold price from a Zestimate, an old sale from a current one, or a distressed sale from an arm's-length one. Verify address, date, size, condition, and source for each comp.
- **Fewer than three comps is not a valuation (High).** The output still looks complete. Until you have three verified sold comps, the result remains an estimate only.
- **Repairs are assumptions, not bids (Critical).** Regional defaults are not contractor quotes. Get an itemized bid or walkthrough and add a contingency for scope creep, permits, and change orders.
- **Hazards are not assessed (High).** No asbestos, lead, mold, radon, structural, or tank testing. Test where age or condition warrants it.
- **Rehab can exceed what the deal supports (High).** The tool does not cap repairs against ARV. Re-underwrite or walk away.
- **Exit costs are defaults (Medium).** Commissions, closing costs, holding time, and credits in the net sheet are placeholders. Replace them with your market's real numbers.

#### 4. Due-diligence, title, and lien risks

- **Not a substitute for due diligence (Critical).** No title search, lien search, inspection, or legal review happens here. Complete all four before signing.
- **Payoff and foreclosure timelines are unverified (Critical).** Get a written payoff and confirm any auction date with the trustee. The urgency language in the scripts is only valid if the date is real.
- **Probate authority is unverified (Critical).** An executor, heir, or court may need to approve. Confirm authority with counsel before presenting an agreement.
- **Occupancy and eviction exposure are unknown (High).** Review the lease, payment history, and local eviction rules before buying a tenancy.
- **Survey, environmental, and insurability are unchecked (High).** Order a survey or flood determination and an insurance quote before removing contingencies.
- **Contract drafts are illustrative (High).** Use jurisdiction-appropriate forms reviewed by a local attorney or title company. Not advice — verify with a qualified professional.

#### 5. Negotiation scripts and seller-motivation risks

- **Motivation scores are subjective (High).** The 4–10 score comes from keywords, not from verified hardship, equity, or timeline. Treat it as a question to ask, not a fact.
- **Scripts are templates (High).** They are written for a generic cash sale. Adapt them, or they will sound mechanical and cost you the lead.
- **Every claim you say must be true (Critical).** Statements like "we saved you $19,000" or "we close in 14–21 days" must be verifiable. Remove anything you cannot support.
- **Stay factual and compliant (Critical).** No false urgency, no pressure tactics, no references to protected classes. Follow fair-housing, solicitation, and licensing rules in your state.
- **Recording needs consent (Critical).** The mic, dictation, and co-pilot capture audio. Confirm consent and the legal basis before recording; consent laws vary by state.
- **The optional Gemini co-pilot can be wrong (High).** Numbers are locked in the prompt, but the model can still produce incorrect or non-compliant wording. Read every suggestion before speaking it.
- **Tone detection is a hint (Medium).** Pitch and energy estimates can mislabel a seller. The words matter more than the meter.
- **Not advice — verify with a qualified professional.** Nothing in the scripts is legal, tax, or financial advice for you or the seller.

#### 6. Creative finance and seller-carry risks

- **The LOI is a non-binding summary (Critical).** It is not a contract and creates no enforceable rights. Counsel must draft the note, mortgage or deed of trust, disclosures, and default terms.
- **Sub-To can trigger a due-on-sale clause (Critical).** Review the existing note and lender requirements before proposing a subject-to structure.
- **Payment math is simple division (High).** There is no amortization, interest, balloon, servicing, or late-fee modeling. Build a real schedule with a professional.
- **Seller-finance rules vary and can be strict (Critical).** Dodd-Frank, SAFE Act, licensing, usury, and disclosure requirements may apply. Confirm compliance before proposing terms.
- **Default remedies do not exist until documented (High).** Do not rely on a handshake; paper the remedies.
- **Tax treatment is unknown (High).** Installment sales, interest income, depreciation recapture, and withholding can change the outcome. Get tax advice.
- **Not advice — verify with a qualified professional.** The creative-finance numbers are negotiation scaffolding, not a compliant structure.

#### 7. Market, legal, tax, and compliance risks

- **No market or rental analysis (High).** Days on market, absorption, investor demand, vacancy, and rents are not modeled. A valid MAO can still be an unsellable deal.
- **No tax computation (High).** Prorations, reassessment, transfer taxes, capital gains, 1031 exchanges, and entity effects are not calculated. Net proceeds are pre-tax.
- **No legal advice (Critical).** Wholesaling, assignment fees, disclosure, and marketing rules differ by state and can require a license. Confirm with local counsel and your broker.
- **Marketing compliance is your responsibility (Critical).** SMS, WhatsApp, and drip copy must respect consent, DNC, TCPA, and CAN-SPAM. The tool does not check any of that.
- **Local data stays local (High).** Deals, conversation text, and any API key are stored in this browser. Use a dedicated device or profile and clear data when finished.
- **No sync or backup (Medium).** Export your deals; clearing browser data deletes them.
- **Not advice — verify with a qualified professional.** Tax, legal, and compliance positions must be confirmed before you act.

#### 8. How warnings are shown

- **Critical warnings stay on screen.** They will not auto-dismiss; you must acknowledge them before copying a contract, LOI, or script.
- **"Estimate Only" blocks exports.** When inputs are incomplete or unverified, contract and LOI copying is disabled and saved deals are marked as estimates.
- **Verification badges require evidence.** "Verified" means a document, source, and date were attached — not that someone clicked a badge.
- **Copies carry the disclaimer.** Every copied script, net sheet, or LOI includes the short disclaimer so the caveat travels with the numbers.
- **Arabic and English warnings are equivalent.** Both languages carry the same critical warnings, reviewed by a human, not machine-translated.

### User Responsibility / No Warranty

You are responsible for every number you enter, every statement you make to a seller or buyer, and every document you sign. Deal Analyzer and its authors provide the tool "as is," without warranties of any kind, express or implied, including accuracy, completeness, merchantability, or fitness for a particular purpose. We do not guarantee that any calculation, estimate, comp, repair figure, script, or creative-finance term is accurate, lawful, or suitable for your transaction.

Nothing in this tool is legal, tax, financial, investment, or brokerage advice, and using it does not create a professional relationship. It is not a substitute for a licensed appraisal, a title search, a professional inspection, contractor bids, environmental testing, or advice from qualified local counsel, a CPA, or a licensed mortgage professional. Real-estate transactions involve substantial risk, including loss of capital. Verify independently before you make an offer, sign an agreement, or fund a transaction. Not advice — verify with a qualified professional.

---

## D. Footer disclaimer (short version)

> **Not advice. Verify before you offer.** Deal Analyzer is a calculator and script generator, not an appraisal, title search, inspection, or legal/tax/financial advice. ARV, comps, repairs, and property details are unverified estimates; the 70% MAO rule and the $10,000 fee are defaults, not facts. Confirm every figure and complete your own due diligence with qualified professionals. [Read full limitations](#limitations)

**One-line variant for exports and SMS/WhatsApp footers:**
> Estimates only — not an appraisal or legal/tax advice. Verify comps, repairs, title, payoff, and terms with qualified professionals before offering. Full limitations: https://jasonwade45.github.io/Deal-analysis/#limitations

---

## E. "ESTIMATE ONLY" trigger logic

### E1. Input conditions that activate it

| # | Condition | Evaluated on | Current behavior | Required behavior |
|---|---|---|---|---|
| 1 | ARV empty, non-numeric, or ≤ 0 | ARV field | Active | Active |
| 2 | Repairs empty and not explicitly `0` | Repairs field | Active | Active; `0` requires an explicit "no repairs confirmed" tick |
| 3 | ARV parsed as implausible (< $20,000 or > $10,000,000) | ARV field | Not handled | Active + inline "check units" warning |
| 4 | ARV < Repairs, or Repairs > 60% of ARV | ARV + Repairs | Not handled | Active + "verify scope" flag |
| 5 | MAO ≤ 0, or MAO below known payoff + closing costs | Calculator + payoff fields | Not handled | Active + block contract copy |
| 6 | Fewer than 3 documented sold comps | Comps checklist | Not handled | Active (ARV unverified) |
| 7 | Square footage is a default, not a counted/verified value | Snapshot sqft row | Not handled | Downgrade ARV confidence, show "sqft unverified" |
| 8 | ARV or Repairs badge is not `VERIFIED` | Snapshot badges | Not handled | Active for export gating; UI may still show "Working estimate" |
| 9 | Required county fields (APN, year built, sqft) are unverified | Snapshot | Not handled | Show a "verification incomplete" checklist, not a hard estimate flag |
| 10 | Asking price missing | Asking field | Gap shows "—" | **Do not** activate ESTIMATE ONLY; show "Gap unknown" inline |
| 11 | Test offer > MAO | Test offer field | Rejection toast only | Block submission + persistent rejection banner |

### E2. Display rules while active

- Persistent amber results banner above the calculator: **"ESTIMATE ONLY — {reason}. Do not present these figures as a binding offer."** It does not auto-dismiss.
- Prefix every exported number block with `Est.` and list the active reasons.
- Show a "What's missing" chip group: `ARV`, `Repairs`, `Comps < 3`, `MAO ≤ 0`, `Badges unverified`.
- Disable: **Copy Contract**, **Copy 3-Option LOI**, **Save as Analyzed** (status becomes `Estimate Only`).
- Allow: **Copy Script**, **Copy Net Sheet** — but append the short disclaimer and an `ESTIMATE ONLY` header line.

### E3. Clearing rules

Deactivate only when all are true:
1. ARV parses > 0 and is within the plausible range.
2. Repairs parses ≥ 0; `0` requires explicit confirmation.
3. ARV ≥ Repairs and Repairs ≤ 60% of ARV.
4. MAO > 0 and (if payoff is known) MAO ≥ payoff + estimated closing costs.
5. At least 3 comps are entered with source + date, or the user records a documented override with a reason.
6. ARV and Repairs badges are `VERIFIED` with evidence + timestamp.

### E4. Reference implementation (adapt to current state model)

```js
const reasons = [];
if (!arvValid) reasons.push('ARV missing or invalid');
if (!repairsValid) reasons.push('Repairs missing');
if (arvValid && repairsValid && repairs > arv * 0.6) reasons.push('Repairs exceed 60% of ARV');
if (arvValid && (arv < 20000 || arv > 10000000)) reasons.push('ARV outside plausible range');
if (mao !== null && mao <= 0) reasons.push('MAO is zero or negative');
if (mao !== null && payoffKnown && mao < payoff + closingCosts) reasons.push('MAO does not clear payoff');
if (compsVerified < 3) reasons.push('Fewer than 3 verified comps');
if (badge('arv') !== 'VERIFIED' || badge('repairs') !== 'VERIFIED') reasons.push('ARV or Repairs unverified');

const isEstimateOnly = reasons.length > 0;
const canExportContract = !isEstimateOnly && !testOfferExceedsMao;
```

> Note: the current app already treats `repairs === 0` as valid and flags only missing ARV/repairs; keep that behavior and layer the new conditions on top.

---

## F. "Before You Make an Offer" verification checklist

Gate the offer button (or at minimum the contract/LOI copy) behind this checklist. Each item needs evidence, an owner, and a date.

| # | Checklist item | Required evidence | Blocks offer? |
|---|---|---|---|
| 1 | County appraiser data confirmed | APN, beds/baths, sqft, year built from the county record (screenshot or link + date) | Yes |
| 2 | Three sold comps verified | 3 addresses, sold price, sold date, sqft, condition, source; all within the chosen radius/time window | Yes |
| 3 | ARV supported | Appraisal, BPO, or agent CMA, or the comp adjustment sheet | Yes |
| 4 | Repair scope and photos | Contractor walkthrough or itemized bid; current photos/video; contingency % recorded | Yes |
| 5 | Title, liens, and payoff | Title commitment or preliminary report; written mortgage payoff; lien/HOA/judgment search | Yes |
| 6 | Tax roll and prorations | Current tax bill, assessed value, any delinquency, proration estimate | Yes |
| 7 | Seller motivation evidence | Documented reason, timeline, and decision-makers (not just a keyword score) | Yes |
| 8 | Occupancy and access | Lease or occupancy statement; confirmation of access for inspection | Yes |
| 9 | Insurance and insurability | Quote or confirmation the property is insurable at expected cost | Yes |
| 10 | Creative-finance terms (if used) | Counsel-reviewed note/LOI, amortization schedule, due-on-sale and compliance review | Yes, if option C is on the table |
| 11 | Disclosure and consent | Recording consent, marketing consent, agency disclosure as required locally | Yes |
| 12 | Exit and buyer demand | Buyer list response or assignment candidate; expected days to assign | No, but required to quote a fee |

**Sign-off:** `Analyst name / date` + `Reviewer (if required by your shop) / date`. The tool should store this block with the deal and print it on any exported package.

---

## G. Acceptance criteria for the developer/UX team

1. **Persistent risk surface:** a dedicated "Limitations & Caveats" page or section exists, is reachable from the footer and the header, and carries all eight categories with the exact copy in section C.
2. **ESTIMATE ONLY gate:** every condition in E1 is implemented; the banner persists; contract and LOI copy are disabled; saved deals are marked `Estimate Only`; reasons are itemized.
3. **No false verification:** `VERIFIED` requires evidence (URL/file/note) + timestamp; ARV, repairs, and ownership cannot be marked verified without it; exported artifacts print the badge state and date.
4. **Assumption warnings in place:** inline warnings beside MAO %, Fee, Repairs, ARV, comps, motivation score, and creative-finance inputs; each names the assumption and the required action.
5. **Copy/export integrity:** every copy action (script, net sheet, LOI, CSV/JSON, WhatsApp) appends the short disclaimer and, when applicable, the `ESTIMATE ONLY` header.
6. **Print integrity:** printed/PDF output includes a dated disclaimer block; no warning is hidden by print styles.
7. **Critical-state UX:** no Critical warning is delivered only by the 5.5-second toast; all Critical states offer an explicit acknowledgment.
8. **Recording consent:** enabling the mic or dictation shows a consent modal and records acceptance before audio capture starts.
9. **Creative-finance gate:** the LOI/Sub-To/seller-carry area shows a modal covering non-binding status, due-on-sale, amortization, compliance, tax, and default risk before any copy or calculation is shown as final.
10. **Compliance copy:** fair housing, licensing/wholesaling, TCPA/DNC, and "not advice" notices appear where the related features are used, not only in the footer.
11. **Privacy disclosure:** the API settings and History panels state that keys, deals, and transcripts are stored locally and how to clear them.
12. **Accessibility and localization:** WCAG AA contrast for severity colors, icon + text labels (not color alone), focus trap and Esc in modals, correct `dir` handling for mixed Arabic/English, and a human-reviewed Arabic version of every Critical warning.
13. **Mobile:** all warnings remain fully readable at 360px, with no truncation of severity or required action.
14. **Regression tests:** unit tests for each E1 trigger and clearing rule; snapshot tests for the persistent banner and disabled export buttons; a test that copied text contains the disclaimer.
15. **No weakening:** the four existing caveats (fixed math, county verification, not an appraisal/due diligence, ESTIMATE ONLY) remain present and, where applicable, expanded — never shortened or removed.

---

### Reviewer note

This document is a specification and copy set, not legal advice. Before publishing the long disclaimer, have local counsel review the wording for your jurisdiction and business entity. Not advice — verify with a qualified professional.
