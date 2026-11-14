import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Lock,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { formatUSD, hasInvalidNumberChars } from '../lib/dealMath.js';

// ============================================================================
// SUB-COMPONENTS: CONFIDENCE BADGE, NUMERIC INPUT, QUICK LINKS, TOP STRIP
// ============================================================================

export function ConfidenceBadge({ status, onClick }) {
  const styles = {
    VERIFIED: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40',
    ESTIMATE: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
    UNVERIFIED: 'bg-rose-500/15 text-rose-500 border-rose-500/40'
  };
  const icons = {
    VERIFIED: <ShieldCheck className="w-3 h-3" />,
    ESTIMATE: <AlertTriangle className="w-3 h-3" />,
    UNVERIFIED: <HelpCircle className="w-3 h-3" />
  };
  const current = styles[status] ? status : 'UNVERIFIED';

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to cycle verification status (VERIFIED → ESTIMATE → UNVERIFIED)"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border transition hover:brightness-110 ${styles[current]}`}
    >
      {icons[current]}
      {current}
    </button>
  );
}

export function NumericField({ label, value, onChange, placeholder, isLight = false }) {
  const hasLetters = hasInvalidNumberChars(value);

  return (
    <div>
      <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none ${
          hasLetters
            ? 'border-rose-500 bg-rose-500/10 text-rose-500'
            : isLight
            ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
            : 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
        }`}
      />
      {hasLetters && (
        <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Numbers only
        </p>
      )}
    </div>
  );
}

export function QuickPropertyLinks({ address, isLight }) {
  const cleanAddr = (address || '').trim();

  // No address yet → no verification links. Never fall back to a demo address.
  if (cleanAddr.length < 3) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Verify:
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
            isLight
              ? 'bg-slate-100 text-slate-500 border-slate-300'
              : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
          }`}
        >
          أدخل عنوان العقار أولاً — لا روابط تحقق بدون عنوان
        </span>
      </div>
    );
  }

  const encoded = encodeURIComponent(cleanAddr);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        Verify:
      </span>
      <a
        href={`https://www.zillow.com/homes/${encoded}_rb/`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/30 hover:bg-blue-500/20 transition"
      >
        Zillow <ExternalLink className="w-2.5 h-2.5" />
      </a>
      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(cleanAddr + ' Redfin property details')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 transition"
      >
        Redfin <ExternalLink className="w-2.5 h-2.5" />
      </a>
      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(cleanAddr + ' county property appraiser tax record')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition"
      >
        County Record <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}

export function TopProcessNotification({ notification, onClose }) {
  if (!notification) return null;

  const themeMap = {
    green: {
      wrapper: 'bg-emerald-950/95 border-2 border-emerald-400 text-white shadow-2xl shadow-emerald-500/25',
      badge: 'bg-emerald-400 text-slate-950',
      badgeLabel: 'APPROVED ACTION • ALL PROCESSES VERIFIED',
      titleColor: 'text-emerald-200',
      stepBorder: 'border-emerald-500/30 bg-slate-950/80',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
    },
    orange: {
      wrapper: 'bg-amber-950/95 border-2 border-amber-400 text-white shadow-2xl shadow-amber-500/25',
      badge: 'bg-amber-400 text-slate-950',
      badgeLabel: 'MISSING PREREQUISITE • ACTION NEEDS PRIOR STEP',
      titleColor: 'text-amber-200',
      stepBorder: 'border-amber-500/30 bg-slate-950/80',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
    },
    red: {
      wrapper: 'bg-rose-950/95 border-2 border-rose-500 text-white shadow-2xl shadow-rose-500/30',
      badge: 'bg-rose-500 text-white',
      badgeLabel: 'REJECTED ACTION • BLOCKED / INVALID STATE',
      titleColor: 'text-rose-200',
      stepBorder: 'border-rose-500/40 bg-slate-950/80',
      icon: <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
    }
  };

  const theme = themeMap[notification.type] || themeMap.green;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl pointer-events-auto transition-all duration-200 print:hidden"
    >
      <div className={`rounded-2xl p-3 sm:p-3.5 backdrop-blur-md ${theme.wrapper}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {theme.icon}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${theme.badge}`}>
                  {theme.badgeLabel}
                </span>
                <span className="text-[11px] font-mono text-slate-300">
                  {notification.timestamp}
                </span>
              </div>
              <h4 className={`text-xs sm:text-sm font-extrabold mt-1 ${theme.titleColor}`}>
                {notification.title}
              </h4>
            </div>
          </div>

          <button
            type="button"
            data-skip-global-popup="true"
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shrink-0"
          >
            ✕
          </button>
        </div>

        {Array.isArray(notification.processes) && notification.processes.length > 0 && (
          <div className={`mt-2 rounded-xl p-2 border ${theme.stepBorder}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {notification.processes.map((proc, index) => {
                const statusColor =
                  proc.status === 'fail'
                    ? 'text-rose-300 bg-rose-950/60 border-rose-500/40'
                    : proc.status === 'warn'
                    ? 'text-amber-300 bg-amber-950/60 border-amber-500/40'
                    : 'text-emerald-300 bg-emerald-950/50 border-emerald-500/30';
                const statusSymbol =
                  proc.status === 'fail' ? '✕' : proc.status === 'warn' ? '⚠' : '✓';

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${statusColor}`}
                  >
                    <span className="font-extrabold font-mono text-xs shrink-0">{statusSymbol}</span>
                    <span className="truncate">{proc.step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TopCalculatorStrip({ math, isLight }) {
  const cardBg = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-zinc-900/90 border-zinc-800 shadow-xl';
  const cellBg = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-900'
    : 'bg-zinc-950/80 border-zinc-800/80 text-white';

  return (
    <section aria-label="Instant Calculator Strip" className="mb-5">
      <div className={`border rounded-2xl p-3 sm:p-4 ${cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <Lock className="w-3 h-3" /> LAYER 1 LOCKED CALCULATOR
            </span>
            <span className={`text-xs hidden sm:inline ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              MAO = <code className="font-mono font-semibold">round(ARV × {math.maoPct}% − Repairs − {formatUSD(math.fee, '$0')})</code>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {math.isEstimateOnly && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                ESTIMATE ONLY — Click Analyze to Auto-Calculate ARV & Repairs
              </span>
            )}
            {math.isAskingBelowMao && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ASKING BELOW MAO (+{formatUSD(Math.abs(math.askingMinusMao))} Instant Spread!)
              </span>
            )}
            {math.testOfferExceedsMao && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/50">
                <AlertTriangle className="w-3.5 h-3.5" />
                Test Offer ({formatUSD(math.testOffer)}) Exceeds Max Allowable!
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className={`border rounded-xl p-2.5 ${cellBg}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">ARV</div>
            <div className="text-base sm:text-lg font-extrabold mt-0.5 font-mono">
              {formatUSD(math.arv, 'Missing')}
            </div>
            <div className="text-[10px] opacity-60">Renovated Value</div>
          </div>

          <div className={`border rounded-xl p-2.5 ${cellBg}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Repairs</div>
            <div className="text-base sm:text-lg font-extrabold mt-0.5 font-mono">
              {formatUSD(math.repairs, 'Missing')}
            </div>
            <div className="text-[10px] opacity-60">Rehab Deducted</div>
          </div>

          <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl p-2.5">
            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center justify-between">
              <span>MAO ({math.maoPct}%)</span>
              <Lock className="w-3 h-3" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-500 mt-0.5 font-mono">
              {math.isComplete ? formatUSD(math.mao) : 'EST ONLY'}
            </div>
            <div className="text-[10px] text-emerald-500/80">Includes {formatUSD(math.fee)} fee</div>
          </div>

          <div className={`border rounded-xl p-2.5 ${cellBg}`}>
            <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">
              Opening (-{math.cushionPct}%)
            </div>
            <div className="text-base sm:text-lg font-extrabold text-sky-500 mt-0.5 font-mono">
              {math.isComplete ? formatUSD(math.opening) : 'EST ONLY'}
            </div>
            <div className="text-[10px] opacity-60">
              Spread: {math.isComplete ? formatUSD(math.spreadAtOpening) : '—'}
            </div>
          </div>

          <div className={`border rounded-xl p-2.5 ${cellBg}`}>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
              Target Offer
            </div>
            <div className="text-base sm:text-lg font-extrabold text-indigo-500 mt-0.5 font-mono">
              {math.isComplete ? formatUSD(math.target) : 'EST ONLY'}
            </div>
            <div className="text-[10px] opacity-60">
              Spread: {math.isComplete ? formatUSD(math.spreadAtTarget) : '—'}
            </div>
          </div>

          <div className={`border rounded-xl p-2.5 ${cellBg}`}>
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              Walk-Away Max
            </div>
            <div className="text-base sm:text-lg font-extrabold text-amber-500 mt-0.5 font-mono">
              {math.isComplete ? formatUSD(math.walkAway) : 'EST ONLY'}
            </div>
            <div className="text-[10px] opacity-60">Hard Ceiling</div>
          </div>

          <div
            className={`rounded-xl p-2.5 border ${
              math.askingMinusMao === null
                ? cellBg
                : math.isAskingBelowMao
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-500'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              Asking − MAO
            </div>
            <div className="text-base sm:text-lg font-extrabold mt-0.5 font-mono">
              {math.askingMinusMao === null
                ? '—'
                : math.askingMinusMao > 0
                ? `+${formatUSD(math.askingMinusMao)}`
                : formatUSD(math.askingMinusMao)}
            </div>
            <div className="text-[10px] opacity-80">
              {math.askingMinusMao === null
                ? 'Pending'
                : math.isAskingBelowMao
                ? 'Below MAO!'
                : 'Gap above MAO'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
