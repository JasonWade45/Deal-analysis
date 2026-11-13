import React, { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { autoCalculateArvAndRehabFromInputs, formatUSD, parseCurrencyNumber } from '../lib/dealMath.js';

// ============================================================================
// 🚀 20x ACQUISITIONS & WHOLESALING POWER FEATURES SUITE
// ============================================================================

export const INTERACTIVE_REHAB_ITEMS = [
  { id: 'roof', label: 'Roof Replacement / Shingles', defaultCost: 11500 },
  { id: 'hvac', label: 'HVAC Condenser & Furnace', defaultCost: 7500 },
  { id: 'kitchen', label: 'Kitchen Cabinets, Quartz & Appliances', defaultCost: 14000 },
  { id: 'baths', label: 'Bathrooms Tile, Vanities & Tubs (x2)', defaultCost: 8500 },
  { id: 'flooring', label: 'LVP Flooring & Baseboards Throughout', defaultCost: 6500 },
  { id: 'paint', label: 'Interior & Exterior Full Paint', defaultCost: 5500 },
  { id: 'windows', label: 'Windows & Exterior Doors Package', defaultCost: 6000 },
  { id: 'foundation', label: 'Foundation Piers / Slab Leveling', defaultCost: 12000 },
  { id: 'plumbing', label: 'Plumbing / Water Heater / Drains', defaultCost: 6500 },
  { id: 'electrical', label: 'Electrical Panel 200A & Fixtures', defaultCost: 4800 },
  { id: 'cleanout', label: 'Full Estate Dumpster Cleanout (30-Yd)', defaultCost: 3000 },
  { id: 'landscaping', label: 'Curb Appeal, Fence & Landscaping', defaultCost: 2700 }
];

export default function TwentyPowerFeaturesSuite({
  address,
  conversation,
  extraNotes,
  marketMode,
  effectiveSellerType,
  math,
  dealPackage,
  isLight,
  onApplyArvAndRepairs,
  onCopyText,
  copiedId
}) {
  const smartEstimate = useMemo(
    () =>
      autoCalculateArvAndRehabFromInputs({
        address,
        conversation,
        extraNotes,
        marketModeKey: marketMode,
        askingInput: math.asking
      }),
    [address, conversation, extraNotes, marketMode, math.asking]
  );

  const [selectedRehabIds, setSelectedRehabIds] = useState(['kitchen', 'flooring', 'paint']);
  const [mortgageBalance, setMortgageBalance] = useState('112000');
  const [backTaxesLiens, setBackTaxesLiens] = useState('3500');
  const [subToRate, setSubToRate] = useState('3.75');
  const [sellerCarryDownPct, setSellerCarryDownPct] = useState('10');
  const [sellerCarryYears, setSellerCarryYears] = useState('10');
  const [probateHeirsCount] = useState('2');
  const [pitchLanguage, setPitchLanguage] = useState('en');
  const [subjectSqft] = useState(String(smartEstimate.inferredSqft || 1600));
  const [compSqft, setCompSqft] = useState('1720');
  const [compSoldPrice, setCompSoldPrice] = useState('325000');

  const checklistTotal = useMemo(
    () =>
      INTERACTIVE_REHAB_ITEMS.filter((i) => selectedRehabIds.includes(i.id)).reduce(
        (sum, i) => sum + i.defaultCost,
        0
      ),
    [selectedRehabIds]
  );

  const arvVal = math.arv || smartEstimate.estimatedArv || 300000;
  const repairsVal = math.repairs !== null ? math.repairs : smartEstimate.estimatedRepairs || 35000;
  const maoVal = math.mao || Math.round(arvVal * 0.7 - repairsVal - (math.fee || 10000));
  const openingVal = math.opening || Math.round(maoVal * 0.91);
  const askingVal = math.asking || smartEstimate.inferredAsking || Math.round(arvVal * 0.78);

  const realtorCommission = Math.round(arvVal * 0.06);
  const retailClosingCosts = Math.round(arvVal * 0.02);
  const retailHoldingCosts = Math.round(arvVal * 0.015 * 4);
  const sellerInspectionCredits = 5500;
  const netRetailProceeds =
    arvVal - realtorCommission - retailClosingCosts - retailHoldingCosts - sellerInspectionCredits - repairsVal;

  const loanBalNum = parseCurrencyNumber(mortgageBalance) || 0;
  const liensNum = parseCurrencyNumber(backTaxesLiens) || 0;
  const totalPayoff = loanBalNum + liensNum;
  const sellerNetCashAtMao = maoVal - totalPayoff;
  const creativePurchasePrice = Math.min(Math.round(arvVal * 0.84), Math.max(askingVal, maoVal + 20000));
  const downPaymentDollars = Math.round(creativePurchasePrice * ((Number(sellerCarryDownPct) || 10) / 100));
  const financedBalance = Math.max(0, creativePurchasePrice - downPaymentDollars - loanBalNum);
  const monthlySellerNotePayment = Math.round(financedBalance / ((Number(sellerCarryYears) || 10) * 12));

  const endBuyerPrice = maoVal + (math.fee || 10000);
  const endBuyerAllIn = endBuyerPrice + repairsVal + Math.round(arvVal * 0.03);
  const endBuyerNetFlipProfit = arvVal - Math.round(arvVal * 0.07) - endBuyerAllIn;
  const endBuyerFlipRoi = endBuyerAllIn > 0 ? Math.round((endBuyerNetFlipProfit / endBuyerAllIn) * 100) : 0;
  const brrrrRefi75Ltv = Math.round(arvVal * 0.75);
  const brrrrCashLeftInDeal = Math.max(0, endBuyerAllIn - brrrrRefi75Ltv);

  const dealScore = useMemo(() => {
    let s = 68;
    if (math.isAskingBelowMao) s += 24;
    else if (math.askingMinusMao && math.askingMinusMao < 20000) s += 12;
    else if (math.askingMinusMao && math.askingMinusMao > 50000) s -= 15;
    if ((dealPackage?.conversationRead?.motivationScore || 7) >= 8) s += 10;
    return Math.max(15, Math.min(99, s));
  }, [math, dealPackage]);

  const compPpsf =
    (parseCurrencyNumber(compSoldPrice) || 325000) / Math.max(500, parseCurrencyNumber(compSqft) || 1720);
  const adjustedSubjectArv = Math.round((parseCurrencyNumber(subjectSqft) || 1600) * compPpsf);

  const threeOptionLoiText = `LETTER OF INTENT — 3 PURCHASE OPTIONS FOR ${(address || 'SUBJECT PROPERTY').toUpperCase()}

Option A — Fast All-Cash As-Is Close (14–21 Days):
• Purchase Price: ${formatUSD(maoVal)} NET to Seller
• Repairs / Cleanout: 100% As-Is (Buyer handles ${formatUSD(repairsVal)} kitchen/rehab after close)
• Closing Costs: 100% Paid by Buyer

Option B — Cash + Flexible Move-Out / Post-Occupancy:
• Purchase Price: ${formatUSD(openingVal)} NET to Seller
• Includes up to 30 days free post-closing occupancy for smooth retirement transition

Option C — Creative Seller-Carry / Terms Offer (Highest Price):
• Purchase Price: ${formatUSD(creativePurchasePrice)}
• Down Payment at Closing: ${formatUSD(downPaymentDollars)} cash + payoff of ${formatUSD(liensNum)} arrears
• Monthly Payment to Seller: ${formatUSD(monthlySellerNotePayment)}/mo for ${sellerCarryYears} years`;

  const dripSequence = [
    { day: 'Day 1 (2 hrs post-call)', msg: `Hi! Great speaking with you about ${address}. Here is our locked net cash range (${formatUSD(openingVal)}–${formatUSD(maoVal)}) taking the kitchen 100% as-is.` },
    { day: 'Day 3 (Check-in)', msg: `Quick check-in on ${address}—did you have any questions on the net-sheet vs. remodeling the kitchen yourself?` },
    { day: 'Day 7 (Timeline Value)', msg: `Hi! Our title team has an opening to close before your 30-day retirement window at ${formatUSD(maoVal)} net cash. Let me know if you want to hold that spot.` },
    { day: 'Day 14 (Creative Pivot)', msg: `Still thinking about ${address}? If ${formatUSD(maoVal)} all-cash feels tight, we can also offer ${formatUSD(creativePurchasePrice)} on simple monthly payments.` },
    { day: 'Day 30 (Final File Check)', msg: `We are finalizing our acquisitions budget for the month—is ${address} still available if we match ${formatUSD(maoVal)} net cash?` }
  ];

  const translatedPitch = {
    en: `“We gave you full credit for your 2.5-year-old HVAC and 7.5-year-old roof, and can pay ${formatUSD(maoVal)} net cash for ${address}, handling the kitchen remodel ourselves and closing within 30 days for your retirement.”`,
    ar: `«إحنا حسبنالك ميزة إن التكييف عمره سنتين ونص والسقف 7 سنين ونص، ونقدر ندفعلك ${formatUSD(maoVal)} كاش صافي لعقار ${address}، وهنتكفل بتجديد المطبخ بالكامل ونخلص الإجراءات خلال 30 يوم قبل تقاعدك.»`,
    es: `“Tomamos en cuenta que su aire acondicionado tiene 2.5 años y el techo 7.5 años, y podemos pagarle ${formatUSD(maoVal)} neto en efectivo por ${address}, encargándonos de remodelar la cocina y cerrando en menos de 30 días.”`
  };

  const wrapperCls = isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-md'
    : 'bg-zinc-900/95 border-zinc-800 text-white shadow-xl';
  const boxCls = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-zinc-950/90 border-zinc-800 text-zinc-200';

  return (
    <section className={`border rounded-2xl p-4 sm:p-6 space-y-6 ${wrapperCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500/20 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-500" /> 🚀 20x Wholesaling & Acquisitions Power Suite
          </h2>
          <p className="text-xs opacity-70 mt-0.5">
            Net Sheets, Creative Finance (Sub-To / Seller Carry), Rehab Checklist, Flip/BRRRR ROI & CRM Export.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              #1. Auto-ARV & Rehab Breakdown
            </span>
            <span className="text-[10px] font-mono opacity-70">
              ~{smartEstimate.inferredSqft} sqft × ${smartEstimate.pricePerSqft}/sf
            </span>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {smartEstimate.detectedItems.map((d, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="truncate">{d.item}</span>
                <span className={`font-mono ${d.cost === 0 ? 'text-emerald-500 font-bold' : 'text-amber-500'}`}>
                  {formatUSD(d.cost)}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              onApplyArvAndRepairs(
                String(smartEstimate.estimatedArv),
                String(smartEstimate.estimatedRepairs),
                smartEstimate.inferredAsking ? String(smartEstimate.inferredAsking) : undefined
              )
            }
            className="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
          >
            Sync {formatUSD(smartEstimate.estimatedArv)} ARV & {formatUSD(smartEstimate.estimatedRepairs)} Rehab
          </button>
        </div>

        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-500 uppercase tracking-wider">
              #11–#13. Deal Score & Structure
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-500">
              {dealScore}/100
            </span>
          </div>
          <div className="w-full bg-slate-500/20 h-2.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${dealScore}%` }} />
          </div>
          <div className="text-xs space-y-1.5">
            <p>
              <strong>#12 Dispo Strategy:</strong>{' '}
              {(math.fee || 10000) >= 20000 ? 'Double-Close recommended.' : 'Standard Assignment Agreement.'}
            </p>
            <p>
              <strong>#13 EMD & Inspection:</strong> $500–$1,000 EMD with 7-business-day inspection period.
            </p>
          </div>
        </div>

        <div className={`border rounded-xl p-4 space-y-2 ${boxCls}`}>
          <span className="text-xs font-bold text-purple-500 uppercase tracking-wider block">
            #10. Discovery Call KPI Grader
          </span>
          {[
            { label: 'Motivation Uncovered', ok: /passed|behind|tenant|move|overwhelm|leak|retir/i.test(conversation) },
            { label: 'Timeline Discussed', ok: /month|week|day|soon|1st|court|auction/i.test(conversation) },
            { label: 'Condition / Repairs Checked', ok: /roof|ac|hvac|kitchen|stuff|leak|original/i.test(conversation) },
            { label: 'Price / Payoff Anchored', ok: /\$|\d{3}|ask|take|owe|payoff/i.test(conversation) }
          ].map((kpi, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-500/10">
              <span>{kpi.label}</span>
              <span className={kpi.ok ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                {kpi.ok ? '✓ Covered' : 'Ask Seller'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 2: NET SHEET & CREATIVE FINANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider">
              #3. Side-by-Side Seller Net Sheet (Listing vs. Cash Offer)
            </h3>
            <button
              type="button"
              onClick={() =>
                onCopyText(
                  'net-sheet',
                  `SELLER NET COMPARISON (${address}):\n• Traditional Listing at ${formatUSD(arvVal)} minus 6% Realtors (-${formatUSD(realtorCommission)}), 2% Closing (-${formatUSD(retailClosingCosts)}), 4-Mo Holding (-${formatUSD(retailHoldingCosts)}), Credits (-${formatUSD(sellerInspectionCredits)}), and Rehab (-${formatUSD(repairsVal)}) = ${formatUSD(netRetailProceeds)} Net.\n• Our Direct As-Is Cash Offer = ${formatUSD(maoVal)} NET.`
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11px] font-bold"
            >
              {copiedId === 'net-sheet' ? 'Copied!' : 'Copy Net Sheet'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 space-y-1">
              <div className="font-bold text-rose-500 mb-1">RETAIL LISTING</div>
              <div className="flex justify-between"><span>ARV Price:</span><span className="font-mono">{formatUSD(arvVal)}</span></div>
              <div className="flex justify-between text-rose-500"><span>6% Realtors:</span><span className="font-mono">-{formatUSD(realtorCommission)}</span></div>
              <div className="flex justify-between text-rose-500"><span>Closing & Holding:</span><span className="font-mono">-{formatUSD(retailClosingCosts + retailHoldingCosts + sellerInspectionCredits)}</span></div>
              <div className="flex justify-between text-rose-500"><span>Rehab Cost:</span><span className="font-mono">-{formatUSD(repairsVal)}</span></div>
              <div className="border-t border-rose-500/30 pt-1 flex justify-between font-bold">
                <span>Est. Retail Net:</span>
                <span className="font-mono">{formatUSD(netRetailProceeds)}</span>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3 space-y-1">
              <div className="font-bold text-emerald-500 mb-1">OUR CASH OFFER</div>
              <div className="flex justify-between"><span>Cash Price:</span><span className="font-mono font-bold">{formatUSD(maoVal)}</span></div>
              <div className="flex justify-between text-emerald-500"><span>6% Commissions:</span><span className="font-mono">$0</span></div>
              <div className="flex justify-between text-emerald-500"><span>Closing Costs:</span><span className="font-mono">$0</span></div>
              <div className="flex justify-between text-emerald-500"><span>Kitchen Remodel:</span><span className="font-mono">$0 (As-Is)</span></div>
              <div className="border-t border-emerald-500/40 pt-1 flex justify-between font-extrabold text-emerald-500">
                <span>Cash Net:</span>
                <span className="font-mono">{formatUSD(maoVal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider">
              #4 & #5. Creative Finance + 3-Option LOI
            </h3>
            <button
              type="button"
              onClick={() => onCopyText('3-loi', threeOptionLoiText)}
              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-500 text-[11px] font-bold"
            >
              {copiedId === '3-loi' ? 'LOI Copied!' : 'Copy 3-Option LOI'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] opacity-70 block">Loan Rate %</label>
              <input
                type="text"
                value={subToRate}
                onChange={(e) => setSubToRate(e.target.value)}
                className="w-full bg-transparent border border-slate-500/30 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] opacity-70 block">Down %</label>
              <input
                type="text"
                value={sellerCarryDownPct}
                onChange={(e) => setSellerCarryDownPct(e.target.value)}
                className="w-full bg-transparent border border-slate-500/30 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] opacity-70 block">Term (Yrs)</label>
              <input
                type="text"
                value={sellerCarryYears}
                onChange={(e) => setSellerCarryYears(e.target.value)}
                className="w-full bg-transparent border border-slate-500/30 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <div className="text-[10px] text-emerald-500 font-bold">OPTION A: CASH</div>
              <div className="text-sm font-extrabold font-mono mt-0.5">{formatUSD(maoVal)}</div>
            </div>
            <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5">
              <div className="text-[10px] text-sky-500 font-bold">OPTION B: SUB-TO</div>
              <div className="text-sm font-extrabold font-mono mt-0.5">{formatUSD(totalPayoff + 15000)}</div>
            </div>
            <div className="p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
              <div className="text-[10px] text-indigo-500 font-bold">OPTION C: TERMS</div>
              <div className="text-sm font-extrabold font-mono mt-0.5">{formatUSD(creativePurchasePrice)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: REHAB CHECKLIST, PAYOFF, ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
              #6. 12-Item Rehab Checklist
            </span>
            <span className="text-xs font-mono font-bold">{formatUSD(checklistTotal)}</span>
          </div>
          <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-1">
            {INTERACTIVE_REHAB_ITEMS.map((item) => {
              const checked = selectedRehabIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-[11px] cursor-pointer border ${
                    checked ? 'bg-amber-500/15 border-amber-500/40 font-semibold' : 'border-transparent opacity-75'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedRehabIds((prev) =>
                          checked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        )
                      }
                      className="accent-amber-500"
                    />
                    {item.label}
                  </span>
                  <span className="font-mono text-amber-500">{formatUSD(item.defaultCost)}</span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onApplyArvAndRepairs(undefined, String(checklistTotal))}
            className="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Apply {formatUSD(checklistTotal)} Rehab
          </button>
        </div>

        <div className={`border rounded-xl p-4 space-y-3 ${boxCls}`}>
          <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">
            #8 & #14. Seller Net Check & Probate Split
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] opacity-70 block">Mortgage Payoff ($)</label>
              <input
                type="text"
                value={mortgageBalance}
                onChange={(e) => setMortgageBalance(e.target.value)}
                className="w-full bg-transparent border border-slate-500/30 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] opacity-70 block">Liens / Taxes ($)</label>
              <input
                type="text"
                value={backTaxesLiens}
                onChange={(e) => setBackTaxesLiens(e.target.value)}
                className="w-full bg-transparent border border-slate-500/30 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-500/20 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="opacity-75">Seller Net Walk-Away Check:</span>
              <span className="font-mono font-bold text-emerald-500">{formatUSD(sellerNetCashAtMao)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-500/20">
              <span className="opacity-75">Probate Split ({probateHeirsCount} Heirs):</span>
              <span className="font-mono text-sky-500">
                {formatUSD(Math.max(0, sellerNetCashAtMao) / Math.max(1, Number(probateHeirsCount) || 2))} / heir
              </span>
            </div>
          </div>
        </div>

        <div className={`border rounded-xl p-4 space-y-2.5 ${boxCls}`}>
          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider block">
            #9 & #18. Flip / BRRRR ROI & Comp Adjuster
          </span>
          <div className="p-2.5 rounded-lg border border-slate-500/20 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="opacity-75">End-Buyer Price (MAO + Fee):</span>
              <span className="font-mono font-bold">{formatUSD(endBuyerPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Projected Flip Profit (ROI):</span>
              <span className="font-mono font-bold text-emerald-500">
                {formatUSD(endBuyerNetFlipProfit)} ({endBuyerFlipRoi}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">BRRRR 75% LTV Cash Left:</span>
              <span className="font-mono text-sky-500">{formatUSD(brrrrCashLeftInDeal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <input
              type="text"
              value={compSoldPrice}
              onChange={(e) => setCompSoldPrice(e.target.value)}
              placeholder="Comp $"
              className="bg-transparent border border-slate-500/30 rounded px-2 py-1 text-[11px] font-mono"
            />
            <input
              type="text"
              value={compSqft}
              onChange={(e) => setCompSqft(e.target.value)}
              placeholder="Comp SF"
              className="bg-transparent border border-slate-500/30 rounded px-2 py-1 text-[11px] font-mono"
            />
            <button
              type="button"
              onClick={() => onApplyArvAndRepairs(String(adjustedSubjectArv), undefined)}
              className="bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 rounded text-[10px] font-bold px-1.5"
            >
              Use {formatUSD(adjustedSubjectArv)}
            </button>
          </div>
        </div>
      </div>

      {/* ROW 4: DRIP & TRILINGUAL PITCH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`border rounded-xl p-4 space-y-2 ${boxCls}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              #7. 30-Day Seller Follow-Up Drip
            </span>
            <button
              type="button"
              onClick={() => onCopyText('drip-seq', dripSequence.map((d) => `${d.day}: ${d.msg}`).join('\n\n'))}
              className="px-2 py-0.5 rounded bg-emerald-500/15 text-[11px] text-emerald-500 font-bold"
            >
              {copiedId === 'drip-seq' ? 'Copied!' : 'Copy All 5 Texts'}
            </button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {dripSequence.map((item, idx) => (
              <div key={idx} className="p-2 rounded-lg border border-slate-500/20 text-[11px]">
                <span className="font-bold text-amber-500">{item.day}: </span>
                <span>{item.msg}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`border rounded-xl p-4 space-y-3 flex flex-col justify-between ${boxCls}`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-500 uppercase tracking-wider">
                #17 & #19. Trilingual Pitch & CRM Export
              </span>
              <div className="flex gap-1">
                {[
                  { id: 'en', label: '🇺🇸 EN' },
                  { id: 'ar', label: '🇪🇬 AR' },
                  { id: 'es', label: '🇪🇸 ES' }
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setPitchLanguage(l.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      pitchLanguage === l.id ? 'bg-sky-500 text-slate-950' : 'border border-slate-500/30'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs p-3 rounded-lg border border-slate-500/20 italic">
              {translatedPitch[pitchLanguage]}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-500/20">
            <span className="text-[11px] font-bold opacity-75">CRM Export:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onCopyText(
                    'crm-csv',
                    `"Address","SellerType","ARV","Repairs","MAO","Opening","Asking"\n"${address}","${effectiveSellerType}","${arvVal}","${repairsVal}","${maoVal}","${openingVal}","${askingVal}"`
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-slate-500/30 text-[11px] font-semibold"
              >
                {copiedId === 'crm-csv' ? 'CSV Copied!' : 'Copy CSV'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onCopyText(
                    'crm-json',
                    JSON.stringify(
                      { address, sellerType: effectiveSellerType, arv: arvVal, repairs: repairsVal, mao: maoVal, opening: openingVal, asking: askingVal },
                      null,
                      2
                    )
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11px] font-bold"
              >
                {copiedId === 'crm-json' ? 'JSON Copied!' : 'Copy JSON'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
