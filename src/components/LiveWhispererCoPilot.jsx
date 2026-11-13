import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mic,
  Play,
  Square,
  User,
  Bot,
  CheckCircle2,
  VolumeX,
  Zap
} from 'lucide-react';
import { formatUSD } from '../lib/dealMath.js';
import {
  QUICK_LIVE_PROMPTS,
  analyzeScriptProgressAndBargeIn,
  calculateScriptSimilarity,
  compareWithAgentVoiceProfile,
  detectSpeakerTone,
  generateInstantStageAwareReply,
  isClearlyAgentSelfIntroOrPitch
} from '../lib/liveCoPilot.js';

// ============================================================================
// LIVE CALL WHISPERER CO-PILOT
// - Acoustic voiceprint calibration (Pitch Hz + Spectral Timbre + Energy)
// - Smart Pause vs. Seller Interruption (Barge-In) Detection Engine
// - Real-Time Seller & Agent Tone Detection + Personal Tone Preservation
// - 8 one-tap instant seller objection moments
// ============================================================================

export default function LiveWhispererCoPilot({
  apiKey,
  selectedModel,
  address,
  playbook,
  scriptPackage,
  math,
  isLight,
  onAppendToConversation
}) {
  const [listenMode, setListenMode] = useState('handsfree');
  const [speechLang, setSpeechLang] = useState('en-US');
  const [isListening, setIsListening] = useState(false);
  const [muteMyVoice, setMuteMyVoice] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [lastIgnoredUserText, setLastIgnoredUserText] = useState('');
  const [lastSellerText, setLastSellerText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(scriptPackage?.opening || '');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiSourceBadge, setAiSourceBadge] = useState('Ready');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
  const [silenceDelayMs, setSilenceDelayMs] = useState(900);
  const [callLog, setCallLog] = useState([]);
  const [manualSellerInput, setManualSellerInput] = useState('');
  const [liveCustomOffer, setLiveCustomOffer] = useState(null);

  const [turnStatusBadge, setTurnStatusBadge] = useState({
    type: 'ready',
    label: '🎧 جاهز للاستماع الذكي (يميز بين توقفك المؤقت ومقاطعة البايع)',
    scriptProgressPct: 0
  });

  const [agentVoiceProfile, setAgentVoiceProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('deal_analyzer_voice_profile');
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
  const [detectedSellerTone, setDetectedSellerTone] = useState({
    id: 'neutral',
    label: '🎯 هادئ / استشاري (Calm / Consultative)',
    color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/40',
    coaching: 'نبرة متزنة؛ التزم بأسلوبك الهادئ المباشر.'
  });

  const recognitionRef = useRef(null);
  const expectedUserScriptRef = useRef(scriptPackage?.opening || '');
  const silenceTimerRef = useRef(null);
  const unspokenBufferRef = useRef('');
  const processedCharsCountRef = useRef(0);
  const isListeningRef = useRef(false);
  const muteMyVoiceRef = useRef(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioRafRef = useRef(null);
  const recentPitchSamplesRef = useRef([]);
  const liveAcousticRef = useRef(liveAcoustic);
  const agentVoiceProfileRef = useRef(agentVoiceProfile);

  useEffect(() => {
    muteMyVoiceRef.current = muteMyVoice;
  }, [muteMyVoice]);

  useEffect(() => {
    agentVoiceProfileRef.current = agentVoiceProfile;
    try {
      localStorage.setItem('deal_analyzer_voice_profile', JSON.stringify(agentVoiceProfile));
    } catch {
      // ignore
    }
  }, [agentVoiceProfile]);

  useEffect(() => {
    if (scriptPackage?.opening && !lastSellerText) {
      expectedUserScriptRef.current = scriptPackage.opening;
      setAiSuggestion(scriptPackage.opening);
    }
  }, [scriptPackage, lastSellerText]);

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

  const startAcousticAnalyzer = async () => {
    if (audioContextRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
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
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
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

    const collectedPitches = [];
    const collectedCentroids = [];
    const collectedEnergies = [];

    const collectInterval = setInterval(() => {
      const cur = liveAcousticRef.current;
      if (cur && cur.energy >= 8 && cur.pitchHz >= 80) {
        collectedPitches.push(cur.pitchHz);
        collectedCentroids.push(cur.centroidHz || 1150);
        collectedEnergies.push(cur.energy);
      }
    }, 120);

    setTimeout(() => {
      clearInterval(collectInterval);
      setIsCalibratingVoice(false);

      const avgPitch =
        collectedPitches.length > 0
          ? Math.round(collectedPitches.reduce((a, b) => a + b, 0) / collectedPitches.length)
          : 135;
      const avgCentroid =
        collectedCentroids.length > 0
          ? Math.round(collectedCentroids.reduce((a, b) => a + b, 0) / collectedCentroids.length)
          : 1120;
      const avgEnergy =
        collectedEnergies.length > 0
          ? Math.round(collectedEnergies.reduce((a, b) => a + b, 0) / collectedEnergies.length)
          : 42;

      const inferredStyle =
        avgEnergy > 55
          ? 'Energetic, Direct & Confident'
          : avgPitch < 140
          ? 'Calm, Steady & Consultative'
          : 'Warm, Empathetic & Conversational';

      setAgentVoiceProfile({
        avgPitchHz: avgPitch,
        avgCentroidHz: avgCentroid,
        avgEnergy,
        toneStyle: inferredStyle,
        calibrated: true,
        sampleCount: (agentVoiceProfileRef.current?.sampleCount || 0) + collectedPitches.length
      });

      if (!isListeningRef.current) {
        stopAcousticAnalyzer();
      }
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

  const getAiResponseForSeller = async (sellerText, options = {}) => {
    const { wasBargeIn = false } = options;
    const cleanedSellerText = (sellerText || '').trim();
    if (cleanedSellerText.length < 2) return;

    setLastSellerText(cleanedSellerText);
    setLiveText('');
    unspokenBufferRef.current = '';

    const curAcoustic = liveAcousticRef.current;
    const sellerTone = detectSpeakerTone({
      text: cleanedSellerText,
      pitchHz: curAcoustic.pitchHz,
      pitchVariance: curAcoustic.pitchVariance,
      energy: curAcoustic.energy
    });
    setDetectedSellerTone(sellerTone);

    setTurnStatusBadge({
      type: wasBargeIn ? 'seller_barge_in' : 'seller_speaking',
      label: wasBargeIn
        ? `⚡ قاطعك البايع أثناء كلامك! (${sellerTone.label}) — تم تعديل الرد فوراً`
        : `🗣️ البايع أنهى كلامه (${sellerTone.label}) — اقرأ الرد الآن`,
      scriptProgressPct: 0
    });

    const instantLocalReply = generateInstantStageAwareReply({
      sellerSpeech: cleanedSellerText,
      math,
      playbook,
      address,
      wasBargeIn,
      sellerToneId: sellerTone.id
    });
    setAiSuggestion(instantLocalReply);
    setAiSourceBadge(wasBargeIn ? '⚡ Barge-In Pivot (<15ms)' : '⚡ Instant (<15ms)');
    expectedUserScriptRef.current = instantLocalReply;

    setIsAiThinking(true);
    const openStr = math.isComplete ? formatUSD(math.opening) : 'ESTIMATE ONLY';
    const targetStr = math.isComplete ? formatUSD(math.target) : 'ESTIMATE ONLY';
    const walkStr = math.isComplete ? formatUSD(math.walkAway) : 'ESTIMATE ONLY';
    const repStr = math.repairs !== null ? formatUSD(math.repairs) : 'ESTIMATE ONLY';

    const recentTurns = callLog
      .slice(-4)
      .map((t) => `${t.role === 'seller' ? 'Seller' : 'Agent'}: ${t.text}`)
      .join('\n');

    const prompt = `You are a real-time live phone call whisperer for a real estate wholesaling acquisitions agent.
Property: ${address}
Seller Type: ${playbook.label} (${playbook.tone})
Known Deal Facts: Seller is retiring, wants to close in ~30 days, dropped price from $280k to $250k. Kitchen needs remodeling, but HVAC (2.5 yrs old) and Roof (7.5 yrs old) are in great shape.

AGENT'S SAVED VOICE & TONE PROFILE (WRITE IN THIS EXACT PERSONAL STYLE):
- Agent Tone Style: ${agentVoiceProfileRef.current?.toneStyle || 'Calm, Consultative & Empathetic'} (Pitch ~${agentVoiceProfileRef.current?.avgPitchHz || 135}Hz)

SELLER'S LIVE DETECTED EMOTIONAL TONE & TURN CONTEXT:
- Seller Current Tone: ${sellerTone.label} (${sellerTone.coaching})
- Did Seller Interrupt / Barge-In Mid-Sentence?: ${wasBargeIn ? 'YES — The seller interrupted the agent mid-sentence! Acknowledge their interruption politely ("Oh go right ahead—I hear you...") before pivoting.' : 'No, normal turn-taking.'}

LOCKED CALCULATOR NUMBERS (NEVER INVENT OTHER NUMBERS):
- Opening Cash Offer: ${openStr}
- Target / Max Cash Offer (MAO): ${targetStr}
- Walk-Away Ceiling: ${walkStr}
- Repair Estimate: ${repStr}

Recent Call Context:
${recentTurns || 'Call just started.'}

The Seller on the phone JUST said: "${cleanedSellerText}"

TASK:
Write the EXACT next 1 to 2 spoken sentences the Agent should say back right now, matching the Agent's personal tone (${agentVoiceProfileRef.current?.toneStyle}) and de-escalating the Seller's tone (${sellerTone.label}).
- Output ONLY the raw spoken words (no quotes, no labels, no markdown).
- Language: ${speechLang === 'ar-EG' ? 'Natural Egyptian Arabic' : 'Natural conversational English'}.`;

    const modelToUse = apiKey ? selectedModel || 'gemini-3-flash-preview' : 'gemini-3-flash-preview';
    const effectiveKey = apiKey || '';

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${effectiveKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 }
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanReply = rawReply.replace(/^["'“”]+|["'“”]+$/g, '').trim();

        if (cleanReply && cleanReply.length > 8) {
          setAiSuggestion(cleanReply);
          setAiSourceBadge(wasBargeIn ? '✨ Gemini Barge-In AI' : '✨ Gemini Tone-Matched AI');
          expectedUserScriptRef.current = cleanReply;

          setCallLog((prev) => [
            ...prev,
            {
              role: 'seller',
              text: cleanedSellerText,
              tone: sellerTone.label,
              wasBargeIn,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            },
            {
              role: 'copilot',
              text: cleanReply,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          ]);

          if (onAppendToConversation) {
            onAppendToConversation(
              `Seller (${wasBargeIn ? 'Interrupted' : 'Live'} - ${sellerTone.id}): ${cleanedSellerText}\nMe (Co-Pilot): ${cleanReply}`
            );
          }
          setIsAiThinking(false);
          return;
        }
      }
    } catch {
      // Fallback to instantLocalReply
    }

    setCallLog((prev) => [
      ...prev,
      {
        role: 'seller',
        text: cleanedSellerText,
        tone: sellerTone.label,
        wasBargeIn,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      {
        role: 'copilot',
        text: instantLocalReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
    if (onAppendToConversation) {
      onAppendToConversation(
        `Seller (${wasBargeIn ? 'Interrupted' : 'Live'} - ${sellerTone.id}): ${cleanedSellerText}\nMe (Co-Pilot): ${instantLocalReply}`
      );
    }
    setIsAiThinking(false);
  };

  const processCapturedSpeech = (spokenText, isInterimCheck = false) => {
    const trimmed = (spokenText || '').trim();
    if (trimmed.length < 3) return { action: 'noop' };

    if (muteMyVoiceRef.current) {
      if (!isInterimCheck) {
        autoUpdateAgentVoiceprint();
        setLastIgnoredUserText(`(Muted My Voice) "${trimmed}"`);
        setLiveText('');
        unspokenBufferRef.current = '';
      }
      return { action: 'ignored_agent' };
    }

    if (listenMode === 'handsfree') {
      const progressAnalysis = analyzeScriptProgressAndBargeIn(trimmed, expectedUserScriptRef.current);

      if (progressAnalysis.hasBargeInTail && progressAnalysis.bargeInText.trim().length >= 3) {
        setLastIgnoredUserText(`قرأت: "${progressAnalysis.agentPrefixText.slice(0, 45)}..." ثم قاطعك البايع!`);
        getAiResponseForSeller(progressAnalysis.bargeInText, { wasBargeIn: true });
        return { action: 'barge_in' };
      }

      let maxSim = 0;
      for (const candidateScript of allKnownUserScripts) {
        const sim = calculateScriptSimilarity(trimmed, candidateScript);
        if (sim > maxSim) maxSim = sim;
      }

      const voiceMatch = compareWithAgentVoiceProfile(liveAcousticRef.current, agentVoiceProfileRef.current);
      const isAgentSpeaking =
        progressAnalysis.isPrefixOfScript ||
        maxSim >= similarityThreshold ||
        isClearlyAgentSelfIntroOrPitch(trimmed) ||
        (voiceMatch.isKnownAgentVoice && maxSim >= 0.3);

      if (isAgentSpeaking) {
        const pct = Math.round(Math.max(progressAnalysis.progressRatio, maxSim) * 100);
        autoUpdateAgentVoiceprint();

        if (progressAnalysis.isPrefixOfScript && progressAnalysis.progressRatio < 0.8) {
          setTurnStatusBadge({
            type: 'agent_paused',
            label: `⏸️ توقف مؤقت منك (قرأت ${pct}% من السكريبت) — كمل كلامك براحتك أو لو البايع قاطعك هيلقطه فوراً`,
            scriptProgressPct: pct
          });
          return { action: 'agent_paused_mid_script', pct };
        }

        if (!isInterimCheck) {
          setTurnStatusBadge({
            type: 'agent_reading',
            label: `✅ أنهيت قراءة السكريبت (${pct}% تطابق + تم تحديث بصمة صوتك) — بانتظار رد البايع...`,
            scriptProgressPct: 100
          });
          setLastIgnoredUserText(
            `"${trimmed.slice(0, 60)}..." (${pct}% تطابق السكريبت • بصمة صوتك ${voiceMatch.matchConfidence || 88}%)`
          );
          setLiveText('');
          unspokenBufferRef.current = '';
        }
        return { action: 'ignored_agent' };
      }
    }

    if (!isInterimCheck) {
      const wasAgentMidScript = turnStatusBadge.type === 'agent_paused';
      getAiResponseForSeller(trimmed, { wasBargeIn: wasAgentMidScript });
    }
    return { action: 'seller_turn' };
  };

  const startSpeechEngine = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAiSuggestion(
        'Browser Speech Recognition requires Google Chrome or Edge. You can also test live responses using the input box or 1-Tap buttons below!'
      );
      return;
    }

    startAcousticAnalyzer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    processedCharsCountRef.current = 0;
    unspokenBufferRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event) => {
      let fullSessionTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullSessionTranscript += event.results[i][0].transcript + ' ';
      }

      const freshSlice = fullSessionTranscript.slice(processedCharsCountRef.current).trim();
      if (!freshSlice) return;

      setLiveText(freshSlice);
      unspokenBufferRef.current = freshSlice;

      if (listenMode === 'handsfree') {
        const liveProgress = analyzeScriptProgressAndBargeIn(freshSlice, expectedUserScriptRef.current);

        if (liveProgress.hasBargeInTail && liveProgress.bargeInText.split(/\s+/).length >= 3) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          processedCharsCountRef.current = fullSessionTranscript.length;
          processCapturedSpeech(freshSlice, false);
          return;
        }

        if (liveProgress.isPrefixOfScript) {
          const pct = Math.round(liveProgress.progressRatio * 100);
          setTurnStatusBadge({
            type: 'agent_reading',
            label: `🎤 أنت تقرأ السكريبت الآن (${pct}% مكتمل) — لو سكتت في النص هينتظرك، ولو البايع قاطعك هيرد فوراً`,
            scriptProgressPct: pct
          });
        }

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        const effectiveWaitMs =
          liveProgress.isPrefixOfScript && liveProgress.progressRatio < 0.8
            ? Math.round(silenceDelayMs * 1.85)
            : silenceDelayMs;

        silenceTimerRef.current = setTimeout(() => {
          const textToProcess = unspokenBufferRef.current.trim();
          if (textToProcess.length >= 3) {
            const result = processCapturedSpeech(textToProcess, false);
            if (result?.action !== 'agent_paused_mid_script') {
              processedCharsCountRef.current = fullSessionTranscript.length;
            }
          }
        }, effectiveWaitMs);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && listenMode === 'handsfree') {
        processedCharsCountRef.current = 0;
        try {
          recognition.start();
        } catch {
          // ignore
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch {
      setIsListening(false);
    }
  };

  const stopSpeechEngine = () => {
    isListeningRef.current = false;
    setIsListening(false);
    stopAcousticAnalyzer();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (listenMode === 'ptt' && unspokenBufferRef.current.trim().length > 2) {
      processCapturedSpeech(unspokenBufferRef.current, false);
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      stopAcousticAnalyzer();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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
    const targetStr = math.isComplete ? formatUSD(liveCustomOffer || math.target) : 'our cash figure';
    const calmLine = `I hear you 100%, and please know I am not here to pressure you or waste a second of your time. If ${targetStr} cash doesn't work for what you need right now, we can part as friends and I can simply leave the written net breakdown with you as a backup option—fair enough?`;
    setAiSuggestion(calmLine);
    expectedUserScriptRef.current = calmLine;
    setAiSourceBadge('🧯 De-Escalation Rescue');
    setTurnStatusBadge({
      type: 'seller_barge_in',
      label: '🧯 تم تفعيل جملة تهدئة البايع وإنقاذ المكالمة فوراً',
      scriptProgressPct: 0
    });
  };

  const cardTheme = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-lg'
    : 'bg-zinc-900/95 border-emerald-500/40 text-white shadow-2xl';
  const subBoxTheme = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-zinc-950 border-zinc-800 text-slate-200';

  return (
    <section className={`border-2 rounded-2xl p-4 sm:p-6 space-y-5 ${cardTheme}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500/20 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500">
              <Mic className={`w-4 h-4 ${isListening ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold">
              Live Call Whisperer Co-Pilot 🎧
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              {aiSourceBadge}
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            يميز ذكياً بين <strong>توقفك المؤقت (Pause)</strong> و<strong>مقاطعة البايع (Barge-In)</strong> + يحفظ بصمة ونبرة صوتك ويكتشف نبرة البايع لحظياً.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-zinc-950 border-zinc-800'}`}>
            <button
              type="button"
              onClick={() => {
                stopSpeechEngine();
                setListenMode('handsfree');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                listenMode === 'handsfree'
                  ? 'bg-emerald-500 text-slate-950'
                  : isLight
                  ? 'text-slate-600'
                  : 'text-zinc-400'
              }`}
            >
              Hands-Free (Smart Pause/Barge-In)
            </button>
            <button
              type="button"
              onClick={() => {
                stopSpeechEngine();
                setListenMode('ptt');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                listenMode === 'ptt'
                  ? 'bg-emerald-500 text-slate-950'
                  : isLight
                  ? 'text-slate-600'
                  : 'text-zinc-400'
              }`}
            >
              Push-to-Talk
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSpeechLang((l) => (l === 'en-US' ? 'ar-EG' : 'en-US'))}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}
          >
            {speechLang === 'en-US' ? '🇺🇸 EN' : '🇪🇬 AR'}
          </button>
        </div>
      </div>

      {/* VOICEPRINT BIOMETRICS, PERSONAL TONE SAVER & SELLER TONE DETECTOR BAR */}
      <div className={`rounded-xl p-3.5 border grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${subBoxTheme}`}>
        <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-2 border-b lg:border-b-0 lg:border-r border-slate-500/20 pb-2 lg:pb-0 lg:pr-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-emerald-500 uppercase tracking-wider">
                🎙️ بصمة ونبرة صوتك المحفوظة:
              </span>
              {agentVoiceProfile.calibrated && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  ✓ محفوظة ({agentVoiceProfile.avgPitchHz} Hz)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={agentVoiceProfile.toneStyle}
                onChange={(e) =>
                  setAgentVoiceProfile((prev) => ({ ...prev, toneStyle: e.target.value, calibrated: true }))
                }
                className={`border rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              >
                <option value="Calm, Consultative & Empathetic">هادئ، استشاري ومتعاطف (Calm & Consultative)</option>
                <option value="Energetic, Direct & Confident">واثق، مباشر وسريع (Direct & Confident)</option>
                <option value="Warm, Empathetic & Conversational">ودود، دافئ ومطمئن (Warm & Friendly)</option>
                <option value="Analytical & Math-Focused">تحليلي ومبني على الأرقام (Math-Driven)</option>
              </select>
            </div>
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
            {isCalibratingVoice ? '🎙️ تكلم الآن لمدة 3 ثواني...' : '🎙️ معايرة وحفظ صوتي'}
          </button>
        </div>

        <div className="lg:col-span-3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-500/20 pb-2 lg:pb-0 lg:pr-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="opacity-70 text-[11px]">التردد الحي (Pitch):</span>
            <span className="font-mono font-bold text-sky-400">
              {liveAcoustic.pitchHz > 0 ? `${liveAcoustic.pitchHz} Hz` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="opacity-70 text-[11px]">تطابق بصمة صوتك:</span>
            <span
              className={`font-mono font-bold ${
                liveAcoustic.voiceMatchPct >= 70 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {liveAcoustic.pitchHz > 0
                ? liveAcoustic.voiceMatchPct >= 70
                  ? `${liveAcoustic.voiceMatchPct}% (صوتك أنت)`
                  : `${liveAcoustic.voiceMatchPct}% (نبرة البايع)`
                : 'بانتظار الصوت'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold opacity-75">نبرة البايع المكتشفة:</span>
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${detectedSellerTone.color}`}>
              {detectedSellerTone.label}
            </span>
          </div>
          <p className="text-[11px] opacity-75 mt-1 truncate" title={detectedSellerTone.coaching}>
            💡 {detectedSellerTone.coaching}
          </p>
        </div>
      </div>

      {/* LIVE TURN STATE BANNER: PAUSE VS. BARGE-IN INDICATOR */}
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
        <div className="flex items-center gap-2">
          <span>{turnStatusBadge.label}</span>
        </div>
        {turnStatusBadge.scriptProgressPct > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono">تقدم قراءة السكريبت: {turnStatusBadge.scriptProgressPct}%</span>
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${turnStatusBadge.scriptProgressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Controls Strip */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 border ${subBoxTheme}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {listenMode === 'handsfree' ? (
            <>
              <button
                type="button"
                onClick={() => (isListening ? stopSpeechEngine() : startSpeechEngine())}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition shadow-md ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
                title="بدء الاستماع الحي بدون زراير — Start Hands-Free"
              >
                {isListening ? (
                  <>
                    <Square className="w-4 h-4" /> ⏹ إيقاف الاستماع (Stop Live Mic)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> 🎧 بدء الاستماع الحي بدون زراير (Start Hands-Free)
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
                  {muteMyVoice ? '🔇 Muted (I am talking)' : '🎙️ Mute While I Talk'}
                </button>
              )}

              {liveText && (
                <button
                  type="button"
                  onClick={() => {
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    const t = unspokenBufferRef.current || liveText;
                    unspokenBufferRef.current = '';
                    getAiResponseForSeller(t, { wasBargeIn: true });
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold bg-rose-500 text-white hover:bg-rose-400 transition"
                >
                  ⚡ ده مقاطعة من البايع (رد فوراً)
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onMouseDown={startSpeechEngine}
              onMouseUp={stopSpeechEngine}
              onTouchStart={startSpeechEngine}
              onTouchEnd={stopSpeechEngine}
              className={`px-6 py-3 rounded-xl font-extrabold text-sm transition shadow-lg ${
                isListening ? 'bg-rose-500 text-white scale-105' : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {isListening ? '🎙️ Listening to Seller... (Release for Instant Reply)' : '🎙️ Hold While Seller Speaks'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Pause Timer:</span>
            <input
              type="range"
              min="500"
              max="1800"
              step="100"
              value={silenceDelayMs}
              onChange={(e) => setSilenceDelayMs(Number(e.target.value))}
              className="w-20 accent-emerald-500"
            />
            <span className="font-mono font-bold text-emerald-500">{(silenceDelayMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Echo Filter:</span>
            <input
              type="range"
              min="0.35"
              max="0.80"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-20 accent-emerald-500"
            />
            <span className="font-mono font-bold text-emerald-500">{Math.round(similarityThreshold * 100)}%</span>
          </div>
        </div>
      </div>

      {/* 8 One-Tap Instant Seller Objection Moments */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 8 أزرار اعتراضات البايع الفورية (1-Tap Seller Moments)
          </span>
          <button
            type="button"
            onClick={triggerPanicDeescalate}
            className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
          >
            🧯 إنقاذ وتهدئة البايع فوراً
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {QUICK_LIVE_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => getAiResponseForSeller(item.text, { wasBargeIn: item.bargeIn })}
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
              {item.shortLabel || item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-Side Live Stream & Teleprompter */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className={`md:col-span-5 rounded-xl p-4 border flex flex-col justify-between min-h-[200px] ${subBoxTheme}`}>
          <div>
            <div className="text-xs font-bold text-sky-500 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" /> Seller Live Speech & Tone
              </span>
              {isListening && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/40 font-extrabold">
                  ● REC
                </span>
              )}
            </div>

            {liveText ? (
              <p className="text-sm font-semibold italic p-3 rounded-lg bg-sky-500/10 border border-sky-500/30">
                “{liveText}”
              </p>
            ) : lastSellerText ? (
              <div className="space-y-1.5">
                <span className="text-[11px] opacity-60">Last captured from seller:</span>
                <p className="text-sm font-medium italic p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  “{lastSellerText}”
                </p>
              </div>
            ) : (
              <p className="text-xs opacity-50 mt-8 text-center">
                Click &ldquo;Start Smart Live Listening&rdquo; or tap any Seller Moment button above...
              </p>
            )}
          </div>

          {lastIgnoredUserText && (
            <div className="mt-3 pt-2 border-t border-slate-500/20 text-[11px] text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{lastIgnoredUserText}</span>
            </div>
          )}
        </div>

        <div className="md:col-span-7 rounded-xl p-4 sm:p-5 border-2 border-emerald-500 bg-emerald-950/90 text-white flex flex-col justify-between min-h-[200px] shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> SAY THIS NOW (IN YOUR {agentVoiceProfile.toneStyle.split(',')[0].toUpperCase()} TONE):
            </span>
            <div className="flex items-center gap-2">
              {isAiThinking && (
                <span className="text-[10px] text-amber-300 animate-pulse font-bold">
                  Matching Tone...
                </span>
              )}
              <span className="text-[11px] font-mono bg-emerald-400 text-slate-950 font-extrabold px-2 py-0.5 rounded">
                MAO: {math.isComplete ? formatUSD(math.mao) : 'EST ONLY'}
              </span>
            </div>
          </div>

          <blockquote className="text-lg sm:text-xl font-bold leading-relaxed bg-slate-950/85 p-4 rounded-xl border-l-4 border-emerald-400 text-white shadow-inner">
            “{aiSuggestion}”
          </blockquote>

          {math.isComplete && math.opening && math.mao && (
            <div className="mt-3 pt-2.5 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-300 font-bold">
                🎚️ حرك السعر لايف أثناء المكالمة: <strong className="font-mono text-white">{formatUSD(liveCustomOffer || math.opening)}</strong>
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
                  const updatedLine = `If we can lock in the timeline today and take the property 100% as-is, I can bring our net cash offer to ${formatUSD(nextVal)}—with zero closing costs or fees on your end. Does ${formatUSD(nextVal)} work for you?`;
                  setAiSuggestion(updatedLine);
                  expectedUserScriptRef.current = updatedLine;
                }}
                className="w-36 sm:w-48 accent-emerald-400"
              />
              <span className="text-[11px] font-mono text-emerald-200">
                Spread: <strong>{formatUSD((math.arv * (math.maoPct / 100) - math.repairs) - (liveCustomOffer || math.opening))}</strong>
              </span>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200/90 font-mono">
            <span>Opening: <strong>{formatUSD(math.opening)}</strong></span>
            <span>Target MAO: <strong>{formatUSD(math.target)}</strong></span>
            <span>Walk-Away: <strong>{formatUSD(math.walkAway)}</strong></span>
          </div>
        </div>
      </div>

      {/* Type Seller Reply Simulator */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!manualSellerInput.trim()) return;
          getAiResponseForSeller(manualSellerInput, { wasBargeIn: false });
          setManualSellerInput('');
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={manualSellerInput}
          onChange={(e) => setManualSellerInput(e.target.value)}
          placeholder="Type anything the seller says (or test an interruption like 'Wait hold on, $192k is too low!') and press Enter..."
          className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-white'
          }`}
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shrink-0 transition"
        >
          Get Live Reply
        </button>
      </form>
    </section>
  );
}
