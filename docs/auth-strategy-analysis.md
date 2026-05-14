# Authentication Strategy Analysis: Long-Term Maintenance & Security

**Date:** 2026-05-14
**Context:** Phase 3 design for Transcript App (see PRD.md §5.10, phase-3-auth-design.md)

---

## Executive Summary

**Recommended:** **FastAPI + fastapi-users library (Option B1)**

**Rationale:**
- ✅ Aligns with self-hosted platform vision (PRD §5.15)
- ✅ Single-language Python stack (maintenance efficiency)
- ✅ Production-ready security out of the box
- ✅ OAuth-ready for future expansion
- ✅ Lower long-term maintenance than custom implementation
- ✅ Community-vetted, actively maintained

**Runner-up:** Custom FastAPI + JWT (Option B2) — only if you have dedicated security expertise

**Reject:** NextAuth.js (adds Node.js complexity), Supabase (violates self-hosted requirement)

---

## 1. Detailed Comparison Matrix

| Criterion | NextAuth.js | fastapi-users | Custom JWT | Supabase | Sessions (Custom) |
|-----------|------------|---------------|------------|----------|-------------------|
| **Long-term Maintenance** | ⚠️ Medium-High | ✅ Low-Medium | ❌ High | ✅ Low | ⚠️ Medium |
| **Security (out of box)** | ✅ Excellent | ✅ Excellent | ⚠️ Depends | ✅ Excellent | ⚠️ Good |
| **Platform Alignment (§5.15)** | ❌ Poor | ✅ Excellent | ✅ Good | ❌ Rejected | ✅ Good |
| **Single Stack (Python)** | ❌ No (Node.js) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **OAuth Ready** | ✅ Yes (50+ providers) | ✅ Yes (10+ providers) | ❌ Manual | ✅ Yes | ❌ Manual |
| **Setup Complexity** | ⚠️ Medium | ✅ Low | ⚠️ Medium | ✅ Very Low | ⚠️ Medium |
| **Ongoing Maintenance** | ⚠️ 2 ecosystems | ✅ Standard deps | ❌ Manual security | ✅ Managed | ⚠️ Manual features |
| **Customization** | ⚠️ Limited | ✅ High | ✅ Total | ❌ Low | ✅ High |
| **Community Support** | ✅ Very Large | ✅ Large | ⚠️ DIY | ✅ Large | ⚠️ DIY |
| **Self-Hosted** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ External | ✅ Yes |
| **Cost (5 years)** | $$$ (2 stacks) | $ (deps) | $$$ (eng time) | $$$ (vendor) | $$ (eng time) |

**Legend:**
- ✅ Excellent / Recommended
- ⚠️ Acceptable with caveats
- ❌ Poor / Not recommended

---

## 2. Option A: NextAuth.js (Auth.js v5)

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  Node.js     │─────▶│  PostgreSQL  │
│  (Frontend) │      │  (NextAuth)  │      │  (Users)     │
└─────────────┘      └──────────────┘      └──────────────┘
       │                     │
       │                     │ JWT validation
       │                     ▼
       │              ┌──────────────┐      ┌──────────────┐
       └─────────────▶│  FastAPI     │─────▶│  PostgreSQL  │
                      │  (Transcribe)│      │  (Jobs)      │
                      └──────────────┘      └──────────────┘
```

### Long-Term Maintenance: ⚠️ MEDIUM-HIGH

**What you maintain:**
1. **Node.js environment:** Separate runtime, package.json, npm/yarn/pnpm lockfiles
2. **NextAuth updates:** Breaking changes between major versions (v4→v5 was significant)
3. **Database adapters:** Keep PostgreSQL adapter in sync with NextAuth
4. **Token validation in Python:** Must verify JWT signatures from Node.js service
5. **Deployment complexity:** Two services (FastAPI + Node.js) with different patterns
6. **Dependency conflicts:** Node.js CVEs independent of Python ecosystem

**Annual maintenance estimate:**
- Minor version updates: 4-6x/year (2-4 hours each)
- Major version migration: Every 2-3 years (40-80 hours)
- Security patches: 2-4x/year (1-2 hours each)
- Cross-service debugging: 10-20 hours/year
- **Total: 60-100 hours/year**

### Security: ✅ EXCELLENT

**Strengths:**
- Well-audited codebase (thousands of production deployments)
- Automatic CSRF protection via `csrfToken`
- Secure session handling (encrypted JWT or database sessions)
- Regular security advisories and patches
- Built-in OAuth attack mitigations (state parameter, PKCE)

**Considerations:**
- Must configure JWT secret correctly (high entropy, rotated)
- Cross-origin issues if React + Node.js on different domains
- Token validation in Python requires correct library (e.g., PyJWT with RS256)

**Security Setup:**
```javascript
// nextauth.config.js
export default NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET, // MUST be cryptographically random
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: true // HTTPS only
      }
    }
  }
})
```

### Platform Alignment: ❌ POOR

**PRD §5.15 Requirements:**
- ✅ Self-hosted (not external SaaS)
- ❌ Single-language stack (introduces Node.js)
- ⚠️ "NextAuth.js-style" ≠ NextAuth itself (PRD uses it as pattern example)
- ❌ Complicates Coolify deployment (two apps vs one)

**Why this matters:**
- PRD §5.15 envisions shared auth service across multiple apps
- Adding Node.js means maintaining two runtime platforms (Python + Node.js)
- Your other apps may be Python-based → inconsistent auth implementation

### Cost Analysis (5-year TCO)

| Item | Year 1 | Years 2-5 | Total |
|------|--------|-----------|-------|
| Initial setup (Node.js + integration) | 40h | - | 40h |
| Annual maintenance | 60h | 240h | 300h |
| Major version migrations | - | 120h | 120h |
| Infrastructure (2x services) | +30% | +30% | +30% |
| **Total** | **100h** | **360h** | **460h** |

At $150/hour engineering rate: **$69,000** over 5 years

### Verdict: ⚠️ NOT RECOMMENDED

**Only choose if:**
- You're building Next.js apps for other parts of the platform
- You already have Node.js expertise in-house
- You need 50+ OAuth providers immediately

**Skip if:**
- Python-first architecture (your case)
- Self-hosted simplicity is a priority (your case per PRD)
- Small team (context switching between ecosystems)

---

## 3. Option B1: fastapi-users Library (RECOMMENDED)

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  FastAPI     │─────▶│  PostgreSQL  │
│  (Frontend) │      │  (Auth +     │      │  (Users +    │
│             │      │   Transcribe)│      │   Jobs)      │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Redis       │
                     │  (Sessions/  │
                     │   Rate Limit)│
                     └──────────────┘
```

### Long-Term Maintenance: ✅ LOW-MEDIUM

**What you maintain:**
1. **Dependency updates:** `uv sync --upgrade fastapi-users` (semantic versioning, stable API)
2. **Database migrations:** When adding custom fields to User model (standard Alembic)
3. **Configuration:** Environment variables, OAuth credentials (if added later)
4. **Customization:** Overriding default templates/emails (optional)

**What you DON'T maintain:**
- JWT generation/validation logic
- Password hashing implementation
- OAuth flow implementation
- Rate limiting (with provided hooks)
- Email verification flow

**Annual maintenance estimate:**
- Dependency updates: 2-3x/year (30 min each)
- Security patches: 1-2x/year (1 hour each)
- Custom feature additions: 10-20 hours/year
- **Total: 15-30 hours/year**

### Security: ✅ EXCELLENT

**Built-in security features:**

```python
# Password Security (automatic)
from passlib.context import CryptContext
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Configurable work factor
)

# JWT Security
from fastapi_users.authentication import JWTStrategy
strategy = JWTStrategy(
    secret=SECRET,  # From environment
    lifetime_seconds=3600,  # 1 hour access token
    token_audience=["fastapi-users:auth"],
    algorithm="HS256"  # or RS256 with keypair
)

# Rate Limiting (with hooks)
@router.post("/auth/login")
async def login(request: Request):
    # Library provides hooks for rate limiting
    # Integrate with slowapi or custom Redis counter
```

**Security checklist (provided by library):**
- ✅ bcrypt with configurable rounds
- ✅ JWT with expiration and refresh
- ✅ CSRF protection via SameSite cookies
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ Timing-attack safe password comparison
- ✅ Email verification with time-limited tokens
- ✅ Password reset with single-use tokens

**Additional hardening (manual):**
```python
# Add rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/auth/login")
@limiter.limit("5/15minutes")
async def login(...):
    ...

# Add password strength validation
from zxcvbn import zxcvbn

def validate_password(password: str):
    result = zxcvbn(password)
    if result['score'] < 3:
        raise ValueError("Password too weak")
```

### Platform Alignment: ✅ EXCELLENT

**PRD §5.15 Requirements:**
- ✅ Self-hosted (no external services)
- ✅ Single Python stack (integrates natively with FastAPI)
- ✅ PostgreSQL for user storage (matches platform)
- ✅ Redis for sessions/rate limiting (matches platform)
- ✅ OAuth-ready for Phase 7 shared auth migration
- ✅ Simple Coolify deployment (single FastAPI app)

**Future-proofing:**
```python
# Phase 7 migration path to shared auth service
# Option 1: Keep fastapi-users, add SSO provider
# Option 2: Replace with platform auth client

# Code is modular enough to swap auth later:
# - User model is standard SQLAlchemy
# - Routes are FastAPI standard
# - No vendor lock-in
```

### Cost Analysis (5-year TCO)

| Item | Year 1 | Years 2-5 | Total |
|------|--------|-----------|-------|
| Initial setup (fastapi-users) | 16h | - | 16h |
| Annual maintenance | 20h | 80h | 100h |
| Custom features (MFA, etc.) | - | 40h | 40h |
| Security audits | 8h | 32h | 40h |
| **Total** | **44h** | **152h** | **196h** |

At $150/hour engineering rate: **$29,400** over 5 years

**Savings vs NextAuth:** $39,600 (57% reduction)

### Implementation Estimate

**Phase 3A: Backend (1 week)**
```python
# Day 1-2: Setup (16 hours)
# - Install fastapi-users + dependencies
# - Configure database models
# - Set up JWT strategy
# - Create auth router

# Day 3-4: Endpoints (16 hours)
# - Register, login, logout, /me
# - Password reset flow
# - Email verification (optional)
# - Rate limiting

# Day 5: Testing (8 hours)
# - Unit tests for auth flows
# - Security testing
# - API documentation

# Total: 40 hours
```

**Phase 3B: Frontend (1 week)**
```typescript
// Day 1-2: Auth context (16 hours)
// - AuthContext + useAuth hook
// - API client for auth endpoints
// - Token refresh mechanism

// Day 3-4: UI Components (16 hours)
// - Login/Register forms
// - Protected routes
// - Error handling

// Day 5: Integration (8 hours)
// - Update job creation
// - Localization (EN/ES)
// - Testing

// Total: 40 hours
```

### Code Example: Minimal Setup

```python
# backend/app/users.py (complete auth setup in ~100 lines)

from fastapi_users import FastAPIUsers, schemas
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

# 1. User schema
class UserRead(schemas.BaseUser[uuid.UUID]):
    display_name: str | None

class UserCreate(schemas.BaseUserCreate):
    display_name: str | None

class UserUpdate(schemas.BaseUserUpdate):
    display_name: str | None

# 2. JWT strategy
def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.SECRET_KEY,
        lifetime_seconds=3600
    )

# 3. Auth backend
bearer_transport = BearerTransport(tokenUrl="auth/login")
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# 4. FastAPI Users instance
fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_db,
    [auth_backend],
)

# 5. Add routes to app
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# 6. Protect endpoints
current_active_user = fastapi_users.current_user(active=True)

@app.post("/jobs/")
async def create_job(
    user: User = Depends(current_active_user),
    ...
):
    # Job is automatically scoped to user.id
    ...
```

That's it! Compare to ~500 lines for custom implementation.

### Verdict: ✅ STRONGLY RECOMMENDED

**Choose fastapi-users if:**
- ✅ You want production-ready auth without reinventing the wheel
- ✅ You value long-term maintenance efficiency
- ✅ You need OAuth later (Google, GitHub) without rewrite
- ✅ You have a small team focused on core product (transcription)
- ✅ Security is critical (medical/legal transcripts per README)

**This is the best fit for your project.**

---

## 4. Option B2: Custom JWT Implementation

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  FastAPI     │─────▶│  PostgreSQL  │
│             │      │  (Custom     │      │              │
│             │      │   Auth)      │      │              │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            │ (Manual implementation)
                            ▼
                     All auth logic written from scratch
```

### Long-Term Maintenance: ❌ HIGH

**What you maintain (everything):**

1. **JWT Generation & Validation:**
```python
# ~100 lines just for JWT handling
from jose import JWTError, jwt
from datetime import datetime, timedelta

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    # Must handle: expiration, signature, claims, audience
    # Easy to get wrong: timezone issues, clock skew, etc.
    ...
```

2. **Password Hashing:**
```python
# ~50 lines
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Must remember:
# - Timing-attack safe comparison
# - Proper salt generation
# - Work factor configuration
# - Migration path if algorithm changes
```

3. **User Registration:**
```python
# ~150 lines with validation
@router.post("/register")
async def register(email: str, password: str, db: Session):
    # Check: email format, duplicate users, password strength
    # Hash password, create user, generate verification token
    # Handle: db errors, email conflicts, validation
    ...
```

4. **Password Reset:**
```python
# ~200 lines
# Generate token, store with expiration, send email
# Validate token, update password, invalidate token
# Handle: expired tokens, already-used tokens, email failures
```

5. **Email Verification:**
```python
# ~100 lines
# Similar complexity to password reset
```

6. **Rate Limiting:**
```python
# ~150 lines with Redis
from redis import Redis
from datetime import datetime

async def check_rate_limit(key: str, max_attempts: int, window: int):
    # Track attempts per IP, per user, per endpoint
    # Handle: distributed rate limiting, Redis failures
    ...
```

7. **OAuth (if needed later):**
```python
# ~500+ lines per provider
# Google: OAuth flow, token exchange, user info fetch
# GitHub: Same complexity
# Must handle: state parameter, PKCE, token refresh
```

**Annual maintenance estimate:**
- Security patches (jose, passlib): 4-6x/year (2-4 hours each)
- CVE responses: 1-2x/year (8-40 hours each to retest entire auth)
- Bug fixes (edge cases): 10-20 hours/year
- New features (MFA, magic links): 40-80 hours/year
- **Total: 80-150 hours/year**

### Security: ⚠️ DEPENDS ON IMPLEMENTATION

**Common vulnerabilities in custom auth:**

```python
# ❌ INSECURE: Weak secret
SECRET_KEY = "mysecret123"  # NEVER do this
# ✅ SECURE: Cryptographically random
SECRET_KEY = secrets.token_urlsafe(32)

# ❌ INSECURE: Timing attack
if user.password_hash == provided_password:
# ✅ SECURE: Constant-time comparison
if pwd_context.verify(provided_password, user.password_hash):

# ❌ INSECURE: No expiration
jwt.encode({"user_id": user.id}, SECRET)
# ✅ SECURE: Expiration + refresh
jwt.encode({"user_id": user.id, "exp": expires}, SECRET)

# ❌ INSECURE: Password in logs
logger.info(f"Login attempt: {email}, {password}")
# ✅ SECURE: Redact sensitive data
logger.info(f"Login attempt: {email}", extra={"email": email})

# ❌ INSECURE: User enumeration
return {"error": "User not found"}  # vs "Invalid credentials"
# ✅ SECURE: Generic error message
return {"error": "Invalid email or password"}

# ❌ INSECURE: No rate limiting
@app.post("/login")
# ✅ SECURE: Rate limit
@app.post("/login")
@limiter.limit("5/15minutes")
```

**OWASP Top 10 Checklist (you must implement):**
- [ ] A01: Broken Access Control → Role-based checks on every endpoint
- [ ] A02: Cryptographic Failures → HTTPS, bcrypt, secure JWT secrets
- [ ] A03: Injection → Parameterized queries (SQLAlchemy helps)
- [ ] A04: Insecure Design → Threat modeling, security requirements
- [ ] A05: Security Misconfiguration → Secure defaults, no debug in prod
- [ ] A07: Identification/Auth Failures → MFA, secure password reset, session management
- [ ] A08: Software/Data Integrity → Dependency scanning, SRI
- [ ] A09: Logging/Monitoring → Auth events, failed login alerts
- [ ] A10: SSRF → Validate redirect URLs in OAuth

**Security testing burden:**
```bash
# You must run these regularly:
- pytest tests/test_auth_security.py  # ~50 test cases
- bandit -r app/  # Python security linter
- safety check  # Dependency vulnerabilities
- sqlmap -u http://localhost/api/auth/login  # SQL injection
- Manual penetration testing: 20+ hours/year
```

### Platform Alignment: ✅ GOOD

**PRD §5.15 Requirements:**
- ✅ Self-hosted
- ✅ Single Python stack
- ✅ PostgreSQL
- ⚠️ OAuth requires significant additional work
- ⚠️ Phase 7 migration to shared auth may require rewrite

### Cost Analysis (5-year TCO)

| Item | Year 1 | Years 2-5 | Total |
|------|--------|-----------|-------|
| Initial implementation | 80h | - | 80h |
| Annual maintenance | 100h | 400h | 500h |
| Security incidents | 20h | 80h | 100h |
| OAuth implementation | - | 100h | 100h |
| Security audits | 20h | 80h | 100h |
| **Total** | **220h** | **660h** | **880h** |

At $150/hour engineering rate: **$132,000** over 5 years

**Cost vs fastapi-users:** +$102,600 (349% increase)

### Verdict: ⚠️ NOT RECOMMENDED (Unless You Have Expertise)

**Only choose if:**
- You have a dedicated security engineer on staff
- You need absolute control over auth logic
- You're building auth as a learning exercise
- You have < 100 users (lower risk)

**Skip if:**
- Small team (context: you're using uv/Poetry, modern Python stack = likely solo or small team)
- Auth is not your core competency
- You want to ship Phase 3 in < 4 weeks
- Medical/legal transcripts require high security (per README)

---

## 5. Option C: Supabase Auth

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  Supabase    │ (External SaaS)
│             │      │  Auth API    │
└─────────────┘      └──────────────┘
       │                     │
       │                     │ User ID
       ▼                     ▼
┌─────────────┐      ┌──────────────┐
│  FastAPI    │      │  Supabase    │
│  (Backend)  │      │  PostgreSQL  │
└─────────────┘      └──────────────┘
       │
       ▼
┌─────────────┐
│  Your Postgres
│  (Jobs only)
└─────────────┘
```

### Long-Term Maintenance: ✅ LOW (but risky)

**What you maintain:**
- Supabase client library updates (monthly)
- Environment variables (Supabase URL, keys)
- User sync logic (Supabase users → your job ownership)

**What Supabase maintains:**
- Auth endpoints
- Password hashing
- OAuth providers
- Email sending
- Security patches
- Infrastructure

**Annual maintenance estimate:**
- Client library updates: 4x/year (30 min each)
- Supabase dashboard config: 2 hours/year
- **Total: 4 hours/year** ← This seems great!

**BUT...**

### Security: ✅ EXCELLENT (Managed)

Supabase handles:
- bcrypt password hashing
- JWT with RS256
- OAuth flows (Google, GitHub, etc.)
- Row-level security policies
- Rate limiting
- Email verification
- MFA (paid tier)

### Platform Alignment: ❌ REJECTED

**Critical issues for your project:**

1. **PRD §5.15 Violation:**
> "The hosted Transcript App must be deployed on the platform specified in `/Users/brianmckean/work/ai_stuff/my-vault/Goals/Professional/projects/PRDs/self-hosting-infrastructure.md`"

Supabase is **external SaaS**, not self-hosted.

2. **Privacy Concerns (README):**
> "All audio-to-text processing occurs on your local machine. No data is transmitted to or stored on external servers, making it suitable for sensitive legal and medical transcriptions."

If user auth is on Supabase:
- User emails are on Supabase servers
- PII (personally identifiable information) leaves your infrastructure
- Compliance issues for GDPR, HIPAA

3. **Vendor Lock-In:**
- Supabase Row-Level Security (RLS) policies are PostgreSQL-specific but Supabase-configured
- Migrating away requires:
  - Exporting users (passwords are hashed, but still complex)
  - Rewriting all auth logic
  - User password resets for everyone
  - Estimated migration: 80-120 hours

4. **Cost at Scale:**
```
Supabase Pricing (2026):
- Free tier: 50,000 MAU (monthly active users)
- Pro tier ($25/mo): 100,000 MAU
- Team tier ($599/mo): 500,000 MAU
- Enterprise: Custom

For 10,000 active users → $25/month = $300/year
For 100,000 users → $599/month = $7,188/year

Compare to self-hosted (fastapi-users):
- PostgreSQL: $0 (self-hosted)
- Redis: $0 (self-hosted)
- Engineering: 20 hours/year × $150 = $3,000/year

Supabase becomes more expensive at ~40,000 users
```

### Verdict: ❌ REJECT

**Reasons:**
- Violates PRD requirement for self-hosted platform
- Privacy concerns for medical/legal use case
- Vendor lock-in risk
- Higher cost at scale

**Only consider if:**
- You pivot from self-hosted to fully managed SaaS
- Privacy/compliance is not a concern
- You need to ship MVP in 1 week (fastest option)

---

## 6. Option D: Custom Server-Side Sessions

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  FastAPI     │─────▶│  PostgreSQL  │
│  (Cookie)   │      │              │      │  (Users)     │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Redis       │
                     │  (Sessions)  │
                     └──────────────┘
```

### Long-Term Maintenance: ⚠️ MEDIUM

**What you maintain:**
```python
# Session management (~300 lines)
import secrets
from datetime import datetime, timedelta

class SessionStore:
    def create_session(self, user_id: UUID) -> str:
        session_id = secrets.token_urlsafe(32)
        # Store in Redis with expiration
        redis.setex(
            f"session:{session_id}",
            timedelta(days=30),
            user_id
        )
        return session_id

    def get_session(self, session_id: str) -> UUID | None:
        # Fetch from Redis, extend expiration on access
        ...

    def destroy_session(self, session_id: str):
        # Delete from Redis
        ...

# Still need:
# - User registration (100 lines)
# - Password hashing (50 lines)
# - Password reset (200 lines)
# - Email verification (100 lines)
# - Rate limiting (150 lines)

# Total: ~900 lines (vs ~100 with fastapi-users)
```

**Compared to JWT:**
- Simpler (no signature verification)
- Stateful (can revoke sessions easily)
- But still need 80% of custom auth code

**Annual maintenance estimate:**
- Redis operations debugging: 10 hours/year
- Session cleanup jobs: 5 hours/year
- Security patches: 10 hours/year
- Feature additions: 40 hours/year
- **Total: 65 hours/year**

### Security: ⚠️ GOOD (If Implemented Correctly)

**Session security checklist:**
```python
# ✅ Secure session ID generation
session_id = secrets.token_urlsafe(32)  # 256 bits

# ✅ HttpOnly cookie (prevent XSS)
response.set_cookie(
    "session_id",
    session_id,
    httponly=True,
    secure=True,  # HTTPS only
    samesite="strict",  # CSRF protection
    max_age=30*24*60*60,
)

# ✅ Session fixation protection
# Regenerate session ID after login
old_session = request.cookies.get("session_id")
new_session = create_new_session(user_id)
destroy_session(old_session)

# ✅ Session expiration
# Redis TTL handles automatic cleanup

# ✅ Concurrent session limits
# Track sessions per user, limit to N
```

**Vulnerabilities to prevent:**
```python
# ❌ INSECURE: Predictable session IDs
session_id = f"{user_id}_{timestamp}"  # NEVER
# ✅ SECURE: Cryptographically random
session_id = secrets.token_urlsafe(32)

# ❌ INSECURE: No secure flag
response.set_cookie("session_id", value)  # Sent over HTTP!
# ✅ SECURE: HTTPS only
response.set_cookie("session_id", value, secure=True)

# ❌ INSECURE: Session never expires
redis.set(f"session:{id}", user_id)  # Lives forever
# ✅ SECURE: TTL + sliding window
redis.setex(f"session:{id}", 1800, user_id)  # 30 min
```

### Platform Alignment: ✅ GOOD

- ✅ Self-hosted (Redis + PostgreSQL)
- ✅ Single Python stack
- ⚠️ OAuth still requires manual implementation
- ⚠️ No mobile app support (cookies don't work well)

### Cost Analysis (5-year TCO)

| Item | Year 1 | Years 2-5 | Total |
|------|--------|-----------|-------|
| Initial implementation | 60h | - | 60h |
| Annual maintenance | 65h | 260h | 325h |
| OAuth implementation | - | 80h | 80h |
| Security testing | 15h | 60h | 75h |
| **Total** | **140h** | **400h** | **540h** |

At $150/hour engineering rate: **$81,000** over 5 years

**Cost vs fastapi-users:** +$51,600 (175% increase)

### Verdict: ⚠️ ACCEPTABLE (But Why Bother?)

**Choose if:**
- You want simple session logic
- You never plan to add OAuth
- You don't need mobile app support
- You're comfortable building auth features yourself

**Skip if:**
- You want OAuth later (fastapi-users is easier)
- You want mobile app support (JWT is better)
- You want to minimize maintenance (use a library)

**Bottom line:** This is "custom auth lite" — you still build 80% of what fastapi-users provides, but with less complexity than full JWT. Not worth it when a library exists.

---

## 7. Final Recommendation Matrix

### For Your Specific Project

**Context:**
- ✅ Self-hosted platform (PRD §5.15)
- ✅ Python/FastAPI backend
- ✅ Medical/legal transcripts (high security)
- ✅ Small team (uv/Poetry suggests solo or small)
- ✅ Need OAuth later (Phase 4/6)

**Ranked by fit:**

| Rank | Option | Best For | Why |
|------|--------|----------|-----|
| 🥇 **1st** | **fastapi-users** | **Your project** | Self-hosted, Python, secure, low maintenance, OAuth-ready |
| 🥈 2nd | Custom sessions | Learning exercise | Simpler than JWT, but still custom code |
| 🥉 3rd | Custom JWT | Security expertise | Total control, but high maintenance |
| 4th | NextAuth.js | Node.js platforms | Wrong stack for Python-first app |
| 5th | Supabase | Quick MVP | Violates PRD self-hosted requirement |

### Decision Tree

```
Do you need self-hosted?
├─ No → Consider Supabase (fastest)
└─ Yes
    │
    Do you have a security engineer?
    ├─ Yes → Custom JWT (total control)
    └─ No
        │
        Do you want to add Node.js to your stack?
        ├─ Yes → NextAuth.js (if building Next.js apps)
        └─ No
            │
            Do you need OAuth (Google, GitHub)?
            ├─ Yes → fastapi-users ✅ (recommended)
            └─ No
                │
                Do you want to minimize code?
                ├─ Yes → fastapi-users ✅ (still recommended)
                └─ No → Custom sessions (DIY)
```

### Implementation Recommendation

**Phase 3: Use fastapi-users**

```python
# Week 1: Backend (40 hours)
pip install fastapi-users[sqlalchemy]
# Follow official docs: https://fastapi-users.github.io/fastapi-users/

# Week 2: Frontend (40 hours)
# Build React auth UI
# Integrate with fastapi-users endpoints

# Week 3: Testing (20 hours)
# Security tests, integration tests

# Total: 100 hours (2.5 weeks)
```

**Phase 7: Evaluate Migration**

When you reach Phase 7 (shared platform auth), you have options:

1. **Keep fastapi-users** — Add it as the shared auth service
   - Other apps use fastapi-users client
   - Minimal migration

2. **Replace with platform auth** — Migrate to centralized service
   - Export users from fastapi-users (standard SQLAlchemy)
   - Import to new auth service
   - Update endpoints

Fastapi-users doesn't lock you in — it's just SQLAlchemy + FastAPI.

---

## 8. Security Best Practices (Regardless of Choice)

### Mandatory Security Requirements

**All options must implement:**

1. **Password Security:**
```python
# ✅ bcrypt with work factor ≥ 12
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12)

# ✅ Password strength validation
import zxcvbn
if zxcvbn(password)['score'] < 3:
    raise ValueError("Password too weak")

# ✅ Common password check
from commonpasswords import is_common
if is_common(password):
    raise ValueError("Password too common")
```

2. **Token/Session Security:**
```python
# ✅ Cryptographically random secrets
SECRET_KEY = secrets.token_urlsafe(32)  # 256 bits

# ✅ HttpOnly cookies
response.set_cookie(
    "session",
    value,
    httponly=True,
    secure=True,
    samesite="strict",
)

# ✅ Short-lived access tokens
ACCESS_TOKEN_EXPIRE = 3600  # 1 hour
REFRESH_TOKEN_EXPIRE = 30 * 24 * 3600  # 30 days
```

3. **Rate Limiting:**
```python
from slowapi import Limiter

@app.post("/auth/login")
@limiter.limit("5/15minutes")
async def login(...): ...

@app.post("/auth/register")
@limiter.limit("3/hour")
async def register(...): ...
```

4. **Input Validation:**
```python
from pydantic import BaseModel, EmailStr, field_validator

class UserCreate(BaseModel):
    email: EmailStr  # Validates email format
    password: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 12:
            raise ValueError("Password must be ≥12 characters")
        # Check complexity...
        return v
```

5. **Logging & Monitoring:**
```python
import logging

# ✅ Log auth events
logger.info("Login success", extra={"user_id": user.id, "ip": request.client.host})
logger.warning("Login failed", extra={"email": email, "ip": request.client.host})

# ❌ Never log passwords
# logger.info(f"Password: {password}")  # NEVER!
```

6. **HTTPS Enforcement:**
```python
# In production
if not request.url.scheme == "https":
    raise HTTPException(403, "HTTPS required")

# Or use middleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
app.add_middleware(HTTPSRedirectMiddleware)
```

### Security Audit Checklist

Before launching Phase 3:

- [ ] Passwords hashed with bcrypt (rounds ≥ 12)
- [ ] JWT secrets are cryptographically random (≥256 bits)
- [ ] HttpOnly cookies with Secure + SameSite flags
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enforced in production
- [ ] SQL injection prevented (use ORM)
- [ ] XSS prevented (React auto-escapes, validate backend)
- [ ] CSRF prevented (SameSite cookies)
- [ ] Password reset tokens expire (15-30 min)
- [ ] Email verification tokens expire
- [ ] Failed login attempts logged
- [ ] User enumeration prevented (generic error messages)
- [ ] Session/token expiration works
- [ ] Logout invalidates session/token
- [ ] Dependencies scanned for CVEs (`safety check`)
- [ ] Secrets not in git (`.env` in `.gitignore`)

### Ongoing Security Maintenance

**Monthly:**
- [ ] Review auth logs for suspicious patterns
- [ ] Update dependencies (`uv sync --upgrade`)

**Quarterly:**
- [ ] Run `safety check` for dependency CVEs
- [ ] Review OWASP Top 10 changes
- [ ] Test rate limiting still works

**Annually:**
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Rotate JWT secrets (with grace period)

---

## 9. Conclusion

### TL;DR Recommendation

**Use fastapi-users** for Phase 3.

**Why:**
- ✅ 57% cheaper than NextAuth ($29k vs $69k over 5 years)
- ✅ 85% cheaper than custom JWT ($29k vs $132k)
- ✅ Production-ready security out of the box
- ✅ OAuth-ready for Phase 4+
- ✅ Aligns with PRD self-hosted requirement
- ✅ Low maintenance burden (15-30 hours/year)
- ✅ Single Python stack (no Node.js complexity)

**When to reconsider:**
- If you pivot to fully managed SaaS → Supabase
- If you add Next.js apps to platform → NextAuth
- If you hire a security engineer → Custom JWT (maybe)

### Next Steps

1. **Approve this analysis** → Decision: fastapi-users
2. **Review phase-3-auth-design.md** → Fill in Section 15 (Decision Log)
3. **Create Phase 3A task list** → Backend implementation
4. **Set up development environment** → PostgreSQL, Redis via Docker Compose
5. **Start implementation** → Follow fastapi-users quickstart

### Questions?

Let me know if you want me to:
- Set up the initial fastapi-users implementation
- Create detailed implementation tasks
- Build the database schema and migrations
- Write security tests

---

**Last updated:** 2026-05-14
**Document status:** Ready for decision
