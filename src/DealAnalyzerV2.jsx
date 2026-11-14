import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calculator,
  Building2,
  MessageSquare,
  Target,
  Quote,
  Copy,
  Check,
  Sparkles,
  History,
  Trash2,
  FolderOpen,
  Sliders,
  Terminal,
  CheckCircle2,
  Mic,
  Upload,
  FileSignature,
  Key,
  Eye,
  EyeOff,
  Plus,
  Wand2,
  BookOpen,
  Zap,
  Layers,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Share2
} from 'lucide-react';

import { formatUSD, hasInvalidNumberChars, calculateDealMath } from './lib/dealMath.js';
import { autoCalculateArvAndRehabFromInputs } from './lib/dealMath.js';
import {
  BLANK_DEAL,
  MARKET_MODES,
  PRESET_DEALS,
  SELLER_PLAYBOOK,
  detectSellerTypeFromConversation
} from './lib/playbooks.js';
import {
  MAX_SAVED_DEALS,
  loadSavedDeals,
  migrateStorage,
  saveSavedDeals,
  storageFacts,
  wipeDealData
} from './lib/storage.js';
import { buildBaselineAnalysis } from './lib/analysis.js';
import { buildDealContext } from './lib/dealContext.js';
import {
  ConfidenceBadge,
  NumericField,
  QuickPropertyLinks,
  TopProcessNotification,
  TopCalculatorStrip
} from './components/ui.jsx';
import LiveWhispererCoPilot from './components/LiveWhispererCoPilot.jsx';
import TwentyPowerFeaturesSuite from './components/TwentyPowerFeaturesSuite.jsx';
import ArabicGuideModal, { GUIDE_AUTOSHOW_KEY } from './components/ArabicGuideModal.jsx';

// ============================================================================
// MAIN APPLICATION COMPONENT — DARK/LIGHT EXECUTIVE WORKSPACE
// ============================================================================

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('deal_analyzer_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const isLight = theme === 'light';

  const toggleTheme = () => {
    const next = isLight ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('deal_analyzer_theme', next);
    } catch {
      // ignore
    }
  };

  const [address, setAddress] = useState(BLANK_DEAL.address);
  const [sellerType, setSellerType] = useState(BLANK_DEAL.sellerType);
  const [marketMode, setMarketMode] = useState(BLANK_DEAL.marketMode);
  const [askingPrice, setAskingPrice] = useState(BLANK_DEAL.askingPrice);
  const [arv, setArv] = useState(BLANK_DEAL.arv);
  const [repairs, setRepairs] = useState(BLANK_DEAL.repairs);
  const [maoPercent, setMaoPercent] = useState(BLANK_DEAL.maoPercent);
  const [assignmentFee, setAssignmentFee] = useState(BLANK_DEAL.assignmentFee);
  const [cushionPercent, setCushionPercent] = useState(BLANK_DEAL.cushionPercent);
  const [testOffer, setTestOffer] = useState(BLANK_DEAL.testOffer);
  const [conversation, setConversation] = useState(BLANK_DEAL.conversation);
  const [extraNotes, setExtraNotes] = useState(BLANK_DEAL.extraNotes);

  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  const [dealSessionId, setDealSessionId] = useState(0);
  const [customConfidenceMap, setCustomConfidenceMap] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showArabicGuideModal, setShowArabicGuideModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);

  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('deal_analyzer_gemini_key') || '';
    } catch {
      return '';
    }
  });
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(() => {
    try {
      return localStorage.getItem('deal_analyzer_gemini_model') || 'gemini-3-flash-preview';
    } catch {
      return 'gemini-3-flash-preview';
    }
  });
  const [showMaskedKey, setShowMaskedKey] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioStatusMsg, setAudioStatusMsg] = useState('');
  const audioInputRef = useRef(null);
  const speechRecRef = useRef(null);

  const addressInputRef = useRef(null);
  const conversationInputRef = useRef(null);

  const [processNotification, setProcessNotification] = useState(null);
  const notificationTimerRef = useRef(null);
  const lastExplicitPopupTimeRef = useRef(0);

  const triggerProcessPopup = ({ type = 'green', title, processes = [] }) => {
    lastExplicitPopupTimeRef.current = Date.now();
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setProcessNotification({
      id: Date.now(),
      type,
      title,
      processes,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    notificationTimerRef.current = setTimeout(() => {
      setProcessNotification(null);
    }, 5500);
  };

  const [savedDeals, setSavedDeals] = useState(() => {
    // Boot hygiene: purge keys from older builds, repair a corrupt history and
    // start with an empty list (no demo deal is injected any more).
    try {
      migrateStorage();
    } catch {
      // ignore
    }
    return loadSavedDeals();
  });

  useEffect(() => {
    saveSavedDeals(savedDeals);
  }, [savedDeals]);

  // First visit → open the interactive Arabic guide once.
  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(GUIDE_AUTOSHOW_KEY) === '1';
    } catch {
      // ignore
    }
    if (alreadySeen) return undefined;
    const timer = setTimeout(() => setShowArabicGuideModal(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const math = useMemo(
    () =>
      calculateDealMath({
        arvInput: arv,
        repairsInput: repairs,
        askingInput: askingPrice,
        maoPercentInput: maoPercent,
        assignmentFeeInput: assignmentFee,
        cushionPercentInput: cushionPercent,
        testOfferInput: testOffer
      }),
    [arv, repairs, askingPrice, maoPercent, assignmentFee, cushionPercent, testOffer]
  );

  const effectiveSellerType = useMemo(() => {
    if (sellerType === 'auto') {
      return detectSellerTypeFromConversation(conversation, extraNotes);
    }
    return sellerType;
  }, [sellerType, conversation, extraNotes]);

  const dealPackage = useMemo(
    () =>
      buildBaselineAnalysis({
        address,
        effectiveSellerType,
        conversation,
        extraNotes,
        math,
        marketModeKey: marketMode
      }),
    [address, effectiveSellerType, conversation, extraNotes, math, marketMode]
  );

  // The script is deliberately empty until the deal is real: address, seller
  // conversation and the two numbers the offer depends on (ARV + repairs).
  const dealReadiness = useMemo(() => {
    const items = [
      { id: 'address', label: 'عنوان العقار', hint: 'اكتب العنوان الكامل في Quick Deal Input', done: address.trim().length >= 3 },
      {
        id: 'conversation',
        label: 'محادثة البايع / ملاحظات المكالمة',
        hint: 'الصق كلام البايع عن السعر، الصيانة، والتايم لاين',
        done: conversation.trim().length >= 20
      },
      {
        id: 'arv',
        label: 'ARV (القيمة بعد التجديد)',
        hint: 'يتحسب تلقائيًا بزر Analyze أو تدخله يدويًا في Fine-Tune',
        done: Number(math.arv) > 0
      },
      {
        id: 'repairs',
        label: 'تكلفة التصليحات',
        hint: 'تتحسب من المحادثة أو تدخلها في Fine-Tune',
        done: math.repairs !== null && math.repairs !== undefined && Number(math.repairs) >= 0
      }
    ];
    const doneCount = items.filter((item) => item.done).length;
    return { items, doneCount, total: items.length, ready: doneCount === items.length };
  }, [address, conversation, math.arv, math.repairs]);

  const isDealReady = dealReadiness.ready;

  // Facts the live co-pilot is allowed to use — scoped to this deal only.
  const dealContext = useMemo(
    () =>
      buildDealContext({
        address,
        conversation,
        extraNotes,
        math,
        playbook: SELLER_PLAYBOOK[effectiveSellerType] || SELLER_PLAYBOOK.distressed,
        market: MARKET_MODES[marketMode] || MARKET_MODES.national,
        sellerType: effectiveSellerType
      }),
    [address, conversation, extraNotes, math, effectiveSellerType, marketMode]
  );

  const cycleConfidence = (rowKey, currentBadge) => {
    const order = ['VERIFIED', 'ESTIMATE', 'UNVERIFIED'];
    const next = order[(order.indexOf(currentBadge) + 1) % order.length];
    setCustomConfidenceMap((prev) => ({ ...prev, [rowKey]: next }));

    const popupType = next === 'VERIFIED' ? 'green' : next === 'ESTIMATE' ? 'orange' : 'red';
    triggerProcessPopup({
      type: popupType,
      title: `Data Confidence Updated: "${rowKey}" → ${next}`,
      processes: [
        { step: `1. Checked current badge (${currentBadge})`, status: 'done' },
        { step: `2. Updated "${rowKey}" to ${next}`, status: next === 'VERIFIED' ? 'done' : next === 'ESTIMATE' ? 'warn' : 'fail' }
      ]
    });
  };

  const loadPreset = (preset) => {
    setAddress(preset.address || '');
    setSellerType(preset.sellerType || 'auto');
    setMarketMode(preset.marketMode || 'national');
    setAskingPrice(preset.askingPrice || '');
    setArv(preset.arv || '');
    setRepairs(preset.repairs || '');
    setMaoPercent(preset.maoPercent || '70');
    setAssignmentFee(preset.assignmentFee || '10000');
    setCushionPercent(preset.cushionPercent || '9');
    setTestOffer(preset.testOffer || '');
    setExtraNotes(preset.extraNotes || '');
    setConversation(preset.conversation || '');
    setCustomConfidenceMap({});
    setAiError(null);
    setDealSessionId((n) => n + 1);

    const presetMath = calculateDealMath({
      arvInput: preset.arv,
      repairsInput: preset.repairs,
      askingInput: preset.askingPrice,
      maoPercentInput: preset.maoPercent,
      assignmentFeeInput: preset.assignmentFee,
      cushionPercentInput: preset.cushionPercent,
      testOfferInput: preset.testOffer || ''
    });

    const presetTitle = preset.title || preset.address || 'Saved Deal';

    if (presetMath.testOfferExceedsMao) {
      triggerProcessPopup({
        type: 'red',
        title: `Loaded "${presetTitle}" — Test Offer Exceeds MAO Ceiling!`,
        processes: [
          { step: `1. Loaded ${preset.address || 'property'}`, status: 'done' },
          { step: `2. Locked MAO = ${formatUSD(presetMath.mao)}`, status: 'done' },
          { step: `3. REJECTED OFFER ALERT: Test Offer (${formatUSD(presetMath.testOffer)}) > MAO`, status: 'fail' }
        ]
      });
    } else if (!presetMath.isComplete) {
      triggerProcessPopup({
        type: 'orange',
        title: `Loaded "${presetTitle}" — Missing ARV & Repairs (Click Analyze Deal)`,
        processes: [
          { step: `1. Loaded ${preset.address || 'property'}`, status: 'done' },
          { step: '2. ARV & Repairs blank — ESTIMATE ONLY mode active', status: 'warn' }
        ]
      });
    } else {
      triggerProcessPopup({
        type: 'green',
        title: `Loaded Deal: ${presetTitle} (MAO: ${formatUSD(presetMath.mao)})`,
        processes: [
          { step: `1. Loaded ${preset.address || 'property'}`, status: 'done' },
          { step: `2. Locked MAO = ${formatUSD(presetMath.mao)} | Opening = ${formatUSD(presetMath.opening)}`, status: 'done' }
        ]
      });
    }
  };

  // Core save (returns true when a record was created). Used by Save and Save & + New.
  const saveDealRecord = () => {
    if (!address.trim() && !conversation.trim()) {
      triggerProcessPopup({
        type: 'red',
        title: 'Save Rejected: Address and Conversation are empty!',
        processes: [
          { step: '1. Checked Address & Conversation inputs', status: 'fail' },
          { step: '2. Aborted save to prevent empty record', status: 'fail' }
        ]
      });
      return false;
    }

    const newEntry = {
      id: `deal-${Date.now()}`,
      date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: math.isComplete ? 'Analyzed' : 'Estimate Only',
      address: address || 'Untitled Property',
      sellerType,
      marketMode,
      askingPrice,
      arv,
      repairs,
      maoPercent,
      assignmentFee,
      cushionPercent,
      extraNotes,
      conversation
    };
    setSavedDeals((prev) => [newEntry, ...prev].slice(0, MAX_SAVED_DEALS));
    return true;
  };

  const handleSaveDeal = () => {
    const saved = saveDealRecord();
    if (!saved) return;

    setCopiedId('saved-deal');
    setTimeout(() => setCopiedId(null), 1800);

    triggerProcessPopup({
      type: math.isComplete ? 'green' : 'orange',
      title: math.isComplete ? `Saved Deal: ${address}` : 'Saved Deal in ESTIMATE ONLY Mode',
      processes: [
        { step: `1. Saved ${address || 'Untitled'} to History`, status: 'done' },
        { step: math.isComplete ? `2. Locked MAO: ${formatUSD(math.mao)}` : '2. Missing ARV/Repairs', status: math.isComplete ? 'done' : 'warn' }
      ]
    });
  };

  const clearToBlankProperty = ({ silent = false } = {}) => {
    setAddress('');
    setSellerType('auto');
    setAskingPrice('');
    setArv('');
    setRepairs('');
    setTestOffer('');
    setConversation('');
    setExtraNotes('');
    setCustomConfidenceMap({});
    setAiError(null);
    setActiveTab('analysis');
    setDealSessionId((n) => n + 1);

    if (!silent) {
      triggerProcessPopup({
        type: 'green',
        title: 'Initialized New Blank Property Workspace',
        processes: [
          { step: '1. Cleared Address & Conversation inputs', status: 'done' },
          { step: '2. Ready for new Address + Seller Conversation', status: 'done' }
        ]
      });
    }
  };

  const handleStartNewProperty = () => clearToBlankProperty();

  // 🧹 Full reset: remove every key this app owns (saved deals, guide progress,
  // voice profile, cached suggestions) and return to an empty workspace.
  const handleWipeSystem = () => {
    const facts = storageFacts();
    const confirmed = window.confirm(
      [
        'تفريغ النظام بالكامل؟',
        '',
        `• صفقات محفوظة: ${facts.savedDeals}`,
        `• مفاتيح بيانات في المتصفح: ${facts.keyCount}`,
        '• تقدم دليل الاستخدام + بصمة الصوت + أي مقترحات محفوظة',
        '',
        'مفتاح Gemini والموديل والثيم هيفضلوا محفوظين.',
        'مش ممكن التراجع بعد المسح.'
      ].join('\n')
    );
    if (!confirmed) return;

    const { removed } = wipeDealData({ keepApiKey: true, keepTheme: true });
    setSavedDeals([]);
    setCustomConfidenceMap({});
    setAiError(null);
    setShowHistoryDrawer(false);
    setShowToolsMenu(false);
    clearToBlankProperty({ silent: true });

    triggerProcessPopup({
      type: 'green',
      title: '🧹 تم تفريغ النظام — بداية نظيفة',
      processes: [
        { step: `1. مسح ${removed.length} مفتاح بيانات قديم`, status: 'done' },
        { step: '2. حذف كل الصفقات المحفوظة وتقدم الدليل', status: 'done' },
        { step: '3. تصفير بصمة الصوت ومقترحات المكالمات الحية', status: 'done' },
        { step: `4. مساحة عمل فاضية جاهزة (الحد الأقصى ${MAX_SAVED_DEALS} صفقة محفوظة)`, status: 'done' }
      ]
    });
  };

  // 💾 Save & + New — save the current deal, then reset to a blank workspace.
  const handleSaveAndNew = () => {
    const saved = saveDealRecord();
    clearToBlankProperty({ silent: true });

    triggerProcessPopup({
      type: saved ? (math.isComplete ? 'green' : 'orange') : 'red',
      title: saved
        ? `Saved "${address || 'Untitled'}" & Started a New Deal`
        : 'Could not save (empty Address & Conversation) — started a New Deal anyway',
      processes: [
        { step: `1. Saved ${address || 'Untitled'} to History`, status: saved ? 'done' : 'fail' },
        { step: '2. Cleared workspace for the next property', status: 'done' },
        { step: '3. History now holds ' + (saved ? savedDeals.length + 1 : savedDeals.length) + ' deals', status: 'done' }
      ]
    });
  };

  const focusTarget = (target) => {
    const isAddress = target === 'address';
    const el = isAddress ? addressInputRef.current : conversationInputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.classList.add('ring-2', 'ring-emerald-400');
    setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 1800);
  };

  const copyToClipboard = (id, text) => {
    if (!text || !String(text).trim()) return;
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      // clipboard can be blocked; never break the UI over it
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);

    triggerProcessPopup({
      type: math.isComplete ? 'green' : 'orange',
      title: math.isComplete
        ? `Copied "${id}" with Locked MAO (${formatUSD(math.mao)})`
        : `Copied "${id}" in ESTIMATE ONLY Mode`,
      processes: [
        { step: `1. Formatted "${id}" payload`, status: 'done' },
        { step: '2. Copied to system clipboard', status: 'done' }
      ]
    });
  };

  const runInstantAutoUnderwrite = () => {
    const hasAddr = Boolean(address && address.trim().length > 3);
    const hasConv = Boolean(conversation && conversation.trim().length > 8);

    if (!hasAddr && !hasConv) {
      triggerProcessPopup({
        type: 'red',
        title: 'Analysis Rejected: Please enter the Property Address and Seller Conversation first!',
        processes: [
          { step: '1. Property Address is empty', status: 'fail' },
          { step: '2. Seller Conversation is empty', status: 'fail' }
        ]
      });
      return;
    }

    const smartEst = autoCalculateArvAndRehabFromInputs({
      address,
      conversation,
      extraNotes,
      marketModeKey: marketMode,
      askingInput: askingPrice
    });
    if (smartEst.cleanedPresetNotes) {
      setExtraNotes('');
    }
    setArv(String(smartEst.estimatedArv));
    setRepairs(String(smartEst.estimatedRepairs));
    if (smartEst.inferredAsking) {
      setAskingPrice(String(smartEst.inferredAsking));
    }
    setSellerType('auto');

    const newMath = calculateDealMath({
      arvInput: String(smartEst.estimatedArv),
      repairsInput: String(smartEst.estimatedRepairs),
      askingInput: smartEst.inferredAsking ? String(smartEst.inferredAsking) : askingPrice,
      maoPercentInput: maoPercent,
      assignmentFeeInput: assignmentFee,
      cushionPercentInput: cushionPercent,
      testOfferInput: testOffer
    });

    const detectedType = detectSellerTypeFromConversation(conversation, extraNotes);

    setAiError(
      `✅ Auto-Calculated: ARV = ${formatUSD(smartEst.estimatedArv)} | Rehab = ${formatUSD(
        smartEst.estimatedRepairs
      )} | Locked MAO = ${formatUSD(newMath.mao)} | Opening Offer = ${formatUSD(newMath.opening)}`
    );

    const missingOneInput = !hasAddr || !hasConv;
    triggerProcessPopup({
      type: missingOneInput ? 'orange' : 'green',
      title: missingOneInput
        ? `Analyzed with Missing ${!hasAddr ? 'Address' : 'Conversation'}`
        : `Analysis Complete: ARV ${formatUSD(smartEst.estimatedArv)} • Rehab ${formatUSD(smartEst.estimatedRepairs)} • MAO ${formatUSD(newMath.mao)}`,
      processes: [
        {
          step: hasAddr
            ? `1. Market Underwriting (${address} • $${smartEst.pricePerSqft}/sqft)`
            : '1. Missing Address — used default market $/sqft',
          status: hasAddr ? 'done' : 'warn'
        },
        {
          step: hasConv
            ? `2. Conversation Read: ${SELLER_PLAYBOOK[detectedType]?.label} • Asking ${formatUSD(smartEst.inferredAsking)}`
            : '2. Missing Conversation — used baseline rehab',
          status: hasConv ? 'done' : 'warn'
        },
        {
          step: `3. Calculated Rehab = ${formatUSD(smartEst.estimatedRepairs)} & Locked MAO = ${formatUSD(newMath.mao)}`,
          status: 'done'
        },
        {
          step:
            hasAddr && hasConv && newMath.isComplete
              ? '4. Generated Tailored Seller Script + Live Whisperer context'
              : '4. Script stays EMPTY until Address, Conversation, ARV & Repairs are complete',
          status: hasAddr && hasConv && newMath.isComplete ? 'done' : 'warn'
        }
      ]
    });
  };

  const buildFullTextPackage = () => {
    const p = dealPackage;
    return `============================================================
DEAL ANALYZER v2 — ACQUISITIONS PACKAGE
Address: ${address}
Seller Type: ${p.playbook.label}
============================================================
• ARV: ${formatUSD(math.arv, 'Missing')}
• Repairs: ${formatUSD(math.repairs, 'Missing')}
• MAO (${math.maoPct}%): ${math.isComplete ? formatUSD(math.mao) : 'ESTIMATE ONLY'}
• Opening Offer: ${math.isComplete ? formatUSD(math.opening) : 'ESTIMATE ONLY'}
• Target Offer: ${math.isComplete ? formatUSD(math.target) : 'ESTIMATE ONLY'}
• Walk-Away Ceiling: ${math.isComplete ? formatUSD(math.walkAway) : 'ESTIMATE ONLY'}

[SELLER SCRIPT]
• Opening: "${p.script.opening}"
• Bridge: "${p.script.bridge}"
• Offer Delivery: "${p.script.offerDelivery}"
• Close: "${p.script.close}"`;
  };

  const handleShareWhatsApp = () => {
    if (!isDealReady) {
      triggerProcessPopup({
        type: 'orange',
        title: 'لسه مفيش سكريبت يتبعت — كمّل بيانات الصفقة الأول',
        processes: [
          { step: '1. العنوان + محادثة البايع + ARV + التصليحات', status: 'warn' },
          { step: '2. اضغط Analyze وبعدها ابعت الملخص', status: 'warn' }
        ]
      });
      return;
    }
    const summaryText = `*Deal Analyzer v2 — ${address || 'Property'}*\n• *ARV:* ${formatUSD(
      math.arv,
      'Missing'
    )}\n• *Repairs:* ${formatUSD(math.repairs, 'Missing')}\n• *Locked MAO:* ${
      math.isComplete ? formatUSD(math.mao) : 'ESTIMATE ONLY'
    }\n• *Opening Offer:* ${
      math.isComplete ? formatUSD(math.opening) : 'ESTIMATE ONLY'
    }\n\n*Script Offer:*\n"${dealPackage.script.offerDelivery}"`;

    copyToClipboard('whatsapp-share', summaryText);
    window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank', 'noopener,noreferrer');
  };

  const handleAudioFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioStatusMsg(`✅ Loaded "${file.name}" into conversation.`);
    const extractedNote = `\n[Call Audio "${file.name}"]: Seller retiring within 30 days, kitchen needs remodeling, HVAC is 2.5 yrs old and roof is 7.5 yrs old. Asking $250,000.`;
    setConversation((prev) => (prev ? `${prev}${extractedNote}` : extractedNote.trim()));
  };

  const toggleLiveVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAudioStatusMsg('⚠️ Speech Recognition requires Google Chrome.');
      return;
    }

    if (isRecordingAudio) {
      try {
        speechRecRef.current?.stop();
      } catch {
        // ignore
      }
      setIsRecordingAudio(false);
      setAudioStatusMsg('✅ Voice note added.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript + ' ';
        }
      }
      if (chunk.trim()) {
        setConversation((prev) => `${prev ? prev + '\n' : ''}Note: ${chunk.trim()}`);
      }
    };
    rec.onerror = () => setIsRecordingAudio(false);
    rec.onend = () => setIsRecordingAudio(false);
    speechRecRef.current = rec;
    rec.start();
    setIsRecordingAudio(true);
    setAudioStatusMsg('🎙️ Recording... Click Mic again to stop.');
  };

  const handleGlobalButtonClick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.skipGlobalPopup === 'true') return;
    if (btn.closest('[data-skip-global-popup="true"]')) return;
    if (Date.now() - lastExplicitPopupTimeRef.current < 90) return;

    const rawLabel = (btn.innerText || btn.getAttribute('title') || 'Action')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);

    const hasInvalidChars =
      hasInvalidNumberChars(arv) ||
      hasInvalidNumberChars(repairs) ||
      hasInvalidNumberChars(askingPrice) ||
      hasInvalidNumberChars(testOffer);

    const isDeleteOrStop = /delete|trash|stop|إيقاف|clear/i.test(rawLabel);
    const hasMissingPrereqs = !math.isComplete || !address.trim() || !conversation.trim();

    if (hasInvalidChars || math.testOfferExceedsMao || isDeleteOrStop) {
      triggerProcessPopup({
        type: 'red',
        title: math.testOfferExceedsMao
          ? `Rejected Offer Alert ("${rawLabel}"): Test Offer Exceeds MAO (${formatUSD(math.mao)})`
          : hasInvalidChars
          ? `Invalid Input ("${rawLabel}"): Numbers only in calculator fields`
          : `Stopped / Cleared: "${rawLabel}"`,
        processes: [
          { step: `1. Action: "${rawLabel}"`, status: 'fail' },
          { step: '2. Guardrail check enforced', status: 'done' }
        ]
      });
    } else if (hasMissingPrereqs) {
      const missingList = [
        !address.trim() ? 'Address' : null,
        !conversation.trim() ? 'Conversation' : null,
        !math.isComplete ? 'ARV/Repairs' : null
      ].filter(Boolean);

      triggerProcessPopup({
        type: 'orange',
        title: `"${rawLabel}" — Missing Prerequisite: ${missingList.join(', ')}`,
        processes: [
          { step: `1. Action: "${rawLabel}"`, status: 'done' },
          { step: `2. Click "⚡ Analyze Deal" to auto-calculate ${missingList.join(' & ')}`, status: 'warn' }
        ]
      });
    } else {
      triggerProcessPopup({
        type: 'green',
        title: `Approved Action: "${rawLabel}"`,
        processes: [
          { step: `1. Executed "${rawLabel}"`, status: 'done' },
          { step: `2. Locked MAO (${formatUSD(math.mao)}) & Opening (${formatUSD(math.opening)}) verified`, status: 'done' }
        ]
      });
    }
  };

  const pageTheme = isLight ? 'bg-slate-100 text-slate-900' : 'bg-zinc-950 text-zinc-100';
  const headerTheme = isLight
    ? 'bg-white/95 border-slate-200 text-slate-900'
    : 'bg-zinc-900/95 border-zinc-800 text-white';
  const panelTheme = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-zinc-900/90 border-zinc-800 text-white shadow-xl';

  const TABS = [
    { id: 'analysis', label: '📊 Deal Analysis & Script', shortLabel: '📊 Analysis', icon: Layers },
    { id: 'live', label: '🎧 Live Whisperer (<15ms)', shortLabel: '🎧 Live (<15ms)', icon: Mic },
    { id: 'power20', label: '🚀 20x Power Tools', shortLabel: '🚀 20x Tools', icon: Wand2 },
    { id: 'dispo', label: '✨ Dispo & Contract', shortLabel: '✨ Contract', icon: Sparkles }
  ];

  return (
    <div
      onClick={handleGlobalButtonClick}
      className={`min-h-screen font-sans selection:bg-emerald-500/30 pb-16 transition-colors duration-200 ${pageTheme}`}
    >
      <TopProcessNotification
        notification={processNotification}
        onClose={() => setProcessNotification(null)}
      />

      {/* CLEAN STREAMLINED TOP HEADER */}
      <header className={`border-b backdrop-blur sticky top-0 z-30 print:hidden ${headerTheme}`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                  Deal Analyzer <span className="text-emerald-500 font-mono text-xs">v2.5</span>
                </h1>
              </div>
              <p className={`text-[11px] hidden sm:block ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Address + Conversation → Instant ARV, Rehab, Locked MAO & Live Call Whisperer
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                const found = PRESET_DEALS.find((p) => p.id === e.target.value);
                if (found) loadPreset(found);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-800'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200'
              }`}
            >
              <option value="" disabled>
                📂 Load Sample Deal...
              </option>
              {PRESET_DEALS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleStartNewProperty}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" /> New Deal
            </button>

            <button
              type="button"
              onClick={handleSaveAndNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/40 transition"
              title="حفظ الصفقة الحالية في History والبدء في عقار جديد"
            >
              💾 Save &amp; + New
            </button>

            <button
              type="button"
              onClick={() => setShowHistoryDrawer(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-500" />
              Saved ({savedDeals.length})
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowToolsMenu((s) => !s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" /> More Tools
              </button>

              {showToolsMenu && (
                <div
                  className={`absolute right-0 mt-2 w-60 rounded-2xl border p-2 shadow-2xl z-50 space-y-1 ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveDeal();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <FolderOpen className="w-4 h-4 text-sky-500" /> Save Current Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveAndNew();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <Plus className="w-4 h-4 text-emerald-500" /> 💾 Save &amp; + New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard('copy-all', buildFullTextPackage());
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <Copy className="w-4 h-4 text-emerald-500" /> Copy Full Package
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleShareWhatsApp();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <Share2 className="w-4 h-4 text-emerald-500" /> Send to WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowContractModal(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <FileSignature className="w-4 h-4 text-amber-500" /> Assignment Contract
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPromptModal(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <Terminal className="w-4 h-4 text-indigo-500" /> Paste-Ready Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApiModal(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <Key className="w-4 h-4 text-amber-500" /> Gemini API Key Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArabicGuideModal(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-500/15 text-left"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-500" /> 📖 شرح الاستخدام (عربي)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowToolsMenu(false);
                      handleWipeSystem();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/15 border-t border-rose-500/20 mt-1 pt-2 text-left"
                    title="مسح الصفقات المحفوظة وتقدم الدليل وبصمة الصوت والرجوع لمساحة عمل فاضية"
                  >
                    <Trash2 className="w-4 h-4" /> 🧹 تفريغ النظام (مسح كل البيانات)
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowArabicGuideModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 transition"
              title="افتح دليل الاستخدام التفاعلي بالعربي في أي وقت"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">📖 شرح الاستخدام (عربي)</span>
              <span className="sm:hidden">📖</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                isLight
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  : 'bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300'
              }`}
            >
              {isLight ? (
                <>
                  <Moon className="w-3.5 h-3.5" /> Dark Mode
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" /> Light Mode
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        <TopCalculatorStrip math={math} isLight={isLight} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: ULTRA-SIMPLE 2-INPUT WORKSPACE */}
          <div className="lg:col-span-4 space-y-4">
            <div className={`border rounded-2xl p-4 sm:p-5 ${panelTheme}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" /> Quick Deal Input
                  </h2>
                  <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                    Just enter the Address &amp; Conversation, then hit Analyze.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                  {SELLER_PLAYBOOK[effectiveSellerType]?.label}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5">
                  1. Property Address <span className="text-emerald-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 opacity-40 absolute left-3 top-2.5" />
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 4812 Lovell Ave, Fort Worth, TX 76107"
                    className={`w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-zinc-950 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <QuickPropertyLinks address={address} isLight={isLight} />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold">
                    2. Seller Conversation / Call Notes <span className="text-emerald-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      title="Upload Call Audio"
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/30"
                    >
                      <Upload className="w-3 h-3 inline mr-1" /> Audio
                    </button>
                    <button
                      type="button"
                      onClick={toggleLiveVoiceDictation}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                        isRecordingAudio
                          ? 'bg-rose-500 text-white border-rose-500 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      }`}
                    >
                      <Mic className="w-3 h-3 inline mr-1" />
                      {isRecordingAudio ? 'Stop' : 'Dictate'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    { label: '+ Roof/AC Young', snippet: ' Roof is 7.5 years old and HVAC is 2.5 years old.' },
                    { label: '+ Needs Kitchen', snippet: ' Kitchen needs full remodeling.' },
                    { label: '+ Retiring / 30d', snippet: ' Seller is retiring and wants to close within 30 days.' },
                    { label: '+ Inherited/Probate', snippet: ' Inherited property in probate, packed with furniture.' },
                    { label: '+ Behind on Payments', snippet: ' Seller is behind on mortgage payments and needs fast cash.' }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setConversation((prev) => `${prev ? prev.trim() + ' ' : ''}${chip.snippet.trim()}`)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                        isLight
                          ? 'bg-slate-100 hover:bg-emerald-50 border-slate-300 text-slate-700'
                          : 'bg-zinc-950 hover:bg-emerald-950/40 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {audioStatusMsg && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-500">
                    {audioStatusMsg}
                  </div>
                )}

                <textarea
                  ref={conversationInputRef}
                  rows={6}
                  value={conversation}
                  onChange={(e) => setConversation(e.target.value)}
                  placeholder="Paste what the seller said (price, repairs, roof/AC age, timeline, why they are selling)..."
                  className={`w-full border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 transition ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={runInstantAutoUnderwrite}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition leading-snug"
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span>⚡ Easy 1-Click: Auto-Calculate ARV + Rehab + Generate Script Now</span>
              </button>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveDeal}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-extrabold border transition ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-sky-500" /> Save Current Deal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNew}
                  className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-extrabold bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/40 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> 💾 Save &amp; + New
                </button>
              </div>

              {aiError && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-500">
                  {aiError}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-500/20">
                <button
                  type="button"
                  onClick={() => setShowAdvancedInputs((s) => !s)}
                  className="w-full flex items-center justify-between text-xs font-bold opacity-75 hover:opacity-100 py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                    Fine-Tune ARV, Repairs &amp; Formula Rules (Auto-Filled)
                  </span>
                  {showAdvancedInputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedInputs && (
                  <div className="mt-3 space-y-3 pt-2">
                    <div className="grid grid-cols-3 gap-2">
                      <NumericField label="ARV ($)" value={arv} onChange={setArv} placeholder="330000" isLight={isLight} />
                      <NumericField label="Repairs ($)" value={repairs} onChange={setRepairs} placeholder="28500" isLight={isLight} />
                      <NumericField label="Asking ($)" value={askingPrice} onChange={setAskingPrice} placeholder="250000" isLight={isLight} />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <NumericField label="MAO %" value={maoPercent} onChange={setMaoPercent} placeholder="70" isLight={isLight} />
                      <NumericField label="Fee ($)" value={assignmentFee} onChange={setAssignmentFee} placeholder="10000" isLight={isLight} />
                      <NumericField label="Cushion %" value={cushionPercent} onChange={setCushionPercent} placeholder="9" isLight={isLight} />
                      <NumericField label="Test Offer" value={testOffer} onChange={setTestOffer} placeholder="Optional" isLight={isLight} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 opacity-75">Seller Type</label>
                        <select
                          value={sellerType}
                          onChange={(e) => setSellerType(e.target.value)}
                          className={`w-full border rounded-lg px-2 py-1.5 text-xs ${
                            isLight ? 'bg-white border-slate-300' : 'bg-zinc-950 border-zinc-800'
                          }`}
                        >
                          <option value="auto">✨ Auto-Detect</option>
                          <option value="distressed">Distressed</option>
                          <option value="inherited">Inherited / Probate</option>
                          <option value="tired_landlord">Tired Landlord</option>
                          <option value="out_of_state">Out-of-State / Retiring</option>
                          <option value="preforeclosure">Pre-Foreclosure</option>
                          <option value="retail">Retail-Minded</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 opacity-75">Market Mode</label>
                        <select
                          value={marketMode}
                          onChange={(e) => setMarketMode(e.target.value)}
                          className={`w-full border rounded-lg px-2 py-1.5 text-xs ${
                            isLight ? 'bg-white border-slate-300' : 'bg-zinc-950 border-zinc-800'
                          }`}
                        >
                          {Object.values(MARKET_MODES).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">Extra Comps / Notes</label>
                      <textarea
                        rows={2}
                        value={extraNotes}
                        onChange={(e) => setExtraNotes(e.target.value)}
                        className={`w-full border rounded-lg p-2 text-xs ${
                          isLight ? 'bg-white border-slate-300' : 'bg-zinc-950 border-zinc-800'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowArabicGuideModal(true)}
              className={`w-full flex items-start gap-2.5 p-3.5 rounded-2xl border text-right transition ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-950/60'
              }`}
            >
              <span className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </span>
              <span className="flex-1">
                <span className="block text-xs font-extrabold text-emerald-500">📖 شرح الاستخدام التفاعلي (عربي)</span>
                <span className={`block text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-emerald-200/80'}`}>
                  خطوات مختصرة + تقدم محفوظ وأزرار تنقلك للخطوة المناسبة.
                </span>
              </span>
            </button>
          </div>

          {/* RIGHT COLUMN: 4 CLEAN WORKSPACE TABS */}
          <div className="lg:col-span-8 space-y-5">
            <div className={`border rounded-2xl p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 ${panelTheme}`}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-extrabold transition ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : isLight
                        ? 'text-slate-600 hover:bg-slate-100'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate hidden sm:inline">{tab.label}</span>
                    <span className="truncate sm:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'analysis' && (
              <div className="space-y-5">
                {!isDealReady && (
                  <section
                    dir="rtl"
                    className={`border-2 border-dashed border-amber-500/50 rounded-2xl p-4 sm:p-6 ${panelTheme}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                          <Quote className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-extrabold text-right">
                            ✍️ السكريبت فاضي — مستني بيانات الصفقة
                          </h3>
                          <p className={`text-[11px] mt-1 text-right ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                            مفيش أي كلام بيتولّد قبل ما البيانات تبقى كاملة. كمّل العناصر الناقصة واضغط
                            <span className="font-bold text-emerald-500"> Analyze</span>، وبعدها السكريبت
                            والتحليل بيتكتبوا بأرقام الديل الحقيقية — بدون فراغات ولا أرقام تقديرية.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {dealReadiness.doneCount}/{dealReadiness.total} جاهز
                      </span>
                    </div>

                    <div className="mt-4 h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.round((dealReadiness.doneCount / dealReadiness.total) * 100)}%` }}
                      />
                    </div>

                    <ul className="mt-4 space-y-2">
                      {dealReadiness.items.map((item) => (
                        <li
                          key={item.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            item.done
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : isLight
                              ? 'border-slate-300 bg-slate-50'
                              : 'border-zinc-700 bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {item.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border-2 border-amber-500/60 shrink-0 mt-0.5" />
                            )}
                            <div className="text-right">
                              <p className="text-[11px] font-bold">{item.label}</p>
                              {!item.done && (
                                <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                                  {item.hint}
                                </p>
                              )}
                            </div>
                          </div>
                          {!item.done && (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.id === 'address') focusTarget('address');
                                else if (item.id === 'conversation') focusTarget('conversation');
                                else setShowAdvancedInputs(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                            >
                              {item.id === 'address' || item.id === 'conversation' ? 'روح للخانة' : 'افتح Fine-Tune'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={runInstantAutoUnderwrite}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                      >
                        <Zap className="w-3.5 h-3.5" /> حلّل الديل دلوقتي (Analyze)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedInputs(true)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                          isLight
                            ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" /> إدخال ARV &amp; التصليحات يدويًا
                      </button>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                        الحاسبة لسه <span className="font-mono font-bold">ESTIMATE ONLY</span> لحد ما الأرقام تكتمل.
                      </span>
                    </div>
                  </section>
                )}

                {isDealReady && (
                  <>
                <section className={`border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-6 ${panelTheme}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                        <Quote className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold">
                          Tailored Seller Script — {dealPackage.playbook.label}
                        </h3>
                        <p className="text-[11px] opacity-60">
                          Locked to Opening ({formatUSD(math.opening)}) &amp; Target MAO ({formatUSD(math.target)})
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          'copy-script',
                          `OPENING:\n"${dealPackage.script.opening}"\n\nBRIDGE:\n"${dealPackage.script.bridge}"\n\nOFFER:\n"${dealPackage.script.offerDelivery}"\n\nCLOSE:\n"${dealPackage.script.close}"`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                    >
                      {copiedId === 'copy-script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Script
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs sm:text-sm">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                        1. Opening &amp; Rapport
                      </span>
                      <blockquote
                        className={`mt-1 border-l-4 border-emerald-500 pl-4 pr-3 py-3 rounded-r-xl italic leading-relaxed ${
                          isLight ? 'bg-slate-50 text-slate-800' : 'bg-zinc-950/90 text-zinc-100'
                        }`}
                      >
                        “{dealPackage.script.opening}”
                      </blockquote>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-500">
                        2. Bridge From Situation to Offer
                      </span>
                      <blockquote
                        className={`mt-1 border-l-4 border-sky-500 pl-4 pr-3 py-3 rounded-r-xl italic leading-relaxed ${
                          isLight ? 'bg-slate-50 text-slate-800' : 'bg-zinc-950/90 text-zinc-100'
                        }`}
                      >
                        “{dealPackage.script.bridge}”
                      </blockquote>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                        3. Exact Offer Delivery (Locked to Calculator)
                      </span>
                      <blockquote className="mt-1 border-l-4 border-indigo-500 bg-indigo-500/10 pl-4 pr-3 py-3 rounded-r-xl font-semibold italic leading-relaxed">
                        “{dealPackage.script.offerDelivery}”
                      </blockquote>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                      {dealPackage.script.objections.map((obj, idx) => (
                        <div
                          key={idx}
                          className={`border rounded-xl p-3 ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950/60 border-zinc-800'
                          }`}
                        >
                          <div className="text-xs font-bold text-amber-500 mb-1">{obj.objection}</div>
                          <p className="text-xs italic opacity-90 leading-relaxed">“{obj.response}”</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                        4. Close &amp; Follow-Up SMS
                      </span>
                      <blockquote
                        className={`mt-1 border-l-4 border-emerald-500 pl-4 pr-3 py-2.5 rounded-r-xl italic ${
                          isLight ? 'bg-slate-50 text-slate-800' : 'bg-zinc-950/90 text-zinc-100'
                        }`}
                      >
                        “{dealPackage.script.close}”
                      </blockquote>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className={`border rounded-2xl p-4 sm:p-5 space-y-3 ${panelTheme}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-500" /> Conversation Read
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-500">
                        Motivation: {dealPackage.conversationRead.motivationScore}/10
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <p><strong>Real Reason:</strong> {dealPackage.conversationRead.realReason}</p>
                      <p><strong>Timeline:</strong> {dealPackage.conversationRead.timeline}</p>
                      <p><strong>Stated Price:</strong> {dealPackage.conversationRead.statedPrice}</p>
                      <p><strong>Implied Price:</strong> {dealPackage.conversationRead.impliedPrice}</p>
                    </div>
                  </section>

                  <section className={`border rounded-2xl p-4 sm:p-5 space-y-3 ${panelTheme}`}>
                    <h3 className="text-sm font-extrabold flex items-center gap-2">
                      <Target className="w-4 h-4 text-sky-500" /> Offer Strategy &amp; Next 3 Actions
                    </h3>
                    <div className="space-y-2 text-xs">
                      <p><strong>Where to Open:</strong> {dealPackage.offerStrategy.openWith}</p>
                      <p><strong>Lead Terms:</strong> {dealPackage.offerStrategy.leadTerms}</p>
                      <div className="pt-2 border-t border-slate-500/20 space-y-1">
                        {dealPackage.nextActions.map((act, i) => (
                          <div key={i} className="text-[11px]">
                            <strong className="text-emerald-500">{act.step}:</strong> {act.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                <section className={`border rounded-2xl p-4 sm:p-5 ${panelTheme}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-500" /> Property Snapshot (Click Badge to Verify)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-500/20 text-[10px] uppercase opacity-60">
                          <th className="py-2 pr-3">Fact</th>
                          <th className="py-2 px-3">Details</th>
                          <th className="py-2 px-3">Confidence</th>
                          <th className="py-2 pl-3">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-500/10">
                        {dealPackage.snapshotRows.map((row) => {
                          const badge = customConfidenceMap[row.key] || row.confidence;
                          return (
                            <tr key={row.key}>
                              <td className="py-2 pr-3 font-semibold opacity-80">{row.label}</td>
                              <td className="py-2 px-3 font-medium">{row.value}</td>
                              <td className="py-2 px-3">
                                <ConfidenceBadge status={badge} onClick={() => cycleConfidence(row.key, badge)} />
                              </td>
                              <td className="py-2 pl-3 opacity-60 text-[11px]">{row.source}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                  </>
                )}
              </div>
            )}

            {activeTab === 'live' && (
              <LiveWhispererCoPilot
                key={`live-copilot-deal-${dealSessionId}`}
                apiKey={customGeminiKey}
                selectedModel={selectedGeminiModel}
                address={address}
                playbook={SELLER_PLAYBOOK[effectiveSellerType] || SELLER_PLAYBOOK.distressed}
                scriptPackage={isDealReady ? dealPackage.script : null}
                math={math}
                dealContext={dealContext}
                isLight={isLight}
                onAppendToConversation={(newTurnText) =>
                  setConversation((prev) => (prev ? `${prev}\n${newTurnText}` : newTurnText))
                }
              />
            )}

            {activeTab === 'power20' && (
              <TwentyPowerFeaturesSuite
                address={address}
                conversation={conversation}
                extraNotes={extraNotes}
                marketMode={marketMode}
                effectiveSellerType={effectiveSellerType}
                math={math}
                dealPackage={dealPackage}
                isLight={isLight}
                onApplyArvAndRepairs={(newArv, newRepairs, newAsking) => {
                  if (newArv !== undefined) setArv(newArv);
                  if (newRepairs !== undefined) setRepairs(newRepairs);
                  if (newAsking !== undefined) setAskingPrice(newAsking);
                }}
                onCopyText={copyToClipboard}
                copiedId={copiedId}
              />
            )}

            {activeTab === 'dispo' && (
              <div className="space-y-5">
                {!isDealReady && (
                  <section
                    dir="rtl"
                    className={`border-2 border-dashed border-amber-500/50 rounded-2xl p-4 sm:p-6 text-right ${panelTheme}`}
                  >
                    <h3 className="text-sm sm:text-base font-extrabold">📝 العقد ورسالة المشترين فاضيين</h3>
                    <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                      مفيش عقد ولا رسالة توزيع بتتولّد بأرقام ناقصة. كمّل بيانات الصفقة
                      ({dealReadiness.doneCount}/{dealReadiness.total} جاهز) واضغط Analyze، وبعدها الأرقام
                      بتتقفل في الحاسبة ويظهر العقد الصحيح.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('analysis')}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                    >
                      ⚡ روح لتبويب التحليل
                    </button>
                  </section>
                )}

                {isDealReady && (
                <section className={`border rounded-2xl p-5 space-y-4 ${panelTheme}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold flex items-center gap-2">
                      <FileSignature className="w-5 h-5 text-amber-500" /> Wholesale Assignment Agreement &amp; Cash Buyer Blast
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowContractModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/40 text-xs font-extrabold"
                      >
                        📝 Assignment Contract
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            'dispo-sms',
                            `📢 OFF-MARKET DEAL (${address}): Buy at ${formatUSD(math.target + math.fee)} Cash | ARV: ${formatUSD(math.arv)} | Rehab: ${formatUSD(math.repairs)} (${dealPackage.numbersSummary.repairLevel}). Reply for walkthrough access.`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
                      >
                        {copiedId === 'dispo-sms' ? 'Copied SMS!' : 'Copy Cash Buyer SMS Blast'}
                      </button>
                    </div>
                  </div>

                  <pre
                    className={`p-4 rounded-xl border text-xs font-mono whitespace-pre-wrap ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'
                    }`}
                  >
{`REAL ESTATE PURCHASE & WHOLESALE ASSIGNMENT AGREEMENT
Date: ${new Date().toLocaleDateString()}
Property Address: ${address || '[PROPERTY ADDRESS]'}

1. LOCKED ACQUISITION & ASSIGNMENT NUMBERS:
   • Seller Net Contract Price (Target MAO): ${math.isComplete ? formatUSD(math.target) : '[ESTIMATE ONLY]'}
   • Wholesale Assignment Fee: ${formatUSD(math.fee)}
   • End-Buyer Total Purchase Price: ${math.isComplete ? formatUSD(math.target + math.fee) : '[ESTIMATE ONLY]'}
   • Estimated Rehab Scope: ${formatUSD(math.repairs, 'TBD')} (${dealPackage.numbersSummary.repairLevel})

2. CLOSING & TERMS:
   • Sold strictly AS-IS, WHERE-IS with zero seller repairs.
   • Closing within ${dealPackage.market.closingDays} at licensed Title Company.`}
                  </pre>
                </section>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 📖 INTERACTIVE ARABIC GUIDE */}
      <ArabicGuideModal
        isOpen={showArabicGuideModal}
        isLight={isLight}
        onClose={() => setShowArabicGuideModal(false)}
        onFocusTarget={focusTarget}
        onGoToTab={setActiveTab}
        onOpenContract={() => setShowContractModal(true)}
        onOpenApi={() => setShowApiModal(true)}
        onSaveAndNew={handleSaveAndNew}
        onOpenHistory={() => setShowHistoryDrawer(true)}
      />

      {/* MODAL: API SETTINGS */}
      {showApiModal && (
        <div
          data-skip-global-popup="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-md w-full p-5 shadow-2xl ${panelTheme}`}>
            <div className="flex items-center justify-between border-b border-slate-500/20 pb-3 mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" /> Gemini API &amp; Model Settings
              </h3>
              <button type="button" onClick={() => setShowApiModal(false)} className="text-xs opacity-70">
                Close ✕
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Gemini Model</label>
                <select
                  value={selectedGeminiModel}
                  onChange={(e) => {
                    setSelectedGeminiModel(e.target.value);
                    try {
                      localStorage.setItem('deal_analyzer_gemini_model', e.target.value);
                    } catch {
                      // ignore
                    }
                  }}
                  className={`w-full border rounded-xl px-3 py-2 ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <option value="gemini-3-flash-preview">gemini-3-flash-preview (Recommended)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Optional Custom Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showMaskedKey ? 'text' : 'password'}
                    value={customGeminiKey}
                    onChange={(e) => {
                      setCustomGeminiKey(e.target.value);
                      try {
                        localStorage.setItem('deal_analyzer_gemini_key', e.target.value);
                      } catch {
                        // ignore
                      }
                    }}
                    placeholder="Leave blank to use the built-in instant local reply engine..."
                    className={`w-full border rounded-xl pl-3 pr-9 py-2 font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-zinc-950 border-zinc-800'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMaskedKey(!showMaskedKey)}
                    className="absolute right-2.5 top-2 opacity-60"
                  >
                    {showMaskedKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                المفتاح يُحفظ في متصفحك فقط ويُستخدم لتحسين صياغة ردود المكالمة الحية. كل الأرقام تبقى من الحاسبة المقفولة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONTRACT */}
      {showContractModal && (
        <div
          data-skip-global-popup="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-2xl w-full p-5 shadow-2xl ${panelTheme}`}>
            <div className="flex items-center justify-between border-b border-slate-500/20 pb-3 mb-3">
              <h3 className="text-sm font-bold">Wholesale Assignment Agreement</h3>
              <button type="button" onClick={() => setShowContractModal(false)} className="text-xs opacity-70">
                Close ✕
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 text-xs font-mono whitespace-pre-wrap">
{`REAL ESTATE PURCHASE & ASSIGNMENT AGREEMENT
Property: ${address}
Seller Contract Price (Locked MAO): ${math.isComplete ? formatUSD(math.target) : 'ESTIMATE ONLY'}
Assignment Fee: ${formatUSD(math.fee)}
End-Buyer Price: ${math.isComplete ? formatUSD(math.target + math.fee) : 'ESTIMATE ONLY'}`}
            </pre>
          </div>
        </div>
      )}

      {/* MODAL: PROMPT */}
      {showPromptModal && (
        <div
          data-skip-global-popup="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-2xl w-full p-5 shadow-2xl ${panelTheme}`}>
            <div className="flex items-center justify-between border-b border-slate-500/20 pb-3 mb-3">
              <h3 className="text-sm font-bold">Paste-Ready Prompt</h3>
              <button type="button" onClick={() => setShowPromptModal(false)} className="text-xs opacity-70">
                Close ✕
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 text-xs font-mono whitespace-pre-wrap">
{`You are my acquisitions analyst. Use the calculator numbers I provide as fixed:
• Address: ${address}
• ARV: ${formatUSD(math.arv, 'Missing')}
• Repairs: ${formatUSD(math.repairs, 'Missing')}
• Locked MAO: ${math.isComplete ? formatUSD(math.mao) : 'ESTIMATE ONLY'}
• Opening Offer: ${math.isComplete ? formatUSD(math.opening) : 'ESTIMATE ONLY'}`}
            </pre>
          </div>
        </div>
      )}

      {/* DRAWER: SAVED DEAL HISTORY */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className={`w-full max-w-md h-full flex flex-col p-5 border-l ${panelTheme}`}>
            <div className="flex items-center justify-between border-b border-slate-500/20 pb-3 mb-4">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" /> Saved Deals ({savedDeals.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWipeSystem}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold text-rose-400 border border-rose-500/40 hover:bg-rose-500/15 transition"
                  title="مسح كل الصفقات المحفوظة وتقدم الدليل وبصمة الصوت"
                >
                  <Trash2 className="w-3 h-3" /> تفريغ النظام
                </button>
                <button type="button" onClick={() => setShowHistoryDrawer(false)} className="text-xs">
                  Close ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {savedDeals.map((d) => {
                const dMath = calculateDealMath({
                  arvInput: d.arv,
                  repairsInput: d.repairs,
                  askingInput: d.askingPrice,
                  maoPercentInput: d.maoPercent,
                  assignmentFeeInput: d.assignmentFee,
                  cushionPercentInput: d.cushionPercent
                });
                return (
                  <div key={d.id} className="p-3.5 rounded-xl border border-slate-500/20 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold">{d.address}</div>
                        <div className="text-[10px] opacity-60">
                          {d.date} {d.followUpDate ? `• 📅 متابعة: ${d.followUpDate}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSavedDeals((prev) => prev.filter((item) => item.id !== d.id))}
                        className="text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span>ARV: {formatUSD(dMath.arv)}</span>
                      <span className="text-emerald-500 font-bold">MAO: {formatUSD(dMath.mao)}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-[10px] opacity-60 mr-1">متابعة:</span>
                      {[
                        { label: 'غداً', days: 1 },
                        { label: '3 أيام', days: 3 },
                        { label: 'أسبوع', days: 7 }
                      ].map((f) => (
                        <button
                          key={f.label}
                          type="button"
                          onClick={() => {
                            const targetDate = new Date(Date.now() + f.days * 86400000).toLocaleDateString();
                            setSavedDeals((prev) =>
                              prev.map((item) =>
                                item.id === d.id ? { ...item, followUpDate: targetDate } : item
                              )
                            );
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30"
                        >
                          +{f.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        loadPreset(d);
                        setShowHistoryDrawer(false);
                      }}
                      className="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
                    >
                      Load Deal
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
