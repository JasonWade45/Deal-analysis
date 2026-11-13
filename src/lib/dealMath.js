// ============================================================================
// UTILITY FUNCTIONS & LAYER 1 DETERMINISTIC CALCULATOR
// ============================================================================

export function parseCurrencyNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function hasInvalidNumberChars(val) {
  if (!val || String(val).trim() === '') return false;
  return /[a-zA-Z]/.test(String(val));
}

export function formatUSD(val, fallback = '—') {
  if (val === null || val === undefined || !Number.isFinite(val)) return fallback;
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  return `${isNegative ? '-' : ''}$${absVal.toLocaleString('en-US')}`;
}

/**
 * Layer 1: Deterministic Calculator (Pure Code — No LLM Math Drift)
 */
export function calculateDealMath({
  arvInput,
  repairsInput,
  askingInput,
  maoPercentInput = 70,
  assignmentFeeInput = 10000,
  cushionPercentInput = 9,
  testOfferInput = ''
}) {
  const arv = parseCurrencyNumber(arvInput);
  const repairs =
    repairsInput === '0' || repairsInput === 0 ? 0 : parseCurrencyNumber(repairsInput);
  const asking = parseCurrencyNumber(askingInput);
  const maoPct = Number(maoPercentInput) > 0 ? Number(maoPercentInput) : 70;
  const fee =
    assignmentFeeInput === '0' || assignmentFeeInput === 0
      ? 0
      : parseCurrencyNumber(assignmentFeeInput) ?? 10000;
  const cushionPct = Number(cushionPercentInput) >= 0 ? Number(cushionPercentInput) : 9;
  const testOffer = parseCurrencyNumber(testOfferInput);

  const isComplete = arv !== null && repairs !== null;

  if (!isComplete) {
    return {
      arv,
      repairs,
      asking,
      maoPct,
      fee,
      cushionPct,
      testOffer,
      isComplete: false,
      isEstimateOnly: true,
      mao: null,
      opening: null,
      target: null,
      walkAway: null,
      spreadAtOpening: null,
      spreadAtTarget: null,
      spreadAtWalkAway: null,
      spreadAtAsking: null,
      spreadAtTestOffer: null,
      askingMinusMao: null,
      isAskingBelowMao: false,
      testOfferExceedsMao: false
    };
  }

  const maxBuyerPrice = arv * (maoPct / 100) - repairs;
  const mao = Math.round(maxBuyerPrice - fee);
  const opening = Math.round(mao * (1 - cushionPct / 100));
  const target = mao;
  const walkAway = mao;

  const spreadAtOpening = Math.round(maxBuyerPrice - opening);
  const spreadAtTarget = Math.round(maxBuyerPrice - target);
  const spreadAtWalkAway = Math.round(maxBuyerPrice - walkAway);
  const spreadAtAsking = asking !== null ? Math.round(maxBuyerPrice - asking) : null;
  const spreadAtTestOffer = testOffer !== null ? Math.round(maxBuyerPrice - testOffer) : null;

  const askingMinusMao = asking !== null ? Math.round(asking - mao) : null;
  const isAskingBelowMao = asking !== null && asking <= mao;
  const testOfferExceedsMao = testOffer !== null && testOffer > mao;

  return {
    arv,
    repairs,
    asking,
    maoPct,
    fee,
    cushionPct,
    testOffer,
    isComplete: true,
    isEstimateOnly: false,
    mao,
    opening,
    target,
    walkAway,
    spreadAtOpening,
    spreadAtTarget,
    spreadAtWalkAway,
    spreadAtAsking,
    spreadAtTestOffer,
    askingMinusMao,
    isAskingBelowMao,
    testOfferExceedsMao
  };
}

// ============================================================================
// HELPER: NORMALIZE SPOKEN/TYPED PRICE MENTIONS (e.g. "280", "250,000", "250k")
// ============================================================================
export function extractPricesFromConversation(conversation = '') {
  const text = String(conversation || '');
  const prices = [];

  const contextualRegex =
    /(?:asking|ask|take|wants?\s+to\s+take|wants?|need|offer|around|at|under|down\s+to|for)\s*(?:firstly\s+at\s*|around\s*|about\s*)?\$?(\d{2,3}(?:,\d{3})|\d{2,3}\s*k\b|\b[1-9]\d{2}\b)/gi;

  let match;
  while ((match = contextualRegex.exec(text)) !== null) {
    const raw = match[1].toLowerCase().replace(/,/g, '').trim();
    let val = null;
    if (raw.endsWith('k')) {
      val = parseFloat(raw) * 1000;
    } else {
      const num = Number(raw);
      if (num >= 100 && num <= 999) {
        val = num * 1000;
      } else if (num >= 35000 && num <= 5000000) {
        val = num;
      }
    }
    if (val && val >= 35000 && val <= 5000000) {
      prices.push(Math.round(val));
    }
  }

  return prices;
}

export function isSystemYoungOrGood(text = '', keywordRegex) {
  const lower = String(text || '').toLowerCase();
  const sentences = lower.split(/[.;!?\n]+/);
  for (const s of sentences) {
    if (keywordRegex.test(s)) {
      if (/\b(?:new|good|great|fine|updated|replaced|recent|only)\b/i.test(s)) return true;
      const ageMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yo)\s*old/i);
      if (ageMatch) {
        const years = parseFloat(ageMatch[1]);
        if (years <= 12 && !/leak|bad|replace|broken|old/i.test(s)) {
          return true;
        }
      }
    }
  }
  return false;
}

// ============================================================================
// FEATURE #1: SMART AUTO-ARV & AUTO-REHAB ENGINE (FROM ADDRESS + CONVERSATION)
// ============================================================================
export function autoCalculateArvAndRehabFromInputs({
  address = '',
  conversation = '',
  extraNotes = '',
  marketModeKey = 'national',
  askingInput = ''
}) {
  const isDefaultPreset1Notes =
    extraNotes &&
    extraNotes.includes('4720 Lovell sold $312,000') &&
    !conversation.includes('Mom passed away 4 months ago');
  const effectiveNotes = isDefaultPreset1Notes ? '' : extraNotes;

  const combined = `${address} ${conversation} ${effectiveNotes}`;
  const convAndRelevantNotes = `${conversation} ${effectiveNotes}`;
  const lower = convAndRelevantNotes.toLowerCase();

  const sqftMatch = combined.match(/(\d{1,2},\d{3}|\d{3,4})\s*(?:sq\s*ft|sqft|sf|square\s*feet|قدم)/i);
  const inferredSqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : 1600;

  const extractedConvPrices = extractPricesFromConversation(conversation);
  const latestConvAsking =
    extractedConvPrices.length > 0 ? extractedConvPrices[extractedConvPrices.length - 1] : null;
  const initialAnchorPrice =
    extractedConvPrices.length > 1 ? extractedConvPrices[0] : latestConvAsking;

  const askNum = latestConvAsking || parseCurrencyNumber(askingInput);

  const compDollarMatches = [
    ...convAndRelevantNotes.matchAll(/(?:sold|worth|zillow|comp|valued|arv)[^$\d]{0,25}\$?(\d{3},?\d{3})/gi)
  ];
  const debtMatch = convAndRelevantNotes.match(/(?:owe|balance|payoff|mortgage)[^$\d]{0,25}\$?(\d{2,3},?\d{3})/i);
  const debtNum = debtMatch ? parseCurrencyNumber(debtMatch[1]) : null;

  let pricePerSqft = 195;
  if (/miami|fort lauderdale|hollywood|boca|palm beach|fl\b|florida/i.test(address) || marketModeKey === 'south_fl') {
    pricePerSqft = 245;
  } else if (/fort worth|dallas|arlington|tx\b|texas|tarrant/i.test(address) || marketModeKey === 'tarrant_tx') {
    pricePerSqft = 195;
  } else if (/ca\b|california|los angeles|san diego|ny\b|seattle|denver|austin/i.test(address)) {
    pricePerSqft = 340;
  } else if (/oh\b|ohio|detroit|indiana|memphis|st louis|pa\b|cleveland/i.test(address)) {
    pricePerSqft = 135;
  }

  let estimatedArv = Math.round((inferredSqft * pricePerSqft) / 1000) * 1000;

  if (compDollarMatches.length > 0) {
    const vals = compDollarMatches
      .map((m) => parseCurrencyNumber(m[1]))
      .filter((n) => n && n >= 60000 && n <= 3000000);
    if (vals.length > 0) {
      estimatedArv = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 1000) * 1000;
    }
  } else if (initialAnchorPrice && initialAnchorPrice >= 100000) {
    estimatedArv = Math.round((Math.max(initialAnchorPrice, askNum || 0) * 1.18) / 1000) * 1000;
  } else if (askNum && askNum > 50000) {
    if (/zillow|top dollar|don't have to sell|retail/i.test(lower)) {
      estimatedArv = Math.round((askNum * 1.08) / 1000) * 1000;
    } else {
      estimatedArv = Math.round((askNum * 1.32) / 1000) * 1000;
    }
  } else if (debtNum && debtNum > 30000) {
    estimatedArv = Math.round((debtNum * 1.85) / 1000) * 1000;
  }

  const detectedItems = [];
  let rehabTotal = Math.round(inferredSqft * 9);
  detectedItems.push({ item: `Interior Paint, Flooring & Turn (${inferredSqft} sqft)`, cost: rehabTotal });

  const roofIsGood = isSystemYoungOrGood(conversation, /roof|shingle/i);
  const hvacIsGood = isSystemYoungOrGood(conversation, /hvac|ac\b|a\/c|air condition|unit/i);

  if (roofIsGood) {
    detectedItems.push({ item: 'Roof Inspected (Young / Good Condition — $0 Replace)', cost: 0 });
  } else if (/roof|leak|shingle|tarp|سقف/i.test(lower)) {
    const c = marketModeKey === 'south_fl' ? 16000 : 11500;
    rehabTotal += c;
    detectedItems.push({ item: 'Roof Replacement / Leak Remediation', cost: c });
  }

  if (hvacIsGood) {
    detectedItems.push({ item: 'HVAC / AC Unit (Young / Good Condition — $0 Replace)', cost: 0 });
  } else if (/ac\b|a\/c|hvac|furnace|air condition|تكييف/i.test(lower)) {
    const c = 7500;
    rehabTotal += c;
    detectedItems.push({ item: 'HVAC / AC Condenser & Air Handler', cost: c });
  }

  if (/kitchen|cabinet|counter|remodel|dated|original|مطبخ/i.test(lower)) {
    const c = 14000;
    rehabTotal += c;
    detectedItems.push({ item: 'Full Kitchen Remodel & Countertops/Appliances', cost: c });
  }
  if (/foundation|crack|settling|slab|pier|أساسات/i.test(lower)) {
    const c = 12500;
    rehabTotal += c;
    detectedItems.push({ item: 'Foundation / Structural Pier Adjustment', cost: c });
  }
  if (/cast iron|plumb|pipe|sewer|water heater|سباكة/i.test(lower)) {
    const c = 8500;
    rehabTotal += c;
    detectedItems.push({ item: 'Plumbing / Cast-Iron Drain Line Scope', cost: c });
  }
  if (/pack|stuff|hoard|cleanout|trash|estate|furniture|40 years|30 years/i.test(lower)) {
    const c = 3500;
    rehabTotal += c;
    detectedItems.push({ item: 'Full Estate Dumpster Cleanout & Hauling', cost: c });
  }
  if (/pool|حمام سباحة/i.test(lower)) {
    const c = 6500;
    rehabTotal += c;
    detectedItems.push({ item: 'Pool Resurfacing & Equipment', cost: c });
  }

  if (detectedItems.filter((d) => d.cost > 0).length === 1) {
    const stdContingency = Math.round(inferredSqft * 8);
    rehabTotal += stdContingency;
    detectedItems.push({ item: 'Standard Kitchen/Bath Refresh & Mechanical Contingency', cost: stdContingency });
  }

  rehabTotal = Math.round(rehabTotal / 500) * 500;

  return {
    estimatedArv,
    estimatedRepairs: rehabTotal,
    inferredAsking: latestConvAsking || askNum,
    initialAnchorPrice,
    inferredSqft,
    pricePerSqft,
    detectedItems,
    cleanedPresetNotes: isDefaultPreset1Notes
  };
}
