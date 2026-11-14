import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mic,
  Play,
  Square,
  User,
  Bot,
  CheckCircle2,
  VolumeX,
  Zap,
  RotateCcw,
  ShieldAlert,
  Brain,
  PhoneCall
} from 'lucide-react';
import { formatUSD } from '../lib/dealMath.js';
import {
  analyzeScriptProgressAndBargeIn,
  calculateScriptSimilarity,
  compareWithAgentVoiceProfile,
  detectSpeakerTone,
  isClearlyAgentSelfIntroOrPitch
} from '../lib/liveCoPilot.js';
import {
  isRecorderSupported,
  isWebSpeechSupported,
  transcribeAudioBlob
} from '../lib/audioTranscriber.js';
import { VOICE_PROFILE_KEY } from '../lib/storage.js';
import {
  INTENT_LABELS,
  buildGeminiPrompt,
  buildQuickPrompts,
  detectSellerIntent,
  generateCallOpener,
  generateContextualReply,
  guardModelOutput
} from '../lib/callReplyEngine.js';

// ============================================================================
// LIVE CALL WHISPERER CO-PILOT — v3 (per-deal context, per-call sessions)
//
// What changed:
// - Every call starts a fresh session: clean transcript, clean intent history,
//   fresh opener, turn counter reset. Nothing carries over between calls.
// - Each deal is isolated: the component is keyed per deal in App, and all
//   replies are generated from this deal's own facts (address, asking, ARV,
//   repairs, MAO, payoff, condition, timeline) — never a hard-coded script.
// - Replies are intent-aware and bilingual (EN / Egyptian Arabic) and avoid
//   inventing numbers. Optional Gemini output is number-guarded.
// - Seller speech is no longer mistaken for the agent's script: a detected
//   seller intent wins unless the match to the agent script is very strong.
// ============================================================================

const INTERIM_COMMIT_MS = 1200;
const RECORDER_MAX_MS = 15000;

const CUE_REGEX = /\b(?:wait|hold on|stop|listen|look|no way|nah|actually|hang on|excuse me|sorry)\b|استنى|ثانية|لحظة|لا لا|بص|اسمعني/i;
const NEUTRAL_TONE = {
  id: 'neutral',
  label: '🎯 هادئ / استشاري (Calm / Consultative)',
  color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/40',
  coaching: 'نبرة متزنة؛ التزم بأسلوبك الهادئ المباشر.'
};

function timeStamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveWhispererCoPilot({
  apiKey,
  selectedModel,
  address,
  playbook,
  scriptPackage,
  math,
  isLight,
  dealContext,
  onAppendToConversation
}) {
  const [listenMode, setListenMode] = useState('handsfree');
  const [speechLang, setSpeechLang] = useState('en-US');
  const [isListening, setIsListening] = useState(false);
  const [muteMyVoice, setMuteMyVoice] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [lastIgnoredUserText, setLastIgnoredUserText] = useState('');
  const [lastSellerText, setLastSellerText] = useState('');
  const [lastIntent, setLastIntent] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(
    () => generateCallOpener(dealContext || {}, 'en') || scriptPackage?.opening || ''
  );
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiSourceBadge, setAiSourceBadge] = useState('جاهز');
  const [aiError, setAiError] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.62);
  const [silenceDelayMs, setSilenceDelayMs] = useState(900);
  const [callLog, setCallLog] = useState([]);
  const [manualSellerInput, setManualSellerInput] = useState('');
  const [micError, setMicError] = useState('');
  const [micEngine, setMicEngine] = useState(() =>
    isWebSpeechSupported() ? 'webspeech' : isRecorderSupported() ? 'recorder' : 'none'
  );
  const [heardText, setHeardText] = useState('');
  const [ignoredSpeech, setIgnoredSpeech] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveCustomOffer, setLiveCustomOffer] = useState(null);
  const [callNumber, setCallNumber] = useState(0);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [callEndedAt, setCallEndedAt] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [appendToDeal, setAppendToDeal] = useState(false);
  const [useAi, setUseAi] = useState(false);

  const [turnStatusBadge, setTurnStatusBadge] = useState({
    type: 'ready',
    label: '🎧 جاهز — اضغط «مكالمة جديدة» ليبدأ سياق نظيف لهذه الصفقة',
    scriptProgressPct: 0
  });

  const [agentVoiceProfile, setAgentVoiceProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(VOICE_PROFILE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      avgPitchHz: 132,
      avgCentroidHz: 1150,
      avgEnergy: 38,
      toneStyle: 'Calm, Consultative & Empathetic',
      calibrated: false,
      sampleCount: 0
    };
  });

  const [isCalibratingVoice, setIsCalibratingVoice] = useState(false);
  const [liveAcoustic, setLiveAcoustic] = useState({
    pitchHz: 0,
    centroidHz: 0,
    energy: 0,
    pitchVariance: 0,
    voiceMatchPct: 0,
    detectedSpeaker: 'idle'
  });
  const [detectedSellerTone, setDetectedSellerTone] = useState(NEUTRAL_TONE);

  const recognitionRef = useRef(null);
  const expectedUserScriptRef = useRef(scriptPackage?.opening || '');
  const silenceTimerRef = useRef(null);
  const pendingUtteranceRef = useRef(null);
  const unspokenBufferRef = useRef('');
  const isListeningRef = useRef(false);
  const muteMyVoiceRef = useRef(false);
  const lastAgentSpeechAtRef = useRef(0);
  const lastUtteranceRef = useRef({ text: '', at: 0 });
  const listenModeRef = useRef('handsfree');
  const speechLangRef = useRef('en-US');
  const restartTimerRef = useRef(null);
  const restartAttemptsRef = useRef(0);
  const commitBufferRef = useRef('');
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const recorderTimerRef = useRef(null);
  const isRecordingRef = useRef(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioRafRef = useRef(null);
  const recentPitchSamplesRef = useRef([]);
  const liveAcousticRef = useRef(liveAcoustic);
  const agentVoiceProfileRef = useRef(agentVoiceProfile);

  const lang = speechLang === 'ar-EG' ? 'ar' : 'en';
  const ctx = useMemo(() => dealContext || {}, [dealContext]);
  const quickPrompts = useMemo(() => buildQuickPrompts(ctx), [ctx]);
  const contextFacts = useMemo(
    () => [
      { label: 'العنوان', value: ctx.shortAddress || '—' },
      { label: 'نوع البايع', value: ctx.playbookLabel || '—' },
      { label: 'Asking', value: ctx.asking ? formatUSD(ctx.asking) : 'غير معروف' },
      { label: 'ARV', value: ctx.arv ? formatUSD(ctx.arv) : 'غير معروف' },
      { label: 'Repairs', value: ctx.repairs !== null && ctx.repairs !== undefined ? formatUSD(ctx.repairs) : 'غير معروف' },
      { label: 'MAO', value: ctx.target ? formatUSD(ctx.target) : 'ESTIMATE ONLY' },
      { label: 'Opening', value: ctx.opening ? formatUSD(ctx.opening) : '—' },
      { label: 'Payoff', value: ctx.payoff ? formatUSD(ctx.payoff) : 'غير معروف' },
      { label: 'الإغلاق', value: ctx.closingDays || '—' }
    ],
    [ctx]
  );

  const sessionStats = useMemo(() => {
    const sellerTurns = callLog.filter((t) => t.role === 'seller');
    const intents = sellerTurns.map((t) => t.intent).filter(Boolean);
    const unique = [...new Set(intents)];
    return { sellerTurns: sellerTurns.length, uniqueIntents: unique };
  }, [callLog]);

  useEffect(() => {
    muteMyVoiceRef.current = muteMyVoice;
  }, [muteMyVoice]);

  useEffect(() => {
    listenModeRef.current = listenMode;
  }, [listenMode]);

  useEffect(() => {
    speechLangRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    if (isWebSpeechSupported()) setMicEngine('webspeech');
    else if (isRecorderSupported()) setMicEngine('recorder');
    else setMicEngine('none');
  }, []);

  useEffect(() => {
    agentVoiceProfileRef.current = agentVoiceProfile;
    try {
      localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(agentVoiceProfile));
    } catch {
      // ignore
    }
  }, [agentVoiceProfile]);

  useEffect(() => {
    if (!apiKey) setUseAi(false);
  }, [apiKey]);

  useEffect(() => {
    if (!callStartedAt) return undefined;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [callStartedAt]);

  // Fresh suggestion whenever the deal context changes and no call is running.
  useEffect(() => {
    if (callStartedAt || lastSellerText) return;
    const opener = scriptPackage?.opening || generateCallOpener(ctx, lang);
    expectedUserScriptRef.current = opener;
    setAiSuggestion(opener);
  }, [scriptPackage, ctx, lang, callStartedAt, lastSellerText]);

  const allKnownUserScripts = useMemo(() => {
    return [
      expectedUserScriptRef.current,
      aiSuggestion,
      scriptPackage?.opening,
      scriptPackage?.bridge,
      scriptPackage?.offerDelivery,
      scriptPackage?.close,
      ...(scriptPackage?.objections || []).map((o) => o.response)
    ].filter(Boolean);
  }, [aiSuggestion, scriptPackage]);

  // -------------------------------------------------------------------------
  // Acoustic analyzer + voiceprint (unchanged behavior, per-session)
  // -------------------------------------------------------------------------
  const startAcousticAnalyzer = async () => {
    if (audioContextRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Float32Array(analyser.fftSize);

      const sampleLoop = () => {
        if (!analyserRef.current || !audioContextRef.current) return;
        analyserRef.current.getByteFrequencyData(freqData);
        analyserRef.current.getFloatTimeDomainData(timeData);

        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) sumSq += timeData[i] * timeData[i];
        const rms = Math.sqrt(sumSq / timeData.length);
        const energyVal = Math.min(100, Math.round(rms * 320));

        if (energyVal >= 8) {
          const sampleRate = audioContextRef.current.sampleRate || 44100;
          const binHz = sampleRate / analyserRef.current.fftSize;

          const minBin = Math.max(1, Math.floor(85 / binHz));
          const maxBin = Math.min(freqData.length - 1, Math.ceil(330 / binHz));
          let peakBin = minBin;
          let peakAmp = 0;
          for (let b = minBin; b <= maxBin; b++) {
            if (freqData[b] > peakAmp) {
              peakAmp = freqData[b];
              peakBin = b;
            }
          }
          const pitchHz = Math.round(peakBin * binHz);

          let weightedSum = 0;
          let totalAmp = 0;
          const maxCentroidBin = Math.min(freqData.length - 1, Math.ceil(4000 / binHz));
          for (let b = minBin; b <= maxCentroidBin; b++) {
            weightedSum += b * binHz * freqData[b];
            totalAmp += freqData[b];
          }
          const centroidHz = totalAmp > 0 ? Math.round(weightedSum / totalAmp) : 1200;

          recentPitchSamplesRef.current = [...recentPitchSamplesRef.current.slice(-14), pitchHz];
          const samples = recentPitchSamplesRef.current;
          const avgP = samples.reduce((a, b) => a + b, 0) / samples.length;
          const variance = Math.round(
            Math.sqrt(samples.reduce((acc, v) => acc + Math.pow(v - avgP, 2), 0) / samples.length)
          );

          const matchResult = compareWithAgentVoiceProfile(
            { pitchHz, centroidHz, energy: energyVal },
            agentVoiceProfileRef.current
          );

          const nextAcoustic = {
            pitchHz,
            centroidHz,
            energy: energyVal,
            pitchVariance: variance,
            voiceMatchPct: matchResult.matchConfidence,
            detectedSpeaker: matchResult.isKnownAgentVoice ? 'agent' : 'seller'
          };
          liveAcousticRef.current = nextAcoustic;
          setLiveAcoustic(nextAcoustic);
        } else {
          setLiveAcoustic((prev) => ({ ...prev, energy: energyVal, detectedSpeaker: 'idle' }));
        }

        audioRafRef.current = requestAnimationFrame(sampleLoop);
      };

      audioRafRef.current = requestAnimationFrame(sampleLoop);
    } catch {
      // Microphone stream busy or blocked
    }
  };

  const stopAcousticAnalyzer = () => {
    if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const calibrateMyVoiceProfile = async () => {
    setIsCalibratingVoice(true);
    await startAcousticAnalyzer();

    const pitches = [];
    const centroids = [];
    const energies = [];

    const collectInterval = setInterval(() => {
      const cur = liveAcousticRef.current;
      if (cur && cur.energy >= 8 && cur.pitchHz >= 80) {
        pitches.push(cur.pitchHz);
        centroids.push(cur.centroidHz || 1150);
        energies.push(cur.energy);
      }
    }, 120);

    setTimeout(() => {
      clearInterval(collectInterval);
      setIsCalibratingVoice(false);

      const avgPitch = pitches.length ? Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length) : 135;
      const avgCentroid = centroids.length
        ? Math.round(centroids.reduce((a, b) => a + b, 0) / centroids.length)
        : 1120;
      const avgEnergy = energies.length ? Math.round(energies.reduce((a, b) => a + b, 0) / energies.length) : 42;

      const style =
        avgEnergy > 55
          ? 'Energetic, Direct & Confident'
          : avgPitch < 140
          ? 'Calm, Steady & Consultative'
          : 'Warm, Empathetic & Conversational';

      setAgentVoiceProfile({
        avgPitchHz: avgPitch,
        avgCentroidHz: avgCentroid,
        avgEnergy,
        toneStyle: style,
        calibrated: true,
        sampleCount: (agentVoiceProfileRef.current?.sampleCount || 0) + pitches.length
      });

      if (!isListeningRef.current) stopAcousticAnalyzer();
    }, 3600);
  };

  const autoUpdateAgentVoiceprint = () => {
    const cur = liveAcousticRef.current;
    if (!cur || cur.pitchHz < 80) return;
    setAgentVoiceProfile((prev) => {
      const weight = prev.calibrated ? 0.85 : 0.6;
      return {
        ...prev,
        avgPitchHz: Math.round(prev.avgPitchHz * weight + cur.pitchHz * (1 - weight)),
        avgCentroidHz: Math.round((prev.avgCentroidHz || 1150) * weight + (cur.centroidHz || 1150) * (1 - weight)),
        avgEnergy: Math.round((prev.avgEnergy || 40) * weight + cur.energy * (1 - weight)),
        calibrated: true,
        sampleCount: (prev.sampleCount || 0) + 1
      };
    });
  };

  // -------------------------------------------------------------------------
  // Contextual reply
  // -------------------------------------------------------------------------
  const pushTurn = (entry) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCallLog((prev) => [...prev, { ...entry, id, time: timeStamp() }]);
    return id;
  };

  const replyToSeller = async (rawText, options = {}) => {
    const text = String(rawText || '').trim();
    if (text.length < 2) return;

    // speechLangRef is updated the moment the language button is pressed; the
    // `lang` captured in this closure can still be the previous render's value.
    const replyLang = speechLangRef.current === 'ar-EG' ? 'ar' : 'en';

    const now = Date.now();
    const norm = (v) =>
      String(v).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const prevUtterance = lastUtteranceRef.current;
    if (now - prevUtterance.at < 5000) {
      const current = norm(text);
      const previous = norm(prevUtterance.text);
      if (current && previous && (current === previous || current.startsWith(previous) || previous.startsWith(current))) {
        return;
      }
    }
    lastUtteranceRef.current = { text, at: now };
    setHeardText(text);
    setIgnoredSpeech(null);
    setMicError('');

    const intentInfo = detectSellerIntent(text);
    const sellerTone = detectSpeakerTone({
      text,
      pitchHz: liveAcousticRef.current.pitchHz,
      pitchVariance: liveAcousticRef.current.pitchVariance,
      energy: liveAcousticRef.current.energy
    });
    const wasBargeIn = Boolean(options.wasBargeIn);

    setDetectedSellerTone(sellerTone);
    setLastIntent(intentInfo.id);
    setLastSellerText(text);
    setLiveText('');
    unspokenBufferRef.current = '';
    setTurnStatusBadge({
      type: wasBargeIn ? 'seller_barge_in' : 'seller_speaking',
      label: `${wasBargeIn ? '⚡ قاطعك البايع!' : '🗣️ البايع قال:'} ${INTENT_LABELS[intentInfo.id]?.ar || ''} — الرد جاهز`,
      scriptProgressPct: 0
    });

    const local = generateContextualReply({
      intent: intentInfo.id,
      sellerSpeech: text,
      ctx,
      wasBargeIn,
      sellerToneId: sellerTone.id,
      lang: replyLang,
      turn: callLog.filter((t) => t.role === 'seller').length
    });

    setAiSuggestion(local.text);
    expectedUserScriptRef.current = local.text;
    setAiSourceBadge(wasBargeIn ? '⚡ رد سياقي (مقاطعة)' : '⚡ رد سياقي فوري');
    setAiError('');

    pushTurn({
      role: 'seller',
      text,
      tone: sellerTone.label,
      intent: intentInfo.id,
      wasBargeIn,
      source: 'mic'
    });
    const copilotId = pushTurn({ role: 'copilot', text: local.text, source: 'local' });

    if (appendToDeal && onAppendToConversation) {
      onAppendToConversation(
        `Seller (${wasBargeIn ? 'interrupted' : 'live'} • ${intentInfo.id}): ${text}\nMe (co-pilot): ${local.text}`
      );
    }

    if (!useAi || !apiKey) return;

    setIsAiThinking(true);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel || 'gemini-3-flash-preview'}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: buildGeminiPrompt({
                      sellerSpeech: text,
                      ctx,
                      lang: replyLang,
                      wasBargeIn,
                      toneLabel: sellerTone.label,
                      turn: callLog.length + 1,
                      history: callLog
                    })
                  }
                ]
              }
            ],
            generationConfig: { temperature: 0.35 }
          })
        }
      );

      if (!res.ok) throw new Error(`Gemini ${res.status}`);

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const guarded = guardModelOutput(raw, ctx);

      if (guarded) {
        setAiSuggestion(guarded);
        expectedUserScriptRef.current = guarded;
        setAiSourceBadge('✨ Gemini + سياق الصفقة');
        setCallLog((prev) =>
          prev.map((turn) => (turn.id === copilotId ? { ...turn, text: guarded, source: 'gemini' } : turn))
        );
        if (appendToDeal && onAppendToConversation) {
          onAppendToConversation(`Me (co-pilot, AI): ${guarded}`);
        }
      } else {
        setAiError('تم تجاهل رد الـ AI لأنه يحتوي رقماً غير موجود في حاسبة الصفقة — تم استخدام الرد السياقي المحلي.');
      }
    } catch {
      setAiError('تعذر الاتصال بموديل الـ AI — تم استخدام الرد السياقي المحلي.');
    } finally {
      setIsAiThinking(false);
    }
  };

  const processCapturedSpeech = (spokenText) => {
    const trimmed = String(spokenText || '').trim();
    if (trimmed.length < 2) return;
    setHeardText(trimmed);

    if (muteMyVoiceRef.current) {
      autoUpdateAgentVoiceprint();
      setLastIgnoredUserText(`🔇 (Muted) "${trimmed.slice(0, 70)}"`);
      setIgnoredSpeech({ text: trimmed, reason: 'زر «Mute» شغال — بيتم تجاهل كل الكلام.' });
      setLiveText('');
      unspokenBufferRef.current = '';
      return;
    }

    if (listenMode === 'handsfree') {
      const progress = analyzeScriptProgressAndBargeIn(trimmed, expectedUserScriptRef.current);
      const intentInfo = detectSellerIntent(trimmed);

      let maxSim = 0;
      for (const candidate of allKnownUserScripts) {
        const sim = calculateScriptSimilarity(trimmed, candidate);
        if (sim > maxSim) maxSim = sim;
      }

      const voiceMatch = compareWithAgentVoiceProfile(liveAcousticRef.current, agentVoiceProfileRef.current);

      // Only a near-exact match counts as the agent's own voice. The old 0.30
      // prefix rule and the 0.70 similarity rule were swallowing real seller
      // sentences, which read as "the mic does not understand me".
      const looksLikeAgent =
        (progress.isPrefixOfScript && progress.progressRatio >= 0.55) ||
        maxSim >= Math.max(0.78, similarityThreshold) ||
        (isClearlyAgentSelfIntroOrPitch(trimmed) && maxSim >= 0.5);

      // A clear seller intent (price, timeline, repairs, family, payoff...) wins
      // unless the utterance is a near-exact match to the agent's own script.
      const strongSellerIntent = intentInfo.matched && intentInfo.id !== 'greeting' && intentInfo.id !== 'question';
      const isAgentSpeaking = looksLikeAgent && !(strongSellerIntent && maxSim < 0.92);

      if (isAgentSpeaking) {
        lastAgentSpeechAtRef.current = Date.now();
        autoUpdateAgentVoiceprint();
        const pct = Math.round(Math.max(progress.progressRatio, maxSim) * 100);
        setTurnStatusBadge({
          type: 'agent_reading',
          label: `✅ صوتك أنت (${pct}% تطابق السكريبت) — مستمع لرد البايع الآن`,
          scriptProgressPct: pct
        });
        setLastIgnoredUserText(
          `"${trimmed.slice(0, 60)}..." (${pct}% تطابق • بصمة الصوت ${voiceMatch.matchConfidence || 0}%)`
        );
        setIgnoredSpeech({
          text: trimmed,
          reason: `حسبتها إنت بتقرأ السكريبت (${pct}% تطابق). لو دي جملة البايع، اضغط «رد على الجملة دي».`
        });
        setLiveText('');
        unspokenBufferRef.current = '';
        return;
      }
    }

    const bargeIn =
      CUE_REGEX.test(trimmed) && Date.now() - lastAgentSpeechAtRef.current < 9000;

    replyToSeller(trimmed, { wasBargeIn: bargeIn });
  };

  // -------------------------------------------------------------------------
  // Speech engine — final results drive replies; interim only drives display
  // -------------------------------------------------------------------------
  const stopSpeechEngine = () => {
    isListeningRef.current = false;
    setIsListening(false);
    stopAcousticAnalyzer();
    if (pendingUtteranceRef.current) clearTimeout(pendingUtteranceRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    commitBufferRef.current = '';
    if (recognitionRef.current) {
      const current = recognitionRef.current;
      current.onend = null;
      try {
        current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (isRecordingRef.current) stopRecorder();
    setCallEndedAt((prev) => prev || Date.now());
  };

  const scheduleRecognitionRestart = (recognition, delay = 250) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current || recognitionRef.current !== recognition) return;
      try {
        recognition.start();
        restartAttemptsRef.current = 0;
      } catch {
        restartAttemptsRef.current += 1;
        if (restartAttemptsRef.current <= 6) {
          scheduleRecognitionRestart(recognition, 800);
        } else {
          setMicError('التعرف على الكلام وقف من نفسه. اضغط «بدء الاستماع» تاني، أو استخدم زر «سجّل كلام البايع».');
          isListeningRef.current = false;
          setIsListening(false);
        }
      }
    }, delay);
  };

  // Chrome often delivers Arabic (and long) speech as interim results only.
  // Committing the interim buffer after a short silence is what makes the
  // co-pilot answer at all on those browsers.
  const scheduleInterimCommit = (text) => {
    commitBufferRef.current = text;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const pending = commitBufferRef.current;
      commitBufferRef.current = '';
      if (pending && pending === unspokenBufferRef.current) {
        unspokenBufferRef.current = '';
        processCapturedSpeech(pending);
      }
    }, INTERIM_COMMIT_MS);
  };

  const startSpeechEngine = ({ langOverride } = {}) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const recorderOk = isRecorderSupported();
      setMicEngine(recorderOk ? 'recorder' : 'none');
      setMicError(
        recorderOk
          ? 'المتصفح ده مش بيدعم التعرف المباشر على الكلام (Safari / Firefox / بعض متصفحات الموبايل). استخدم زر «🎙️ سجّل كلام البايع» — هيسجل صوتك ويحوّله نص بالـ AI، أو اكتب في الخانة تحت.'
          : 'المتصفح ده مش بيدعم التعرف على الكلام ولا التسجيل. افتح الصفحة على Chrome أو Edge، أو اكتب كلام البايع في الخانة تحت.'
      );
      return;
    }

    setMicEngine('webspeech');
    setMicError('');
    startAcousticAnalyzer();

    const activeLang = langOverride || speechLangRef.current;
    speechLangRef.current = activeLang;

    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      old.onend = null;
      old.onerror = null;
      old.onresult = null;
      try {
        old.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    unspokenBufferRef.current = '';
    commitBufferRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = activeLang;

    recognition.onresult = (event) => {
      let interim = '';
      let finals = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) finals += `${transcript} `;
        else interim += transcript;
      }

      const display = (finals || interim).trim();
      if (display) setLiveText(display);

      if (interim.trim()) {
        unspokenBufferRef.current = interim.trim();
        scheduleInterimCommit(interim.trim());
        if (CUE_REGEX.test(interim) && Date.now() - lastAgentSpeechAtRef.current < 9000) {
          setTurnStatusBadge({
            type: 'seller_barge_in',
            label: '⚡ يبدو أن البايع قاطعك — جارٍ تجهيز الرد…',
            scriptProgressPct: 0
          });
        }
      }

      if (finals.trim()) {
        const text = finals.trim();
        commitBufferRef.current = '';
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (pendingUtteranceRef.current) clearTimeout(pendingUtteranceRef.current);
        pendingUtteranceRef.current = setTimeout(() => processCapturedSpeech(text), 180);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && recognitionRef.current === recognition) {
        scheduleRecognitionRestart(recognition, 250);
      } else if (!isListeningRef.current) {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown';
      if (code === 'no-speech' || code === 'aborted') {
        setTurnStatusBadge({
          type: 'ready',
          label: '🎧 مستمع… لسه مسمعتش كلام واضح',
          scriptProgressPct: 0
        });
        return;
      }

      const messages = {
        'not-allowed': 'المتصفح رفض إذن الميكروفون. اضغط أيقونة القفل جنب العنوان ← الميكروفون ← السماح، ثم اضغط «بدء الاستماع» تاني.',
        'service-not-allowed': 'خدمة التعرف على الكلام مش متاحة للموقع ده. جرّب Chrome/Edge، أو استخدم زر «سجّل كلام البايع» (تفريغ بالـ AI).',
        'audio-capture': 'مفيش ميكروفون متاح أو مشغول بتطبيق تاني. وصّل ميكروفون وجرّب تاني.',
        network: 'خدمة التعرف على الكلام محتاجة إنترنت. اتأكد من الشبكة، أو استخدم زر «سجّل كلام البايع».',
        'language-not-supported': 'المتصفح مش بيدعم اللغة المختارة للاستماع. بدّل اللغة أو استخدم زر التسجيل.'
      };
      setMicError(messages[code] || `خطأ في التعرف على الصوت: ${code}`);
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      isListeningRef.current = true;
      restartAttemptsRef.current = 0;
      setTurnStatusBadge({
        type: 'ready',
        label: `🎧 مستمع (${activeLang === 'ar-EG' ? 'عربي' : 'English'}) — اتكلم عادي والرد هيتبني على كلامك`,
        scriptProgressPct: 0
      });
    } catch {
      scheduleRecognitionRestart(recognition, 400);
      setIsListening(true);
      isListeningRef.current = true;
    }
  };

  const switchSpeechLanguage = (next) => {
    setSpeechLang(next);
    speechLangRef.current = next;
    if (isListeningRef.current) startSpeechEngine({ langOverride: next });
  };

  // ---------------------------------------------------------------------------
  // Recorder fallback: record → Gemini transcription → same reply pipeline.
  // Works on browsers with no Web Speech API and when the speech service fails.
  // ---------------------------------------------------------------------------
  const transcribeAndReply = async (blob) => {
    if (!apiKey) {
      setMicError('تفريغ التسجيل محتاج مفتاح Gemini API (من إعدادات الموديل فوق). أو اكتب كلام البايع في الخانة تحت.');
      return;
    }
    setIsTranscribing(true);
    setMicError('');
    try {
      const text = await transcribeAudioBlob({ blob, apiKey, model: selectedModel, lang });
      if (!text) {
        setMicError('مقدرتش أطلّع كلام واضح من التسجيل — قرّب الميكروفون واتكلم جملة كاملة، وجرّب تاني.');
        return;
      }
      setHeardText(text);
      replyToSeller(text, { source: 'transcribed' });
    } catch {
      setMicError('حصل خطأ أثناء تفريغ التسجيل. جرّب تاني أو اكتب الجملة يدوياً.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const stopRecorder = () => {
    if (recorderTimerRef.current) clearTimeout(recorderTimerRef.current);
    recorderTimerRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  };

  const startRecorder = async () => {
    if (!isRecorderSupported()) {
      setMicError('المتصفح ده مش بيدعم التسجيل الصوتي. اكتب كلام البايع في الخانة تحت.');
      return;
    }
    try {
      const stream =
        micStreamRef.current ||
        (await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        }));
      micStreamRef.current = stream;
      const mimeType = window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType });
      recorderChunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recorderChunksRef.current.push(event.data);
      };
      rec.onstop = async () => {
        const chunks = recorderChunksRef.current;
        recorderChunksRef.current = [];
        recorderRef.current = null;
        isRecordingRef.current = false;
        setIsRecording(false);
        if (!chunks.length) return;
        await transcribeAndReply(new Blob(chunks, { type: mimeType }));
      };
      rec.start();
      recorderRef.current = rec;
      isRecordingRef.current = true;
      setIsRecording(true);
      setMicError('');
      setTurnStatusBadge({
        type: 'ready',
        label: '🔴 جاري التسجيل — اتكلم وبعدين اضغط «وقف وسيّب النص»',
        scriptProgressPct: 0
      });
      recorderTimerRef.current = setTimeout(() => stopRecorder(), RECORDER_MAX_MS);
    } catch {
      setMicError('مقدرتش أفتح الميكروفون للتسجيل — اتأكد من إذن الميكروفون للموقع.');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const toggleRecorder = () => {
    if (isRecordingRef.current) stopRecorder();
    else startRecorder();
  };

  const forceUseIgnoredSpeech = () => {
    if (!ignoredSpeech?.text) return;
    const text = ignoredSpeech.text;
    setIgnoredSpeech(null);
    replyToSeller(text, { wasBargeIn: CUE_REGEX.test(text) });
  };

  // -------------------------------------------------------------------------
  // Sessions — every call is independent; each deal is isolated by App key
  // -------------------------------------------------------------------------
  const beginNewCall = ({ autoListen = false } = {}) => {
    stopSpeechEngine();
    setCallEndedAt(null);
    setCallLog([]);
    setLastSellerText('');
    setLastIntent(null);
    setLiveText('');
    setLastIgnoredUserText('');
    setLiveCustomOffer(null);
    setAiError('');
    setMicError('');
    setHeardText('');
    setIgnoredSpeech(null);
    setDetectedSellerTone(NEUTRAL_TONE);
    setTurnStatusBadge({
      type: 'ready',
      label: '🎧 مكالمة جديدة — سياق نظيف لهذه الصفقة فقط (لا كلام من مكالمات سابقة)',
      scriptProgressPct: 0
    });

    const nextCallNumber = callNumber + 1;
    setCallNumber(nextCallNumber);
    const rotatedOpener = generateCallOpener(ctx, lang);
    const opener =
      nextCallNumber % 2 === 0 && scriptPackage?.opening
        ? scriptPackage.opening
        : rotatedOpener;
    setAiSuggestion(opener);
    expectedUserScriptRef.current = opener;
    setAiSourceBadge('جاهز');
    setCallStartedAt(Date.now());
    lastAgentSpeechAtRef.current = 0;
    lastUtteranceRef.current = { text: '', at: 0 };

    if (autoListen) {
      setTimeout(() => startSpeechEngine(), 80);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopSpeechEngine();
      setTurnStatusBadge({
        type: 'ready',
        label: '⏹ تم إيقاف الاستماع — التفريغ محفوظ لهذه المكالمة فقط. اضغط «مكالمة جديدة» للبدء من جديد.',
        scriptProgressPct: 0
      });
    } else {
      if (!callStartedAt) beginNewCall({ autoListen: true });
      else startSpeechEngine();
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      stopAcousticAnalyzer();
      if (pendingUtteranceRef.current) clearTimeout(pendingUtteranceRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recorderTimerRef.current) clearTimeout(recorderTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const triggerPanicDeescalate = () => {
    const targetStr = math.isComplete ? formatUSD(liveCustomOffer || math.target) : 'الرقم اللي أقدر أوصله';
    const calmLine =
      lang === 'ar'
        ? `فاهمك 100%، ومش هنا أضغط عليك ولا أضيع وقتك. لو ${targetStr} مش مناسب للي محتاجه، نفترق كأصحاب وأسيبلك التفاصيل مكتوبة كخيار احتياطي — تمام؟`
        : `I hear you 100%, and I am not here to pressure you or waste your time. If ${targetStr} cash does not work for what you need, we can part as friends and I will leave the breakdown as a backup option — fair enough?`;
    setAiSuggestion(calmLine);
    expectedUserScriptRef.current = calmLine;
    setAiSourceBadge('🧯 تهدئة');
    pushTurn({ role: 'copilot', text: calmLine, source: 'panic' });
    setTurnStatusBadge({
      type: 'seller_barge_in',
      label: '🧯 تم تفعيل جملة تهدئة البايع',
      scriptProgressPct: 0
    });
  };

  const elapsedMs = callStartedAt ? (callEndedAt || clockNow) - callStartedAt : 0;
  const intensityLabel = isListening
    ? '● يستمع الآن'
    : callStartedAt
    ? '⏹ المكالمة متوقفة'
    : 'جاهز لمكالمة جديدة';

  const cardTheme = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-lg'
    : 'bg-zinc-900/95 border-emerald-500/40 text-white shadow-2xl';
  const subBoxTheme = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-zinc-950 border-zinc-800 text-slate-200';

  return (
    <section className={`border-2 rounded-2xl p-4 sm:p-6 space-y-5 ${cardTheme}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-500/20 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500">
              <Mic className={`w-4 h-4 ${isListening ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold">Live Call Whisperer Co-Pilot 🎧</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              {aiSourceBadge}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              🔒 سياق هذه الصفقة فقط
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            كل مكالمة تبدأ نظيفة، والردود تُبنى على كلام البايع + بيانات هذه الصفقة (بدون أرقام أو وقائع محفوظة من مكالمة أخرى).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
              isLight ? 'bg-slate-50 border-slate-300' : 'bg-zinc-950 border-zinc-800'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
            مكالمة #{callNumber || 0}
            <span className="font-mono">{formatDuration(elapsedMs)}</span>
            <span className={isListening ? 'text-rose-400' : 'opacity-70'}>{intensityLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => beginNewCall({ autoListen: false })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition ${
              isLight
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
            }`}
            title="كل مكالمة تبدأ بسياق نظيف منفصل عن المكالمة السابقة"
          >
            <RotateCcw className="w-3.5 h-3.5" /> مكالمة جديدة (New Call)
          </button>

          <button
            type="button"
            onClick={() => switchSpeechLanguage(speechLang === 'en-US' ? 'ar-EG' : 'en-US')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}
          >
            {speechLang === 'en-US' ? '🇺🇸 EN' : '🇪🇬 AR'}
          </button>
        </div>
      </div>

      {/* Deal context the co-pilot is allowed to use */}
      <div className={`rounded-xl p-3 border ${subBoxTheme}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> حقائق الصفقة التي يستخدمها الـ Co-Pilot
          </span>
          <span className="text-[10px] opacity-60">لا يستخدم أي معلومة خارج هذه القائمة</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contextFacts.map((fact) => (
            <span
              key={fact.label}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <span className="opacity-60">{fact.label}:</span> <span className="font-mono">{fact.value}</span>
            </span>
          ))}
          {ctx.timelineSentence && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-500">
              تایم لاين: {ctx.timelineSentence.slice(0, 60)}
            </span>
          )}
          {ctx.occupancy !== 'unknown' && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-400">
              الإشغال: {ctx.occupancy}
            </span>
          )}
          {ctx.payoff && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-400">
              Payoff: {formatUSD(ctx.payoff)}
            </span>
          )}
        </div>
        <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          لكل صفقة سياقها المستقل: عند فتح صفقة أخرى يبدأ الـ Co-Pilot من الصفر. مكالمة جديدة = سجل ومقترحات جديدة.
        </p>
      </div>

      {/* Voiceprint + tone strip */}
      <div className={`rounded-xl p-3.5 border grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${subBoxTheme}`}>
        <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-2 border-b lg:border-b-0 lg:border-r border-slate-500/20 pb-2 lg:pb-0 lg:pl-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-emerald-500 uppercase tracking-wider">
                🎙️ بصمة صوتك:
              </span>
              {agentVoiceProfile.calibrated && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  ✓ {agentVoiceProfile.avgPitchHz} Hz
                </span>
              )}
            </div>
            <select
              value={agentVoiceProfile.toneStyle}
              onChange={(e) =>
                setAgentVoiceProfile((prev) => ({ ...prev, toneStyle: e.target.value, calibrated: true }))
              }
              className={`mt-1 border rounded-lg px-2 py-1 text-[11px] font-semibold ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
              }`}
            >
              <option value="Calm, Consultative & Empathetic">هادئ، استشاري ومتعاطف</option>
              <option value="Energetic, Direct & Confident">واثق ومباشر</option>
              <option value="Warm, Empathetic & Conversational">ودود ومطمئن</option>
              <option value="Analytical & Math-Focused">تحليلي بالأرقام</option>
            </select>
          </div>
          <button
            type="button"
            onClick={calibrateMyVoiceProfile}
            disabled={isCalibratingVoice}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
              isCalibratingVoice
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {isCalibratingVoice ? '🎙️ تكلم 3 ثواني…' : '🎙️ معايرة صوتي'}
          </button>
        </div>

        <div className="lg:col-span-3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-500/20 pb-2 lg:pb-0 lg:pl-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="opacity-70 text-[11px]">Pitch:</span>
            <span className="font-mono font-bold text-sky-400">
              {liveAcoustic.pitchHz > 0 ? `${liveAcoustic.pitchHz} Hz` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="opacity-70 text-[11px]">تطابق صوتك:</span>
            <span className={`font-mono font-bold ${liveAcoustic.voiceMatchPct >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {liveAcoustic.pitchHz > 0 ? `${liveAcoustic.voiceMatchPct}%` : 'بانتظار الصوت'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold opacity-75">نبرة البايع:</span>
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${detectedSellerTone.color}`}>
              {detectedSellerTone.label}
            </span>
          </div>
          <p className="text-[11px] opacity-75 mt-1 truncate" title={detectedSellerTone.coaching}>
            💡 {detectedSellerTone.coaching}
          </p>
        </div>
      </div>

      {/* Turn status */}
      <div
        className={`rounded-xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs font-bold transition-all ${
          turnStatusBadge.type === 'seller_barge_in'
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
            : turnStatusBadge.type === 'agent_paused'
            ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
            : turnStatusBadge.type === 'agent_reading'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : isLight
            ? 'bg-slate-100 border-slate-300 text-slate-700'
            : 'bg-zinc-950 border-zinc-800 text-zinc-300'
        }`}
      >
        <span>{turnStatusBadge.label}</span>
        {lastIntent && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            نية البايع: {INTENT_LABELS[lastIntent]?.ar || lastIntent}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 border ${subBoxTheme}`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition shadow-md ${
              isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4" /> ⏹ إيقاف الاستماع
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> 🎧 بدء الاستماع الحي (Hands-Free)
              </>
            )}
          </button>

          {isListening && (
            <button
              type="button"
              onClick={() => setMuteMyVoice((m) => !m)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                muteMyVoice
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : isLight
                  ? 'bg-white border-slate-300 text-slate-700'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}
            >
              <VolumeX className="w-3.5 h-3.5" />
              {muteMyVoice ? '🔇 Muted (أنا بتكلم)' : '🎙️ Mute While I Talk'}
            </button>
          )}

          {liveText && (
            <button
              type="button"
              onClick={() => {
                const text = unspokenBufferRef.current || liveText;
                unspokenBufferRef.current = '';
                replyToSeller(text);
              }}
              className="px-3 py-2 rounded-xl text-xs font-extrabold bg-rose-500 text-white hover:bg-rose-400 transition"
            >
              ⚡ ده كلام البايع — رد فوراً
            </button>
          )}

          <button
            type="button"
            onClick={toggleRecorder}
            disabled={isTranscribing}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition ${
              isRecording
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : isTranscribing
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : isLight
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
            }`}
            title="مفيد لو المتصفح مش بيدعم التعرف المباشر: بيسجل صوت البايع ويحوّله نص بالـ AI"
          >
            <Mic className="w-3.5 h-3.5" />
            {isRecording ? '⏹ وقف وسيّب النص' : isTranscribing ? '⏳ جاري التفريغ…' : '🎙️ سجّل كلام البايع'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              disabled={!apiKey}
              className="accent-emerald-500"
            />
            <span className={apiKey ? '' : 'opacity-40'}>AI (Gemini)</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={appendToDeal}
              onChange={(e) => setAppendToDeal(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>أضف كلام المكالمة لملاحظات الصفقة</span>
          </label>
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Echo:</span>
            <input
              type="range"
              min="0.4"
              max="0.85"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-16 accent-emerald-500"
            />
            <span className="font-mono font-bold text-emerald-500">{Math.round(similarityThreshold * 100)}%</span>
          </div>
        </div>
      </div>

      {aiError && (
        <div className="rounded-xl px-3 py-2 border border-amber-500/40 bg-amber-500/10 text-[11px] font-semibold text-amber-500 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Quick prompts */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 8 أزرار اعتراضات فورية — بأرقام هذه الصفقة
          </span>
          <button
            type="button"
            onClick={triggerPanicDeescalate}
            className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
          >
            🧯 إنقاذ وتهدئة
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => replyToSeller(item.text, { wasBargeIn: item.bargeIn })}
              title={item.label}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold border transition text-left leading-snug ${
                item.bargeIn
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border-rose-500/40'
                  : isLight
                  ? 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-300'
                  : 'bg-zinc-950 hover:bg-emerald-950/50 text-zinc-200 hover:text-emerald-300 border-zinc-800'
              }`}
            >
              <span className="block text-[9px] font-mono opacity-60">#{idx + 1}</span>
              {item.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Live transcript + suggestion */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className={`md:col-span-5 rounded-xl p-4 border flex flex-col min-h-[240px] ${subBoxTheme}`}>
          <div className="text-xs font-bold text-sky-500 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" /> Seller — this call
            </span>
            {isListening && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/40 font-extrabold">
                ● REC
              </span>
            )}
          </div>

          <div className="flex-1 text-xs space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {callLog.filter((t) => t.role === 'seller').length === 0 && (
              <p className="text-[11px] opacity-50 text-center mt-8">
                لم يتم تسجيل كلام من البايع في هذه المكالمة بعد. ابدأ الاستماع أو اكتب في الأسفل.
              </p>
            )}
            {callLog
              .filter((t) => t.role === 'seller')
              .slice(-4)
              .map((turn) => (
                <div key={turn.id} className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[9px] font-mono opacity-60">{turn.time}</span>
                    <span className="text-[9px] font-bold text-sky-400">
                      {INTENT_LABELS[turn.intent]?.ar || turn.intent}
                      {turn.wasBargeIn ? ' • مقاطعة' : ''}
                    </span>
                  </div>
                  <p className="italic font-semibold">“{turn.text}”</p>
                </div>
              ))}
            {liveText && (
              <p className="italic text-[11px] opacity-80 border-t border-slate-500/20 pt-1">🎙️ “{liveText}”</p>
            )}
          </div>

          {lastIgnoredUserText && (
            <div className="mt-2 pt-2 border-t border-slate-500/20 text-[10px] text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{lastIgnoredUserText}</span>
            </div>
          )}
        </div>

        <div className="md:col-span-7 rounded-xl p-4 sm:p-5 border-2 border-emerald-500 bg-emerald-950/90 text-white flex flex-col justify-between min-h-[240px] shadow-xl">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> قول ده دلوقتي (رد على كلامه)
            </span>
            <div className="flex items-center gap-2">
              {isAiThinking && <span className="text-[10px] text-amber-300 animate-pulse font-bold">AI…</span>}
              <span className="text-[11px] font-mono bg-emerald-400 text-slate-950 font-extrabold px-2 py-0.5 rounded">
                MAO: {math.isComplete ? formatUSD(math.mao) : 'EST ONLY'}
              </span>
            </div>
          </div>

          <blockquote className="text-base sm:text-lg font-bold leading-relaxed bg-slate-950/85 p-4 rounded-xl border-l-4 border-emerald-400 text-white shadow-inner">
            “{aiSuggestion}”
          </blockquote>

          {math.isComplete && math.opening && math.mao && (
            <div className="mt-3 pt-2.5 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-300 font-bold">
                🎚️ عرض لايف: <strong className="font-mono text-white">{formatUSD(liveCustomOffer || math.opening)}</strong>
              </span>
              <input
                type="range"
                min={Math.min(math.opening, math.mao)}
                max={Math.max(math.opening, math.mao)}
                step={500}
                value={liveCustomOffer || math.opening}
                onChange={(e) => {
                  const nextVal = Number(e.target.value);
                  setLiveCustomOffer(nextVal);
                  const updatedLine =
                    lang === 'ar'
                      ? `لو نقدر نثبت التايم لاين النهاردة وناخد العقار زي ما هو، أقدر أوصل العرض الصافي لـ ${formatUSD(nextVal)} — وكل مصاريف الإغلاق علينا. يناسبك ${formatUSD(nextVal)}؟`
                      : `If we can lock in the timeline today and take the property 100% as-is, I can bring our net cash offer to ${formatUSD(nextVal)} — with zero closing costs on your end. Does ${formatUSD(nextVal)} work for you?`;
                  setAiSuggestion(updatedLine);
                  expectedUserScriptRef.current = updatedLine;
                }}
                className="w-32 sm:w-44 accent-emerald-400"
              />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200/90 font-mono">
            <span>Opening: {math.isComplete ? formatUSD(math.opening) : '—'}</span>
            <span>Target: {math.isComplete ? formatUSD(math.target) : '—'}</span>
            <span>Walk-Away: {math.isComplete ? formatUSD(math.walkAway) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Call transcript (agent + copilot) */}
      {callLog.length > 0 && (
        <div className={`rounded-xl p-3 border ${subBoxTheme}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
              سجل هذه المكالمة (منفصل عن أي مكالمة أخرى)
            </span>
            <span className="text-[10px] opacity-60">
              {sessionStats.sellerTurns} رد من البايع • {sessionStats.uniqueIntents.length} نية مختلفة
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
            {callLog.slice(-10).map((turn) => (
              <div key={turn.id} className="text-[10px] leading-relaxed flex gap-1.5">
                <span className="font-mono opacity-50 shrink-0">{turn.time}</span>
                <span className={`font-bold shrink-0 ${turn.role === 'seller' ? 'text-sky-400' : 'text-emerald-400'}`}>
                  {turn.role === 'seller' ? 'Seller' : 'Me'}:
                </span>
                <span className="opacity-90">{turn.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mic diagnostics — what the browser actually heard, and why it was ignored */}
      <div className={`rounded-xl p-3 border space-y-2 ${subBoxTheme}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">
            🎤 حالة الميكروفون واللي اتسمع فعلاً
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className={`px-2 py-0.5 rounded-md border ${
              micEngine === 'webspeech'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : micEngine === 'recorder'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}>
              {micEngine === 'webspeech'
                ? 'محرك: تعرف مباشر (Web Speech)'
                : micEngine === 'recorder'
                ? 'محرك: تسجيل + تفريغ AI'
                : 'المتصفح مش بيدعم الميكروفون'}
            </span>
            <span className="px-2 py-0.5 rounded-md border bg-sky-500/10 text-sky-400 border-sky-500/30">
              لغة الاستماع: {speechLang === 'ar-EG' ? 'العربية (ar-EG)' : 'English (en-US)'}
            </span>
            {isListening && (
              <span className="px-2 py-0.5 rounded-md border bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse">
                ● بيسجّل الكلام دلوقتي
              </span>
            )}
          </span>
        </div>

        <p className={`text-[11px] ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
          <span className="opacity-60">آخر جملة اتسمعت: </span>
          <span className="font-semibold">{heardText || 'لسه مفيش كلام واضح…'}</span>
        </p>

        {liveText && liveText !== heardText && (
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            <span className="opacity-60">جاري سماعها الآن: </span>
            <span className="italic">{liveText}</span>
          </p>
        )}

        {ignoredSpeech && (
          <div className="rounded-lg p-2 border border-amber-500/40 bg-amber-500/10 space-y-1.5">
            <p className="text-[11px] font-bold text-amber-400">تم تجاهل جملة: «{ignoredSpeech.text}»</p>
            <p className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>{ignoredSpeech.reason}</p>
            <button
              type="button"
              onClick={forceUseIgnoredSpeech}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
            >
              رد على الجملة دي كأنها كلام البايع
            </button>
          </div>
        )}

        {micError && (
          <div className="rounded-lg p-2 border border-rose-500/40 bg-rose-500/10">
            <p className="text-[11px] font-bold text-rose-300 leading-relaxed">⚠️ {micError}</p>
          </div>
        )}

        <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          لو الميكروفون مش لاقط: بدّل اللغة لـ AR قبل بدء الاستماع، واسمع على Chrome/Edge، ودوس «🎙️ سجّل كلام البايع» كبديل
          مضمون. أي جملة بتتسمع بتظهر فوق قبل ما الـ Co-Pilot يرد عليها.
        </p>
      </div>

      {/* Simulator */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!manualSellerInput.trim()) return;
          replyToSeller(manualSellerInput);
          setManualSellerInput('');
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={manualSellerInput}
          onChange={(e) => setManualSellerInput(e.target.value)}
          placeholder={lang === 'ar' ? 'اكتب كلام البايع هنا لتجربة الرد…' : "Type anything the seller says and press Enter…"}
          className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-white'
          }`}
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shrink-0 transition"
        >
          جرّب الرد
        </button>
      </form>

      <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
        بالاستمرار في الاستماع أو التسجيل، أنت تقر بأن لديك موافقة الأطراف اللازمة وفق قوانين ولايتك (قوانين التسجيل تختلف من
        ولاية لأخرى). الردود والأرقام تقديرية وليست نصيحة قانونية أو ضريبية — راجع
        <a
          href="https://jasonwade45.github.io/Deal-analysis/#limitations"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-emerald-500 mx-1"
        >
          Limitations &amp; Caveats
        </a>
        قبل الاعتماد عليها.
      </p>
    </section>
  );
}
