// App entry: cors, helmet, routes, static, cleanup job
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const auth = require('./auth/middleware');
const startCleanup = require('./lib/cleanup');

const app = express();

// Behind the Nginx reverse proxy: trust the first proxy hop so req.ip and
// express-rate-limit read the real client IP from X-Forwarded-For.
// '1' = trust exactly one proxy (Nginx), which is safe for rate limiting.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '1mb' }));

// --- CORS -------------------------------------------------------------
// Local testing: set DISABLE_CORS=true in .env to allow any origin.
// Production: locked to hasaniche.com + its subdomains.
const ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?hasaniche\.com$/;

// >>> CORS TEMPORARILY REMOVED — allowing ALL origins for testing.
//     Restore the locked-down block below when done (user will confirm).
console.log('[cors] REMOVED — all origins allowed (testing mode)');
app.use(cors());
/*  --- Restore this for production ------------------------------------
if (process.env.DISABLE_CORS === 'true') {
  console.log('[cors] DISABLED — allowing all origins (local dev only)');
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);         // curl / server-to-server
      if (ORIGIN_RE.test(origin)) return cb(null, true);
      return cb(new Error('Blocked by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));
}
--------------------------------------------------------------------- */

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Auth (open)
app.use('/api/auth', require('./auth/routes'));

// Everything below requires a JWT
app.use('/api', auth);
app.use('/api/products', require('./routes/products'));
app.use('/api', require('./routes/suppliers'));
app.use('/api', require('./routes/tags'));
app.use('/api', require('./routes/adlinks'));
app.use('/api', require('./routes/adangles'));
app.use('/api', require('./routes/comments'));
app.use('/api/ranking', require('./routes/ranking'));

// Error handler (incl. CORS + multer)
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 400).json({ error: err.message || 'Server error' });
});

startCleanup();

const PORT = process.env.PORT || 5011;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
