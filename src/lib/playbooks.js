// ============================================================================
// LAYER 3: SELLER-TYPE PLAYBOOK & MARKET MODES
// ============================================================================

export const MARKET_MODES = {
  national: {
    id: 'national',
    label: 'National Standard',
    rehabPerSqft: { light: 20, medium: 38, heavy: 65 },
    closingDays: '14–21 days',
    taxNote: '1.2%–1.8% est. annual property tax',
    assignmentNorm: '$10,000–$15,000 standard fee'
  },
  tarrant_tx: {
    id: 'tarrant_tx',
    label: 'Tarrant County / DFW, TX',
    rehabPerSqft: { light: 22, medium: 42, heavy: 72 },
    closingDays: '10–14 days (Texas Title Co.)',
    taxNote: '~2.15%–2.45% Tarrant Appraisal District (TAD) rate; check foundation/slab',
    assignmentNorm: '$12,000–$20,000 DFW assignment norm'
  },
  south_fl: {
    id: 'south_fl',
    label: 'South Florida (Miami-Dade / Broward / PBC)',
    rehabPerSqft: { light: 28, medium: 52, heavy: 88 },
    closingDays: '15–25 days (Municipal Lien & Hoa/Condo Estoppel check)',
    taxNote: '~1.8%–2.1% non-homestead reassessment; verify roof age & cast-iron pipes',
    assignmentNorm: '$15,000–$25,000 South FL assignment norm'
  }
};

export const SELLER_PLAYBOOK = {
  distressed: {
    id: 'distressed',
    label: 'Distressed / Behind on Payments',
    tone: 'Empathy first, zero judgment, calm and steady',
    leadTerms: 'Speed (close in 10–14 days), 100% certainty, strictly as-is, flexible move-out date',
    mainObjection: '“I need more to cover everything” / “I need time to think about it”',
    scriptAngle: '“I’m not here to pressure you; I’m trying to see if a clean cash option solves the immediate problem.”'
  },
  inherited: {
    id: 'inherited',
    label: 'Inherited / Probate',
    tone: 'Patient, respectful, simplify the burden',
    leadTerms: 'Zero repairs, zero cleanout (leave unwanted items behind), flexible probate timeline, title handles paperwork',
    mainObjection: 'Family disagreement / waiting on probate attorney',
    scriptAngle: '“You don’t have to fix anything or clean out a single box; we can work completely around the probate timeline.”'
  },
  tired_landlord: {
    id: 'tired_landlord',
    label: 'Tired Landlord',
    tone: 'Business-like, relief-focused, pragmatic',
    leadTerms: 'Buy with tenants in place, as-is, zero further repair calls, fast close before next rent cycle',
    mainObjection: '“I want top dollar / retail value”',
    scriptAngle: '“Compare net proceeds, eviction risk, and stress—not just the headline price.”'
  },
  out_of_state: {
    id: 'out_of_state',
    label: 'Out-of-State / Retiring Owner',
    tone: 'Convenience-driven, hyper-organized, frictionless',
    leadTerms: 'Mobile notary / remote closing, no travel required, we coordinate local access and cleanout',
    mainObjection: '“I want to fly in and see it first / get local bids”',
    scriptAngle: '“You don’t need to remodel or manage contractors; we handle the walkthrough, cleanout, and closing remotely.”'
  },
  preforeclosure: {
    id: 'preforeclosure',
    label: 'Pre-Foreclosure',
    tone: 'Respect the clock, urgent but supportive, transparent',
    leadTerms: 'Clear title & payoff coordination, protect remaining equity & credit, guaranteed funds before auction',
    mainObjection: '“I’m trying to reinstate / waiting on loan modification”',
    scriptAngle: '“Let’s look at the exact auction date and your equity so you know every concrete backup option before the clock runs out.”'
  },
  retail: {
    id: 'retail',
    label: 'Retail-Minded / Wants Top Dollar',
    tone: 'Consultative, validate their number, math-driven net comparison',
    leadTerms: 'Zero 6% agent commissions, zero buyer repair credits, no 90-day holding/inspection contingencies',
    mainObjection: '“Zillow says it’s worth more…”',
    scriptAngle: '“Your number may be right for a fully renovated retail listing; here’s the net comparison after repairs, 6% fees, and holding time.”'
  },
  auto: {
    id: 'auto',
    label: 'Auto-Detect from Conversation',
    tone: 'Dynamically matched to conversation signals',
    leadTerms: 'Cash, as-is, zero commissions, custom closing timeline',
    mainObjection: 'Detected from conversation transcript',
    scriptAngle: 'Auto-selected from Seller Playbook based on conversation pain points'
  }
};

export function detectSellerTypeFromConversation(conversation = '', extraNotes = '') {
  const combined = `${conversation} ${extraNotes}`.toLowerCase();
  if (/auction|foreclos|reinstate|behind on.*month|notice of default|nod|sheriff/i.test(combined)) {
    return 'preforeclosure';
  }
  if (/inherit|probate|mom passed|dad passed|estate|sibling|brother and i|sister and i/i.test(combined)) {
    return 'inherited';
  }
  if (/tenant|rent|lease|evict|landlord|property manager/i.test(combined)) {
    return 'tired_landlord';
  }
  if (/out of state|live in|fly in|remote|moved away|3 hours away|retir/i.test(combined)) {
    return 'out_of_state';
  }
  if (/zillow|redfin|top dollar|realtor|list it|don't have to sell/i.test(combined)) {
    return 'retail';
  }
  return 'distressed';
}

// A clean workspace: the app boots empty and the user adds the real deal.
// Demo deals stay available from the "Load Sample Deal" menu.
export const BLANK_DEAL = {
  id: 'blank-deal',
  title: 'Blank Property',
  address: '',
  sellerType: 'auto',
  marketMode: 'national',
  askingPrice: '',
  arv: '',
  repairs: '',
  maoPercent: '70',
  assignmentFee: '10000',
  cushionPercent: '9',
  testOffer: '',
  extraNotes: '',
  conversation: ''
};

export const PRESET_DEALS = [
  {
    id: 'preset-retirement-call',
    title: '⭐ Your Call: Retiring Seller ($280k → $250k)',
    badge: 'Kitchen Remodel • Good Roof/HVAC',
    address: '4812 Lovell Ave, Fort Worth, TX 76107',
    sellerType: 'auto',
    marketMode: 'tarrant_tx',
    askingPrice: '250000',
    arv: '330000',
    repairs: '28500',
    maoPercent: '70',
    assignmentFee: '10000',
    cushionPercent: '9',
    testOffer: '',
    extraNotes:
      'Seller is retiring and wants to close within 30 days. Kitchen needs full remodeling. HVAC is only 2.5 years old and Roof is 7.5 years old (both in good shape). Seller dropped ask from $280k to $250k.',
    conversation: `**Me:** "So basically, actually, I called the owner of this property and honestly, she was asking firstly at 280, but then told the lead manager she's going to take 250,000. She wants to close within the next, um, month, okay? The reason for selling is because she is retirement—she's retiring right now, okay? And yeah, so she wants to take 250,000, and the kitchen needs totally remodeling. The HVAC unit is 7.5 years old—and the HVAC, I'm sorry, is 2.5 years old and the roof is 7.5 years old."`
  },
  {
    id: 'preset-inherited',
    title: '1. Inherited / Probate',
    badge: 'Probate + Heavy Cleanout',
    address: '4812 Lovell Ave, Fort Worth, TX 76107',
    sellerType: 'inherited',
    marketMode: 'tarrant_tx',
    askingPrice: '195000',
    arv: '310000',
    repairs: '42000',
    maoPercent: '70',
    assignmentFee: '10000',
    cushionPercent: '9',
    testOffer: '',
    extraNotes:
      '3/2 brick ranch, 1,640 sqft, built 1958. Sold comp 4720 Lovell sold $312,000 (01/2026); 4901 Bryce sold $308,000. Needs roof, HVAC, full cosmetic update, and heavy estate cleanout.',
    conversation: `Me: Hi Sarah, calling about the Lovell Ave house. How are things going with the estate?
Seller: Honestly it's overwhelming. Mom passed away 4 months ago and the house is still packed with 40 years of stuff.
Me: I'm sorry for your loss. Have you and your brother decided on a timeline?
Seller: Probate court should sign off next month. My brother lives in Denver and just wants it done, but he thinks we should ask $195,000. Neither of us wants to clean it out or fix the old AC.`
  },
  {
    id: 'preset-below-mao',
    title: '2. Asking Below MAO',
    badge: 'Positive Spread Test',
    address: '1924 NW 31st Ave, Fort Lauderdale, FL 33311',
    sellerType: 'tired_landlord',
    marketMode: 'south_fl',
    askingPrice: '155000',
    arv: '320000',
    repairs: '45000',
    maoPercent: '70',
    assignmentFee: '12000',
    cushionPercent: '8',
    testOffer: '',
    extraNotes: 'CBS 3/2, 1,420 sqft, built 1971. Tenant is 2 months behind and lease is month-to-month.',
    conversation: `Me: Hey Mr. Alvarez, saw you might be open to selling the NW 31st Ave rental.
Seller: Yes. The tenant stopped paying two months ago, the water heater just went out, and my insurance doubled.
Me: If we take the tenant in place and close cash before the 1st, where do you need to be?
Seller: If you wire $155,000 net to me and I don't have to evict or fix a thing, it's yours.`
  },
  {
    id: 'preset-missing-arv',
    title: '3. Missing ARV / Repairs',
    badge: 'ESTIMATE ONLY Test',
    address: '719 Oak Hollow Dr, Arlington, TX 76012',
    sellerType: 'preforeclosure',
    marketMode: 'tarrant_tx',
    askingPrice: '215000',
    arv: '',
    repairs: '',
    maoPercent: '70',
    assignmentFee: '10000',
    cushionPercent: '9',
    testOffer: '',
    extraNotes: 'Seller mentioned auction scheduled next month. Need to pull TAD records and 3 comps.',
    conversation: `Me: Hi Marcus, reaching out about the Oak Hollow property.
Seller: Look, I'm 5 months behind and the bank set a sale date for the first Tuesday of next month.
Me: Do you know the rough payoff and what repairs the house needs?
Seller: Payoff with arrears is around $178,000. Kitchen is original and there's a small roof leak over the garage. I was hoping to walk with $215,000 total.`
  },
  {
    id: 'preset-retail',
    title: '4. Retail / Zillow-Anchored',
    badge: 'Net Comparison Test',
    address: '8420 Pasadena Blvd, Pembroke Pines, FL 33024',
    sellerType: 'retail',
    marketMode: 'south_fl',
    askingPrice: '410000',
    arv: '445000',
    repairs: '48000',
    maoPercent: '70',
    assignmentFee: '15000',
    cushionPercent: '8',
    testOffer: '260000',
    extraNotes: '4/2 pool home, 1,910 sqft, built 1979. Original shingle roof and original terrazzo/kitchen.',
    conversation: `Me: Hi Linda, thanks for chatting about Pasadena Blvd.
Seller: I don't have to sell. Zillow says my house is worth $435,000, so I'd want at least $410,000 cash.
Me: Totally fair to look at Zillow. Has the roof or kitchen been updated recently?
Seller: No, roof is 21 years old and kitchen is original 1980s, which is why I'd rather not deal with picky retail buyers and open houses.`
  }
];
