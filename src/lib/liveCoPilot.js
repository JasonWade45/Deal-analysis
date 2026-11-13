import { formatUSD } from './dealMath.js';

// ============================================================================
// LIVE CALL WHISPERER HELPERS
// - Script similarity / progress tracking
// - Smart pause vs. seller interruption (barge-in) detection
// - Seller tone detection + agent voiceprint matching
// - Instant (<15ms) stage-aware local reply engine
// ============================================================================

export function normalizeWords(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function calculateScriptSimilarity(spokenStr = '', scriptStr = '') {
  const spokenWords = normalizeWords(spokenStr);
  const scriptWords = normalizeWords(scriptStr);
  if (spokenWords.length === 0 || scriptWords.length === 0) return 0;

  const spokenSet = new Set(spokenWords);
  const scriptSet = new Set(scriptWords);

  let overlap = 0;
  for (const w of spokenSet) {
    if (scriptSet.has(w)) overlap++;
  }

  const unionSize = new Set([...spokenSet, ...scriptSet]).size;
  const jaccard = unionSize > 0 ? overlap / unionSize : 0;
  const containment = spokenSet.size > 0 ? overlap / spokenSet.size : 0;

  return Math.max(jaccard, containment * 0.9);
}

export function analyzeScriptProgressAndBargeIn(spokenStr = '', activeScriptStr = '') {
  const rawTokens = String(spokenStr || '').trim().split(/\s+/).filter(Boolean);
  const spokenWords = normalizeWords(spokenStr);
  const scriptWords = normalizeWords(activeScriptStr);

  if (spokenWords.length === 0 || scriptWords.length === 0) {
    return {
      isPrefixOfScript: false,
      progressRatio: 0,
      hasBargeInTail: false,
      bargeInText: '',
      agentPrefixText: ''
    };
  }

  const scriptSet = new Set(scriptWords);
  const bargeInCueRegex =
    /\b(?:hold on|wait a|wait|stop|listen|look|no way|nah|actually|let me stop you|hang on|استنى|ثانية|لحظة|لا لا|بص حضرتك|اسمعني)\b/i;

  let matchedScriptPrefixCount = 0;
  let highestScriptIdxReached = -1;

  for (let i = 0; i < spokenWords.length; i++) {
    const w = spokenWords[i];
    const idxInScript = scriptWords.indexOf(w);
    if (idxInScript !== -1) {
      matchedScriptPrefixCount++;
      if (idxInScript > highestScriptIdxReached) {
        highestScriptIdxReached = idxInScript;
      }
    } else {
      const nextW = spokenWords[i + 1];
      const nextNextW = spokenWords[i + 2];
      const nextMatches =
        (nextW && scriptSet.has(nextW)) || (nextNextW && scriptSet.has(nextNextW));
      if (!nextMatches && matchedScriptPrefixCount >= 2) {
        break;
      }
    }
  }

  const tailStartIdx = Math.max(0, matchedScriptPrefixCount);
  const tailWords = spokenWords.slice(tailStartIdx);
  const tailMatchingCount = tailWords.filter((w) => scriptSet.has(w)).length;
  const tailMatchRatio = tailWords.length > 0 ? tailMatchingCount / tailWords.length : 1;

  const progressRatio =
    scriptWords.length > 0
      ? Math.min(
          1,
          Math.max(
            matchedScriptPrefixCount / scriptWords.length,
            (highestScriptIdxReached + 1) / scriptWords.length
          )
        )
      : 0;

  const hasBargeInTail =
    (matchedScriptPrefixCount >= 2 && tailWords.length >= 3 && tailMatchRatio < 0.34) ||
    (matchedScriptPrefixCount >= 1 && bargeInCueRegex.test(rawTokens.slice(tailStartIdx).join(' ')));

  const isPrefixOfScript =
    !hasBargeInTail &&
    matchedScriptPrefixCount >= 2 &&
    matchedScriptPrefixCount / spokenWords.length >= 0.65;

  return {
    isPrefixOfScript,
    progressRatio,
    hasBargeInTail,
    bargeInText: hasBargeInTail ? rawTokens.slice(tailStartIdx).join(' ') : '',
    agentPrefixText: hasBargeInTail ? rawTokens.slice(0, tailStartIdx).join(' ') : spokenStr
  };
}

export function detectSpeakerTone({ text = '', pitchHz = 0, pitchVariance = 0, energy = 0 }) {
  const lower = String(text || '').toLowerCase();

  if (
    /insult|ridiculous|no way|too low|waste|stop|don't call|angry|مستحيل|قليل جدا|إيه الكلام ده/i.test(lower) ||
    (energy > 62 && pitchVariance > 28)
  ) {
    return {
      id: 'defensive',
      label: '😠 حاسم / معترض (Firm / Pushing Back)',
      color: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
      coaching: 'هدّئ النبرة فوراً، صدّق على كلامه، ولا تدافع عن الرقم بشكل صدامي.'
    };
  }

  if (
    /maybe|not sure|think about|i don't know|um|uh|let me see|wallahi|مش عارف|محتاج أفكر|ممكن/i.test(lower) ||
    (pitchVariance < 12 && energy > 0 && energy < 28)
  ) {
    return {
      id: 'hesitant',
      label: '🤔 متردد / يفكر (Hesitant / Uncertain)',
      color: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
      coaching: 'البايع متردد؛ استخدم نبرة مطمئنة واطرح سؤالاً بسيطاً بدون ضغط.'
    };
  }

  if (
    /fast|hurry|quick|month|asap|right now|retir|auction|بسرعة|مستعجل|خلال شهر/i.test(lower) ||
    pitchHz > 205
  ) {
    return {
      id: 'urgent',
      label: '⏰ مستعجل / عملي (Urgent / Time-Focused)',
      color: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
      coaching: 'ركّز فوراً على سرعة الإغلاق المضمونة (14-21 يوم) وعدم الحاجة لأي صيانة.'
    };
  }

  if (/great|good|thanks|appreciate|fair|okay|sure|تمام|ممتاز|شكراً|أهلاً/i.test(lower)) {
    return {
      id: 'warm',
      label: '😊 ودود / متعاون (Warm / Open)',
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
      coaching: 'البايع منفتح؛ حافظ على نبرتك الودودة وانتقل لتثبيت الخطوة القادمة.'
    };
  }

  return {
    id: 'neutral',
    label: '🎯 هادئ / استشاري (Calm / Consultative)',
      color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/40',
    coaching: 'نبرة متزنة؛ التزم بأسلوبك الهادئ المباشر.'
  };
}

export function compareWithAgentVoiceProfile(liveMetrics, savedProfile) {
  if (!savedProfile || !savedProfile.avgPitchHz || !liveMetrics || !liveMetrics.pitchHz) {
    return { isKnownAgentVoice: false, matchConfidence: 0 };
  }

  const pitchDiff = Math.abs(liveMetrics.pitchHz - savedProfile.avgPitchHz);
  const centroidDiff = Math.abs((liveMetrics.centroidHz || 1200) - (savedProfile.avgCentroidHz || 1200));

  const pitchScore = Math.max(0, 1 - pitchDiff / 55);
  const timbreScore = Math.max(0, 1 - centroidDiff / 900);

  const combinedMatch = pitchScore * 0.65 + timbreScore * 0.35;
  return {
    isKnownAgentVoice: combinedMatch >= 0.72,
    matchConfidence: Math.round(combinedMatch * 100)
  };
}

export function isClearlyAgentSelfIntroOrPitch(text = '') {
  const lower = String(text).toLowerCase().trim();
  if (
    /^(?:hey|hi|hello)?\s*(?:there\s*)?(?:this is|my name is)\s+\w+.*(?:calling about|reaching out|from|buying)/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /\b(?:our title company|we buy strictly as-is|our cash offer|we cover all closing costs|my underwriting allows)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

export function generateInstantStageAwareReply({
  sellerSpeech = '',
  math,
  address,
  wasBargeIn = false,
  sellerToneId = 'neutral'
}) {
  const lower = sellerSpeech.toLowerCase().trim();
  const openStr = math.isComplete ? formatUSD(math.opening) : 'our initial cash estimate';
  const targetStr = math.isComplete ? formatUSD(math.target) : 'our target cash number';
  const repStr = math.repairs !== null ? formatUSD(math.repairs) : 'the kitchen and cosmetic work';
  const shortAddr = address ? address.split(',')[0] : 'the property';

  const bargeInPrefix = wasBargeIn
    ? 'Oh, go right ahead—sorry to talk over you! I hear you 100%. '
    : sellerToneId === 'defensive'
    ? 'I hear you loud and clear, and I’m definitely not here to waste your time. '
    : sellerToneId === 'hesitant'
    ? 'No rush at all—let’s keep it super simple. '
    : '';

  if (
    !wasBargeIn &&
    /^(?:hey|hi|hello|good|doing well|fine|speaking|yes|yeah|who is this|how you doing|how are you)/i.test(lower) &&
    lower.split(/\s+/).length <= 12 &&
    !/\$|\d{3}|low|offer|price|kitchen|roof|month/i.test(lower)
  ) {
    return `Doing great, thanks for asking! I'm following up on ${shortAddr}—I know you mentioned wanting to wrap things up within the next month for your retirement without having to remodel the kitchen. Do you have two quick minutes to go over the net cash numbers I put together for you?`;
  }

  if (wasBargeIn && /^(?:wait|hold on|stop|hang on|listen|look|استنى|ثانية|لحظة)/i.test(lower) && lower.split(/\s+/).length <= 6) {
    return `Oh, my apologies—please go ahead! What was on your mind regarding ${shortAddr}?`;
  }

  if (/low|more|insult|can't do|250|280|higher|not enough|أقل|قليل|أكتر|سعر أعلى/i.test(lower)) {
    return `${bargeInPrefix}I appreciate that you already came down from $280k to $250k. Because your roof is 7.5 years old and the HVAC is 2.5 years old, I gave you full credit for mechanicals and can stretch our net cash offer from ${openStr} up to ${targetStr} net, closing in 21 days with zero commissions. Or if you firmly need $250,000, we can structure a simple Seller-Carry option at your price!`;
  }

  if (/zillow|redfin|realtor|agent|list|worth|market|زيلو|سمسار/i.test(lower)) {
    return `${bargeInPrefix}Zillow's estimate assumes a brand-new remodeled kitchen. Once you deduct ${repStr} for the kitchen remodel plus 6% realtor commissions and 3 months of showings, ${targetStr} net cash puts guaranteed funds in your pocket right on your retirement schedule.`;
  }

  if (/think|talk to|brother|sister|wife|husband|spouse|tomorrow|next week|أفكر|أستشير/i.test(lower)) {
    return `${bargeInPrefix}Take all the time you need—zero pressure at all. Let me text or email you our 1-page breakdown showing ${openStr} to ${targetStr} net cash right now so you can review the exact numbers in black and white tonight. What's the best email for you?`;
  }

  if (/fast|when|close|timeline|days|month|retir|امتى|وقت|شهر/i.test(lower)) {
    return `${bargeInPrefix}Since we use our own cash with no bank appraisals, our local title company can close in 14 to 21 days—well inside your 30-day retirement timeline—and wire ${targetStr} net directly to your account.`;
  }

  if (/clean|stuff|furniture|repair|fix|kitchen|roof|hvac|ac\b|عفش|تصليح|مطبخ/i.test(lower)) {
    return `${bargeInPrefix}You won't have to touch the kitchen or hire a single contractor. Because your HVAC is only 2.5 years old and the roof is 7.5 years old, we didn't deduct a dime for those—we're buying the kitchen 100% as-is at ${targetStr} net to you.`;
  }

  if (/what.*offer|how much|number|pay|give me|price|كام|عرضك/i.test(lower)) {
    return `${bargeInPrefix}Taking the kitchen 100% as-is, covering all title and closing costs, and closing within your 30-day retirement window, we can open at ${openStr} net cash—and if we can lock in the timeline today, I can push it up to ${targetStr} net.`;
  }

  return `${bargeInPrefix}Got it—that helps me a lot. Since we cover 100% of closing costs, give you full credit for the young roof and HVAC, and take the kitchen as-is, how does ${openStr} to ${targetStr} net cash sound for a guaranteed 30-day close?`;
}

// 8 one-tap instant seller objection moments for the Live Call Whisperer.
export const QUICK_LIVE_PROMPTS = [
  {
    label: '⚡ قاطعني: "Wait, $192k is too low!"',
    shortLabel: '⚡ Barge-In: "Too low!"',
    text: 'Wait hold on, $192,500 is way too low, I already dropped from 280 to 250,000!',
    bargeIn: true
  },
  {
    label: '👋 "Hello, who is this?"',
    shortLabel: '👋 "Who is this?"',
    text: 'Hey, this is the homeowner, how are you doing?',
    bargeIn: false
  },
  {
    label: '🛠️ "Roof & AC are young!"',
    shortLabel: '🛠️ "Roof & AC young"',
    text: 'The HVAC is only 2.5 years old and the roof is 7.5 years old, only the kitchen needs remodeling.',
    bargeIn: false
  },
  {
    label: '⏱️ "Closing in 30 days?"',
    shortLabel: '⏱️ "Close in 30 days"',
    text: 'I am retiring right now and need to close within the next month.',
    bargeIn: false
  },
  {
    label: '🏠 "Zillow says more"',
    shortLabel: '🏠 "Zillow says more"',
    text: 'Zillow says my house is worth way more than that.',
    bargeIn: false
  },
  {
    label: '🤔 "Need to think about it"',
    shortLabel: '🤔 "Need to think"',
    text: 'Um, I am not sure, I need to think about it and talk to my family first.',
    bargeIn: false
  },
  {
    label: '💵 "I need $250k firm"',
    shortLabel: '💵 "Need $250k firm"',
    text: 'I need a firm 250,000 cash, I am not taking a penny less than my asking price.',
    bargeIn: true
  },
  {
    label: '🏦 "I still owe a big payoff"',
    shortLabel: '🏦 "Big payoff"',
    text: 'My payoff with the bank is still around 178,000, so I need enough to clear that and walk away with something.',
    bargeIn: false
  }
];
