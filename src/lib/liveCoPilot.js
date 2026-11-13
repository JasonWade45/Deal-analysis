// ============================================================================
// LIVE CALL WHISPERER HELPERS
// - Script similarity / progress tracking
// - Smart pause vs. seller interruption (barge-in) detection
// - Seller tone detection + agent voiceprint matching
// NOTE: contextual reply generation lives in callReplyEngine.js
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
