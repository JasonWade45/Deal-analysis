import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Mic,
  Calculator,
  FileSignature,
  Wand2,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Lightbulb,
  ExternalLink
} from 'lucide-react';

// ============================================================================
// 📖 دليل الاستخدام التفاعلي بالعربية — INTERACTIVE ARABIC USAGE GUIDE
// - Step-by-step onboarding with persisted progress
// - Quick-action buttons that jump straight to the right tab / control
// - FAQ accordion + reset progress
// ============================================================================

const GUIDE_STORAGE_KEY = 'deal_analyzer_guide_progress_v1';
const GUIDE_AUTOSHOW_KEY = 'deal_analyzer_guide_seen_v1';

const GUIDE_SECTIONS = [
  { id: 'quickstart', label: '1️⃣ البداية السريعة', icon: Sparkles },
  { id: 'analysis', label: '2️⃣ التحليل والسكريبت', icon: Calculator },
  { id: 'live', label: '3️⃣ المكالمة الحية', icon: Mic },
  { id: 'deal', label: '4️⃣ الحفظ والتعاقد', icon: FileSignature },
  { id: 'faq', label: '5️⃣ أسئلة شائعة', icon: BookOpen }
];

const GUIDE_STEPS = [
  {
    id: 'g1',
    section: 'quickstart',
    title: 'اكتب عنوان العقار في الخانة الأولى',
    detail:
      'في العمود الأيسر (Quick Deal Input) اكتب عنوان العقار كاملاً مع المدينة والولاية والزكود، مثل: 4812 Lovell Ave, Fort Worth, TX 76107.',
    tips: ['العنوان يحدد سوق التسعير (تكساس / فلوريدا / السوق الوطني) وسعر القدم المربع تلقائياً.'],
    action: { type: 'focus-address', label: '✍️ اذهب لخانة العنوان' }
  },
  {
    id: 'g2',
    section: 'quickstart',
    title: 'الصق محادثة البايع كاملة',
    detail:
      'الصق نص المكالمة في خانة Seller Conversation / Call Notes، أو اضغط زر «🎙️ Dictate» للتفريغ الصوتي، أو «⬆️ Audio» لرفع تسجيل المكالمة.',
    tips: [
      'كل ما ذكره البايع عن السعر، الصيانة، عمر السقف والتكييف، والتايم لاين يتم استخراجه تلقائياً.',
      'أزرار الاختصار السريعة (+ Roof/AC Young، + Needs Kitchen…) تضيف جمل جاهزة للمحادثة.'
    ],
    action: { type: 'focus-conversation', label: '📋 اذهب لخانة المحادثة' }
  },
  {
    id: 'g3',
    section: 'quickstart',
    title: 'اضغط زر التحليل الواحد (Easy 1-Click)',
    detail:
      'اضغط الزر الأخضر الكبير ⚡ Easy 1-Click: Auto-Calculate ARV + Rehab + Generate Script Now. النظام يحسب الـ ARV وتكلفة الصيانة والـ MAO ويحدد نوع البايع ويكتب السكريبت بالأرقام المقفولة.',
    tips: [
      'لا يوجد أي حساب بواسطة الذكاء الاصطناعي في الأرقام — الحاسبة (Layer 1) كود ثابت لمنع أي انحراف.',
      'لو ظهرت رسالة ESTIMATE ONLY فهذا يعني أن الـ ARV أو الصيانة ناقصة؛ اضغط Analyze مرة أخرى أو أدخلهم يدوياً من «Fine-Tune».'
    ],
    action: { type: 'tab:analysis', label: '📊 افتح تبويب التحليل' }
  },
  {
    id: 'g4',
    section: 'analysis',
    title: 'راجع شريط الأرقام المقفولة أعلى الشاشة',
    detail:
      'الشريط يعرض: ARV • Repairs • MAO (70%) • Opening Offer (−cushion%) • Target • Walk-Away • Asking − MAO. أي رقم يقفز للأحمر يعني أن طلب البايع أعلى من سقفك.',
    tips: ['كل السكريبتات والأزرار تستخدم هذه الأرقام نفسها، فلا يمكن أن يختلف رقم في المكالمة عن الحاسبة.'],
    action: { type: 'tab:analysis', label: '🔒 اعرض الأرقام' }
  },
  {
    id: 'g5',
    section: 'analysis',
    title: 'اقرأ وانسخ السكريبت المخصص للبايع',
    detail:
      'في تبويب «📊 Deal Analysis & Script» ستجد: Opening & Rapport، Bridge to Offer، Exact Offer Delivery، 3 ردود على الاعتراضات، وClose + Follow-Up SMS. اضغط «Copy Script» لنسخهم كلهم.',
    tips: ['اسأل أسئلة Discovery الناقصة المذكورة في «Next 3 Actions» قبل تقديم أي رقم ملزم.'],
    action: { type: 'tab:analysis', label: '📄 افتح السكريبت' }
  },
  {
    id: 'g6',
    section: 'analysis',
    title: 'تحقق من بيانات العقار (Property Snapshot)',
    detail:
      'اضغط على شارة التحقق (VERIFIED / ESTIMATE / UNVERIFIED) لتغيير حالتها يدوياً، واستخدم أزرار Verify (Zillow / Redfin / County Record) للتأكد من المساحة وسنة البناء والضرائب.',
    tips: ['لا توقّع عقداً نهائياً قبل تحويل بيانات ARV والمساحة إلى VERIFIED.'],
    action: null
  },
  {
    id: 'g7',
    section: 'live',
    title: 'افتح تبويب 🎧 Live Whisperer (<15ms)',
    detail:
      'أثناء المكالمة الحية مع البايع، انتقل إلى تبويب «🎧 Live Whisperer (<15ms)». النظام يميز بين توقفك المؤقت (Pause) و مقاطعة البايع (Barge-In) ويقترح ردك فوراً.',
    tips: ['متاح على Chrome أو Edge لأنه يستخدم Web Speech API.'],
    action: { type: 'tab:live', label: '🎧 افتح المكالمة الحية' }
  },
  {
    id: 'g8',
    section: 'live',
    title: 'اضغط «بدء الاستماع الحي بدون زراير»',
    detail:
      'اضغط زر 🎧 بدء الاستماع الحي بدون زراير (Start Hands-Free) واسمح للمتصفح باستخدام الميكروفون. اقرأ الجملة الظاهرة في المربع الأخضر «SAY THIS NOW».',
    tips: [
      'معايرة صوتك (🎙️ معايرة وحفظ صوتي) تجعل النظام يتجاهل صوتك أنت ويلتقط صوت البايع فقط.',
      'مفتاح «Mute While I Talk» مفيد لو كنت في مكالمة سماعة خارجية.'
    ],
    action: { type: 'tab:live', label: '🎙️ ابدأ الاستماع' }
  },
  {
    id: 'g9',
    section: 'live',
    title: 'استخدم أزرار الاعتراضات الـ 8 الفورية',
    detail:
      'ثمانية أزرار جاهزة لأشهر اعتراضات البايع (السعر منخفض، سأفكر، زيلو يقول أكثر، لدي قرض…). اضغط الزر عند سماع الاعتراض ليظهر الرد التفاوضي فوراً.',
    tips: ['زر 🧯 «إنقاذ وتهدئة البايع فوراً» يوقف التصعيد ويعطيك جملة تهدئة جاهزة.'],
    action: { type: 'tab:live', label: '⚡ جرّب الأزرار الـ8' }
  },
  {
    id: 'g10',
    section: 'deal',
    title: 'احفظ الصفقة أو ابدأ صفقة جديدة',
    detail:
      'اضغط «💾 Save & + New» لحفظ الصفقة الحالية في History والبدء بعقار جديد فوراً، أو «Save Current Deal» من قائمة More Tools.',
    tips: ['بياناتك تُحفظ في متصفحك (localStorage) وتبقى بعد إغلاق الصفحة.'],
    action: { type: 'save-new', label: '💾 احفظ وابدأ جديد' }
  },
  {
    id: 'g11',
    section: 'deal',
    title: 'ولّد عقد التخصيص ورسالة المشترين',
    detail:
      'من تبويب «✨ Dispo & Contract» اضغط Assignment Contract لتوليد عقد الشراء والتخصيص بالأرقام المحسوبة، أو انسخ «Cash Buyer SMS Blast» لإرسال الصفقة لقائمة المشترين.',
    tips: ['العقد نموذج مسودة — راجعه مع محامٍ/شركة تايتل قبل التوقيع.'],
    action: { type: 'contract', label: '📝 افتح العقد' }
  },
  {
    id: 'g12',
    section: 'deal',
    title: 'أضف مفتاح Gemini (اختياري)',
    detail:
      'من More Tools → Gemini API Key Settings أضف مفتاحك لتشغيل الردود الذكية في المكالمة الحية. بدون مفتاح يعمل محرك الرد الفوري المحلي (<15ms) بنفس الأرقام المقفولة.',
    tips: ['لا تشارك مفتاحك مع أي شخص، ويُحفظ في متصفحك فقط.'],
    action: { type: 'api', label: '🔑 إعدادات المفتاح' }
  }
];

const FAQ_ITEMS = [
  {
    q: 'هل يعمل التطبيق بدون مفتاح Gemini؟',
    a: 'نعم. الحاسبة (Layer 1) وتعليمات السكريبت ومحرك الرد الفوري (Instant <15ms) وأدوات الـ 20x تعمل بالكامل بدون أي مفتاح. المفتاح الإضافي يحسّن صياغة ردود المكالمة الحية فقط.'
  },
  {
    q: 'لماذا تظهر رسالة ESTIMATE ONLY؟',
    a: 'تظهر عندما يكون الـ ARV أو تكلفة الصيانة غير مدخلين أو غير صالحين. اضغط زر Analyze Deal ليحسبهما النظام من المحادثة، أو أدخلهما يدوياً من قسم Fine-Tune ARV, Repairs & Formula Rules.'
  },
  {
    q: 'هل الأرقام تُحسب بالذكاء الاصطناعي؟',
    a: 'لا. الـ MAO والأرقام الأخرى تُحسب بكود ثابت: MAO = round(ARV × النسبة − الصيانة − رسوم التخصيص). هذا يمنع أي انحراف حسابي (LLM Math Drift).'
  },
  {
    q: 'كيف أحسب ARV إذا لم أكن أعرفه؟',
    a: 'اكتب عنوان العقار والصق المحادثة، وسيقدر النظام ARV من المساحة وسعر القدم المربع للسوق والكومبس المذكورة. ثم تحقق من 3 مبيعات حديثة عبر أزرار Zillow/Redfin/County Record قبل تقديم عرض ملزم.'
  },
  {
    q: 'الميكروفون أو التعرف على الصوت لا يعمل، ما الحل؟',
    a: 'استخدم Chrome أو Edge واسمح بإذن الميكروفون، وتأكد أن الصفحة على HTTPS أو localhost. يمكنك أيضاً تجربة الردود بكتابة كلام البايع في خانة المحاكاة أو استخدام أزرار الاعتراضات الثمانية.'
  },
  {
    q: 'أين تُحفظ الصفقات؟',
    a: 'في localStorage داخل متصفحك (History). يمكنك تصديرها كـ CSV أو JSON من تبويب 20x Power Tools، أو نسخ الحزمة الكاملة من More Tools → Copy Full Package.'
  }
];

function loadProgress() {
  try {
    const raw = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export default function ArabicGuideModal({
  isOpen,
  isLight = true,
  onClose,
  onFocusTarget,
  onGoToTab,
  onOpenContract,
  onOpenApi,
  onSaveAndNew,
  onOpenHistory
}) {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [completedSteps, setCompletedSteps] = useState(loadProgress);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [autoShow, setAutoShow] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_AUTOSHOW_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const toggleAutoShow = (checked) => {
    setAutoShow(checked);
    try {
      if (checked) localStorage.removeItem(GUIDE_AUTOSHOW_KEY);
      else localStorage.setItem(GUIDE_AUTOSHOW_KEY, '1');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(completedSteps));
    } catch {
      // ignore
    }
  }, [completedSteps, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const sectionSteps = useMemo(
    () => GUIDE_STEPS.filter((s) => s.section === activeSection),
    [activeSection]
  );

  const progressPct = Math.round((completedSteps.length / GUIDE_STEPS.length) * 100);

  const toggleStep = (id) => {
    setCompletedSteps((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const runAction = (action) => {
    if (!action) return;

    if (action.type === 'focus-address' || action.type === 'focus-conversation') {
      onClose();
      if (onFocusTarget) {
        onFocusTarget(action.type === 'focus-address' ? 'address' : 'conversation');
      }
      return;
    }

    const [kind, payload] = action.type.split(':');

    if (kind === 'focus') {
      onClose();
      if (onFocusTarget) onFocusTarget(payload);
      return;
    }
    if (kind === 'tab') {
      if (onGoToTab) onGoToTab(payload);
      onClose();
      return;
    }
    if (action.type === 'contract') {
      onClose();
      if (onOpenContract) onOpenContract();
      return;
    }
    if (action.type === 'api') {
      onClose();
      if (onOpenApi) onOpenApi();
      return;
    }
    if (action.type === 'save-new') {
      onClose();
      if (onSaveAndNew) onSaveAndNew();
      return;
    }
    if (action.type === 'history') {
      onClose();
      if (onOpenHistory) onOpenHistory();
    }
  };

  if (!isOpen) return null;

  const lightCard = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-2xl'
    : 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-2xl';
  const subCard = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-700'
    : 'bg-zinc-950 border-zinc-800 text-zinc-300';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="دليل الاستخدام التفاعلي"
        data-skip-global-popup="true"
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border-2 border-emerald-500/70 overflow-hidden ${lightCard}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-500/20 bg-emerald-500/10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base sm:text-lg font-extrabold">📖 دليل الاستخدام التفاعلي</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">
                v2.5
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
              خطوات مختصرة بالعربي: العنوان + المحادثة → تحليل فوري → سكريبت ومكالمة حية → حفظ وتعاقد.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الدليل"
            className={`p-1.5 rounded-lg border shrink-0 ${
              isLight
                ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-500/20">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              أنجزت {completedSteps.length} من {GUIDE_STEPS.length} خطوة ({progressPct}%)
            </span>
            <button
              type="button"
              onClick={() => setCompletedSteps([])}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                isLight ? 'border-slate-300 text-slate-500' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              <RotateCcw className="w-3 h-3" /> تصفير التقدم
            </button>
          </div>
          <div className="mt-1.5 w-full h-2 rounded-full bg-slate-500/20 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1.5 overflow-x-auto px-4 sm:px-5 py-2.5 border-b border-slate-500/20">
          {GUIDE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const count = GUIDE_STEPS.filter((s) => s.section === section.id).length;
            const done = GUIDE_STEPS.filter(
              (s) => s.section === section.id && completedSteps.includes(s.id)
            ).length;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap border transition ${
                  active
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                    : isLight
                    ? 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {section.label}
                {count > 0 && (
                  <span
                    className={`px-1 rounded text-[9px] font-mono ${
                      active ? 'bg-slate-950/20' : 'bg-emerald-500/15 text-emerald-500'
                    }`}
                  >
                    {done}/{count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
          {activeSection === 'faq' ? (
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, idx) => {
                const open = openFaqIndex === idx;
                return (
                  <div key={idx} className={`border rounded-xl overflow-hidden ${subCard}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(open ? -1 : idx)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-extrabold text-right"
                    >
                      <span>❓ {item.q}</span>
                      {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>
                    {open && (
                      <p className="px-3 pb-3 text-[11px] leading-relaxed opacity-90 border-t border-slate-500/20 pt-2">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenHistory) onOpenHistory();
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/40 text-xs font-extrabold"
                >
                  🗂️ افتح الصفقات المحفوظة
                </button>
                <a
                  href="https://ai.google.dev/gemini-api/docs/api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl border border-slate-500/30 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  🔑 كيف أحصل على مفتاح Gemini؟ <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <>
              {sectionSteps.map((step, idx) => {
                const done = completedSteps.includes(step.id);
                return (
                  <div
                    key={step.id}
                    className={`border rounded-xl p-3.5 transition ${
                      done
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-zinc-950/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        aria-label={done ? 'إلغاء إتمام الخطوة' : 'تحديد الخطوة كمنجزة'}
                        className="shrink-0 mt-0.5"
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Circle className={`w-5 h-5 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-extrabold">
                            {String(GUIDE_STEPS.findIndex((s) => s.id === step.id) + 1).padStart(2, '0')}
                          </span>
                          <h3 className={`text-xs sm:text-sm font-extrabold ${done ? 'line-through opacity-70' : ''}`}>
                            {step.title}
                          </h3>
                        </div>

                        <p className="text-[11px] sm:text-xs mt-1.5 leading-relaxed opacity-90">
                          {step.detail}
                        </p>

                        {step.tips?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {step.tips.map((tip, tIdx) => (
                              <div
                                key={tIdx}
                                className={`flex items-start gap-1.5 text-[10px] sm:text-[11px] leading-relaxed ${
                                  isLight ? 'text-emerald-700' : 'text-emerald-300'
                                }`}
                              >
                                <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {step.action && (
                            <button
                              type="button"
                              onClick={() => runAction(step.action)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold hover:bg-emerald-400 transition"
                            >
                              {step.action.label}
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                              done
                                ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                : isLight
                                ? 'border-slate-300 text-slate-600'
                                : 'border-zinc-700 text-zinc-400'
                            }`}
                          >
                            {done ? '✓ تمت' : 'تحديد كمنجزة'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {progressPct === 100 && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-[11px] font-bold text-emerald-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> ممتاز! أكملت دليل الاستخدام بالكامل — أنت جاهز لتحليل أول صفقة.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onFocusTarget) onFocusTarget('address');
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
                >
                  ✍️ ابدأ الآن: أدخل العنوان
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onGoToTab) onGoToTab('power20');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold border inline-flex items-center justify-center gap-1.5 ${
                    isLight ? 'border-slate-300 text-slate-700' : 'border-zinc-700 text-zinc-200'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" /> استكشف أدوات 20x
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-500/20">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold opacity-80 cursor-pointer">
            <input
              type="checkbox"
              checked={autoShow}
              onChange={(e) => toggleAutoShow(e.target.checked)}
              className="accent-emerald-500"
            />
            إظهار هذا الدليل تلقائياً عند أول زيارة
          </label>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition"
          >
            فهمت، ابدأ العمل ✓
          </button>
        </div>
      </div>
    </div>
  );
}

export { GUIDE_AUTOSHOW_KEY };
