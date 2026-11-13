// ============================================================================
// CONTEXT-GROUNDED CALL REPLY ENGINE
// Every reply is built from the *current deal context* + the seller's actual
// words. No hard-coded deal facts (no fixed $280k/$250k, no assumed retirement),
// no invented numbers, and each call starts with a clean turn history.
// ============================================================================

const money = (n) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : null);

const shortQuote = (text, maxWords = 14) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.slice(0, maxWords).join(' ');
};

// ---------------------------------------------------------------------------
// Intent detection (deterministic, ordered by business priority)
// ---------------------------------------------------------------------------
const INTENT_RULES = [
  {
    id: 'notInterested',
    regex: /not interested|stop calling|don'?t call|remove me|take me off|unsubscribe|مش مهتم|متبعتش|بلاش تتصل/i
  },
  {
    id: 'whoIsThis',
    regex: /who is this|who am i speaking|who's calling|مين معايا|مين بيكلمني|مين حضرتك|مين انت/i
  },
  {
    id: 'firmPrice',
    regex: /firm|final (?:price|number)|not a penny|bottom line|no less|won'?t go lower|آخر كلام|مش هينزل|نهائي|مش أقل/i
  },
  {
    id: 'priceTooLow',
    regex: /too low|way low|lowball|not enough|insult|cheap|can'?t do that|قليل|قليلة|أقل من كده|اقل من كده|مش كفاية|مستحيل/i
  },
  {
    id: 'payoff',
    regex: /payoff|pay off|owe|balance|mortgage|loan|قرض|مديونية|باقي عليا/i
  },
  {
    id: 'zillow',
    regex: /zillow|redfin|realtor|listing|mls|market value|top dollar|زيلو|سمسار|السوق/i
  },
  {
    id: 'foreclosure',
    regex: /auction|foreclos|sheriff|sale date|behind on|notice of default|مزاد|حجز|متأخر/i
  },
  {
    id: 'probate',
    regex: /passed away|inherit|probate|estate|deceased|mom(?:'s)?|dad(?:'s)?|وفاة|ورث|ورثة|والدتي|والدي/i
  },
  {
    id: 'tenant',
    regex: /tenant|renter|rented|lease|evict|مستأجر|إيجار|عقد إيجار/i
  },
  {
    id: 'familyPressure',
    regex: /(?:brother|sister|family|mother|father|mom|dad|son|daughter|wife|husband|partner|lawyer|attorney|realtor|agent)[^.?!]{0,60}(?:think|say|said|want|worth|more|higher|price)|(?:think|thinks|said|says)[^.?!]{0,25}(?:worth more|get more|more money)|(?:أخويا|أختي|العيلة|أهلي|محامي|شريكي)[^.?!]{0,50}(?:عايز|شايف|بيقول|أكتر|أعلى)/i
  },
  {
    id: 'thinkAboutIt',
    regex: /think about|need to think|talk to (?:my|the)|call me (?:later|tomorrow)|sleep on it|not sure|أفكر|أستشير|أشوف|بكرة|مش متأكد/i
  },
  {
    id: 'sendInfo',
    regex: /email|e-mail|text me|send (?:it|me)|mail me|whatsapp|ابعت|إيميل|واتس/i
  },
  {
    id: 'busy',
    regex: /busy|driving|at work|with (?:a )?client|cooking|مشغول|سايق|في الشغل/i
  },
  {
    id: 'timeline',
    regex: /when can|how (?:fast|soon)|how long|close by|closing|timeline|within (?:a|the) (?:month|week)|30 days|retir|[اأ]?متى|قد إيه|ميعاد الإغلاق|شهر|أسبوع|تقاعد/i
  },
  {
    id: 'askOffer',
    regex: /how much|what(?:'s| is) your offer|what can you (?:pay|offer)|best (?:price|offer)|give me a number|كام|عرضك|بتدفع كام/i
  },
  {
    id: 'condition',
    regex: /roof|hvac|a\/c|\bac\b|kitchen|bath|repair|fix|foundation|plumb|electric|pool|floor|window|needs work|سقف|تكييف|مطبخ|تصليح|حمام|أساسات|سباكة|كهرباء/i
  },
  {
    id: 'cleanout',
    regex: /stuff|furniture|junk|trash|packed|hoard|clean ?out|leave (?:it|everything)|عفش|أثاث|هدوم|زبالة/i
  },
  {
    id: 'agree',
    regex: /^(?:yes|yeah|yep|sure|okay|ok|sounds good|let'?s do it|deal|تمام|أيوه|موافق|خلاص|ماشي)\b/i
  },
  {
    id: 'greeting',
    regex: /^(?:hey|hi|hello|good (?:morning|afternoon|evening)|speaking|this is|أهلاً|السلام|ألو)\b/i
  },
  {
    id: 'question',
    regex: /\?|^(?:what|why|how|when|where|who|which|can you|do you|are you|إيه|ليه|إزاي|[اأ]?متى|فين|مين|ينفع|تقدر)/i
  }
];

export function detectSellerIntent(text = '') {
  const cleaned = String(text || '').trim();
  if (cleaned.length < 2) return { id: 'unknown', matched: false };

  for (const rule of INTENT_RULES) {
    if (rule.regex.test(cleaned)) {
      // A bare greeting must be short, otherwise treat the sentence as content.
      if (rule.id === 'greeting' && cleaned.split(/\s+/).length > 9) continue;
      return { id: rule.id, matched: true };
    }
  }
  return { id: 'unknown', matched: false };
}

export const INTENT_LABELS = {
  notInterested: { en: 'Not interested', ar: 'غير مهتم' },
  whoIsThis: { en: 'Asking who you are', ar: 'يسأل مين أنت' },
  firmPrice: { en: 'Firm on price', ar: 'متمسك بالسعر' },
  priceTooLow: { en: 'Price objection', ar: 'اعتراض على السعر' },
  payoff: { en: 'Payoff / mortgage', ar: 'مديونية / قرض' },
  zillow: { en: 'Zillow / listing anchor', ar: 'زيلو / سعر السوق' },
  foreclosure: { en: 'Foreclosure clock', ar: 'ميعاد حجز / مزاد' },
  probate: { en: 'Probate / inherited', ar: 'ورث / وصاية' },
  tenant: { en: 'Tenant / lease', ar: 'مستأجر / إيجار' },
  thinkAboutIt: { en: 'Needs time / family', ar: 'محتاج وقت / يستشير' },
  sendInfo: { en: 'Wants it in writing', ar: 'عايز التفاصيل مكتوبة' },
  busy: { en: 'Busy / callback', ar: 'مشغول / كلمني بعدين' },
  timeline: { en: 'Timeline / closing', ar: 'التايم لاين / الإغلاق' },
  askOffer: { en: 'Asks for the offer', ar: 'بيسأل عن العرض' },
  condition: { en: 'Condition / repairs', ar: 'الحالة / التصليحات' },
  cleanout: { en: 'Contents / cleanout', ar: 'العفش / التنضيف' },
  agree: { en: 'Open / agreeing', ar: 'موافق / منفتح' },
  greeting: { en: 'Greeting', ar: 'تحية' },
  question: { en: 'Question', ar: 'سؤال' },
  unknown: { en: 'General statement', ar: 'كلام عام' }
};

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------
function facts(ctx = {}) {
  const complete = Boolean(ctx.isComplete && ctx.opening && ctx.target);
  return {
    addr: ctx.shortAddress || 'the property',
    open: money(ctx.opening),
    target: money(ctx.target),
    asking: money(ctx.asking),
    repairs: money(ctx.repairs),
    arv: money(ctx.arv),
    payoff: money(ctx.payoff),
    first: money(ctx.firstPrice),
    last: money(ctx.lastPrice),
    left: Number.isFinite(ctx.target) && Number.isFinite(ctx.payoff) && ctx.target > ctx.payoff ? money(ctx.target - ctx.payoff) : null,
    short: Number.isFinite(ctx.target) && Number.isFinite(ctx.payoff) && ctx.payoff > ctx.target ? money(ctx.payoff - ctx.target) : null,
    drop: money(ctx.priceDrop),
    closing: ctx.closingDays || '14–21 days',
    complete,
    playbook: ctx.playbookLabel || 'Seller'
  };
}

function repairScope(ctx = {}) {
  const items = (ctx.conditionItems || []).map((i) => i.label);
  if (items.length === 0) return 'the work the property needs';
  if (items.length === 1) return `the ${items[0]}`;
  return `the ${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function creditLine(ctx, lang) {
  const f = facts(ctx);
  if (!ctx.priceDrop || !f.first || !f.last) return '';
  return lang === 'ar'
    ? `أعرف إنك نزّلت ${f.drop} من ${f.first} لـ ${f.last} — شكراً على ده. `
    : `I know you already came down ${f.drop}, from ${f.first} to ${f.last} — thank you for that. `;
}

function mechanicsCredit(ctx, lang) {
  const parts = [];
  if (ctx.hvacGood || (ctx.hvacAge !== null && ctx.hvacAge <= 12)) parts.push(ctx.hvacAge !== null ? `HVAC at ${ctx.hvacAge} years` : 'the HVAC');
  if (ctx.roofGood || (ctx.roofAge !== null && ctx.roofAge <= 12)) parts.push(ctx.roofAge !== null ? `roof at ${ctx.roofAge} years` : 'the roof');
  if (parts.length === 0) return '';
  const joined = parts.join(lang === 'ar' ? ' و' : ' and ');
  return lang === 'ar'
    ? `حسبتلك ميزة ${joined}، عشان كده مش خصم منهم. `
    : `I gave you credit for the ${joined} — we didn't deduct for those. `;
}

function missingNumberLine(lang) {
  return lang === 'ar'
    ? 'قبل ما أدي رقم لازم أتأكد من تكلفة التصليحات معاك. إيه أكتر حاجة محتاجة شغل في العقار؟'
    : 'Before I give you a number I need to confirm the repair scope with you. What needs the most work at the property?';
}

// ---------------------------------------------------------------------------
// Reply generation
// ---------------------------------------------------------------------------
export function generateContextualReply({
  intent = 'unknown',
  sellerSpeech = '',
  ctx = {},
  wasBargeIn = false,
  sellerToneId = 'neutral',
  lang = 'en',
  turn = 0,
  intentHint = null
} = {}) {
  const f = facts(ctx);
  const ar = lang === 'ar';
  // Callers may pass a raw hint ('auto', a label, or nothing) — always resolve
  // through the detector so the reply still answers what the seller said.
  const knownIntent = intentHint || intent;
  const resolvedIntent = INTENT_RULES.some((rule) => rule.id === knownIntent)
    ? knownIntent
    : detectSellerIntent(sellerSpeech).id;
  const scope = repairScope(ctx);

  const bargeIn = wasBargeIn
    ? ar
      ? 'اتفضل، آسف قطعتك. '
      : 'Oh, go right ahead — sorry to cut you off. '
    : '';
  const tonePrefix =
    sellerToneId === 'defensive'
      ? ar
        ? 'فاهمك تماماً ومش هنا أضيع وقتك. '
        : 'I hear you loud and clear, and I am not here to waste your time. '
      : sellerToneId === 'hesitant'
      ? ar
        ? 'خد وقتك تماماً. '
        : 'Take all the time you need — no pressure. '
      : '';

  const noNumber = !f.complete;
  const priceRange = ar
    ? `نبدأ ${f.open} ونقدر نوصل ${f.target} صافي لو التايم لاين مناسب`
    : `we can start at ${f.open} and go up to ${f.target} net if the timeline works`;

  const choose = (variants) => variants[turn % variants.length];

  switch (resolvedIntent) {
    case 'greeting':
      return {
        intent: resolvedIntent,
        text: bargeIn + choose(
          ar
            ? [
                `أهلاً، شكراً إنك رديت. أنا من فريق الاستحواذ بخصوص ${f.addr}. ينفع دقيقتين دلوقتي؟`,
                `أهلاً بيك. بكلمك بخصوص ${f.addr} — عندك دقيقتين نتكلم في الخيارات الكاش؟`
              ]
            : [
                `Hi, thanks for picking up. This is the acquisitions team following up on ${f.addr}. Is now still a good time for two quick minutes?`,
                `Hey, thanks for taking my call. I'm calling about ${f.addr} — do you have two minutes to go over the cash options?`
              ]
        )
      };

    case 'whoIsThis':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `أنا من فريق الاستحواذ — إحنا بنشتري العقارات كاش وأس-إز. اتكلمنا قبل كده عن ${f.addr}، ومفيش أي التزام لسه. ينفع نتكلم دقيقتين؟`
          : `This is the acquisitions team — we buy properties as-is for cash. We spoke about ${f.addr}. Nothing is decided yet; I just wanted to confirm the numbers with you. Is now okay?`)
      };

    case 'priceTooLow': {
      if (noNumber) return { intent: resolvedIntent, text: bargeIn + missingNumberLine(lang) };
      return {
        intent: resolvedIntent,
        text: bargeIn + creditLine(ctx, lang) + tonePrefix + (ar
          ? `فاهمك. على حسب ${f.repairs} الشغل اللي العقار محتاجه وإحنا بنغطي مصاريف الإغلاق، ${priceRange}.`
          : `I hear you. Based on the ${f.repairs} of work the property needs and the fact that we cover closing costs, ${priceRange}.`)
      };
    }

    case 'firmPrice': {
      if (!f.complete) return { intent: resolvedIntent, text: bargeIn + missingNumberLine(lang) };
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `أحترم كلامك. كاش أس-إز، سقفي ${f.target}. ${f.asking ? `لو ${f.asking} رقم نهائي، ` : ''}الطريق الوحيد إننا ندخل في هيكل أقساط مش كاش، وده بيغير المخاطرة عليك. الأهم عندك الرقم الأعلى ولا إغلاق كاش نضيف؟`
          : `I respect that. On a straight cash, as-is basis, ${f.target} is my ceiling. ${f.asking ? `If ${f.asking} is firm, ` : ''}the only path is a payment structure instead of cash — and that shifts risk onto you. Which matters more: the top number, or a clean cash close?`)
      };
    }

    case 'askOffer': {
      if (noNumber) return { intent: resolvedIntent, text: bargeIn + missingNumberLine(lang) };
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `بصراحة: أس-إز، مصاريف الإغلاق علينا، وإغلاق ${f.closing} — ${priceRange}.`
          : `Straight answer: as-is, with closing costs on us and a ${f.closing} close, ${priceRange}.`)
      };
    }

    case 'payoff': {
      if (ar) {
        if (!f.payoff) {
          return {
            intent: resolvedIntent,
            text: bargeIn + 'المديونية مهمة جداً في الحسبة. تقدر تقولي الرقم التقريبي أو تبعتلي بيان المديونية؟ مش عايز أفترض رقم غلط.'
          };
        }
        if (f.short) {
          return {
            intent: resolvedIntent,
            text: bargeIn + `لو الباقي حوالي ${f.payoff}، رقمي ${f.target || 'الحالي'} مش بيغطيه — ناقص حوالي ${f.short}. عشان كده محتاج بيان المديونية الرسمي، ونشوف مين يغطي الفرق ده قبل أي توقيع.`
          };
        }
        return {
          intent: resolvedIntent,
          text: bargeIn + `خلينا نحط المديونية في الحسبان. لو الباقي حوالي ${f.payoff}، ${f.target ? `${f.target} بيسدده` : 'عرضنا لازم يسددها'}${f.left ? ` ويفضل لك تقريباً ${f.left} قبل مصاريف الإغلاق` : ''}. محتاج بيان المديونية الرسمي قبل أي توقيع.`
        };
      }
      if (!f.payoff) {
        return {
          intent: resolvedIntent,
          text: bargeIn + 'The payoff matters a lot in this math. Can you tell me the rough balance, or send me the payoff statement? I do not want to assume a wrong number.'
        };
      }
      if (f.short) {
        return {
          intent: resolvedIntent,
          text: bargeIn + `If the balance is about ${f.payoff}, my number at ${f.target || 'this level'} does not clear it — it is about ${f.short} short. So I need the written payoff, and we need to be honest about who covers that gap before anything is signed.`
        };
      }
      return {
        intent: resolvedIntent,
        text: bargeIn + `Let's keep the payoff in view. If the balance is about ${f.payoff}, ${f.target ? `${f.target} clears it` : 'our number has to clear it'}${f.left ? ` and leaves roughly ${f.left} before closing costs` : ''}. I'd want the written payoff before anything is signed.`
      };
    }

    case 'familyPressure': {
      const who = ar
        ? ctx.decisionMakersAr || 'أهلك'
        : ctx.decisionMakers || 'your family';
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `فاهم — ${who} شايفين إن الرقم المفروض يبقى أعلى. ده طبيعي. عندي سؤال عملي: لو ${f.target || 'عرضي'} صافي وأس-إز وإحنا بنغطي الإغلاق، ده يحل النقاش ولا لسه فيه رقم معين في دماغهم؟ ولو تحب أعمل مكالمة معاكم سوا عشان كل الأسئلة تتجاوب مرة واحدة.`
          : `Understood — ${who} think the number should be higher. That is fair. Here is the practical question: if we are at ${f.target || 'my number'} net, as-is, with closing costs on us, does that settle it, or is there a specific number they have in mind? I am happy to do a short call with all of you so nothing gets lost in translation.`)
      };
    }

    case 'zillow':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `رقم زيلو بيفترض إن ${f.repairs || 'شغل التصليحات'} متعمل وإنت بتدفع عمولات. عرضنا صافي أس-إز — بدون مصاريف ولا تصليحات ولا معاينات.`
          : `Zillow's number assumes ${f.repairs ? `the ${f.repairs} of work is already done` : 'the work is already done'} and that you pay commissions. Our number is net, as-is — no fees, no repairs, no showings.`)
      };

    case 'timeline':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `إحنا بنستخدم كاش بتاعنا، مفيش موافقات بنك. ${f.closing} واقعي${ctx.timelineSentence ? '، وده متوافق مع التايم لاين اللي ذكرته' : '، وإنت اللي تختار ميعاد الإغلاق'}.`
          : `We use our own cash, so there's no bank approval. ${f.closing} is realistic${ctx.timelineSentence ? ', which lines up with the timeline you mentioned' : ' — and you pick the closing date'}.`)
      };

    case 'foreclosure':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `مش هضيع أيام. لو ميعاد البيع حقيقي، بنفتح التايتل ونطلب البيان فوراً. ${f.target || 'الرقم اللي أقدر أدافع عنه'} ولازم يسدد المديونية.`
          : `I'm not going to waste days. If the sale date is real, we open title and request the payoff immediately. ${f.target || 'The number I can defend'} has to clear the payoff.`)
      };

    case 'probate':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `مش مستعجل، وأنا آسف على اللي بتمر بيه. سيب كل حاجة في البيت زي ما هي، والتايتل يمشي مع مواعيد المحكمة. ${f.target ? `${f.target} صافي هو اللي أقدر أوصله.` : ''}`
          : `I'm not in a hurry, and I'm sorry you're dealing with this. We can leave everything in the house, and title can work around the court timeline. ${f.target ? `${f.target} net is where I can get to.` : ''}`)
      };

    case 'tenant':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `مش محتاج تخرج المستأجر ولا تستنى انتهاء العقد. بناخد العقار بالمستأجر زي ما هو، وإحنا نتعامل مع ده بعد الإغلاق.`
          : `You don't have to evict anyone or wait for the lease. We take it with the tenant in place, as-is, and handle it after closing.`)
      };

    case 'condition':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `${mechanicsCredit(ctx, lang)}${f.repairs ? `الـ ${f.repairs} في حسبتنا لل${scope}.` : 'قولي أكتر حاجة محتاجة شغل عشان أظبط الرقم.'}`
          : `${mechanicsCredit(ctx, lang)}${f.repairs ? `The ${f.repairs} in our numbers is for ${scope}.` : 'Tell me what needs the most work and I will line the number up with that.'}`)
      };

    case 'cleanout':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `خد الصور وأي حاجة شخصية، وسيب الباقي مكانه. إحنا نتولى التنضيف بالكامل بعد الإغلاق.`
          : `Take the photos and anything personal. Leave the rest where it sits — we handle the cleanout after closing.`)
      };

    case 'thinkAboutIt':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `خد وقتك، مش هضغط عليك. أقدر أبعتلك ملخص صفحة واحدة بالأرقام مكتوبة عشان تراجعه مع ${ctx.decisionMakers.length ? 'اللي معاك' : 'نفسك'}؟ إيه أفضل إيميل؟`
          : `Take the time you need; I'm not going to pressure you. Can I send a one-page breakdown so you have the exact numbers in writing? What's the best email?`)
      };

    case 'sendInfo':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `تحت أمرك. إيه أفضل إيميل أو رقم أبعت عليه الملخص؟`
          : `Happy to. What's the best email or number for the one-page breakdown?`)
      };

    case 'busy':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `مفيش مشكلة، أكلمك تاني. أنهي وقت مناسب النهاردة أو بكرة؟`
          : `No problem at all — I can call you back. What time works better today or tomorrow?`)
      };

    case 'notInterested':
      return {
        intent: resolvedIntent,
        text: bargeIn + (ar
          ? `تمام، شكراً إنك قلتلي بصراحة. مش هضايقك تاني. لو حصل تغيير رقمي زي ما هو، وبدون أي ضغط.`
          : `Understood, and I appreciate you telling me straight. I'll leave you alone. If anything changes, my number is the same — no pressure.`)
      };

    case 'agree':
      if (f.complete) {
        return {
          intent: resolvedIntent,
          text: bargeIn + (ar
            ? `تمام. الخطوة بسيطة: أبعتلك الاتفاق صفحة واحدة، نحدد ميعاد الإغلاق، والتايتل يفتح الملف. ${f.target} صافي وإغلاق ${f.closing} مناسب؟`
            : `Great. Next step is simple: I send the one-page agreement, we pick the closing date, and title opens the file. Does ${f.target} net with a ${f.closing} close work?`)
        };
      }
      return { intent: resolvedIntent, text: bargeIn + missingNumberLine(lang) };

    case 'question':
    case 'unknown':
    default: {
      const reflect = shortQuote(sellerSpeech);
      if (ar) {
        return {
          intent: resolvedIntent,
          text: bargeIn + (reflect
            ? `تمام، سمعتك بتقول «${reflect}». عشان أفهم صح: ${f.complete ? `لو نقدر نقفل ${f.closing} بـ ${f.target} صافي وبدون تصليحات، ده يحل الموضوع؟` : 'إيه أكتر حاجة محتاجة شغل في العقار؟'}`
            : `عشان أفهم صح: إيه أكتر حاجة مهمة عندك دلوقتي — السعر، التايم لاين، ولا حالة العقار؟`)
        };
      }
      return {
        intent: resolvedIntent,
        text: bargeIn + (reflect
          ? `Got it — you said “${reflect}”. So I'm clear: ${f.complete ? `if we could close ${f.closing} at ${f.target} net with no repairs, would that solve it?` : 'what needs the most work at the property?'}`
          : `So I understand you correctly: what matters most right now — the price, the timeline, or the condition of the property?`)
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Opener, quick prompts, and safety guard for model output
// ---------------------------------------------------------------------------
export function generateCallOpener(ctx = {}, lang = 'en') {
  const f = facts(ctx);
  const ar = lang === 'ar';

  if (ctx.probate) {
    return ar
      ? `أهلاً، أنا آسف على خسارتكم. بكلمك بخصوص ${f.addr} — مش مستعجل، وعايز أعرف بس إيه أنسب تايم لاين لعيلتكم.`
      : `Hi — I'm sorry for your loss. I'm calling about ${f.addr}. There's no rush at all; I just want to understand what timeline works for your family.`;
  }
  if (ctx.auction) {
    return ar
      ? `أهلاً، بكلمك بخصوص ${f.addr}. عايز أراجع معاك التاريخ والمديونية بدقة، من غير أي ضغط، عشان تشوف كل خياراتك قبل الميعاد.`
      : `Hi, I'm calling about ${f.addr}. I want to go over the date and the payoff carefully — no pressure — so you can see every option before the deadline.`;
  }
  if (ctx.retirement) {
    return ar
      ? `أهلاً، بكلمك بخصوص ${f.addr}. سمعت إنك بتتقاعد وعايز تقفل الموضوع ببساطة — عندك دقيقتين نشوف الخيارات الكاش؟`
      : `Hi, I'm calling about ${f.addr}. I understand you're retiring and want to wrap this up simply — do you have two minutes to look at the cash options?`;
  }
  if (ctx.zillow) {
    return ar
      ? `أهلاً، بكلمك بخصوص ${f.addr}. عايز أراجع معاك أرقام السوق مقارنة بعرض كاش صافي وبدون مصاريف — دقيقتين كفاية؟`
      : `Hi, I'm calling about ${f.addr}. I'd like to compare the market numbers with a net cash offer — no fees, no repairs. Two minutes?`;
  }
  return ar
    ? `أهلاً، أنا من فريق الاستحواذ بخصوص ${f.addr}. عندك دقيقتين؟ مش هضغط عليك — عايز بس أتأكد من الأرقام والتايم لاين.`
    : `Hi, this is the acquisitions team about ${f.addr}. Do you have two minutes? I'm not going to pressure you — I just want to confirm the numbers and the timeline.`;
}

export function buildQuickPrompts(ctx = {}) {
  const f = facts(ctx);
  const scope = repairScope(ctx);
  const mechanics = [
    ctx.roofAge !== null ? `roof is ${ctx.roofAge} years old` : null,
    ctx.hvacAge !== null ? `HVAC is ${ctx.hvacAge} years old` : null
  ]
    .filter(Boolean)
    .join(' and ');

  return [
    {
      label: `⚡ Barge-in: "${f.open || '$—'} is too low!"`,
      shortLabel: '⚡ "Too low!"',
      text: `Wait hold on, ${f.open || 'that number'} is way too low for ${f.addr}.`,
      bargeIn: true
    },
    {
      label: '👋 "Hello, who is this?"',
      shortLabel: '👋 "Who is this?"',
      text: 'Hey, this is the owner. Who is this and what is this about?',
      bargeIn: false
    },
    {
      label: '🛠️ "Roof & AC are fine"',
      shortLabel: '🛠️ "Roof & AC fine"',
      text: mechanics
        ? `The ${mechanics} — those are fine, so I do not see why you are deducting for ${scope}.`
        : `The roof and AC are in good shape — I do not see why you are deducting for ${scope}.`,
      bargeIn: false
    },
    {
      label: '⏱️ Timeline question',
      shortLabel: '⏱️ "How fast?"',
      text: ctx.timelineSentence
        ? `I need to move on this. ${ctx.timelineSentence}`
        : 'How fast can you actually close if we agree on a number?',
      bargeIn: false
    },
    {
      label: '🏠 "Zillow says more"',
      shortLabel: '🏠 "Zillow says more"',
      text: `Zillow shows higher numbers around ${f.addr} — why is your offer only ${f.target || f.open || 'that'}?`,
      bargeIn: false
    },
    {
      label: '🤔 "Need to think about it"',
      shortLabel: '🤔 "Need to think"',
      text: 'Um, I am not sure. I need to think about it and talk to my family first.',
      bargeIn: false
    },
    {
      label: `💵 "I need ${f.asking || 'my price'} firm"`,
      shortLabel: '💵 "My price firm"',
      text: `I need ${f.asking || 'my full asking price'} firm, not a penny less.`,
      bargeIn: true
    },
    {
      label: '🏦 Payoff / mortgage',
      shortLabel: '🏦 "Big payoff"',
      text: f.payoff
        ? `I still owe about ${f.payoff} on it, so I need enough to clear that.`
        : 'I still have a mortgage on it, so I need enough to clear the payoff and walk away with something.',
      bargeIn: false
    }
  ];
}

const ALLOWED_NON_NUMBERS = ['14', '21', '30', '15', '25', '7'];

export function guardModelOutput(text, ctx = {}) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^(?:Agent|Me|Reply)\s*:\s*/i, '')
    .trim();
  if (cleaned.length < 8) return null;

  const allowed = [
    ctx.arv,
    ctx.repairs,
    ctx.asking,
    ctx.opening,
    ctx.target,
    ctx.walkAway,
    ctx.fee,
    ctx.payoff,
    ctx.firstPrice,
    ctx.lastPrice,
    ctx.priceDrop,
    ...(ctx.priceMentions || [])
  ].filter((n) => Number.isFinite(n));

  const matches = cleaned.match(/\$\s?[\d,]+/g) || [];
  for (const m of matches) {
    const n = Number(m.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(n)) continue;
    const ok = allowed.some((a) => Math.abs(a - n) <= 1);
    if (!ok) return null;
  }

  return cleaned;
}

export function buildGeminiPrompt({ sellerSpeech, ctx = {}, lang = 'en', wasBargeIn, toneLabel, turn, history = [] }) {
  const f = facts(ctx);
  const historyText = history
    .slice(-6)
    .map((t) => `${t.role === 'seller' ? 'Seller' : 'Agent'}: ${t.text}`)
    .join('\n');

  return `You are a live phone-call whisperer for a real-estate acquisitions agent.
Everything below is the ONLY information you may use. Never invent a number, a date, a program, or a promise.

DEAL FACTS
- Address: ${ctx.address || 'unknown'}
- Seller playbook: ${ctx.playbookLabel || 'unknown'} (${ctx.playbookTone || 'neutral'})
- Asking price: ${ctx.asking ? `$${ctx.asking}` : 'unknown'}
- ARV: ${ctx.arv ? `$${ctx.arv}` : 'unknown'}
- Repair estimate: ${ctx.repairs !== null && ctx.repairs !== undefined ? `$${ctx.repairs}` : 'unknown'}
- MAO / cash ceiling: ${ctx.target ? `$${ctx.target}` : 'unknown'}
- Opening offer: ${ctx.opening ? `$${ctx.opening}` : 'unknown'}
- Closing window: ${ctx.closingDays || 'unknown'}
- Reported payoff: ${ctx.payoff ? `$${ctx.payoff}` : 'unknown'}
- Known condition items: ${(ctx.conditionItems || []).map((i) => i.label).join(', ') || 'unknown'}
- Timeline mentioned by seller: ${ctx.timelineSentence || 'not stated'}
- Occupancy: ${ctx.occupancy || 'unknown'}

SELLER CONTEXT
- Just said: "${sellerSpeech}"
- Detected intent: ${detectSellerIntent(sellerSpeech).id}
- Detected tone: ${toneLabel || 'neutral'}
- Interrupted the agent mid-sentence: ${wasBargeIn ? 'yes' : 'no'}
- This is turn ${turn} of the current call.

RECENT CALL TRANSCRIPT (this call only)
${historyText || 'Call just started.'}

TASK
Write the exact next 1–2 spoken sentences for the agent, in ${lang === 'ar' ? 'natural Egyptian Arabic' : 'natural conversational English'}.
Rules:
- Use only the deal facts above. If the seller asks something not listed, ask a short clarifying question instead of guessing.
- Do not invent numbers or claim anything not supported above.
- Acknowledge the seller's words, then move to one clear next step.
- Output only the spoken words: no labels, quotes, or markdown.`;
}
