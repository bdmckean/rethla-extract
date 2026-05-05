# Phase 3: Authentication and Accounts - Design Document

**Status:** Draft
**Created:** 2026-05-05
**Author:** [Your name]
**Related PRD:** [docs/PRD.md](./PRD.md) §5.10, §1.1 Phase 3

---

## 1. Overview

### 1.1 Goals

Implement user authentication and account management for Transcript App, enabling:
- User sign-up and sign-in
- Per-user data isolation (jobs, transcripts, usage)
- Session management and security
- Foundation for Phase 4 (admin) and Phase 6 (payments)

### 1.2 Scope (Phase 3)

**In scope:**
- User registration and login
- Session/token management
- Per-user job and transcript scoping
- Basic user profile page
- "My transcripts" view
- User account database schema

**Out of scope (later phases):**
- Admin console (Phase 4)
- Payment integration (Phase 6)
- Social login (OAuth) - optional for Phase 3, prioritize email-based
- Multi-factor authentication (MFA) - Phase 4+

### 1.3 Success Criteria

- [ ] Users can create accounts and sign in
- [ ] Jobs are scoped to the authenticated user
- [ ] Users can only view their own transcripts
- [ ] Sessions persist across browser refreshes
- [ ] Secure password handling (hashing, salting)
- [ ] HTTPS-ready for production (local dev can use HTTP)

---

## 2. Requirements Summary (from PRD §5.10)

| Requirement | Priority | Notes |
|------------|----------|-------|
| Every user must sign in (no anonymous use) | P0 | Hosted web only; local mode TBD |
| Email-based login (email + password or magic link) | P0 | Choose one for MVP |
| Secure session management (cookies/tokens, HTTPS) | P0 | |
| Per-user data scoping (transcripts, jobs, usage) | P0 | |
| Users cannot access other users' data | P0 | Security requirement |
| Social login (Google, GitHub) | P2 | Optional for Phase 3 |

---

## 3. Key Architecture Decisions

### 3.1 Auth Strategy

**Decision needed:** Choose authentication approach for Phase 3.

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. NextAuth.js** | Industry standard, OAuth ready, session + JWT, integrates with React | Adds dependency, some Next.js coupling | ⭐ **Recommended** - aligns with PRD §5.15 shared platform auth |
| **B. FastAPI + JWT** | Full control, lightweight, Python-native | Must build everything, no OAuth out of box | Good if avoiding Next.js ecosystem |
| **C. Supabase Auth** | Batteries included, free tier, realtime | External service dependency, vendor lock-in | Quick MVP but not aligned with self-hosted PRD |
| **D. Custom FastAPI + sessions** | Simple, no external deps | Manual security, limited scalability | Too basic for production |

**Proposed choice:** **Option A (NextAuth.js)** or **Option B (FastAPI + JWT)**

**Rationale:**
- PRD §5.15 mentions "NextAuth.js-style" shared auth for platform
- Phase 3 is still local development, but choosing NextAuth now validates the platform approach
- If we choose FastAPI + JWT, we need to ensure it can integrate with shared auth later

**DECISION REQUIRED:** Which option aligns with your platform vision?

---

### 3.2 Session vs. Token Authentication

| Approach | Description | Best for |
|----------|-------------|----------|
| **Session cookies** | Server-side session, cookie stores session ID | Traditional web apps, single domain |
| **JWT tokens** | Stateless token in localStorage/cookie | APIs, mobile apps, microservices |
| **Hybrid** | JWT in httpOnly cookie | Modern SPAs with security |

**Proposed choice:** **Hybrid (JWT in httpOnly cookie)**

**Rationale:**
- httpOnly cookie prevents XSS attacks (can't access from JavaScript)
- JWT allows stateless validation (scales horizontally)
- Standard for modern SPAs
- Compatible with platform auth in Phase 7

---

### 3.3 Password vs. Passwordless (Magic Link)

| Approach | User Experience | Implementation Complexity |
|----------|----------------|--------------------------|
| **Email + Password** | Familiar, works offline | Hash/salt, password reset flow |
| **Magic Link** | No password to remember | Requires email service, online only |
| **Both** | User choice | Higher complexity |

**Proposed choice:** **Email + Password** (MVP), add magic link in Phase 4

**Rationale:**
- Simpler for local development (no email service required)
- Can add magic link later once email infrastructure is set up
- Most users expect password-based login

**DECISION REQUIRED:** Do you have email sending set up (SMTP, SendGrid, etc.)?

---

## 4. Data Model

### 4.1 Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- bcrypt hash
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'suspended', 'pending_verification'
    email_verified BOOLEAN DEFAULT FALSE,

    -- For future use
    role VARCHAR(50) DEFAULT 'user',  -- 'user', 'admin' (Phase 4)
    metadata JSONB  -- Flexible storage for future fields
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Sessions table (if using server-side sessions)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- Hashed session token
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Update existing jobs table
ALTER TABLE jobs ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);

-- Transcript metadata table (NEW - to track ownership)
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    job_id UUID REFERENCES jobs(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    audio_duration_seconds DECIMAL,
    speaker_count INTEGER,
    language VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    size_bytes BIGINT,

    -- For Phase 6 billing
    billable_units JSONB  -- {transcripts: 1, minutes: 15.5}
);

CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX idx_transcripts_created_at ON transcripts(created_at);
```

### 4.2 Data Migration Plan

**Current state:** Jobs are created without user_id (local mode)

**Migration strategy:**
1. Add `user_id` column as **nullable** initially
2. Create a "system" user for existing jobs
3. After Phase 3 launch, make `user_id` required for new jobs
4. Phase 4+: Backfill or archive old jobs

---

## 5. API Design

### 5.1 New Endpoints (Authentication)

```
POST   /api/auth/register        # Create new account
POST   /api/auth/login           # Sign in
POST   /api/auth/logout          # Sign out
GET    /api/auth/me              # Get current user
POST   /api/auth/refresh         # Refresh token
POST   /api/auth/forgot-password # Request password reset
POST   /api/auth/reset-password  # Complete password reset
```

### 5.2 Updated Endpoints (Scoped to User)

```
# Jobs - now user-scoped
POST   /api/jobs/                # Create job (auto-assign to current user)
GET    /api/jobs/:id             # Get job (only if user owns it)
GET    /api/jobs/                # List user's jobs only

# Transcripts - now user-scoped
GET    /api/transcripts/         # List user's transcripts
GET    /api/transcripts/:id      # Get transcript (only if user owns it)
POST   /api/transcripts/download/:id  # Download (only if user owns it)
```

### 5.3 Example: Registration Flow

**Request:**
```json
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "display_name": "Jane Doe"
}
```

**Response (success):**
```json
HTTP 201 Created
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict

{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "display_name": "Jane Doe",
    "created_at": "2026-05-05T10:00:00Z"
  }
}
```

**Response (error):**
```json
HTTP 400 Bad Request

{
  "detail": "Email already registered"
}
```

### 5.4 Example: Login Flow

**Request:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
HTTP 200 OK
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict

{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "display_name": "Jane Doe"
  }
}
```

---

## 6. Frontend (React) Design

### 6.1 New Pages/Routes

```
/login           # Login page
/register        # Registration page
/profile         # User profile page (view/edit)
/my-transcripts  # User's transcript history
```

### 6.2 Auth Context

```typescript
// src/contexts/AuthContext.tsx
interface User {
  id: string
  email: string
  display_name: string | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthProvider: React.FC<{children: ReactNode}>
export const useAuth: () => AuthContextValue
```

### 6.3 Protected Routes

```typescript
// src/components/ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" />

  return <>{children}</>
}

// Usage in App.tsx
<Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>} />
```

### 6.4 UI Components

```
LoginForm         # Email/password form
RegisterForm      # Sign-up form
ProfileView       # Display user info
ProfileEdit       # Edit user info
TranscriptsList   # User's transcripts (replaces current "Completed" section)
```

---

## 7. Security Considerations

### 7.1 Password Security

- **Hashing:** Use bcrypt with cost factor 12+ (Python: `bcrypt` library)
- **Validation:** Minimum 8 characters, require mix of letters/numbers/symbols
- **Storage:** NEVER store plain text passwords
- **Reset:** Time-limited reset tokens (15-30 min expiry)

```python
# Example (FastAPI)
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
```

### 7.2 Session Security

- **HttpOnly cookies:** Prevent XSS access to tokens
- **Secure flag:** Only send over HTTPS (production)
- **SameSite:** Set to Strict or Lax to prevent CSRF
- **Expiration:** 7-30 day lifetime, refresh before expiry
- **Invalidation:** Clear session on logout server-side

### 7.3 Rate Limiting

Prevent brute force attacks:
```
/api/auth/login       → 5 attempts per 15 min per IP
/api/auth/register    → 3 attempts per hour per IP
/api/auth/forgot-password → 3 attempts per hour per email
```

### 7.4 Input Validation

- Email: Valid format, lowercase normalization
- Password: Length, complexity, common password check
- SQL injection: Use parameterized queries (SQLAlchemy/Prisma handles this)
- XSS: React escapes by default, but validate on backend too

---

## 8. Implementation Plan

### 8.1 Phase 3A: Backend Auth (Week 1)

**Tasks:**
- [ ] Set up database schema (users, sessions tables)
- [ ] Implement password hashing utilities
- [ ] Create auth endpoints (register, login, logout, /me)
- [ ] Add user_id to jobs table and scope job creation
- [ ] Implement JWT or session token generation
- [ ] Add authentication middleware
- [ ] Write unit tests for auth endpoints

**Deliverable:** Working auth API, testable via Postman/curl

### 8.2 Phase 3B: Frontend Auth UI (Week 2)

**Tasks:**
- [ ] Create AuthContext and useAuth hook
- [ ] Build Login page/form
- [ ] Build Register page/form
- [ ] Add ProtectedRoute wrapper
- [ ] Update App.tsx to require auth
- [ ] Add logout button to header
- [ ] Build Profile page (basic view)
- [ ] Update job creation to include user_id automatically

**Deliverable:** Users can register, login, and see their own jobs

### 8.3 Phase 3C: Transcript Scoping (Week 3)

**Tasks:**
- [ ] Create transcripts table with user_id
- [ ] Update job completion to create transcript records
- [ ] Implement "My Transcripts" page (user-scoped list)
- [ ] Add download endpoint with ownership check
- [ ] Migrate existing transcripts to system user
- [ ] Add usage tracking foundation (for Phase 6)

**Deliverable:** Users see only their transcripts, can download them

### 8.4 Phase 3D: Polish & Testing (Week 4)

**Tasks:**
- [ ] Add password reset flow
- [ ] Implement rate limiting
- [ ] Add error handling and user feedback
- [ ] Write integration tests
- [ ] Security audit (check OWASP top 10)
- [ ] Update documentation (README, API docs)
- [ ] Localize auth UI (EN/ES per PRD §5.6)

**Deliverable:** Production-ready auth system

---

## 9. Technology Stack Decisions

### 9.1 Backend (FastAPI)

**Option A: FastAPI + JWT + bcrypt**
```python
# Dependencies to add to pyproject.toml
dependencies = [
    "fastapi-users[sqlalchemy]>=13.0.0",  # Full-featured auth
    # OR build custom:
    "python-jose[cryptography]>=3.3.0",  # JWT
    "passlib[bcrypt]>=1.7.4",            # Password hashing
    "python-multipart>=0.0.9",           # Form data
]
```

**Option B: Use fastapi-users library**
- Pros: Batteries included, JWT/session support, OAuth ready
- Cons: Opinionated, learning curve
- Recommendation: Good for MVP, aligns with PRD

### 9.2 Frontend (React)

```json
// package.json additions
{
  "dependencies": {
    "react-router-dom": "^6.x",  // If not already added
    "@tanstack/react-query": "^5.x"  // Optional: API state management
  }
}
```

### 9.3 Database

**Current:** Need to add PostgreSQL (per PRD §5.15)

**For Phase 3 (local):**
```bash
# Option 1: Local Postgres via Docker
docker run --name transcript-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# Option 2: Add to docker-compose.yml (recommended)
```

**Migration:** Use Alembic (SQLAlchemy) or Prisma migrations

---

## 10. Open Questions

### 10.1 Decisions Needed

| Question | Options | Impact | Owner |
|----------|---------|--------|-------|
| Auth library or custom? | fastapi-users vs. custom JWT | Development speed | [TBD] |
| Session vs JWT? | Server-side sessions vs. stateless JWT | Scalability | [TBD] |
| Email service for password reset? | SendGrid, Mailgun, Postmark, none (defer) | Password reset flow | [TBD] |
| Social login in Phase 3? | Yes (Google/GitHub) or defer to Phase 4 | Scope creep | [TBD] |
| Local mode auth? | Same as cloud, separate, or none | User experience | [TBD] |

### 10.2 PRD Clarifications

- **§7.2:** "Local vs cloud account" - Should local dev require login? Or only hosted?
- **§5.15:** Shared platform auth - Can we preview integration in Phase 3 or wait for Phase 7?

---

## 11. Testing Strategy

### 11.1 Unit Tests (Backend)

```python
# tests/test_auth.py
def test_register_success():
    """User can register with valid email/password"""

def test_register_duplicate_email():
    """Registration fails for existing email"""

def test_login_success():
    """User can login with correct credentials"""

def test_login_invalid_password():
    """Login fails with wrong password"""

def test_protected_endpoint_requires_auth():
    """Job creation requires authentication"""

def test_user_can_only_see_own_jobs():
    """Users cannot access other users' jobs"""
```

### 11.2 Integration Tests

```python
def test_full_auth_flow():
    """Register → Login → Create Job → Logout → Login → See Job"""

def test_password_reset_flow():
    """Request reset → Receive token → Reset password → Login with new password"""
```

### 11.3 Security Tests

- [ ] Password hashing verified (bcrypt)
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (input sanitization)
- [ ] CSRF prevented (SameSite cookies)
- [ ] Rate limiting works (login attempts)
- [ ] Session expiration works
- [ ] Unauthorized access blocked

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Password reset without email service | High - can't reset passwords | Defer reset to Phase 4 or set up SendGrid in Phase 3 |
| Session management complexity | Medium - bugs, security issues | Use proven library (fastapi-users) |
| Migration breaks existing jobs | High - data loss | Thorough testing, nullable user_id initially |
| HTTPS not available locally | Medium - can't test secure cookies | Use HTTP locally, document HTTPS for production |
| Auth blocks local development | Medium - slower iteration | Add "dev mode" bypass or use test account |

---

## 13. Future Considerations (Post-Phase 3)

**Phase 4 (Admin):**
- Admin role in users table
- Admin-only endpoints
- User management UI

**Phase 6 (Payments):**
- Stripe customer_id in users table
- Usage records linked to user_id
- Billing page

**Phase 7 (Platform):**
- Migrate to shared platform auth service
- SSO across multiple apps
- Centralized user management

---

## 14. References

- [PRD - docs/PRD.md](./PRD.md)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [fastapi-users Documentation](https://fastapi-users.github.io/fastapi-users/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

## 15. Approval and Sign-off

**Decision Log:**

| Decision | Option Chosen | Date | Rationale |
|----------|--------------|------|-----------|
| Auth approach | [TBD] | | |
| Session/token | [TBD] | | |
| Email service | [TBD] | | |
| Social login | [TBD] | | |

**Stakeholder Approval:**

- [ ] Product (PRD alignment)
- [ ] Engineering (technical feasibility)
- [ ] Security (threat model review)

---

**Next Steps:**
1. Review this design doc
2. Make key decisions (Section 10)
3. Create implementation tasks
4. Begin Phase 3A (Backend Auth)
