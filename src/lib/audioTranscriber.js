// ============================================================================
// AUDIO TRANSCRIPTION FALLBACK
// Browsers without the Web Speech API (Safari, Firefox, many in-app browsers)
// and browsers whose speech service keeps failing can still be used: we record
// the seller, send the audio to Gemini as inline data, and get back *only* the
// transcript. The transcript then goes through the same intent engine, so the
// "no invented numbers" rule is untouched.
// ============================================================================

export const TRANSCRIBER_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

export function isWebSpeechSupported(scope = typeof window !== 'undefined' ? window : null) {
  if (!scope) return false;
  return Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition);
}

export function isRecorderSupported(scope = typeof window !== 'undefined' ? window : null) {
  if (!scope) return false;
  return Boolean(scope.MediaRecorder) && Boolean(scope.navigator?.mediaDevices?.getUserMedia);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function cleanTranscript(raw = '') {
  let text = String(raw)
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^(?:transcript|transcription|النص|التفريغ)\s*[:：-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  // strip surrounding quotes, including the case "text" left after a prefix
  while (/^["'«“”]|["'«»“”]$/.test(text)) {
    text = text.replace(/^["'«“”]/, '').replace(/["'«»“”]$/, '').trim();
  }
  return text;
}

/**
 * Transcribe a recorded audio blob with Gemini.
 * @returns {Promise<string|null>} transcript, or null when nothing usable came back.
 */
export async function transcribeAudioBlob({
  blob,
  apiKey,
  model,
  lang = 'ar',
  fetchImpl = typeof fetch !== 'undefined' ? fetch : null
} = {}) {
  if (!blob || !apiKey || !fetchImpl) return null;

  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  const mimeType = blob.type || 'audio/webm';
  const languageLine =
    lang === 'ar'
      ? 'The speaker may use Egyptian Arabic or English. Keep the original words, do not translate.'
      : 'The speaker may use English or Arabic. Keep the original words, do not translate.';

  const prompt = [
    'You are a speech transcription engine for a real-estate acquisition call.',
    'Transcribe ONLY the seller\'s words from this audio, verbatim.',
    languageLine,
    'Do not summarize, do not answer, do not add commentary. If the audio contains no clear speech, reply with exactly: NO_SPEECH',
    'Return the transcript text only.'
  ].join(' ');

  const models = [model, ...TRANSCRIBER_MODELS].filter(Boolean);
  const tried = new Set();

  for (const candidate of models) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64 } }
                ]
              }
            ],
            generationConfig: { temperature: 0, maxOutputTokens: 512 }
          })
        }
      );

      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ') || '';
      const text = cleanTranscript(raw);
      if (!text || /^NO_SPEECH$/i.test(text) || text.length < 2) return null;
      return text;
    } catch {
      // try the next model
    }
  }

  return null;
}
