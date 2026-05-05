# Competitive Analysis: Audio Transcription Market

**Status:** Research Complete
**Created:** 2026-05-05
**Last Updated:** 2026-05-05

---

## Executive Summary

The audio transcription market is highly competitive with players across four main segments:

1. **Consumer AI Tools** (Otter.ai, Temi) - Optimized for meetings, interviews, ease of use
2. **Professional Services** (Rev, Trint) - High accuracy, human review, journalism/media focus
3. **Developer APIs** (AssemblyAI, Deepgram) - Build-your-own solutions, volume pricing
4. **Academic/Research Tools** (Whisper, NoScribe) - Privacy-focused, offline, qualitative analysis

**Market gap identified:** Affordable, privacy-focused transcription with speaker diarization for **researchers and interview-based workflows** (journalists, academics, qualitative researchers) who need **better than consumer tools** but **cheaper than professional services**.

---

## 1. Market Segmentation

### 1.1 Consumer AI Tools (Meeting-Focused)

| Service | Pricing | Target User | Key Features |
|---------|---------|-------------|--------------|
| **Otter.ai** | Free, $8.33-30/mo | Meeting notes, professionals | Real-time transcription, AI meeting bot, calendar integration |
| **Temi** | $0.25/min ($15/hr) | Quick one-off transcripts | Pay-as-you-go, fast turnaround, simple editor |
| **Descript** | Free (1 hr/mo), $30/mo | Content creators, podcasters | Video/audio editing, AI voice cloning, filler word removal |

**Strengths:**
- Easy to use, no technical knowledge required
- Real-time features (Otter meeting bot)
- Affordable for occasional use

**Weaknesses:**
- Limited speaker diarization quality
- Not designed for long interviews
- Privacy concerns (cloud-based processing)
- No batch processing

---

### 1.2 Professional Services (Accuracy-Focused)

| Service | Pricing | Target User | Key Features |
|---------|---------|-------------|--------------|
| **Rev.com** | AI: $0.25/min, Human: $1.50/min | Journalists, legal, medical | 99% accuracy (human), fast turnaround, captions |
| **Trint** | $52-100/mo per seat | Newsrooms, media organizations | 30+ languages, live transcription, collaborative editing |
| **Scribie** | AI: $0.10/min, Human: $0.80/min | Professional transcription | 4-step review process, 99%+ accuracy, accent handling |
| **Happy Scribe** | $17-49/mo (120-600 min) | Professional users | Tiered plans, human + AI options, subtitles |

**Strengths:**
- Very high accuracy (especially human transcription)
- Support for multiple languages and accents
- Professional features (timestamps, formatting)
- Compliance (SOC2, GDPR)

**Weaknesses:**
- Expensive ($0.72-1.50/min for human)
- Subscription models lock you into monthly costs
- Not self-hosted (privacy for sensitive interviews)
- Per-minute pricing adds up for long files

---

### 1.3 Developer APIs (Build-Your-Own)

| Service | Pricing | Target User | Key Features |
|---------|---------|-------------|--------------|
| **AssemblyAI** | $0.15/hr base, +$0.02/hr diarization | Developers, app builders | 99 languages, $50 free credits, LeMUR AI summaries |
| **Deepgram** | $0.26/hr ($0.0043/min) | Developers, high-volume | Nova-3 accuracy, streaming + batch, $200 free credits |
| **Google Speech-to-Text** | Tiered (volume-based) | Enterprise developers | 125+ languages, phone call models, AutoML |
| **Amazon Transcribe** | $0.024-0.0102/min (tiered) | AWS ecosystem users | Medical/call center specialization, custom vocabulary |
| **Azure Speech Services** | Tiered pricing | Microsoft ecosystem | Custom models, real-time + batch, HIPAA compliance |

**Strengths:**
- Very cheap at scale ($0.15-0.26/hr vs. $9-90/hr consumer)
- Full control over implementation
- Can self-host (some models)
- Good documentation and SDKs

**Weaknesses:**
- Requires technical expertise
- No UI out of the box
- Need to build entire workflow
- Integration effort

---

### 1.4 Academic/Research Tools (Privacy-Focused)

| Service | Pricing | Target User | Key Features |
|---------|---------|-------------|--------------|
| **Whisper (OpenAI)** | Free (self-hosted) | Researchers, privacy-conscious | Open source, offline, 99 languages, local processing |
| **NoScribe** | Free (open source) | Qualitative researchers | Speaker diarization, 60+ languages, offline |
| **NVivo/MAXQDA** | Software license + add-ons | Academic researchers | Integrated with QDA tools, limited free transcription hours |
| **Sonix** | $10/hr (academic pricing) | Researchers | 53+ languages, 99% accuracy, research-friendly features |

**Strengths:**
- Privacy (offline/local processing)
- Free or low cost
- Integration with analysis tools (NVivo, ATLAS.ti)
- Open source (Whisper, NoScribe)

**Weaknesses:**
- Technical setup required (Whisper, NoScribe)
- No UI/UX polish
- Limited support
- Still need to build speaker identification workflows

---

## 2. Pricing Analysis

### 2.1 Pricing Models Comparison

| Model | Examples | Best For | Pros | Cons |
|-------|----------|----------|------|------|
| **Pay-as-you-go** | Temi ($0.25/min), Rev AI ($0.25/min) | Occasional users | No commitment, predictable | Adds up quickly for heavy use |
| **Monthly subscription** | Otter ($8-30/mo), Happy Scribe ($17-49/mo) | Regular users | Predictable cost, unlimited in tier | Pay even if you don't use |
| **Per-seat enterprise** | Trint ($52-100/seat) | Teams, organizations | Collaboration features | Very expensive, commitment |
| **API/volume-based** | AssemblyAI ($0.15/hr), Deepgram ($0.26/hr) | Developers, high volume | Cheap at scale | Requires dev work |
| **One-time + subscription** | Descript ($30/mo for 30 hrs) | Content creators | Flexibility | Overage charges |
| **Free + paid tiers** | Otter (free + paid) | Freemium users | Try before buy | Limited free features |

### 2.2 Cost Comparison (1 hour of audio)

| Service | Cost (1 hour) | Cost (10 hours/mo) | Cost (50 hours/mo) |
|---------|---------------|--------------------|--------------------|
| **Temi** | $15 | $150 | $750 |
| **Rev AI** | $15 | $150 | $750 |
| **Rev Human** | $90 | $900 | $4,500 |
| **Otter Pro** | ~$8.33/mo (unlimited) | $8.33/mo | $8.33/mo |
| **Happy Scribe Basic** | ~$8.50 (2 hrs included in $17 plan) | $17/mo (limited) | $49/mo (12 hrs) + overage |
| **Trint** | Included in $52-100/mo | $52-100/mo | $52-100/mo |
| **AssemblyAI** | $0.15 | $1.50 | $7.50 |
| **Deepgram** | $0.26 | $2.60 | $13 |
| **Whisper (self-hosted)** | Free (hardware cost) | Free | Free |
| **Your App (proposed)** | $15 (30-day pass) or $9/mo | $9/mo | $9/mo |

### 2.3 Pricing Insights

**Key findings:**
1. **Pay-per-minute is expensive**: $0.25/min = $15/hr adds up to $750/mo for 50 hours
2. **Subscriptions are cost-effective**: If you process >2 hours/month, Otter Pro ($8.33/mo) beats pay-per-use
3. **APIs are cheapest**: AssemblyAI ($0.15/hr) is 100x cheaper than Rev AI, but requires dev work
4. **Free tiers exist**: Otter (300 min/mo free), AssemblyAI ($50 credits), Deepgram ($200 credits)
5. **Human transcription is premium**: 5-20x more expensive than AI

---

## 3. Feature Comparison

### 3.1 Core Transcription Features

| Feature | Consumer Tools | Professional | Developer APIs | Academic |
|---------|----------------|--------------|----------------|----------|
| **Accuracy** | 85-95% | 95-99% (human) | 90-95% | 90-95% |
| **Languages** | 30-50 | 50+ | 99-125+ | 60-99 |
| **Speaker diarization** | Basic (2-3 speakers) | Advanced (10+ speakers) | Advanced (30+ speakers) | Basic-Advanced |
| **Real-time** | Yes (Otter, Fireflies) | Yes (Trint) | Yes (Deepgram streaming) | No |
| **Batch processing** | Limited | Yes | Yes | Yes |
| **Custom vocabulary** | No | Limited | Yes | Limited |
| **Timestamps** | Yes | Yes | Yes | Yes |
| **Export formats** | TXT, DOCX, SRT | TXT, DOCX, SRT, PDF | JSON, TXT, SRT | TXT, DOCX |

### 3.2 Privacy & Security

| Service | Data Location | Encryption | Compliance | Self-hosting |
|---------|--------------|------------|------------|--------------|
| **Otter.ai** | Cloud (US) | In transit/rest | SOC2 | No |
| **Rev** | Cloud (US) | In transit/rest | SOC2, HIPAA (add-on) | No |
| **Trint** | Cloud (UK/US) | In transit/rest | GDPR | No |
| **AssemblyAI** | Cloud (US) | In transit/rest | SOC2, GDPR | No |
| **Whisper** | Local | N/A (offline) | Full control | Yes |
| **Your App** | **Self-hosted or cloud** | **Full control** | **Custom** | **Yes** |

**Market opportunity:** Most services are cloud-only. Self-hosted option is a differentiator for:
- Academic researchers (IRB requirements)
- Journalists (source protection)
- Legal/medical (confidentiality)
- International users (data sovereignty)

### 3.3 Workflow Features

| Feature | Consumer | Professional | Developer | Academic | Your App |
|---------|----------|--------------|-----------|----------|----------|
| Meeting bot integration | ✅ Otter | ❌ | ❌ | ❌ | ❌ |
| Live transcription | ✅ Otter, Trint | ✅ Trint | ✅ Deepgram | ❌ | ⚠️ Future |
| Collaborative editing | ✅ Otter | ✅ Trint | ❌ | ❌ | ⚠️ Phase 4+ |
| Video editing | ✅ Descript | ❌ | ❌ | ❌ | ❌ |
| AI summaries | ✅ Otter | ❌ | ✅ AssemblyAI LeMUR | ❌ | ⚠️ Future |
| Speaker name assignment | Manual | Manual | Manual | Manual | **✅ UI-assisted** |
| Batch upload | Limited | ✅ | ✅ | ✅ | **✅** |
| Desktop app | ❌ | ❌ | ❌ | ✅ Whisper | ⚠️ Phase 5+ |

---

## 4. Competitive Positioning

### 4.1 Where Your App Fits

```
              High Price ($50-100/mo)
                        │
                   Trint │ Rev Human
                        │
              ──────────┼──────────────
                        │
           Happy Scribe │ Otter Pro
                        │
              ──────────┼────────────── Medium Price ($10-30/mo)
                        │
                        │ ★ YOUR APP
                        │   ($9/mo or $15/30 days)
              ──────────┼──────────────
                        │
            Rev AI/Temi │ Sonix
             ($15/hour) │
                        │
              ──────────┼────────────── Low Price (<$10/mo)
                        │
               Otter Free│ Whisper (free)
                        │
              Low Features ──────────── High Features
```

**Your positioning:**
- **Price:** Between free tools (Otter Free, Whisper) and professional services (Rev, Trint)
- **Features:** Better than free tools (speaker ID UI, batch processing) but simpler than enterprise (no collaboration)
- **Target:** Solo researchers, journalists, students who need quality but can't afford $50-100/mo

### 4.2 Competitive Advantages (Your App)

| Advantage | Differentiator | vs. Competitors |
|-----------|----------------|-----------------|
| **1. Self-hosting option** | Run locally with GPU or on private server | Whisper (tech-heavy) vs. cloud services (privacy concerns) |
| **2. Speaker identification UI** | Easy UI to assign names after transcription | Most tools require manual editing in text |
| **3. Domain whitelist** | Free access for educational institutions | Only some offer academic discounts |
| **4. Flexible pricing** | One-time 30 days OR subscription | Most force subscription or pay-per-minute |
| **5. No lock-in** | Export to standard formats, own your data | Some services have proprietary formats |
| **6. Open architecture** | Built on WhisperX (open source) | Proprietary models (Rev, Otter, Trint) |

### 4.3 Competitive Weaknesses (What You DON'T Have)

| Weakness | Impact | Mitigation Strategy |
|----------|--------|---------------------|
| **No real-time transcription** | Can't transcribe live meetings | Focus on batch/upload workflow (Phase 1-3) |
| **No meeting bot** | Can't auto-join Zoom/Teams | Not our target market (researchers upload recordings) |
| **No video editing** | Can't compete with Descript | Different use case (transcription, not production) |
| **No human review option** | Can't match Rev's 99% accuracy | Emphasize "good enough" AI + cheaper price |
| **Limited languages (MVP)** | Only ES/EN initially | Add more languages in Phase 7+ |
| **No mobile app** | Desktop/web only | Most interviews are processed on desktop anyway |

---

## 5. Market Opportunities

### 5.1 Underserved Segments

**1. Academic Researchers (Qualitative)**
- **Pain point:** Need privacy (IRB requirements), can't use cloud services
- **Current solution:** Manual transcription or expensive Trint
- **Your advantage:** Self-hosted + domain whitelist for universities

**2. Independent Journalists**
- **Pain point:** Can't afford $50-100/mo Trint, need source protection
- **Current solution:** Rev pay-per-use ($15/hr adds up) or Otter (poor speaker ID)
- **Your advantage:** Better speaker ID than Otter, cheaper than Rev

**3. Students (Thesis Interviews)**
- **Pain point:** Limited budget, need good speaker diarization
- **Current solution:** Otter Free (limited) or manual transcription
- **Your advantage:** Affordable one-time purchase, no subscription lock-in

**4. Podcasters/Content Creators (Interviews)**
- **Pain point:** Descript is expensive ($30/mo), just need transcripts
- **Current solution:** Descript or Temi (no good speaker ID)
- **Your advantage:** Better speaker ID, cheaper, no video features bloat

**5. International Users (Data Sovereignty)**
- **Pain point:** Can't use US cloud services (GDPR, local laws)
- **Current solution:** Local Whisper (too technical) or expensive local services
- **Your advantage:** Self-hosted option + simpler than Whisper setup

### 5.2 Geographic Opportunities

**Spain/Latin America:**
- **Market size:** Spanish is 2nd most spoken language globally (500M+ speakers)
- **Competition:** Most tools are English-first, Spanish is "also supported"
- **Your advantage:** Built for Spanish from day 1 (PRD §5.8-5.9), Catalan support

**EU/GDPR Markets:**
- **Pain point:** Data residency requirements, can't use US services
- **Your advantage:** Self-hosted deployment option

---

## 6. Pricing Strategy Recommendations

### 6.1 Proposed Pricing vs. Market

| Your Tier | Price | Comparable Service | Market Price | Your Advantage |
|-----------|-------|-------------------|--------------|----------------|
| **24-hour trial** | Free | Otter Free | Free (300 min/mo) | Same |
| **Domain whitelist** | Free (managed) | Academic discounts | 10-30% off | **100% off for edu** |
| **30-day pass** | $15 | Temi (1 hour), Rev AI (1 hour) | $15/hour | **30 days unlimited** |
| **Monthly subscription** | $9/mo | Otter Pro ($8.33/mo), Happy Scribe ($17/mo) | $8-17/mo | **Middle of range** |

### 6.2 Pricing Psychology

**Why $15 for 30 days works:**
- Anchors against Rev/Temi's $15/hour (feels like massive savings)
- Just below $20 psychological barrier
- Covers typical use case: student transcribes 3-5 thesis interviews in a month
- No "gotcha" overage charges

**Why $9/mo subscription works:**
- Below $10 psychological barrier
- Cheaper than Otter Pro ($16.99) and Happy Scribe Basic ($17)
- Saves $6/mo vs. buying 30-day passes every month ($15 x 12 = $180 vs. $9 x 12 = $108)
- "Less than Netflix" comparison

### 6.3 Alternative Pricing Models to Consider

| Model | Example | Pros | Cons | Recommendation |
|-------|---------|------|------|----------------|
| **Pay-per-transcript** | $3-5 per file | Simple, predictable | Discourages long files | ❌ Skip - punishes your best use case |
| **Credit system** | $20 = 10 credits | Feels like prepaid value | Complex accounting | ⚠️ Consider for Phase 7+ |
| **Annual discount** | $99/year (save 8%) | Upfront revenue, retention | Higher barrier to entry | ✅ Add in Phase 6 |
| **Team plans** | $25/mo for 5 users | Targets research groups | Adds complexity | ⚠️ Phase 7+ |
| **Academic pricing** | 50% off for .edu | Captures education market | Revenue loss | ✅ **Domain whitelist handles this** |

---

## 7. Go-to-Market Strategy

### 7.1 Positioning Statement

**For** academic researchers, journalists, and qualitative interviewers
**Who** need accurate speaker-identified transcripts from audio interviews
**Transcript App** is a privacy-focused transcription service
**That** offers WhisperX-quality speaker diarization with an intuitive name assignment UI
**Unlike** expensive professional services (Rev, Trint) or complex open-source tools (Whisper)
**We** provide affordable, flexible pricing ($9/mo or $15/30 days) with self-hosting options for sensitive data

### 7.2 Marketing Channels

| Channel | Target Audience | Message | Priority |
|---------|----------------|---------|----------|
| **Academic conferences** | Qualitative researchers | "IRB-compliant self-hosted transcription" | High |
| **Reddit (r/AskAcademia)** | Grad students | "Affordable thesis interview transcription" | High |
| **Product Hunt** | Early adopters, tech-savvy | "Open-source WhisperX with UI" | Medium |
| **Twitter (Academic Twitter)** | Researchers, journalists | "Finally, good speaker ID without $100/mo" | Medium |
| **University partnerships** | Students, faculty | Domain whitelist for .edu emails | High |
| **LinkedIn (Journalists)** | Media professionals | "Cheaper than Trint, better than Otter" | Low |

### 7.3 Competitive Messaging

**vs. Otter.ai:**
> "Better speaker identification than Otter, designed for interviews not meetings. Self-host for privacy."

**vs. Rev.com:**
> "10x cheaper than Rev for the same interview. AI quality good enough for 95% of use cases. Try 24 hours free."

**vs. Trint:**
> "All the features journalists need, none of the $100/month price tag. One-time $15 for 30 days, or $9/month."

**vs. Whisper (raw):**
> "WhisperX quality with a UI. No terminal commands, no Python setup. Speaker names with one click."

**vs. Descript:**
> "Just transcription, no video bloat. If you need text from audio, we're 3x cheaper and simpler."

---

## 8. Feature Roadmap (Competitive Parity)

### 8.1 Must-Have (Phase 3-6)

| Feature | Why | Competitive Benchmark |
|---------|-----|----------------------|
| ✅ Speaker diarization | Table stakes | All competitors have this |
| ✅ Speaker name assignment UI | **Differentiator** | Most lack this, manual editing required |
| ✅ Export to TXT, DOCX, SRT | Standard formats | Universal across competitors |
| ✅ Batch upload | Efficiency | Professional tools have this |
| ✅ Usage tracking | Billing requirement | All paid services track usage |
| ✅ Domain whitelist | **Unique for academic market** | Only some offer academic discounts |

### 8.2 Nice-to-Have (Phase 7+)

| Feature | Competitive Pressure | Priority | Notes |
|---------|---------------------|----------|-------|
| ⚠️ More languages (CA, FR, DE) | High - Trint has 30+, Sonix 50+ | Medium | Start with ES/EN, add others based on demand |
| ⚠️ AI summaries | Medium - Otter has this | Low | AssemblyAI LeMUR API makes this easy to add |
| ⚠️ Collaborative editing | Low - only Otter/Trint | Low | Different target market (solo researchers) |
| ⚠️ Live transcription | Low - meeting-focused feature | Very Low | Not our core use case |
| ⚠️ Mobile app | Low - desktop workflow | Low | Phase 8+ if web succeeds |
| ⚠️ API access | Medium - developers want this | Medium | Phase 7 - expose same backend API |

### 8.3 Avoid (Out of Scope)

| Feature | Reason to Avoid |
|---------|----------------|
| ❌ Video editing (Descript competitor) | Different market, huge scope |
| ❌ Meeting bots (Otter competitor) | Different workflow, calendar integration complexity |
| ❌ Human review service | Expensive to operate, low margins |
| ❌ Phone call recording | Legal/compliance nightmare |
| ❌ CRM/sales integrations | Enterprise feature, wrong market |

---

## 9. Competitive Threats

### 9.1 Existing Competitors

**Risk: Otter.ai adds better speaker ID**
- **Likelihood:** Medium (they're focused on meetings, not interviews)
- **Impact:** High (they have brand recognition + free tier)
- **Mitigation:** Self-hosting differentiator, faster iteration on speaker UI

**Risk: Rev drops AI pricing to compete**
- **Likelihood:** Low (human transcription is their core business)
- **Impact:** Medium (they have brand trust)
- **Mitigation:** We're already at their price point ($15), emphasize 30-day vs. 1-hour

**Risk: AssemblyAI/Deepgram launch consumer UI**
- **Likelihood:** Low (developer-focused business model)
- **Impact:** High (they have better infrastructure)
- **Mitigation:** First-mover advantage, focus on non-technical users

### 9.2 New Entrants

**Risk: OpenAI launches official Whisper app**
- **Likelihood:** Medium (they already have ChatGPT, could bundle)
- **Impact:** Very High (brand power)
- **Mitigation:** Self-hosting, domain whitelist, Spanish-first positioning

**Risk: Google/Microsoft bundles transcription into Workspace/365**
- **Likelihood:** High (already have speech APIs)
- **Impact:** Medium (enterprise focus, not researcher-friendly)
- **Mitigation:** Privacy angle (self-hosted), better UX for long interviews

### 9.3 Substitutes

**Risk: Manual transcription is "good enough"**
- **Likelihood:** Low (researchers already moving to AI)
- **Impact:** Low
- **Mitigation:** 24-hour free trial shows time savings

**Risk: ChatGPT + plugins replaces dedicated tools**
- **Likelihood:** Medium (ChatGPT can transcribe via plugins)
- **Impact:** Medium
- **Mitigation:** Better speaker diarization, specialized workflow

---

## 10. Key Takeaways & Recommendations

### 10.1 Strategic Recommendations

1. **Focus on underserved academic market first**
   - Domain whitelist for universities = word-of-mouth growth
   - Researchers have tight budgets, can't afford Trint
   - Privacy requirements (IRB) make self-hosting valuable

2. **Emphasize speaker identification UX**
   - This is your differentiator vs. Whisper (too technical) and Otter (poor quality)
   - Build the best speaker naming interface in the market
   - Screenshot this UI for marketing

3. **Pricing is competitive**
   - $9/mo subscription is well-positioned (between Otter $8.33 and Happy Scribe $17)
   - $15/30-day pass is psychological win vs. Rev's $15/hour
   - Keep both options (subscription for power users, one-time for students)

4. **Self-hosting is a moat**
   - Only you and Whisper (technical) offer this
   - Privacy is becoming more important (GDPR, IRB, source protection)
   - Position as "Whisper with a UI"

5. **Don't compete on features you don't need**
   - Skip meeting bots (Otter's domain)
   - Skip video editing (Descript's domain)
   - Focus: batch interview transcription with good speaker ID

### 10.2 Metrics to Track

| Metric | Benchmark (Competitors) | Your Target |
|--------|------------------------|-------------|
| **Transcription accuracy** | 90-95% (AI services) | 90%+ (WhisperX baseline) |
| **Speaker diarization accuracy** | 80-90% (varies by speaker count) | 85%+ |
| **Time to first transcript** | <5 min (Temi), <1 hour (Rev) | <10 min |
| **User retention (Month 2)** | 40-60% (SaaS average) | 50%+ |
| **NPS (Net Promoter Score)** | 30-50 (SaaS average) | 40+ |
| **Customer acquisition cost** | Varies | <$50 (organic + academic partnerships) |

### 10.3 Next Steps

1. **Phase 3-4 (Auth + Admin):** Validate pricing with beta users
2. **Phase 5 (Deploy):** Launch with academic partners (domain whitelist)
3. **Phase 6 (Payments):** Monitor churn between one-time vs. subscription
4. **Competitive monitoring:** Set Google Alerts for Otter, Rev, Trint pricing changes
5. **User research:** Interview 10 academic researchers about current pain points

---

## 11. Appendix: Detailed Service Profiles

### 11.1 Otter.ai

**Founded:** 2016
**HQ:** Los Altos, CA
**Funding:** $63M Series B (2021)
**Users:** 3M+ (claimed)

**Pricing:**
- Free: 300 min/mo, 30 min per conversation
- Pro: $8.33/mo (annual) or $16.99/mo (monthly), 1200 min/mo
- Business: $30/user/mo, 6000 min/mo
- Enterprise: Custom

**Key features:**
- Real-time transcription during meetings
- Otter Assistant bot (auto-joins Zoom/Teams/Meet)
- AI summaries and action items
- Mobile apps (iOS/Android)
- Integrations: Zoom, Google Calendar, Salesforce

**Target market:** Business meetings, sales calls, lectures

**Strengths:** Brand recognition, free tier, ease of use
**Weaknesses:** Speaker ID quality drops with 3+ speakers, meeting-focused UX

---

### 11.2 Rev.com

**Founded:** 2010
**HQ:** San Francisco, CA
**Users:** 350K+ businesses

**Pricing:**
- AI transcription: $0.25/min ($15/hr)
- Human transcription: $1.50/min ($90/hr)
- Captions: $7-15/min

**Key features:**
- Human transcription with 99% accuracy
- 12-hour turnaround (human), <5 min (AI)
- SOC2 Type II, HIPAA compliant (add-on)
- Mobile apps
- Integrations: Zoom, Dropbox, YouTube

**Target market:** Journalists, legal, medical, podcasters

**Strengths:** Accuracy, compliance, brand trust
**Weaknesses:** Expensive, pay-per-minute adds up

---

### 11.3 Trint

**Founded:** 2014
**HQ:** London, UK
**Users:** 50K+ (claimed), BBC, NYT, Forbes use it

**Pricing:**
- Starter: $52-80/mo (7 files)
- Advanced: $60-100/mo (unlimited files)
- Enterprise: Custom

**Key features:**
- 30+ languages
- Live transcription for press conferences
- Collaborative editing (Google Docs-style)
- Translation built-in
- Verification tools (timestamps, playback)

**Target market:** Newsrooms, journalists, media companies

**Strengths:** Live transcription, collaboration, professional
**Weaknesses:** Very expensive, per-seat pricing forces commitment

---

### 11.4 AssemblyAI

**Founded:** 2017
**HQ:** San Francisco, CA
**Funding:** $120M Series B (2024)

**Pricing:**
- Universal-2: $0.0025/min = $0.15/hr (base)
- Universal-3 Pro: $0.0035/min = $0.21/hr
- Speaker diarization: +$0.02/hr
- Free: $50 credits on signup

**Key features:**
- 99 languages (Universal-2), best accuracy (Universal-3)
- LeMUR (AI summaries, Q&A, custom LLM tasks)
- Real-time and async transcription
- Speaker diarization, sentiment, entity detection
- Developer-friendly API, good documentation

**Target market:** Developers, app builders, high-volume users

**Strengths:** Best API DX, cheap at scale, AI features
**Weaknesses:** Requires coding, no UI

---

### 11.5 Whisper (OpenAI)

**Released:** 2022
**License:** Open source (MIT)
**Model sizes:** Tiny, Base, Small, Medium, Large (v1, v2, v3)

**Pricing:** Free (self-hosted), compute costs only

**Key features:**
- 99 languages, multilingual model
- Runs locally (privacy)
- Multiple model sizes (speed vs. accuracy tradeoff)
- Open source, active community
- Python library + CLI

**Target market:** Developers, researchers, privacy-conscious users

**Strengths:** Free, privacy, open source, good accuracy
**Weaknesses:** No speaker diarization (need WhisperX), technical setup, no UI

---

## 12. Sources

- Otter.ai website and pricing page (accessed 2026-05-05)
- Rev.com website and pricing page (accessed 2026-05-05)
- Trint website and reviews (accessed 2026-05-05)
- AssemblyAI documentation and pricing (accessed 2026-05-05)
- Deepgram documentation and pricing comparison (accessed 2026-05-05)
- Academic transcription tool guides (NYU, Harvard, Temple libraries)
- Third-party reviews: Sonix, BrassTranscripts, Capterra
- Web search results from multiple comparison articles (2024-2026)

---

**Document Version:** 1.0
**Next Review:** Before Phase 5 launch (update with beta user feedback)
