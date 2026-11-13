# 📖 دليل الاستخدام التفاعلي — Deal Analyzer v2.5

> الدليل متاح داخل التطبيق في أي وقت من زر **📖 شرح الاستخدام (عربي)** أعلى الشاشة، أو من بطاقة الدليل أسفل العمود الأيسر، أو من **More Tools**. يحتوي على تتبع تقدم محفوظ في المتصفح وأزرار تنقلك مباشرة للخطوة المناسبة.

## 1️⃣ البداية السريعة (مدخلان فقط)

1. **عنوان العقار (Property Address)** — اكتب العنوان كاملاً مع المدينة والولاية والزكود.
   - يحدد السوق تلقائياً: Tarrant/DFW، South Florida، أو السوق الوطني، ويضبط سعر القدم المربع.
2. **محادثة البايع (Seller Conversation / Call Notes)** — الصق نص المكالمة كاملاً.
   - أو اضغط **🎙️ Dictate** للتفريغ الصوتي، أو **⬆️ Audio / Upload Call Audio** لرفع تسجيل المكالمة.
   - أزرار الاختصار تضيف جمل جاهزة (Roof/AC Young، Needs Kitchen، Retiring/30d، Inherited/Probate، Behind on Payments).
3. اضغط الزر الأخضر:
   **⚡ Easy 1-Click: Auto-Calculate ARV + Rehab + Generate Script Now**
   - يحسب: ARV، Repairs، نوع البايع، MAO، Opening، Target، Walk-Away، ويكتب السكريبت بالأرقام المقفولة.

> كل الحسابات في **Layer 1** تتم بكود ثابت:
> `MAO = round(ARV × 70% − Repairs − Assignment Fee)` — لا يوجد أي انحراف حسابي من الذكاء الاصطناعي.

## 2️⃣ التحليل والسكريبت

- **شريط الأرقام المقفولة** أعلى الشاشة: ARV • Repairs • MAO • Opening • Target • Walk-Away • Asking − MAO.
  - اللون الأحمر في «Asking − MAO» يعني أن طلب البايع أعلى من سقفك.
  - رسالة **ESTIMATE ONLY** تعني أن ARV أو الصيانة ناقصة — اضغط Analyze أو أدخلهم من **Fine-Tune**.
- **Tailored Seller Script**: Opening & Rapport → Bridge → Exact Offer Delivery → 3 ردود اعتراضات → Close + Follow-up SMS، مع زر **Copy Script**.
- **Property Snapshot**: اضغط شارة التحقق لتبديلها (VERIFIED → ESTIMATE → UNVERIFIED)، واستخدم Zillow / Redfin / County Record للتأكد.

## 3️⃣ المكالمة الحية — 🎧 Live Whisperer (<15ms)

1. افتح تبويب **🎧 Live Whisperer (<15ms)**.
2. اضغط **🎧 بدء الاستماع الحي بدون زراير (Start Hands-Free)** واسمح بالميكروفون (Chrome / Edge).
3. اقرأ الجملة في المربع الأخضر **SAY THIS NOW**. النظام:
   - يتعرف على صوتك ويتجاهله،
   - يفرّق بين **توقفك المؤقت (Pause)** و**مقاطعة البايع (Barge-In)**،
   - يكتشف نبرة البايع (حاسم / متردد / مستعجل / ودود) ويقترح الرد فوراً.
4. **8 أزرار اعتراضات فورية** لأشهر اعتراضات البايع + زر **🧯 إنقاذ وتهدئة البايع فوراً**.
5. يمكنك تحريك السعر لايف أثناء المكالمة (سلايدر Opening ↔ MAO) فيُحدَّث النص فوراً.
6. بدون مفتاح Gemini يعمل محرك الرد الفوري المحلي؛ ومن **More Tools → Gemini API Key Settings** يمكن إضافة مفتاح لتحسين الصياغة.

## 4️⃣ الحفظ والتعاقد

- **💾 Save & + New** (في الهيدر أو أسفل زر التحليل): يحفظ الصفقة في History ويبدأ عقاراً جديداً فوراً.
- **Saved (n)**: يعرض الصفقات المحفوظة، مع تذكيرات متابعة (غداً / 3 أيام / أسبوع).
- **✨ Dispo & Contract**: عقد التخصيص (Assignment Contract) + رسالة المشترين (Cash Buyer SMS Blast).
- **Copy Full Package / WhatsApp** من قائمة More Tools.
- البيانات محفوظة في `localStorage` داخل متصفحك فقط.

## 5️⃣ أدوات 20x

تبويب **🚀 20x Power Tools** يشمل: تفصيل الصيانة التلقائي، Deal Score، Seller Net Sheet، Creative Finance (Sub-To / Seller Carry)، 3-Option LOI، 12-Item Rehab Checklist، Seller Net Check + Probate Split، Flip/BRRRR ROI، Comp Adjuster، 30-Day Drip، Pitch ثلاثي اللغة (EN/AR/ES)، وتصدير CRM (CSV/JSON).

---

### تشغيل المشروع

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```
