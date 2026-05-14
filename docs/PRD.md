# Product Requirements Document: Transcript App

**Status:** Draft  
**Last updated:** 2026-05-06 (v0.10 — Legal, terms, privacy, and compliance requirements)

## 1. Summary

Transcript App is a client-facing application that converts audio files into text transcripts with **speaker diarization**: each utterance is labeled by speaker (e.g., Speaker 1, Speaker 2). The app runs **locally** for private workflows and is **deployable to the web** for broader access. Users choose input audio, configure **where and how** output files are written, and receive transcripts that include a **structured header** describing speakers.

The **hosted (web) product** requires **authentication**; **per-user usage** is **recorded** for **billing** (per transcript and/or per minute of audio transcribed—see §5.12), with support for **complimentary allowances** up to configurable limits (§5.13). **Administrators** manage users and related settings via an **admin console** (§5.14).

**Localization (MVP):** The product ships with **English** and **Spanish** for both the **user interface** and **user-facing extraction output** (labels, errors, buttons, transcript header field names where localized). **Audio language** is **not** chosen manually for transcription: the pipeline **detects** language automatically (see §5.8 and §10).

**Hosted deployment:** Production deployments target the **self-hosted platform** defined in the separate infrastructure PRD (see **§5.15**): shared **Coolify/Docker**, **Traefik/Caddy**, **PostgreSQL**, **Redis**, **MinIO**, **Stripe**, unified **auth**, and observability—not ad-hoc PaaS unless explicitly overridden.

### 1.1 Delivery phases (build sequence)

Development proceeds in **seven** phases. Later phases build on the core extraction logic from Phase 1; the full product vision (localization, WhisperX pipeline, hosted deployment, billing, etc.) remains documented in this PRD.

**Phases 1–4 run locally** on the developer machine (or equivalent local environment): no requirement to expose the app on the public internet until Phase 5.

| Phase | Scope |
|-------|--------|
| **1 — CLI** | A **script** invoked from the command line: **source file** (input audio) and **output directory** as arguments. Establishes the transcription pipeline, output format, and naming/collision behavior without a graphical UI. |
| **2 — UI** | A **user interface** to choose **one or more input files** and an **output directory** (local folder selection). **Extraction progress** (phase, percent, elapsed time, **best-effort remaining time**), and a **list of completed extractions** (see **§5.4.1**). No user authentication in this phase unless already required by the chosen stack. |
| **3 — Auth and accounts** | **End-user authentication** (sign-in, sessions, per-user data) per **§5.10**. Scopes jobs and transcripts to the authenticated user; **no** admin panel until Phase 4. |
| **4 — Admin panel** | **Administrator** UI for **user management** (list/search users, account state, usage visibility, complimentary limits where applicable) per **§5.14**—distinct from the normal user experience. |
| **5 — Internet deployment** | Deploy the application so it is **reachable on the internet** (staging or production URL). Validates hosting, TLS, routing, and operational basics before monetization. |
| **6 — Payments** | **Billing and payments** integration (e.g., Stripe) per **§5.12–§5.13**, usage alignment with **§5.11**, and user-visible pricing and payment status. |
| **7 — App platform deployment** | Run the hosted product on the **shared self-hosting platform** (**§5.15**): Coolify/Docker, Traefik/Caddy, Postgres, Redis, MinIO, Stripe, shared auth, workers, observability—so operations match the multi-app platform rather than ad-hoc hosting. |

**Phases 1–6 as a learning loop:** They are used to **evaluate** the full **internet stack** and **deployment mechanisms** (how the app is built, shipped, configured, and operated online). **Phases 5 and 6 may be iterated** (repeated or refined) until the team has a clear, **cost-effective** and **time-efficient** way to implement **Phase 7** on the app platform. Phase 7 is not a hard deadline immediately after a single pass of 5–6; it follows confidence in the approach.

## 2. Goals

- Produce readable, speaker-attributed transcripts from user-selected audio.
- Support both **local** execution and **web** deployment without changing the core product promise; document **local development** with a **Python tool** (**uv** or **Poetry**) plus **Docker** for services (§5.5.1) so dependencies are pinned and environments match production where it matters.
- Give users control over **output location** and **output naming** for generated files.
- Surface **speaker count** and **speaker names** when they can be determined (from audio metadata or user input—see §5.3).
- Ship **English and Spanish** for the **UI** and **user-visible extraction strings**, with **automatic** spoken-language detection for processing (see §5.6–§5.9).
- Provide **authenticated** access to the hosted service, **usage tracking**, **monetization** (pay per transcript and/or per minute), **free-tier limits** where allowed, and an **admin console** for user management (§5.10–§5.14).
- **Deploy** the hosted stack on the **shared self-hosting platform** (§5.15) so auth, billing, storage, and operations align with other applications on the same infrastructure.

## 3. Non-goals (initial release)

- Real-time streaming transcription (unless explicitly added later).
- Guaranteed identification of real-world identities (names beyond metadata or user-provided labels).
- Video-first workflows (audio-only unless scope expands).
- Full **self-serve accounting** (invoices, tax jurisdictions) beyond what a payment provider handles—unless explicitly added.

## 4. Personas

- **Researcher / journalist / Lawyer / Doctor :** Records interviews; needs Speaker 1 / Speaker 2 style output and export to a chosen folder; signs in to the web app and expects **clear usage and billing** visibility.
- **Operator on shared hosting:** Uses the web deployment; expects the same transcript quality, clear download or save behavior, and **predictable charges** aligned with usage.
- **Platform administrator:** Onboards users, adjusts **free allowances** or plan flags, investigates **usage** disputes, and suspends or restores accounts.

## 5. Functional requirements

### 5.1 Audio input

- User can **select one or more audio files** (exact supported formats TBD; at minimum common lossy/lossless containers used for speech).
- Clear feedback when a file is unsupported or fails processing.

### 5.2 Transcription with speaker labels

- For each processed file, the app generates **text** where segments are attributed to **Speaker 1, Speaker 2, …** (or equivalent consistent labeling).
- Ordering should follow **time** (chronological).
- **Diarization** (who spoke when) is a core requirement. **Recommended stack:** WhisperX (transcribe → align → diarize → assign word speakers)—see **§10**.

### 5.3 Transcript header

Each output transcript must begin with a **header section** that includes:

| Field | Requirement |
|--------|-------------|
| **Number of speakers** | Always present when diarization succeeds; define behavior if the engine returns zero/one speaker. |
| **Speaker names** | Included **when available** from audio file metadata (e.g., embedded tags) or from **user-provided names** mapped to Speaker 1…N. If names are unknown, header still lists speaker count; per-line labels may remain generic. |

Open product decisions to lock in build phase:

- Whether users can **edit or assign names** in the UI before export.
- Exact **header format** (Markdown, plain text with separators, YAML front matter, etc.).

### 5.4 Output files: naming and directory

- User can **choose an output directory** for saved transcripts (local app: native folder picker or equivalent; web: download behavior and optional “save as” semantics—see §7).
- User can **define naming** for outputs (e.g., pattern based on source filename, timestamp, or custom template). Default naming should be predictable (e.g., `{original_basename}_transcript.txt`).
- Multiple inputs should not silently overwrite: **collision handling** (suffix, prompt, or skip) must be specified in implementation.

### 5.4.1 Phase 2 — Local UI: extraction flow, progress, and completed outputs

This subsection refines **Phase 2** (§1.1) for **local** development (Vite + FastAPI on the machine with filesystem access). **Hosted web** behavior differs (upload/download, no arbitrary paths)—see §7 open questions.

**File selection and output**

- User selects **one or more audio files** and a **single output directory** (folder picker or equivalent); aligns with §5.1 and §5.4.
- Default **output naming** matches §5.4 (e.g. `{original_basename}_transcript.txt`); collision rules unchanged.

**Progress during extraction**

- While a job runs, the UI shows **non-blocking** progress (not only a spinner). Minimum signals:
  - **Pipeline phase:** `transcribe` → `align` → `diarize` → `finalize` (or equivalent labels aligned with §10).
  - **Percent complete** within the current phase when the backend provides it (or indeterminate state only if the engine cannot report progress).
  - **Elapsed time** since the job started.
- **Remaining time (ETA)** is **best-effort**: optional, derived from progress callbacks and elapsed time (e.g. linear extrapolation by phase, rolling estimate by audio minutes). The UI must **not** imply guaranteed accuracy; copy may say “estimate” / “aproximado” (localized per §5.7).
- **Transport:** Server-Sent Events (SSE), WebSocket, or **polling** a job status endpoint; implementation choice. Events should carry at least `phase`, `percent` (0–100 when available), `elapsed_sec`, optional `eta_sec`, and `message` for errors.

**Completed extractions**

- The UI surfaces **files that already have a completed transcript** for the chosen output directory (or configured app “output root”): e.g. **pairing** `{basename}.m4a` / `{basename}.aac` with `{basename}_transcript.txt` (or matching naming convention from §5.4), and listing **metadata** such as filename, completed-at time if available, and path to open.
- **Discovery rule** is implementation-defined: **scan the output directory** for `*_transcript.txt` (or configured pattern) and match stems to known audio in the same folder, **or** maintain a small **manifest** (JSON/CSV) written alongside outputs; pick one and document.

**Localization**

- Progress labels, ETA disclaimer, empty states (“no extractions yet”), and errors follow **§5.6–5.7** (EN/ES).

**Out of scope for Phase 2 UI**

- User accounts, cloud sync, and server-side job history beyond what the local filesystem provides (see Phase 3+).

### 5.5 Deployment modes

- **Local:** Runs on the user’s machine; file system access for reading inputs and writing to a user-chosen directory. **Account, metering, and billing** for local builds are **TBD** (§7)—may mirror cloud or use a separate license model.
- **Web (hosted):** Deployed as a hosted application; users **authenticate** (§5.10), upload audio, and **receive** transcript files (download). **Usage** is **tracked** (§5.11) and **billed** per §5.12–§5.13. Retention policy for audio/transcripts on the server must be **documented** (minimal retention vs. optional “save my jobs”—product decision).

### 5.5.1 Local development (Python environment and Docker)

**Python application dependencies** and **lockfiles** should be managed with a standard tool—**uv** or **Poetry** (pick one for the repo; both provide `pyproject.toml` + lock). Developers install the app and run tests with **`uv run`** / **`poetry run`** (or equivalent) against a **local virtual environment**. This is **orthogonal** to Docker: containers do not replace a pinned Python env for day-to-day editing and fast iteration.

- **Docker Compose** (or similar) should still document how to run **backing services** (database, queue, object storage, payment webhooks in dev, etc.) and optionally the **full stack** (API + worker + UI) in containers for parity with production.
- **Default developer story:** **uv or Poetry on the host** for the Python packages, plus **Compose for dependencies**; optionally **full app in Docker** for those who prefer one command (often **CPU-only** or **Linux + NVIDIA**—see below). **Apple Silicon (macOS):** treat **hybrid** as the practical default—**Compose for services**, **native** WhisperX worker via the same **uv/Poetry** env so **Metal/MPS** (or CPU) works without fighting Linux-in-Docker GPU limits.

Additional notes:

- **Purpose (Docker):** Reproducible **ffmpeg** in images when the worker runs in Docker; alignment between **local**, **CI**, and **production** images; fewer “works on my machine” issues for **service** versions.
- **GPU / WhisperX:** On **Linux with NVIDIA GPUs**, document how to run the **transcription worker** with **CUDA** (e.g., NVIDIA Container Toolkit, appropriate base images). **Apple Silicon (macOS):** Docker Desktop typically runs **Linux** containers without passing through the host’s **Metal/MPS** stack the same way; **GPU-accelerated WhisperX inside Docker on Mac** is often **impractical or CPU-only**. The **hybrid** option remains: **API + database + supporting services in Compose**, **ML worker run natively** with **uv/Poetry** for fast local iteration, **or** CPU-only Docker for convenience.
- **Volumes:** Support bind mounts (or named volumes) for **input audio**, **output transcripts**, and **model cache** directories so developers do not rebuild images to change files.
- **Secrets:** `.env` / compose secrets for `HUGGINGFACE_TOKEN` / `HF_TOKEN` and app keys—**never** commit real secrets; provide `.env.example`.
- **Parity:** Where production runs in containers, **local Compose** should use the **same Dockerfile** (or layered variants) when possible so behavior matches deployment.
- **CI:** Reuse the same **Dockerfile** (or compose target) for **automated tests** and lint where applicable.

End users who “run locally” without contributing code may use the same Compose setup **or** a future packaged installer—product packaging is **TBD**; developer ergonomics are the focus of this subsection.

### 5.6 UI language selection (English / Spanish)

- The UI is available in **English** and **Spanish** from day one.
- Users switch UI language via a **visible language control** (e.g., toggle or dropdown), not buried in settings only—**a dedicated control** (e.g., “Language / Idioma” button or segment control) satisfies this requirement.
- Choice **persists** across sessions (browser `localStorage` on web; app config or equivalent locally).
- UI language is **independent** of audio language: changing UI strings does **not** change how audio is transcribed.

### 5.7 Localized extraction output

- **User-visible strings** produced by the extraction flow (status messages, error text, **progress and ETA labels** per **§5.4.1**, and **localized labels in the transcript header** where the PRD calls for human-readable titles) must exist in **English and Spanish** and follow the **same UI language** selection as §5.6, unless we explicitly define a separate “output language” (default: **same as UI**).
- Raw transcript lines may remain **language-agnostic** (timestamps + `SPEAKER_XX` + text); header titles such as “Speakers” / “Hablantes” should follow locale.
- **Internal logs / developer diagnostics** may stay English-only unless product asks otherwise.

### 5.8 Automatic language detection (audio)

- **Do not** require the user to pick the spoken language for transcription in MVP.
- The pipeline must **infer** language from audio using the ASR stack’s detection step and pass that into alignment (see §10).
- Detected language metadata (e.g., ISO code such as `en`, `es`, `ca`) may be shown in the transcript **header** for transparency (“Detected language: …” / “Idioma detectado: …”).

### 5.9 Spanish with Catalan (mixed / code-switched speech)

- Many recordings use **Catalan mixed with Spanish**. The product should handle this **without** forcing a single manual language for the whole file in MVP.
- **Expectation:** Automatic detection may classify the file or segments toward **Spanish (`es`)** or **Catalan (`ca`)** depending on dominance and model behavior; **code-switched** utterances should still be transcribed with a **multilingual Whisper-class** model (see §10). Perfect separation of Catalan vs. Spanish in every phrase is a **stretch goal**; MVP success is **usable text** and stable **speaker labels**, with mis-attributed language tags occasionally acceptable.
- **Recommendations for implementation** (non-binding but preferred):
  - Prefer a **large multilingual** ASR checkpoint (e.g., Whisper **large-v3** style) in the WhisperX path so both **es** and **ca** are in-vocabulary.
  - Run **alignment** using the **detected** `language_code` from the first transcription pass; if quality checks fail (optional future), allow a **power-user** or **support** path to re-run with a fixed `es` or `ca`—out of scope for MVP unless validation shows need.
  - Document in UX (Spanish + English help copy) that **mixed Catalan–Spanish** is supported **best-effort** via automatic detection, not guaranteed per-sentence language tags in v1.

### 5.10 Authentication and accounts

- **Hosted web application:** Every user must **sign in** with a unique account (no anonymous transcription in production). **Session management** must follow best practices (secure cookies or tokens, rotation, HTTPS).
- **Identity:** Support **email-based** login at minimum (email + password and/or magic link—exact methods TBD). **Social login** (e.g., Google) is optional for a later phase unless prioritized.
- **Authorization:** Transcripts, usage records, and billing state are **scoped to the authenticated user** (and to **admin** roles where applicable—§5.14). Users must not read or modify another user’s data.
- **Local desktop / offline usage:** Relationship to cloud accounts (same login, API token, or separate licensing) is an **implementation decision**—see §7. Until decided, assume **cloud requires login**; local may remain documented separately.

### 5.11 Usage tracking

- The system must **record usage** attributable to each **user account** (and optionally to **organization** if multi-tenant features are added later).
- **Minimum logged fields** (conceptual): user id, job/transcript id, **timestamp**, **audio duration** (seconds or minutes, consistently rounded), **outcome** (success, failure, canceled), and **billing unit** actually charged (see §5.12).
- Usage data supports **invoicing**, **free-tier enforcement** (§5.13), **admin reporting**, and **customer-visible** usage history (e.g., “minutes this month,” “transcripts this period”).
- **Idempotency:** Failed jobs should not double-charge; **retries** must be defined so billing events are **deduplicated** where appropriate.

### 5.12 Billing and payments

- Integrate a **payment provider** (e.g., Stripe or equivalent) for **subscriptions** and/or **pay-as-you-go**—exact provider TBD (§7).
- **Charge models** (product must support **configuration**, not necessarily all at launch):
  - **Per completed transcript** (one billable unit per successful output file or per input file processed to completion).
  - **Per minute** (or per second, normalized to minutes for display) of **audio transcribed**, based on **measured duration** of the processed media (see §5.11).
- The platform may offer **plans** that combine a **base fee** with **overage** using either or both units; **which model applies** is defined by **plan** or **admin-granted entitlements**.
- Users must see **pricing clarity** before running jobs (localized EN/ES where applicable): unit price, estimated cost for current selection, and **payment method** status.
- **Receipts / invoices:** Provide access to payment history consistent with the chosen provider’s capabilities.

### 5.13 Complimentary use and free limits

- **Some users** may be granted **free usage** up to a **limit** without payment (e.g., N **transcripts per month**, M **minutes per month**, or a **one-time** onboarding credit).
- Limits must be **configurable per user or per cohort** (e.g., promo code, manual admin flag) without a new software release where possible.
- When a user **exceeds** their free allowance, behavior must be explicit: **block** further jobs until payment or **charge** overage per §5.12—**product choice** to lock during build.
- **Admin** must be able to **view** remaining allowance and **adjust** grants (§5.14).

### 5.14 Admin console

- **Role:** Users with an **administrator** role access a separate **admin console** (or clearly separated area of the app) not available to normal users.
- **Capabilities (MVP):**
  - **List and search** user accounts (by email, id, status).
  - **View** per-user **usage** summaries and recent jobs.
  - **Manage account state:** e.g., activate, suspend, or mark for review (exact states TBD).
  - **Configure complimentary limits** (§5.13) and, where supported, **plan overrides** or notes for support.
- **Audit:** Administrative actions that change user entitlements or account state should be **logged** (who did what, when, to which account).
- **Security:** Strong authentication for admins (e.g., MFA recommended); least-privilege **roles** if multiple admin levels are introduced later.

### 5.15 Platform deployment (self-hosted infrastructure)

The **hosted** Transcript App must be deployed **on the platform** specified in:

`/Users/brianmckean/work/ai_stuff/my-vault/Goals/Professional/projects/PRDs/self-hosting-infrastructure.md`

*(If this file moves, update the path here or add a checked-in copy under `docs/` in this repository.)*

That document defines **multi-app** self-hosted infrastructure (e.g., **Coolify** + Docker, **Traefik/Caddy**, **PostgreSQL**, **Redis**, **S3-compatible object storage** such as **MinIO**, **Stripe**, **CDN**, **Grafana/Loki**, **GitHub Actions** CI/CD). Transcript App is **one application** (`app_id` in shared schemas) consuming those shared services—not a separate parallel hosting strategy unless explicitly decided.

| Platform component | Use in Transcript App |
|---------------------|------------------------|
| **Edge / TLS** | DNS + CDN (**Cloudflare / Bunny** per platform PRD); HTTPS for SPA + API. |
| **Load balancer / router** | **Traefik or Caddy** — route `transcript.example.com` → frontend; `/api` → FastAPI (or subdomain for API if preferred). |
| **Orchestration** | **Coolify** (or successor) — deploy containers from registry; env vars per environment; health checks. |
| **Frontend** | **React + Vite** build: static assets behind CDN or **container** (e.g., nginx) serving `dist/`; zero-downtime deploys per platform FR1. |
| **Backend API** | **FastAPI** container(s); **health check** `GET /api/health` (aligns with platform deploy example `path: /api/health`). |
| **Auth** | **Shared auth service** (platform PRD: e.g. **NextAuth.js**-style or chosen equivalent). Users, OAuth (Google, GitHub, …), sessions/JWT, **RBAC**; Transcript App validates tokens or session with shared service—**do not** build a second siloed user store unless the platform team standardizes otherwise. |
| **Payments** | **Stripe** — Checkout, Billing, Customer Portal, **webhooks**; usage-based lines map to **per-transcript** and **per-minute** (§5.12); **Stripe Tax** per platform. |
| **PostgreSQL** | App tables: jobs, transcripts metadata, **usage** aligned with platform **`usage_records`** pattern (`user_id`, **`app_id`**, `metric`, `quantity`, e.g. `transcription_minutes`, `transcripts_completed`). |
| **Redis** | Job queue, rate limiting, optional session cache—consistent with platform **FR2/FR3** and worker patterns. |
| **Object storage (MinIO/S3)** | **Audio uploads** (presigned URLs, large files); optional stored transcript files; lifecycle/retention per §5.5. |
| **Workers** | **Async transcription pipeline** (WhisperX §10)—**queue + worker** containers; **GPU** nodes per platform “heavy compute” pattern (dedicated app server or worker pool with NVIDIA). |
| **Observability** | **Prometheus/Grafana**, **Loki** — per-app metrics and logs; alert on API errors, queue depth, worker failures, webhook failures. |
| **CI/CD** | **GitHub Actions** → build/push **Docker** images → deploy to Coolify; preview environments and Stripe test mode per platform **Deployment Pipeline** section. |

**Implementation notes:**

- **Single sign-on:** End users should be able to use **one platform identity** across apps if the shared auth service supports it (platform goal FR2).
- **Billing:** Record usage events in a form compatible with **Stripe metered billing** and/or internal aggregation—match platform **Payment Service API** and webhook handling (idempotency, replay).
- **Secrets:** **Hugging Face token**, Stripe keys, DB URLs, Redis—via platform **secrets management** (e.g. Coolify/Doppler), not committed to git.
- **Scaling:** API and workers scale horizontally where stateless; **GPU workers** scale per capacity; DB and Redis per platform scaling plan.

### 5.16 Legal, terms, privacy, and compliance (user-facing)

This section states **product and documentation requirements** for how users are informed and how they agree to use the product. **Final legal text** (wording, jurisdiction, liability caps, etc.) is owned by counsel; engineering ships the **surfaces** and **versioning** that make policies enforceable and auditable.

#### 5.16.1 Hosted (web) product — required artifacts

For any **internet-accessible** deployment where users **create accounts**, **upload content**, or **pay**, the product must expose and maintain:

| Artifact | Purpose | Notes |
|----------|---------|--------|
| **Terms of Service** (ToS) | Rules of use, account termination, acceptable use, limitations, dispute basics, governing law (as advised). | Primary “user agreement” for SaaS; often what people mean by “EULA” for a web app. |
| **Privacy Policy** | What personal data is collected, why, retention, subprocessors, international transfers (if any), and user rights (region-dependent). | Must align with **actual** data flows: audio, transcripts, usage metrics, auth provider, Stripe, object storage, logs, support access. |
| **Cookie / tracking notice** | Disclosure and consent where required when the app uses **non-essential** cookies or similar tracking (e.g. analytics, marketing pixels). | If only strictly necessary session cookies, document that; if analytics added later, update notice + UX. |
| **Payment terms** | How billing, renewals, refunds, and taxes are handled. | May be **sections within ToS** and/or **linked from Stripe Checkout / Customer Portal**; must not contradict what Stripe and the app actually do. |

**EULA vs ToS:** For **downloadable** desktop or on-prem installers, a separate **End User License Agreement** may be used (software license grant). For the **hosted** product, **ToS + Privacy Policy** are the usual pair unless counsel specifies otherwise.

#### 5.16.2 User acceptance and audit (hosted)

- **Sign-up / first paid checkout:** Users must **affirmatively accept** current ToS and Privacy Policy (e.g. checkbox with links to live documents, or equivalent pattern required in target markets).
- **Material changes:** When policies change materially, product should support **re-notification** or re-acceptance per legal guidance (implementation detail TBD with counsel).
- **Versioning:** Policies should be **versioned or dated** (e.g. “Last updated” on each document); consider retaining **which version** a user accepted and **when** (for disputes and compliance).

#### 5.16.3 Business / enterprise customers (optional but planned)

- **Data Processing Agreement (DPA):** Offer a **DPA** (or equivalent) when selling to organizations that process personal data of their end users through the service, where required.
- **BAA / regulated data:** If the product ever targets **HIPAA** or other regulated categories, that is a **separate** commercial and architectural decision (out of scope unless explicitly added).

#### 5.16.4 Local-only product (Phase 2 / CLI)

- **Disclosure:** UX or README should state clearly whether **audio or transcripts leave the device** (local pipeline vs. any cloud API or telemetry).
- **License:** Distribute under an explicit **open-source license** or **proprietary license**; if proprietary, ship **license terms** appropriate to the distribution channel (installer, package registry, or internal).
- **Telemetry:** If optional or mandatory **analytics, crash reports, or update checks** are added, document them in Privacy-related copy and settings.

#### 5.16.5 Relationship to other PRD sections

- **Data retention and access** (who can see audio/transcripts, support access) must be **consistent** between Privacy Policy and **§5.5 / §6** operational practices.
- **Admin console (§5.14):** Administrative access to user content must be described in Privacy Policy within policy.

## 6. Non-functional requirements

- **Privacy:** Clarify in UX whether audio leaves the device (local-only pipeline vs. cloud APIs). For hosted SaaS, publish **data retention** for audio and transcripts, and **who** can access data (user + admins for support, within policy)—see **§5.16** for required user-facing documents and acceptance flows.
- **Security:** Protect credentials and payment data via the **payment provider** (no primary card storage on app servers if using hosted checkout). Apply **rate limiting** and abuse controls on auth and upload endpoints.
- **Performance:** Define acceptable latency targets per minute of audio once the stack is chosen.
- **Accessibility:** Keyboard navigation and readable defaults for transcript text.
- **Reliability:** Graceful errors; partial failure when batching multiple files should not corrupt completed outputs.
- **i18n engineering:** Use a single catalog for UI strings (e.g., JSON or ICU messages) for **en** and **es**; avoid hard-coded English in components. Same pattern for extraction-facing strings keyed by locale. **Admin console** should support **EN/ES** for core screens where feasible.
- **Local dev ops:** Maintain **documented** local setup: **uv or Poetry** for Python (§5.5.1) and **Docker Compose** for services (and optional full stack); keep README or `docs/` current when **lockfiles**, images, or compose services change.
- **Production deployment:** **Hosted** environments must follow **§5.15** (Coolify, Traefik/Caddy, shared Postgres/Redis/MinIO, shared auth, Stripe, observability). **Docker images** for API and workers should be **CI-built** and **registry-pushed** per platform pipeline.

## 7. Open questions

1. **Web “output directory”:** Browsers cannot write arbitrary paths; is the requirement **download to the user’s chosen folder** (with user gesture), **ZIP of batch**, or a **future desktop wrapper** (e.g., Tauri/Electron)?
2. **Local vs cloud account:** Should the **local** app use the **same** login and metering as the cloud, a **license key**, or remain **unmetered** for a separate SKU?
3. **Payment provider and tax:** Stripe vs. alternatives; regions and **VAT/sales tax** handling.
4. **Cost model** for **infrastructure** (WhisperX local vs. hosted GPU) vs. **customer** pricing in §5.12—ensure unit economics are viable.
5. **Behavior when free tier is exhausted:** Hard block vs. auto-charge overage vs. prompt to upgrade—default policy.
6. **Auth integration detail:** Validate **JWT** from shared auth vs. **BFF** session proxy vs. **service-to-service** token—exact contract with the platform auth service (§5.15).
7. **App routing:** Single domain with `/api` vs. `api.transcript.domain` — align with Traefik labels in Coolify.

## 8. Success criteria (MVP)

- User can select audio and obtain a **speaker-labeled transcript file** with the **header** described in §5.3.
- User can **name outputs** and **choose where they go** within the constraints of local vs. web (§5.4 and open questions in §7).
- **UI and extraction-facing strings** are available in **English and Spanish**, with a **visible language control** (§5.6–5.7).
- **Audio language** is **detected automatically** (§5.8); **Spanish–Catalan** mixed speech is handled **best-effort** per §5.9.
- Extraction follows the **WhisperX baseline** in §10 (transcribe → align → diarize → assign speakers).
- App is **runnable locally** and **deployable to the web** with documented setup; **local development** uses **uv or Poetry** plus **Docker** per §5.5.1 (with **hybrid** native GPU worker on macOS documented where relevant).
- **Hosted** experience: users **sign in**; **usage** is tracked; **billing** supports **per-transcript** and/or **per-minute** charges; **free allowances** can apply; **admins** can manage users via a **console**.
- **Hosted** deployments publish **Terms of Service**, **Privacy Policy**, and (where applicable) **cookie/tracking** and **payment** disclosures; new users accept current terms as specified in **§5.16**.
- **Production** deployment plan aligns with **§5.15** (shared self-hosting platform: Coolify, Traefik/Caddy, Postgres, Redis, MinIO, Stripe, shared auth, workers, observability).

## 9. Revision history

| Version | Date | Notes |
|---------|------|--------|
| 0.1 | 2025-03-23 | Initial draft |
| 0.2 | 2025-03-23 | EN/ES UI + localized extraction strings; auto language detection; Spanish/Catalan mixed speech; WhisperX (`transcribe_v2`) as recommended pipeline |
| 0.3 | 2025-03-23 | Authentication; per-user usage tracking; payments; per-transcript and per-minute pricing; free-tier limits; admin console |
| 0.4 | 2025-03-23 | Local development via Docker (default dev path); GPU/macOS hybrid notes; volumes, secrets, CI parity |
| 0.5 | 2025-03-23 | Local dev: **uv** or **Poetry** for Python/lockfile; Docker for services and optional full stack; hybrid default on macOS |
| 0.6 | 2025-03-23 | **§5.15** — Deploy on shared self-hosting platform PRD (Coolify, Traefik/Caddy, Postgres, Redis, MinIO, Stripe, shared auth, workers, CI/CD); component mapping |
| 0.7 | 2025-03-26 | **§1.1** — Delivery phases: Phase 1 CLI (source + output dir); Phase 2 UI (multi-file + output dir); Phase 3 auth and user management |
| 0.8 | 2025-03-26 | **§1.1** — Phases 4–7: admin panel; internet deploy; payments; app platform (**§5.15**); Phases 1–4 local; Phases 1–6 evaluate stack + iterate on 5–6 before Phase 7 |
| 0.9 | 2026-04-01 | **§5.4.1** — Phase 2 local UI: progress (phase, %, elapsed), best-effort ETA, SSE/WS/poll; completed extractions list; discovery rule; **§1.1** Phase 2 row updated |
| 0.10 | 2026-05-06 | **§5.16** — Legal, terms, privacy, and compliance: ToS, Privacy Policy, cookies/tracking, payment terms, acceptance/versioning, DPA note, local vs hosted; **§6** privacy bullet cross-ref; **§8** hosted success criterion for published policies |

## 10. Recommended implementation: WhisperX pipeline (`transcribe_v2` approach)

The reference implementation in `transcript_extraction_dev` **`transcribe_v2.py`** should be treated as the **baseline architecture** for extraction in this product.

### 10.1 Pipeline stages (align with WhisperX)

1. **Load model** — `whisperx.load_model(...)` with configurable size (e.g., `large-v3` for quality; smaller for speed in dev).
2. **Transcribe** — `model.transcribe(audio_path)` **without** forcing a language string so Whisper **infers** language and returns segments (and typically a `language` field).
3. **Align** — `language_code = transcription.get("language", "en")` (or equivalent), then `whisperx.load_align_model(language_code=language_code, ...)` and `whisperx.align(...)` for word-level timing needed for speaker assignment.
4. **Diarize** — `whisperx.DiarizationPipeline` (requires Hugging Face token for pyannote-style models where applicable), then `whisperx.assign_word_speakers(diarize_segments, transcription)`.
5. **Emit** — Format segments with timestamps and speaker ids (e.g., `[HH:MM:SS - HH:MM:SS] SPEAKER_XX: text`), plus product **header** (§5.3) and localized titles (§5.7).

### 10.2 Relation to language policy (§5.8–5.9)

- **Automatic detection** is satisfied by step 2: the transcribe pass sets the language used for alignment in step 3.
- **Catalan / Spanish:** If detection returns `ca` or `es`, alignment uses the matching phoneme model; for **mixed** speech, the dominant detected language drives alignment—acceptable for MVP per §5.9. Future work could explore **segment-level** language hints if the stack is extended.

### 10.3 Dependencies and operations

- **Python packaging:** Pin dependencies with **uv** or **Poetry** (`pyproject.toml` + lockfile); document install and run commands for developers (§5.5.1).
- **PyTorch** device selection (`cuda` vs `cpu`), `compute_type` (`float16` on GPU, `float32` on CPU) as in the reference script.
- **Secrets:** `HUGGINGFACE_TOKEN` / `HF_TOKEN` for diarization model access—document in deployment guides.
- **ffmpeg:** Required by underlying stacks; document for local and server images.
- **Containers:** Ship **ffmpeg** (and pinned Python deps) in images used for local and production workers; see **§5.5.1** for **GPU on Linux**, **CPU-only** vs **hybrid native worker on macOS**, and volume mounts for caches.

### 10.4 What not to inherit blindly

- Replace hard-coded output paths with user-configured output dir and naming (PRD §5.4).
- Replace CLI-only entry with app/API surfaces; keep core steps as a **library module** callable from local UI and web backend.
