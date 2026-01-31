# AI Coding Instructions for IV-AEGIS

## Architecture Overview
IV-AEGIS is a security-hardened contact form system with comprehensive DDoS protection. The codebase is structured as a monorepo:
- **Backend** (Node.js + Express + SQLite): Security-focused REST API with multi-layered DDoS defenses
- **Frontend** (Vanilla HTML/CSS/JS): Futuristic UI that submits to contact form endpoint

**Key principle**: Security-first design across all layers. Custom DDoS protection is implemented instead of relying solely on external libraries.

## Development Workflows

### Starting Development
```bash
# Root setup
npm install && cd backend && npm install

# Development mode (uses nodemon for auto-restart)
cd backend && npm run dev

# Production mode
cd backend && npm start

# Health check endpoint
curl http://localhost:3001/health
```

### Key API Endpoints
- `POST /api/contact/submit` - Submit contact form (rate-limited 5 requests/hour per IP)
- `GET /api/contact/list` - Retrieve all contacts (requires pagination in production)
- `PUT /api/contact/:id/status` - Update contact status (new/contacted/resolved/spam)
- `GET /health` - Health check with memory and request stats

## Project-Specific Patterns

### 1. Multi-Layered DDoS Protection Strategy
The backend implements three distinct protection layers (see [backend/server.js](backend/server.js)):

**Layer 1 - Custom Rate Limiting** (`ddosProtection` middleware):
- Tracks requests per IP using in-memory `Map` with 15-minute sliding windows
- Blocks IPs for 30 minutes after exceeding 100 requests per window
- Auto-cleans expired records every 60 seconds to prevent memory leaks
- Always extract client IP from `X-Forwarded-For` header (for reverse proxy compatibility)

**Layer 2 - Request Body Constraints**:
- JSON body size limited to 1MB
- URL-encoded parameter limit: 50 parameters max
- Request/response timeouts: 10 seconds

**Layer 3 - Library-Based Rate Limiting** (`express-rate-limit`):
- Global: 100 requests per 15 minutes per IP
- Form submissions: 5 requests per hour per IP (stricter limit)
- Skips health check endpoint and favicons

### 2. Form Validation Pattern (Multi-Stage)
Located in [backend/contact.js](backend/contact.js):
```javascript
const validation = validateContactForm({ name, email, message }, req);
// Returns: { isValid: bool, errors: [], ipAddress: string }
```

Validation stages in order:
1. **Basic validation**: Length constraints (name ≥2, message 10-5000 chars)
2. **Spam detection**: Count occurrences of SPAM_KEYWORDS (13 English keywords)
3. **Email blacklist**: Reject temporary email domains (tempmail, 10minutemail, etc.)
4. **Frequency check**: Prevent duplicate submissions from same email within 1 hour

**Important**: When modifying validation, always update the SPAM_KEYWORDS and EMAIL_BLACKLIST arrays at the top of contact.js.

### 3. Database Pattern
SQLite database with auto-initialization in [backend/database.js](backend/database.js):
- Contacts table: Stores name, email, message, IP, user-agent, status, timestamp
- Logs table: Tracks all API endpoint activity (method, status code, message)
- `createTables()` runs automatically on connection and creates missing tables
- No migrations system - table schema changes are handled inline

When querying, always use parameterized queries to prevent SQL injection:
```javascript
db.run(sql, [param1, param2], callback)  // ✓ Correct
```

### 4. Response Format Convention
All API responses follow this structure (both success and error):
```javascript
{
  success: boolean,
  message: string,           // User-friendly message in Chinese
  data?: object,             // Only for successful responses
  errors?: string[],         // Only for validation failures
  contactId?: number,        // Contact ID on form submission
  timestamp?: string         // ISO format for timestamps
}
```

Rate-limit header responses include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 5. Logging Convention
Every action must be logged via `logRequest(endpoint, method, statusCode, message)`:
- Called before sending error responses
- Endpoint format: `/api/contact/submit` (always include leading slash)
- Status codes: 200 (success), 201 (created), 400 (validation), 429 (rate limit), 500 (server error)
- Messages are descriptive (not just "OK") and include error details for debugging

### 6. Error Handling Middleware
Global error handler at bottom of [backend/server.js](backend/server.js):
- Logs all errors with timestamp, method, URL, IP, error message
- Returns 400 for JSON format errors, 413 for oversized payloads
- Development mode includes stack traces; production hides them
- Process cleanup (SIGINT/SIGTERM) clears DDoS records before exit

## Important Implementation Notes

### CORS Configuration
Frontend development origin must be added to `app.use(cors())` allowed origins:
```javascript
origin: ['http://localhost:5500', 'http://localhost:3000', 'YOUR_NEW_DOMAIN'],
```
Only GET and POST methods are allowed (no PUT/DELETE from frontend).

### IP Extraction Logic (Reused Pattern)
Always use this pattern when getting client IP (handles proxy chains):
```javascript
const clientIP = req.headers['x-forwarded-for'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : 'unknown');
```

### Environment Variables Needed
- `PORT` (default 3001)
- `NODE_ENV` ('development' or 'production')
- `ADMIN_API_KEY` (for /api/contact/stats endpoint)

### Security Checklist for Modifications
- [ ] Does the change access user input? → Add validation and logging
- [ ] Does it create a network request path? → Add rate limiting via contactFormLimiter or globalLimiter middleware
- [ ] Does it read/write database? → Use parameterized queries and catch errors
- [ ] Does it expose admin functionality? → Require X-API-Key header (see /stats endpoint pattern)

## Frontend Integration Points
The frontend sends POST requests to `/api/contact/submit` with JSON:
```json
{ "name": "string", "email": "string", "message": "string" }
```

Frontend is served as static files from `/frontend` directory with 1-hour cache, except HTML (no-cache).
