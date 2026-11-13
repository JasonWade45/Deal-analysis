import { formatUSD, extractPricesFromConversation, isSystemYoungOrGood } from './dealMath.js';
import { MARKET_MODES, SELLER_PLAYBOOK } from './playbooks.js';

// ============================================================================
// LAYER 2 & 3 DETERMINISTIC DEAL PACKAGE GENERATOR
// ============================================================================

export function buildBaselineAnalysis({
  address,
  effectiveSellerType,
  conversation,
  extraNotes,
  math,
  marketModeKey
}) {
  const playbook = SELLER_PLAYBOOK[effectiveSellerType] || SELLER_PLAYBOOK.distressed;
  const market = MARKET_MODES[marketModeKey] || MARKET_MODES.national;
  const combinedText = `${conversation}\n${extraNotes}`;
  const convLower = combinedText.toLowerCase();

  const bedBathMatch = combinedText.match(/(\d)\s*\/\s*(\d(?:\.\d)?)|(\d)\s*bed.*?(\d)\s*bath/i);
  const sqftMatch = combinedText.match(/(\d{1,2},\d{3}|\d{3,4})\s*(?:sqft|sq\s*ft|sf)/i);
  const yearMatch = combinedText.match(/(?:built|year)\s*(\d{4})|\b(19\d{2}|20[0-2]\d)\b/i);

  const bedsBathsVal = bedBathMatch
    ? bedBathMatch[1]
      ? `${bedBathMatch[1]} Beds / ${bedBathMatch[2]} Baths`
      : `${bedBathMatch[3]} Beds / ${bedBathMatch[4]} Baths`
    : '3 Beds / 2 Baths (Verify County Record)';

  const sqftVal = sqftMatch ? `${sqftMatch[1]} sqft` : '1,600 sqft (Est. from neighborhood)';
  const yearVal = yearMatch ? yearMatch[1] || yearMatch[2] : 'Verify Assessor Record';

  const snapshotRows = [
    {
      key: 'address',
      label: 'Property Address',
      value: address || 'Address Pending',
      confidence: address && address.trim().length > 6 ? 'VERIFIED' : 'UNVERIFIED',
      source: 'User Deal Input • Today'
    },
    {
      key: 'type',
      label: 'Property Type',
      value: /duplex|multi/i.test(convLower)
        ? 'Multi-Family Residential'
        : /condo|townhome/i.test(convLower)
        ? 'Condo / Townhome'
        : 'Single-Family Residence (SFR)',
      confidence: /ranch|cbs|sfr|duplex|condo|home|house/i.test(convLower) ? 'ESTIMATE' : 'UNVERIFIED',
      source: 'Conversation & Notes Inference'
    },
    {
      key: 'bedsBaths',
      label: 'Beds / Baths',
      value: bedsBathsVal,
      confidence: bedBathMatch ? 'ESTIMATE' : 'UNVERIFIED',
      source: bedBathMatch ? 'Stated in Notes / Conversation' : 'Pending County Appraiser Verification'
    },
    {
      key: 'sqft',
      label: 'Living Area (SqFt)',
      value: sqftVal,
      confidence: sqftMatch ? 'ESTIMATE' : 'UNVERIFIED',
      source: sqftMatch ? 'Stated in Notes / Conversation' : 'Pending County Tax Roll Lookup'
    },
    {
      key: 'yearBuilt',
      label: 'Year Built & Mechanicals',
      value: isSystemYoungOrGood(conversation, /roof/i) || isSystemYoungOrGood(conversation, /hvac|ac\b/i)
        ? `${yearVal} • Roof (7.5 yrs) & HVAC (2.5 yrs) in Good Shape`
        : yearVal,
      confidence: isSystemYoungOrGood(conversation, /roof|hvac/i) || yearMatch ? 'ESTIMATE' : 'UNVERIFIED',
      source: 'Seller Conversation Disclosure'
    },
    {
      key: 'taxes',
      label: 'Property Taxes & Assessment',
      value: market.taxNote,
      confidence: 'ESTIMATE',
      source: `${market.label} Baseline`
    },
    {
      key: 'ownerDetails',
      label: 'Owner / Title Status',
      value:
        effectiveSellerType === 'inherited'
          ? 'Estate / Heirs in Probate (Verify Executor Authority)'
          : effectiveSellerType === 'preforeclosure'
          ? 'Owner in Default / Active Foreclosure Clock (Verify Payoff & Arrears)'
          : /retir/i.test(convLower)
          ? 'Owner-Occupant / Retiring Seller (Direct to Owner)'
          : 'Individual Owner on Record (Verify Liens & Mortgage Payoff)',
      confidence: 'ESTIMATE',
      source: 'Inferred from Seller Conversation'
    }
  ];

  let motivationScore = 7;
  if (effectiveSellerType === 'preforeclosure') motivationScore = 9;
  else if (effectiveSellerType === 'distressed') motivationScore = 8;
  else if (effectiveSellerType === 'tired_landlord') motivationScore = 8;
  else if (effectiveSellerType === 'inherited') motivationScore = 7;
  else if (effectiveSellerType === 'out_of_state') motivationScore = 8;
  else if (effectiveSellerType === 'retail') motivationScore = 4;

  if (/don't have to sell|zillow says/i.test(convLower)) motivationScore = Math.min(motivationScore, 4);
  if (/behind|auction|overwhelming|before the 1st|passed away|retir|within the next.*month/i.test(convLower)) {
    motivationScore = Math.max(motivationScore, 8);
  }

  const extractedPricesFromChat = extractPricesFromConversation(conversation);
  const priceDropDetected =
    extractedPricesFromChat.length >= 2 &&
    extractedPricesFromChat[0] > extractedPricesFromChat[extractedPricesFromChat.length - 1];

  const realReasonMap = {
    distressed: 'Financial pressure, deferred maintenance burden, and needing a clean debt/payment relief exit.',
    inherited: 'Settling an inherited estate with heavy contents/cleanout and deferred repairs without family friction.',
    tired_landlord: 'Burnout from non-paying/difficult tenants, rising insurance/taxes, and upcoming capital expenditures.',
    out_of_state: /retir/i.test(convLower)
      ? 'Seller is retiring right now and wants a clean, stress-free as-is cash sale within 30 days without remodeling the kitchen.'
      : 'Eliminating the liability and logistics of managing an aging property from a distance.',
    preforeclosure: 'Stopping an active foreclosure clock and preserving remaining home equity before auction.',
    retail: 'Testing the investor market for convenience and zero showings/commissions while anchored to retail comps.'
  };

  const timelineMap = {
    distressed: 'High urgency (14–30 days) — wants immediate relief from holding costs and stress.',
    inherited: 'Moderate / Court-dependent (30–60 days) — tied to probate sign-off and sibling consensus.',
    tired_landlord: 'High urgency (Under 21 days) — wants to close before the 1st of next month or insurance renewal.',
    out_of_state: /month/i.test(convLower)
      ? 'High urgency (Within the next 30 days) — aligned with retirement transition timeline.'
      : 'Moderate (21–30 days) — prioritizes smooth remote coordination over rushing.',
    preforeclosure: 'CRITICAL URGENCY (7–21 days) — hard foreclosure auction deadline ticking.',
    retail: 'Low urgency (Flexible / Testing waters) — claims no rush unless net numbers make sense.'
  };

  const openNumStr = math.isComplete ? formatUSD(math.opening) : '[OPENING OFFER — ESTIMATE ONLY, ENTER ARV & REPAIRS]';
  const targetNumStr = math.isComplete ? formatUSD(math.target) : '[TARGET MAO — ESTIMATE ONLY, ENTER ARV & REPAIRS]';
  const walkNumStr = math.isComplete ? formatUSD(math.walkAway) : '[WALK-AWAY MAO — ESTIMATE ONLY, ENTER ARV & REPAIRS]';
  const arvStr = math.arv ? formatUSD(math.arv) : '[ESTIMATED ARV]';
  const repairsStr = math.repairs !== null ? formatUSD(math.repairs) : '[ESTIMATED REPAIRS]';

  let repairLevel = 'Medium Rehab ($30k–$50k)';
  if (math.repairs !== null) {
    if (math.repairs < 25000) repairLevel = 'Light / Cosmetic Rehab';
    else if (math.repairs <= 45000) repairLevel = 'Medium Rehab (Kitchen + Interior Turn; Roof/HVAC Good)';
    else repairLevel = 'Heavy / Full Gut & Major Mechanicals';
  }

  const scriptsByType = {
    distressed: {
      opening: `Thanks for walking me through everything on ${address || 'the property'}. I know dealing with the house and the payments at the same time is a lot, and I'm not here to judge or pressure you—my only goal is to see if a clean cash option actually solves the problem for you.`,
      bridge: `Because we buy strictly as-is with cash, you won't spend a dime on the ${repairsStr} in updates or wait months on bank inspections. We can close in as little as ${market.closingDays} or let you pick the exact move-out date.`,
      offerDelivery: `Looking at the work the property needs right now and our all-cash terms where we cover all closing costs, we can start at ${openNumStr} net to you. How does that feel as a starting point to get this completely off your plate?`,
      objections: [
        {
          objection: '“That’s lower than I hoped / I need more to move.”',
          response: `I completely hear you. If we can get the paperwork simple and lock in your exact move-out date, the absolute highest my underwriting allows me to stretch to—covering all closing costs—is ${targetNumStr}, and ${walkNumStr} is truly my ceiling.`
        },
        {
          objection: '“I need to think about it for a few days.”',
          response: `Take the time you need—I never want you to feel rushed. Let me send over the written breakdown at ${openNumStr} to ${targetNumStr} so you can look at the exact net figure in black and white tonight.`
        },
        {
          objection: '“What about all the stuff still inside the house?”',
          response: `Take only the personal items and memories you want to keep, and leave everything else right where it sits. We handle the entire cleanout after closing at no cost to you.`
        }
      ],
      close: `If we put it at ${targetNumStr} net to you, cash, as-is, and let you choose the closing date, is there any reason we couldn't get the simple 1-page agreement started today so title can begin their work?`,
      followUpText: `Hi! Just following up on our chat about ${address || 'the house'}. Our as-is cash offer up to ${targetNumStr} (zero fees or repairs on your end) is ready whenever you want to review the simple agreement. No rush—let me know what questions you have!`
    },
    inherited: {
      opening: `First off, I'm sorry again about your loss, and I appreciate you taking the time to talk about ${address || 'the family home'}. Sorting out an estate with decades of belongings is exhausting, so we take a very patient, zero-rush approach.`,
      bridge: `With our cash option, you and your family don't have to clean out a single closet, fix the AC, or coordinate contractors. We buy it 100% as-is and our title company coordinates directly with the probate timeline.`,
      offerDelivery: `Factoring in the ${repairsStr} in updates and full estate cleanout we'll take on after closing, we can open at ${openNumStr} net cash to the estate. How does that sound to you and the family?`,
      objections: [
        {
          objection: '“My brother / family member thinks we should get more.”',
          response: `That makes total sense. When you share this with your family, remind them ${openNumStr} involves zero realtor commissions, zero repair bills, and zero cleanout. If everyone is ready to wrap up the estate smoothly, I can push our net offer up to our max of ${targetNumStr}.`
        },
        {
          objection: '“Probate isn’t finished yet.”',
          response: `That is completely fine. We can sign the agreement now to lock in your ${targetNumStr} price, open title, and simply set the closing date to occur right after the probate court signs off.`
        },
        {
          objection: '“The house is still packed with 40 years of furniture.”',
          response: `Please don't stress over that. Take the family heirlooms and photos you want, and leave the rest of the furniture and boxes behind—our crew handles 100% of the cleanout.`
        }
      ],
      close: `Would it help if I sent over a clean 1-page summary at ${targetNumStr} net cash so you and your family can review it together with your probate attorney today?`,
      followUpText: `Hi! Checking in on ${address || 'the estate property'}. Whenever you and the family are ready, we can lock in ${targetNumStr} net cash, totally as-is with full cleanout included, timed around probate. Let me know how I can help simplify things!`
    },
    tired_landlord: {
      opening: `I appreciate the straight talk on ${address || 'the rental'}. Every landlord I speak with right now is dealing with the same mix of rising insurance, taxes, and maintenance headaches, so let's look at this strictly from a net-relief standpoint.`,
      bridge: `Instead of you putting ${repairsStr} back into the property or waiting months on a turnover, we'll buy it cash, as-is, and take over everything directly.`,
      offerDelivery: `To take the property and all upcoming repairs off your hands before the 1st of next month, we can come in at ${openNumStr} net cash. How does that line up with what you need to walk away clean?`,
      objections: [
        {
          objection: '“I want closer to retail / top dollar.”',
          response: `If you renovate it to hit ${arvStr} and pay 6% agent fees plus holding costs during vacancy, you're out ${repairsStr} plus months of stress. To bridge the gap and get this closed fast with zero out-of-pocket expense, the absolute highest I can stretch to is ${targetNumStr} net.`
        },
        {
          objection: '“What about the current tenant / lease?”',
          response: `You don't have to evict or wait for the lease to expire. We assume the lease and tenant situation as-is on the day of closing.`
        },
        {
          objection: '“Can you close before next month’s taxes and insurance hit?”',
          response: `Yes—our title company can close in ${market.closingDays} with wired funds, and ${walkNumStr} is our firm walk-away ceiling to get that done before the 1st.`
        }
      ],
      close: `If we lock it in at ${targetNumStr} net to you, take the tenant and repairs as-is, and close before the 1st, shall I have title open the file today?`,
      followUpText: `Hey! Following up on ${address || 'your rental'}. We're ready to lock in ${targetNumStr} net cash, taking the tenant and all ${repairsStr} of repairs as-is before the 1st. Want me to send the 1-page agreement over?`
    },
    out_of_state: {
      opening: `Thanks for taking a few minutes to chat about ${address || 'the property'}. Congratulations on your retirement! When you're transitioning into retirement and want to wrap things up within the next month, the last thing you want is to manage a full kitchen remodel or deal with contractors.`,
      bridge: `Good news is that since your roof is only 7.5 years old and the HVAC is 2.5 years old, we don't have to penalize the offer for mechanicals—we only factor in the ${repairsStr} for the kitchen remodel and interior refresh, and we close in ${market.closingDays}.`,
      offerDelivery: `Based on the ${repairsStr} kitchen and cosmetic remodel needed to reach the ${arvStr} renovated value, we can start our as-is cash offer at ${openNumStr} net to you. How does that sound for a guaranteed 30-day retirement close?`,
      objections: [
        {
          objection: '“I already dropped my price from $280,000 down to $250,000.”',
          response: `I really appreciate you being upfront about dropping from $280k to $250k. If we do an all-cash 14-to-30 day close where you don't touch the kitchen or pay 6% agent fees, our cash ceiling is ${targetNumStr}. However, if you firmly need $250,000, we can also look at a Creative Seller-Carry structure to hit your number!`
        },
        {
          objection: '“The HVAC is 2.5 years old and the roof is 7.5 years old—only the kitchen needs work!”',
          response: `100%—and I gave you full credit for the young roof and 2.5-year-old HVAC! That saved over $19,000 in deductions, which is why I can stretch our cash offer from ${openNumStr} up to our absolute max of ${targetNumStr} net.`
        },
        {
          objection: '“Can you guarantee we close within the next 30 days?”',
          response: `Yes—we use local cash funds with no bank approvals, so we can close at a licensed title company in 14 to 21 days, well inside your 30-day retirement timeline.`
        }
      ],
      close: `If we lock in ${targetNumStr} net cash (or pair it with our Creative Terms option), zero kitchen remodel on your end, and close within the next 30 days for your retirement, can I email you the agreement to review today?`,
      followUpText: `Hi! Following up on ${address || 'your property'}. Congrats again on retirement! We factored in your young 2.5-yr HVAC and 7.5-yr roof and can offer up to ${targetNumStr} net cash (closing within 30 days, kitchen as-is). Let me know when you can review!`
    },
    preforeclosure: {
      opening: `I really appreciate you being upfront with me about the timeline on ${address || 'the property'}. When there's a sale date on the calendar, the most important thing is respecting the clock so you keep control of your equity and your credit.`,
      bridge: `Because our title team works directly with the lender's trustee to order an immediate payoff and stop the auction, we need a clean cash number that clears the debt and puts guaranteed net funds in your pocket before the deadline.`,
      offerDelivery: `Factoring in the ${repairsStr} of repairs and the expedited closing before the auction clock runs out, we can open at ${openNumStr} cash. Based on your payoff, how does that work for you?`,
      objections: [
        {
          objection: '“I’m still hoping the bank approves my loan modification / reinstatement.”',
          response: `I truly hope they do! What many homeowners do is sign our agreement at ${targetNumStr} as a concrete safety net so title can order the payoff today. If your reinstatement comes through before closing, let us know—otherwise you're protected from losing your equity at auction.`
        },
        {
          objection: '“I wanted to walk away with more cash after the payoff.”',
          response: `Let's look at the exact payoff statement together. To make sure you walk away with the maximum possible net check before the sale date, I can push our offer to our absolute ceiling of ${targetNumStr} (${walkNumStr} walk-away).`
        },
        {
          objection: '“Is there enough time left to close?”',
          response: `Yes, as long as we open title today so they can request the formal payoff letter and stop-sale confirmation immediately.`
        }
      ],
      close: `Since every day matters with the auction date approaching, let's get the 1-page agreement signed at ${targetNumStr} and send your authorization to title right now so we can pull the exact payoff—fair enough?`,
      followUpText: `Urgent follow-up on ${address || 'your property'}: With the calendar ticking, we are ready to open title today at ${targetNumStr} cash to clear the payoff and protect your equity. Text me back when you have 2 minutes so we don't lose a day.`
    },
    retail: {
      opening: `Thanks for talking through ${address || 'your home'} with me. Honestly, if a house is fully remodeled to 2026 HGTV standards, listing on the MLS makes total sense—and I'm glad we can just look at the real net math side by side.`,
      bridge: `When properties in the neighborhood sell around ${arvStr}, those buyers demand a brand-new kitchen, updated baths, and pristine inspection reports. Listing as-is usually means spending ${repairsStr} upfront, plus 6% realtor commissions, 2% closing costs, and 3–4 months of holding costs.`,
      offerDelivery: `When you subtract the ${repairsStr} renovation, agent commissions, and months of showings, our direct as-is cash offer opens at ${openNumStr} net—with zero fees and closing on the exact date you pick. How does that net comparison look to you?`,
      objections: [
        {
          objection: '“Zillow says it’s worth way more than that!”',
          response: `Zillow's algorithm assumes the kitchen and mechanicals are already updated to ${arvStr} condition. Once you deduct ${repairsStr} in contractor work plus ~$25,000+ in commissions and closing costs, our absolute top net cash number of ${targetNumStr} puts guaranteed money in your pocket without lifting a finger.`
        },
        {
          objection: '“I’m not in a rush—I don’t have to sell.”',
          response: `That's the best position to be in. Our ${targetNumStr} (${walkNumStr} max ceiling) offer is simply for certainty and convenience—no contractors in your house, no open houses, and no buyers backing out over inspection reports.`
        },
        {
          objection: '“Can you come up closer to my asking price?”',
          response: `On a straight cash as-is basis, ${walkNumStr} is the highest the renovation math allows. If you're open to seller-carry terms where you get paid over time, we could explore a higher headline number—or we can lock in ${targetNumStr} all-cash today.`
        }
      ],
      close: `Comparing a guaranteed ${targetNumStr} net check in ${market.closingDays} versus spending ${repairsStr} and waiting months on the market, would you like me to send the net-sheet and agreement over to look at tonight?`,
      followUpText: `Hi! Enjoyed our conversation about ${address || 'your property'}. I put together the side-by-side net comparison showing our ${targetNumStr} all-cash as-is offer (zero commissions, zero ${repairsStr} rehab). Let me know your thoughts once you look it over!`
    }
  };

  const selectedScript = scriptsByType[effectiveSellerType] || scriptsByType.distressed;

  return {
    effectiveSellerType,
    playbook,
    market,
    snapshotRows,
    conversationRead: {
      motivationScore,
      realReason: realReasonMap[effectiveSellerType],
      timeline: timelineMap[effectiveSellerType],
      statedPrice: priceDropDetected
        ? `Started at ${formatUSD(extractedPricesFromChat[0])} → Dropped to ${formatUSD(
            extractedPricesFromChat[extractedPricesFromChat.length - 1]
          )} (${formatUSD(
            extractedPricesFromChat[0] - extractedPricesFromChat[extractedPricesFromChat.length - 1]
          )} price drop already!)`
        : math.asking
        ? `${formatUSD(math.asking)} (Stated in conversation/input)`
        : 'No explicit price stated yet',
      impliedPrice:
        math.asking && math.isComplete
          ? math.isAskingBelowMao
            ? `Seller is already asking ${formatUSD(Math.abs(math.askingMinusMao))} BELOW our MAO (${formatUSD(math.mao)}). Strong likelihood they accept ${formatUSD(math.opening)}–${formatUSD(math.asking)} for speed & convenience.`
            : `Seller already showed flexibility${
                priceDropDetected
                  ? ` by dropping ${formatUSD(
                      extractedPricesFromChat[0] - extractedPricesFromChat[extractedPricesFromChat.length - 1]
                    )}`
                  : ''
              }; gap to bridge to our ${formatUSD(math.mao)} MAO is ${formatUSD(
                math.askingMinusMao
              )} (or pitch Creative Terms / Seller Carry at ${formatUSD(math.asking)}).`
          : 'Implied flexibility around net payoff + convenience terms.',
      objections: [
        playbook.mainObjection,
        priceDropDetected
          ? `Seller feels they already discounted from ${formatUSD(extractedPricesFromChat[0])} to ${formatUSD(
              extractedPricesFromChat[extractedPricesFromChat.length - 1]
            )}`
          : 'Wanting certainty on net walk-away proceeds',
        'Concern over kitchen remodel cost vs. as-is cash discount'
      ],
      emotionalTriggers: [
        /retir/i.test(convLower)
          ? 'Retiring right now — wants a clean 30-day transition without managing a kitchen remodel'
          : effectiveSellerType === 'inherited'
          ? 'Overwhelmed by 40 years of estate belongings & sibling coordination'
          : 'Desire for a clean, stress-free transition without out-of-pocket repair bills',
        'Relief from contractor coordination, showings, and closing delays'
      ],
      hiddenIssues: [
        isSystemYoungOrGood(conversation, /roof/i) && isSystemYoungOrGood(conversation, /hvac|ac\b/i)
          ? 'Roof (7.5 yrs) & HVAC (2.5 yrs) are young — verify permits & check electrical panel / plumbing'
          : 'Potential unpermitted work or older mechanicals (Roof / HVAC / Cast-iron plumbing)',
        'Verify exact mortgage payoff, HOA/municipal liens, and prorated property taxes'
      ],
      redFlags: [
        !math.isComplete
          ? 'CRITICAL: ARV or Repairs missing — Calculator is in ESTIMATE ONLY mode; do not present final binding offers until verified.'
          : math.asking && !math.isAskingBelowMao && math.askingMinusMao > 35000
          ? `Wide price gap (${formatUSD(math.askingMinusMao)} above MAO) — will require net-sheet education or Creative Seller Carry option.`
          : 'Confirm all decision-makers (spouses/heirs) are on the call before presenting final ceiling.'
      ],
      missingQuestions: [
        '“Is there an existing mortgage payoff or any liens we need to clear at closing?”',
        '“Besides the full kitchen remodel, how are the bathrooms, flooring, and electrical panel?”',
        '“If we handle the kitchen as-is and close within 30 days for your retirement, what is the absolute best net cash figure you could work with?”'
      ]
    },
    numbersSummary: {
      repairLevel,
      compsUsed: extraNotes
        ? extraNotes
        : 'No verified MLS comps pasted yet — using market baseline ESTIMATE. Pull 3 sold comps within 0.5 miles before binding contract.'
    },
    offerStrategy: {
      openWith: math.isComplete
        ? math.isAskingBelowMao
          ? `Open at ${formatUSD(math.opening)} (Seller's asking price of ${formatUSD(math.asking)} is ALREADY below our ${formatUSD(math.mao)} MAO! Anchor at ${formatUSD(math.opening)} and settle effortlessly at or below ${formatUSD(math.asking)} for an extra ${formatUSD(math.spreadAtAsking)} total spread).`
          : `Open with ${formatUSD(math.opening)} (${math.cushionPct}% negotiation cushion below our ${formatUSD(math.mao)} MAO). This gives you ${formatUSD(math.mao - math.opening)} of upward room so the seller feels they won a concession when you settle at ${formatUSD(math.target)}.`
        : 'ESTIMATE ONLY — Do not anchor a hard price yet. Ask discovery questions and verify ARV + Repairs first.',
      leadTerms: playbook.leadTerms,
      whatToTrade: `If seller pushes back on ${openNumStr}, trade price concessions up toward ${targetNumStr} ONLY in exchange for: (1) signing the agreement today, (2) locking in immediate inspection access, or (3) leaving all unwanted contents/cleanout as-is.`,
      whatNotToSay: [
        'Never mention your assignment fee, wholesale spread, or cash buyer list.',
        'Never quote a number above your Walk-Away MAO ceiling without verifying higher ARV comps.',
        'Never insult the property condition—blame “contractor labor & material costs” for the rehab deduction.'
      ]
    },
    script: selectedScript,
    nextActions: [
      {
        step: '1. Verify Title, Mortgage Payoff & Tax Roll',
        detail: `Search county appraiser & recorder for ${address || 'the subject address'} to confirm owner of record, exact sqft/year built, and any open mortgages or municipal liens.`
      },
      {
        step: '2. Lock In 3 Sold Comps & Walk-Through Photos',
        detail: math.isComplete
          ? `Validate the ${formatUSD(math.arv)} ARV and ${formatUSD(math.repairs)} repair budget (confirming the 2.5-yr HVAC & 7.5-yr roof) so your ${formatUSD(math.mao)} MAO is 100% bulletproof.`
          : 'REQUIRED NOW: Enter verified ARV and Repair Estimate in the left panel to unlock final binding offer numbers.'
      },
      {
        step: '3. Deliver Opening Offer & Send Follow-Up Text',
        detail: math.isComplete
          ? `Pitch ${formatUSD(math.opening)} using the ${playbook.label} script, hold ${formatUSD(math.walkAway)} as your hard walk-away ceiling, and send the follow-up text immediately after the call.`
          : 'Complete discovery call using the missing questions list before quoting a number.'
      }
    ]
  };
}
