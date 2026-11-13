import { extractPricesFromConversation } from './dealMath.js';

// ============================================================================
// DEAL CONTEXT EXTRACTION
// Builds the *facts* the co-pilot is allowed to use, per deal, from the
// address + seller conversation + calculator numbers. Nothing is invented:
// if a fact is missing, it stays null and the reply engine asks instead.
// ============================================================================

const CONDITION_PATTERNS = [
  { key: 'roof', label: 'roof', regex: /roof|shingle|سقف/i, cost: 11500 },
  { key: 'hvac', label: 'HVAC / AC', regex: /hvac|a\/c|\bac\b|furnace|air condition|تكييف/i, cost: 7500 },
  { key: 'kitchen', label: 'kitchen', regex: /kitchen|cabinet|counter|مطبخ/i, cost: 14000 },
  { key: 'bath', label: 'bathrooms', regex: /bath|tub|shower|حمام/i, cost: 8500 },
  { key: 'flooring', label: 'flooring', regex: /floor|carpet|lvp|vinyl|أرضيات/i, cost: 6500 },
  { key: 'foundation', label: 'foundation', regex: /foundation|slab|pier|crack|أساسات/i, cost: 12500 },
  { key: 'plumbing', label: 'plumbing', regex: /plumb|pipe|sewer|water heater|cast iron|سباكة/i, cost: 8500 },
  { key: 'electrical', label: 'electrical', regex: /electric|panel|wiring|كهرباء/i, cost: 4800 },
  { key: 'pool', label: 'pool', regex: /pool|حمام سباحة/i, cost: 6500 },
  { key: 'windows', label: 'windows', regex: /window|door|شبابيك/i, cost: 6000 },
  { key: 'cleanout', label: 'cleanout', regex: /hoard|packed|furniture|junk|trash|clean ?out|عفش|أثاث/i, cost: 3500 }
];

function parseNumber(val) {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Decimals like "2.5 years" must not be treated as sentence breaks.
function splitSentences(text) {
  const guarded = String(text || '').replace(/(\d)\.(\d)/g, '$1\u0001$2');
  return guarded
    .split(/[.;!?\n]+/)
    .map((part) => part.replace(/\u0001/g, '.').trim())
    .filter(Boolean);
}

function findFirstSentence(text, regex) {
  const sentences = splitSentences(text);
  for (const s of sentences) {
    if (regex.test(s)) return s.trim();
  }
  return '';
}

function splitClauses(sentence) {
  return String(sentence || '')
    .split(/\band\b|\bwhile\b|,|;|\//i)
    .map((c) => c.trim())
    .filter(Boolean);
}

// Ages are matched per clause so "HVAC is 2.5 years old and the roof is 7.5"
// yields 2.5 for HVAC and 7.5 for the roof instead of the first number for both.
function parseAgeYears(text, keywordRegex) {
  const lower = String(text || '').toLowerCase();
  for (const sentence of splitSentences(lower)) {
    for (const clause of splitClauses(sentence)) {
      if (!keywordRegex.test(clause)) continue;
      const ageMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yo)\s*(?:old)?/i);
      if (ageMatch) {
        const years = parseFloat(ageMatch[1]);
        if (Number.isFinite(years) && years >= 0 && years <= 80) return years;
      }
    }
  }
  return null;
}

function isYoungOrGood(text, keywordRegex) {
  const lower = String(text || '').toLowerCase();
  for (const sentence of splitSentences(lower)) {
    for (const clause of splitClauses(sentence)) {
      if (!keywordRegex.test(clause)) continue;
      if (/\b(?:new|good|great|fine|updated|replaced|recent|solid|works)\b/i.test(clause)) return true;
      if (/\b(?:old|leak|broken|bad|replace|end of life)\b/i.test(clause)) return false;
      const age = parseAgeYears(clause, keywordRegex);
      if (age !== null) return age <= 12;
    }
  }
  return null;
}

export function buildDealContext({
  address = '',
  conversation = '',
  extraNotes = '',
  math = {},
  playbook = {},
  market = {},
  sellerType = 'distressed'
} = {}) {
  const text = `${conversation}\n${extraNotes}`;
  const lower = text.toLowerCase();

  const prices = extractPricesFromConversation(conversation);
  const firstPrice = prices.length > 0 ? prices[0] : null;
  const lastPrice = prices.length > 0 ? prices[prices.length - 1] : null;
  const priceDrop = firstPrice && lastPrice && firstPrice > lastPrice ? firstPrice - lastPrice : 0;

  const roofAge = parseAgeYears(text, /roof|shingle|سقف/i);
  const hvacAge = parseAgeYears(text, /hvac|a\/c|\bac\b|furnace|air condition|تكييف/i);
  const roofGood = isYoungOrGood(text, /roof|shingle|سقف/i);
  const hvacGood = isYoungOrGood(text, /hvac|a\/c|\bac\b|furnace|air condition|تكييف/i);

  const bedBathMatch = text.match(/(\d)\s*\/\s*(\d(?:\.\d)?)|(\d)\s*(?:bed|br).*?(\d)\s*(?:bath|ba)/i);
  const beds = bedBathMatch ? Number(bedBathMatch[1] || bedBathMatch[3]) : null;
  const baths = bedBathMatch ? Number(bedBathMatch[2] || bedBathMatch[4]) : null;

  const sqftMatch = text.match(/(\d{1,2},\d{3}|\d{3,4})\s*(?:sq\s*ft|sqft|sf|square\s*feet|قدم)/i);
  const sqft = sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : null;

  const yearMatch = text.match(/(?:built(?:\s+in)?|year)\s*(\d{4})|\b(19\d{2}|20[0-2]\d)\b/i);
  const yearBuilt = yearMatch ? Number(yearMatch[1] || yearMatch[2]) : null;

  const payoffMatch = text.match(/(?:owe|owes|owing|payoff|pay off|balance|mortgage|قرض|مديونية)[^$\d]{0,30}\$?([\d,]{4,})/i);
  const payoff = payoffMatch ? parseNumber(payoffMatch[1]) : null;

  const conditionItems = CONDITION_PATTERNS.filter((p) => p.regex.test(text)).map((p) => ({
    key: p.key,
    label: p.label,
    sentence: findFirstSentence(text, p.regex)
  }));

  const isRented = /tenant|rented|rent|lease|evict|مستأجر|إيجار/i.test(text);
  const isVacant = /vacant|empty|sitting empty|فاضية|فاضي/i.test(text);
  const isOwnerOccupied = /\bi live\b|owner.occup|ساكن فيها|أنا ساكن/i.test(text);
  const occupancy = isRented ? 'tenant' : isVacant ? 'vacant' : isOwnerOccupied ? 'owner' : 'unknown';

  const decisionMakerRoles = [];
  if (/brother|أخويا|أخي|أخوي|أخوها/i.test(text)) decisionMakerRoles.push({ en: 'your brother', ar: 'أخوك' });
  if (/sister|أختي|أختها/i.test(text)) decisionMakerRoles.push({ en: 'your sister', ar: 'أختك' });
  if (/wife|husband|spouse/i.test(text)) decisionMakerRoles.push({ en: 'your spouse', ar: 'شريك حياتك' });
  if (/attorney|lawyer|محامي/i.test(text)) decisionMakerRoles.push({ en: 'your attorney', ar: 'محاميك' });
  if (/executor|probate court/i.test(text)) decisionMakerRoles.push({ en: 'the executor', ar: 'المنفّذ على التركة' });
  if (decisionMakerRoles.length === 0 && /family|أهل|عائلة/i.test(text)) {
    decisionMakerRoles.push({ en: 'your family', ar: 'أهلك' });
  }
  const joinRoles = (roles, key, andWord) => {
    if (roles.length === 0) return '';
    if (roles.length === 1) return roles[0][key];
    const head = roles.slice(0, -1).map((r) => r[key]).join(key === 'ar' ? '، ' : ', ');
    const last = roles[roles.length - 1][key];
    return key === 'ar' ? `${head} ${andWord}${last}` : `${head} ${andWord} ${last}`;
  };
  const decisionMakers = joinRoles(decisionMakerRoles, 'en', 'and');
  const decisionMakersAr = joinRoles(decisionMakerRoles, 'ar', 'و');
  const decisionMakerRolesList = decisionMakerRoles.map((r) => r.en);

  const timelineSentence = findFirstSentence(
    text,
    /month|week|day|asap|soon|auction|sale date|before the 1st|retir|شهر|أسبوع|قريب|مزاد/i
  );

  const retirement = /retir|retirement|تقاعد/i.test(text);
  const auction = /auction|foreclos|sheriff|sale date|notice of default|مزاد|حجز/i.test(text);
  const probate = /probate|passed away|inherit|estate|deceased|ورث|وفاة/i.test(text);
  const zillow = /zillow|redfin|realtor|listing|top dollar|market value/i.test(text);
  const noRush = /don'?t have to sell|no rush|not in a rush|مش مستعجل|مش مضطر/i.test(text);
  const cleanout = /hoard|packed|furniture|junk|trash|stuff|عفش|أثاث/i.test(text);

  const closingDays = market?.closingDays || '14–21 days';
  const asking = math?.asking ?? lastPrice ?? null;

  return {
    address,
    shortAddress: String(address || '').split(',')[0].trim(),
    sellerType,
    playbookLabel: playbook?.label || 'Seller',
    playbookTone: playbook?.tone || '',
    marketLabel: market?.label || 'National Standard',
    closingDays,

    arv: math?.arv ?? null,
    repairs: math?.repairs ?? null,
    asking,
    opening: math?.opening ?? null,
    target: math?.target ?? null,
    walkAway: math?.walkAway ?? null,
    fee: math?.fee ?? null,
    maoPct: math?.maoPct ?? null,
    isComplete: Boolean(math?.isComplete),

    priceMentions: prices,
    firstPrice,
    lastPrice,
    priceDrop,

    roofAge,
    hvacAge,
    roofGood,
    hvacGood,
    conditionItems,

    beds,
    baths,
    sqft,
    yearBuilt,

    timelineSentence,
    retirement,
    auction,
    probate,
    zillow,
    noRush,
    cleanout,
    occupancy,
    payoff,
    decisionMakers,
    decisionMakersAr,
    decisionMakerRoles: decisionMakerRolesList,

    conversationExcerpt: String(conversation || '').slice(0, 700)
  };
}

export function describeMissingFacts(ctx = {}) {
  const missing = [];
  if (!ctx.arv) missing.push('ARV');
  if (ctx.repairs === null || ctx.repairs === undefined) missing.push('repairs');
  if (!ctx.asking) missing.push('asking price');
  if (!ctx.payoff) missing.push('mortgage payoff');
  if (!ctx.timelineSentence) missing.push('timeline');
  return missing;
}
