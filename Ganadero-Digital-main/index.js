require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const connectPgSimple = require('connect-pg-simple');
const memoizee = require('memoizee');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const hpp = require('hpp');
const { body, param, query, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse/sync');

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('[WARN] EMAIL_USER o EMAIL_PASS no configurados - los correos de invitación no se enviarán');
}

const app = express();
console.log('[BOOT] index.js loaded');

app.use((req, res, next) => {
  console.log('[DEBUG]', req.method, req.path);
  next();
});

// Feature flag para categorías V2
const FEATURE_CATEGORIAS_V2 = String(process.env.FEATURE_CATEGORIAS_V2 || 'false').toLowerCase() === 'true';
console.log('[BOOT] FEATURE_CATEGORIAS_V2=', FEATURE_CATEGORIAS_V2);

// Configuración simple del puerto - usar PORT del entorno o 5000 por defecto
const PORT = process.env.PORT || 5000;
const DEV_BYPASS = true;

// ============================================================
// VALIDACION DE CONFIGURACION DE SEGURIDAD
// ============================================================
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  console.warn('[WARN] SESSION_SECRET tiene menos de 32 caracteres');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ============================================================
// ENCRIPTACIÓN AES-256-GCM PARA CREDENCIALES DE GESTOR MAX
// ============================================================
let ENCRYPTION_KEY = null;
let ENCRYPTION_ENABLED = false;

if (process.env.APP_ENCRYPTION_KEY_B64) {
  try {
    ENCRYPTION_KEY = Buffer.from(process.env.APP_ENCRYPTION_KEY_B64, 'base64');
    if (ENCRYPTION_KEY.length !== 32) {
      console.error('[ERROR] APP_ENCRYPTION_KEY_B64 debe ser base64 de 32 bytes (AES-256). Longitud actual:', ENCRYPTION_KEY.length);
      ENCRYPTION_KEY = null;
    } else {
      ENCRYPTION_ENABLED = true;
      console.log('[SECURITY] Encriptación AES-256-GCM habilitada para credenciales de Gestor Max');
    }
  } catch (err) {
    console.error('[ERROR] APP_ENCRYPTION_KEY_B64 inválido:', err.message);
  }
} else {
  console.warn('[WARN] APP_ENCRYPTION_KEY_B64 no configurado - endpoints de configuración Gestor Max deshabilitados');
}

function encryptCredential(plaintext) {
  if (!ENCRYPTION_KEY) throw new Error('Encriptación no disponible');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('base64') + '.' + tag.toString('base64') + '.' + encrypted.toString('base64');
}

function decryptCredential(payload) {
  if (!ENCRYPTION_KEY) throw new Error('Encriptación no disponible');
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Formato de payload inválido');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

async function listConceptosGestor(databaseId, apiKey, options = {}) {
  const baseUrl = options.baseUrl || 'https://api.gestormax.com';
  const authScheme = options.authScheme || 'x-api-key';
  const soloFisicos = options.soloFisicos !== undefined ? options.soloFisicos : true;
  
  const url = `${baseUrl}/v3/GestorG4/ListConceptos?databaseId=${databaseId}&soloFisicos=${soloFisicos}`;
  const headers = { 'accept': '*/*' };
  
  if (authScheme === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['X-Api-Key'] = apiKey;
  }
  
  const response = await fetch(url, { method: 'GET', headers });
  
  if (response.status !== 200) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 300)}`);
  }
  
  return response.json();
}

// ============================================================
// MIDDLEWARE DE SEGURIDAD - HELMET (Headers HTTP seguros)
// ============================================================
if (DEV_BYPASS) {
  console.log('[DEV] Helmet deshabilitado');
} else {
  app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://replit.com", "https://*.replit.com", "https://*.repl.co", "https://*.replit.dev"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", "https://replit.com", "https://*.replit.com", "https://*.replit.dev", "https://*.repl.co"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  }));
}

// ============================================================
// MIDDLEWARE DE SEGURIDAD - CORS (Control de Origenes)
// ============================================================
const allowedOrigins = [
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null,
  'https://replit.com'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/+$/, '')))) {
      return callback(null, true);
    }
    if (origin.endsWith('.replit.dev') || origin.endsWith('.repl.co') || origin.endsWith('.replit.com')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
}));

// ============================================================
// MIDDLEWARE DE SEGURIDAD - RATE LIMITING
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes, intente nuevamente mas tarde' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  validate: { xForwardedForHeader: false }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de autenticacion, intente nuevamente en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas operaciones de escritura, intente nuevamente en un minuto' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas consultas, intente en un minuto' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);
app.use('/api/login', authLimiter);
app.use('/api/callback', authLimiter);

// ============================================================
// MIDDLEWARE DE SEGURIDAD - HPP (HTTP Parameter Pollution)
// ============================================================
app.use(hpp({
  whitelist: ['tenant_id', 'campo_id', 'categoria_id']
}));

// ============================================================
// MIDDLEWARE DE SEGURIDAD - Body parsing con limites
// ============================================================
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================================
// MIDDLEWARE DE SEGURIDAD - Cache Control para archivos estaticos
// ============================================================
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Deshabilitar cache para HTML, JS y CSS
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ============================================================
// LOGGING DE SEGURIDAD
// ============================================================
const securityLog = (event, details, req = null) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    ip: req ? (req.ip || req.headers['x-forwarded-for'] || 'unknown') : 'system',
    userAgent: req ? req.headers['user-agent'] : 'system',
    userId: req?.user?.claims?.sub || null
  };
  if (event.includes('FAILED') || event.includes('ERROR') || event.includes('BLOCKED')) {
    console.warn('[SECURITY]', JSON.stringify(logEntry));
  }
};

// ============================================================
// FUNCIONES DE VALIDACION Y SANITIZACION
// ============================================================
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, 1000);
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    securityLog('VALIDATION_FAILED', { errors: errors.array() }, req);
    return res.status(400).json({ 
      error: 'Datos de entrada invalidos',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const validateInteger = (value, fieldName) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 2147483647) {
    throw new Error(`${fieldName} debe ser un numero entero valido`);
  }
  return parsed;
};

const PgSession = connectPgSimple(session);

function getPublicHost(req) {
  return req.get('X-Forwarded-Host') || req.get('Host') || process.env.REPLIT_DEV_DOMAIN || req.hostname;
}

function getPublicUrl(req) {
  const host = getPublicHost(req);
  const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
  return `${protocol}://${host}`;
}

app.set('trust proxy', 1);
app.use(session({
  store: DEV_BYPASS ? new session.MemoryStore() : new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.REPL_ID ? true : false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/test', (req, res) => {
  console.log('[TEST] Endpoint called');
  res.json({ test: 'ok' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const getOidcConfig = memoizee(async () => {
  const openidClient = await import('openid-client');
  return await openidClient.discovery(
    new URL(process.env.ISSUER_URL || 'https://replit.com/oidc'),
    process.env.REPL_ID
  );
}, { maxAge: 3600 * 1000 });

async function upsertReplitUser(claims) {
  try {
    await pool.query(`
      INSERT INTO replit_users (id, email, first_name, last_name, profile_image_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_image_url = EXCLUDED.profile_image_url,
        updated_at = NOW()
    `, [String(claims.sub), claims.email, claims.first_name, claims.last_name, claims.profile_image_url]);
  } catch (err) {
    console.error('Error upserting Replit user:', err);
  }
}

async function getReplitUser(id) {
  const result = await pool.query('SELECT * FROM replit_users WHERE id = $1', [id]);
  return result.rows[0];
}

async function getUserRoleAndCampos(replitUserId) {
  const userResult = await pool.query(`
    SELECT u.id, u.nombre, u.email, u.tenant_id, u.activo, r.nombre as rol
    FROM usuarios u
    JOIN roles r ON u.rol_id = r.id
    WHERE u.replit_user_id = $1
  `, [replitUserId]);

  if (userResult.rows.length === 0) {
    return { rol: 'cliente', usuario_id: null, tenant_id: null, tenant_ids: [], vinculado: false };
  }
  
  const user = userResult.rows[0];
  
  if (!user.activo) {
    return { rol: 'cliente', usuario_id: user.id, tenant_id: null, tenant_ids: [], vinculado: true, activo: false };
  }

  const rol = user.rol;

  if (rol === 'administrador') {
    return { rol, usuario_id: user.id, tenant_id: null, tenant_ids: null };
  }

  if (rol === 'cliente') {
    if (!user.tenant_id) {
      return { rol, usuario_id: user.id, tenant_id: null, tenant_ids: [] };
    }
    return { rol, usuario_id: user.id, tenant_id: user.tenant_id, tenant_ids: [user.tenant_id] };
  }

  if (rol === 'auditor') {
    const tenantsResult = await pool.query(
      'SELECT tenant_id FROM auditor_clientes WHERE auditor_id = $1',
      [user.id]
    );
    const tenantIds = tenantsResult.rows.map(r => r.tenant_id);
    return { rol, usuario_id: user.id, tenant_id: null, tenant_ids: tenantIds };
  }

  return { rol: 'cliente', usuario_id: user.id, tenant_id: null, tenant_ids: [], vinculado: true };
}

async function getActiveTenantId(req) {
  const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);

  // --- CORRECCIÓN CRÍTICA: BYPASS DE SESIÓN PARA CLIENTES ---
  // Si el usuario es Cliente, su tenant es FIJO. No dependemos de la cookie de sesión.
  if (roleInfo.rol === 'cliente') {
    if (!roleInfo.tenant_id || typeof roleInfo.tenant_id !== 'number' || roleInfo.tenant_id <= 0) {
      // Cliente sin empresa asignada en BD -> Bloqueo de seguridad
      console.warn('[SECURITY] Cliente sin tenant válido:', roleInfo.usuario_id, 'tenant:', roleInfo.tenant_id);
      return { error: 'Usuario cliente sin empresa asignada. Contacte soporte.', code: 403 };
    }
    // Retornamos DIRECTO el ID de la base de datos.
    return { activeTenantId: roleInfo.tenant_id, roleInfo }; 
  }

  // --- LÓGICA PARA ROLES MULTI-TENANT (Auditor/Admin) ---
  if (roleInfo.rol === 'auditor' || roleInfo.rol === 'administrador') {
    const sessionTenantId = req.session?.active_tenant_id;
    
    // Admin global (sin seleccionar)
    if (roleInfo.rol === 'administrador' && !sessionTenantId) {
        return { activeTenantId: null, roleInfo, isAdmin: true };
    }

    if (!sessionTenantId) {
        return { error: 'Debe seleccionar un cliente', code: 403, requiresClientSelection: true };
    }
    
    // Validación de seguridad para auditor
    if (roleInfo.rol === 'auditor' && (!roleInfo.tenant_ids || !roleInfo.tenant_ids.includes(sessionTenantId))) {
         return { error: 'Acceso denegado a este cliente', code: 403 };
    }
    
    return { activeTenantId: sessionTenantId, roleInfo };
  }

  return { error: 'Rol no identificado', code: 403 };
}

// HELPER: Única fuente de verdad para determinar el tenant
function resolveTenantContext(user, session) {
  if (!user) return null;
  
  // CASO CLIENTE: El tenant es inmutable, viene de la BD.
  if (user.rol === 'cliente') {
    return user.tenant_id || null;
  }
  
  // CASO ADMIN/AUDITOR: Depende de la selección manual en sesión.
  if (user.rol === 'auditor' || user.rol === 'administrador') {
    return session?.active_tenant_id || null;
  }
  
  return null;
}

// Middleware que BLOQUEA si no hay tenant activo (para endpoints de datos)
async function requireActiveTenant(req, res, next) {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    
    // Usar la función unificada
    const activeTenantId = resolveTenantContext(roleInfo, req.session);

    if (!activeTenantId) {
      // ADMINISTRADOR puede operar sin tenant activo
      if (roleInfo.rol === 'administrador') {
        req.activeTenantId = null;
        req.roleInfo = roleInfo;
        return next();
      }

      // CLIENTE bloqueado
      if (roleInfo.rol === 'cliente') {
        return res.status(403).json({ error: 'Cliente sin empresa asignada.' });
      }

      // AUDITOR debe seleccionar cliente
      return res.status(403).json({
        error: 'Seleccione un cliente.',
        requiresClientSelection: true
      });
    }
    
    // Validar acceso para auditor (que el tenant seleccionado esté en sus permitidos)
    if (roleInfo.rol === 'auditor' && (!roleInfo.tenant_ids || !roleInfo.tenant_ids.includes(activeTenantId))) {
        return res.status(403).json({ error: 'Acceso denegado a este cliente.' });
    }

    req.activeTenantId = activeTenantId;
    req.roleInfo = roleInfo;
    next();
  } catch (err) {
    console.error('Error en requireActiveTenant:', err);
    return res.status(500).json({ error: 'Error de autorizacion' });
  }
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Helper para normalizar emails de forma consistente
function canonicalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

const registeredStrategies = new Set();

async function ensureStrategy(publicHost) {
  const strategyName = `replitauth:${publicHost}`;
  if (!registeredStrategies.has(strategyName)) {
    const { Strategy } = await import('openid-client/passport');
    const config = await getOidcConfig();

    const strategy = new Strategy(
      {
        name: strategyName,
        config,
        scope: 'openid email profile offline_access',
        callbackURL: `https://${publicHost}/api/callback`
      },
      async (tokens, verified) => {
        try {
          const claims = tokens.claims();
          claims.email = canonicalizeEmail(claims.email);
          
          // BLINDAJE: Try-catch independiente para operaciones de BD
          let provisionResult = { status: 'ERROR', user: null };
          try {
              await upsertReplitUser(claims);
              provisionResult = await autoProvisionUser(claims);
          } catch (dbError) {
              console.error('[AUTH DB ERROR]', dbError);
          }

          // Usuario NO invitado -> Rechazar autenticación
          if (provisionResult.status === 'NOT_INVITED') {
              console.log('[AUTH] Usuario NO INVITADO rechazado:', claims.email);
              verified(null, false, { message: 'not_invited' });
              return;
          }

          const user = {
            claims: claims,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: claims?.exp,
            provision_status: provisionResult.status
          };
          verified(null, user);
        } catch (err) {
          console.error('[AUTH FATAL]', err);
          verified(null, false, { message: 'Error de autenticación' });
        }
      }
    );
    passport.use(strategy);
    registeredStrategies.add(strategyName);
  }
}

async function autoProvisionUser(claims) {
  const email = canonicalizeEmail(claims.email);
  if (!email) return { status: 'NO_EMAIL', user: null };
  
  const replitId = String(claims.sub);
  
  // A. ¿Ya existe este Replit ID vinculado? -> Asegurar activo y salir.
  const checkReplit = await pool.query('SELECT id FROM usuarios WHERE replit_user_id = $1', [replitId]);
  if (checkReplit.rows.length > 0) {
      await pool.query('UPDATE usuarios SET activo = true WHERE id = $1', [checkReplit.rows[0].id]);
      console.log('[AUTH PROVISION] Camino A: replit_id existe, usuario_id:', checkReplit.rows[0].id, 'replit_id:', replitId);
      return { status: 'LINKED', user: checkReplit.rows[0] };
  }

  // B. ¿Existe el email (canonical)? -> Vincular (usuario fue invitado previamente).
  const checkEmail = await pool.query('SELECT id, replit_user_id FROM usuarios WHERE email = $1', [email]);
  if (checkEmail.rows.length > 0) {
      const u = checkEmail.rows[0];
      await pool.query('UPDATE usuarios SET replit_user_id = $1, activo = true WHERE id = $2', [replitId, u.id]);
      console.log('[AUTH PROVISION] Camino B: email invitado, usuario_id:', u.id, 'email:', email, 'replit_id:', replitId);
      return { status: 'INVITED', user: u };
  }

  // C. No existe nada -> Usuario NO invitado. NO crear registro.
  console.log('[AUTH PROVISION] Camino C: usuario NO INVITADO, email:', email, 'replit_id:', replitId);
  return { status: 'NOT_INVITED', user: null };
}

app.get('/api/login', async (req, res, next) => {
  try {
    const publicHost = getPublicHost(req);
    await ensureStrategy(publicHost);
    passport.authenticate(`replitauth:${publicHost}`, {
      prompt: 'login consent',
      scope: ['openid', 'email', 'profile', 'offline_access']
    })(req, res, next);
  } catch (err) {
    res.redirect('/');
  }
});

app.get('/api/callback', async (req, res, next) => {
  const publicHost = getPublicHost(req);
  console.log('[AUTH CALLBACK] start, host:', publicHost);
  try {
    await ensureStrategy(publicHost);
    passport.authenticate(`replitauth:${publicHost}`, {
      successReturnToOrRedirect: '/',
      failureRedirect: '/',
      failureMessage: true
    }, (err, user, info) => {
      if (err || !user) {
        console.log('[AUTH CALLBACK] failed - err:', !!err, 'user:', !!user, 'info:', info?.message);
        // Usuario NO invitado -> Redirigir con error específico
        if (info?.message === 'not_invited') {
          console.log('[AUTH CALLBACK] Usuario NO INVITADO - redirigiendo con error');
          return res.redirect('/?error=not_invited');
        }
        return res.redirect('/');
      }
      
      // FIX 3.1: Regenerar sesión PRIMERO, luego loguear UNA SOLA VEZ.
      req.session.regenerate((err) => {
        if (err) {
          console.error('[AUTH CALLBACK] session.regenerate failed:', err.message);
          return next(err);
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('[AUTH CALLBACK] logIn failed:', loginErr.message);
            return next(loginErr);
          }
          
          // Asegurar guardado antes de redirigir
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('[AUTH CALLBACK] session.save failed:', saveErr.message);
            } else {
              const sub = String(user.claims?.sub || '');
              const masked = sub.length > 8 ? `${sub.slice(0,4)}...${sub.slice(-4)}` : sub;
              console.log('[AUTH CALLBACK] session saved OK, sub:', masked);
            }
            res.redirect('/');
          });
        });
      });
    })(req, res, next);
  } catch (err) {
    console.error('[AUTH CALLBACK] exception:', err.message);
    res.redirect('/');
  }
});

app.get('/api/logout', async (req, res) => {
  try {
    const openidClient = await import('openid-client');
    const config = await getOidcConfig();
    req.logout(() => {
      const logoutUrl = openidClient.buildEndSessionUrl(config, {
        client_id: process.env.REPL_ID,
        post_logout_redirect_uri: `${req.protocol}://${req.hostname}`
      });
      res.redirect(logoutUrl.href);
    });
  } catch (err) {
    req.logout(() => res.redirect('/'));
  }
});

// Helper para persistir sesión de forma asíncrona
async function saveSession(req) {
  if (!req.session || typeof req.session.save !== 'function') return;
  return new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}

async function isAuthenticated(req, res, next) {
  if (DEV_BYPASS) return next();
  const user = req.user;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const openidClient = await import('openid-client');
    const config = await getOidcConfig();
    const tokenResponse = await openidClient.refreshTokenGrant(config, refreshToken);
    user.claims = tokenResponse.claims();
    user.access_token = tokenResponse.access_token;
    user.refresh_token = tokenResponse.refresh_token;
    user.expires_at = user.claims?.exp;
    console.log('[AUTH REFRESH] token refresh OK, sub:', user.claims?.sub);
    
    // Persistir usuario actualizado en sesión
    req.session.passport = req.session.passport || {};
    req.session.passport.user = user;
    try {
      await saveSession(req);
      console.log('[AUTH REFRESH] saveSession OK');
    } catch (sessionErr) {
      console.error('[AUTH REFRESH] saveSession FAIL:', sessionErr.message);
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    return next();
  } catch (err) {
    console.log('[AUTH REFRESH] token refresh FAIL:', err.message);
    return res.status(401).json({ error: 'No autorizado' });
  }
}

async function isAdminOrAuditor(req, res, next) {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    if (roleInfo.rol === 'administrador' || roleInfo.rol === 'auditor') {
      req.roleInfo = roleInfo;
      return next();
    }
    return res.status(403).json({ error: 'Sin permisos para esta accion' });
  } catch (err) {
    return res.status(403).json({ error: 'Sin permisos para esta accion' });
  }
}

async function isAdminOnly(req, res, next) {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    if (roleInfo.rol === 'administrador') {
      req.roleInfo = roleInfo;
      return next();
    }
    return res.status(403).json({ error: 'Solo administradores pueden realizar esta accion' });
  } catch (err) {
    return res.status(403).json({ error: 'Solo administradores pueden realizar esta accion' });
  }
}

// Middleware que requiere tenant activo para auditores en operaciones de escritura
async function requireTenantForAuditor(req, res, next) {
  try {
    const roleInfo = req.roleInfo || await getUserRoleAndCampos(req.user.claims.sub);
    req.roleInfo = roleInfo;
    
    // Administradores pueden operar sin tenant activo (acceso global)
    if (roleInfo.rol === 'administrador') {
      return next();
    }
    
    // Para auditores, requieren tenant activo seleccionado
    const activeTenantId = req.session?.active_tenant_id;
    if (!activeTenantId) {
      return res.status(403).json({ error: 'Debe seleccionar un cliente antes de realizar esta operacion' });
    }
    
    // Verificar que el auditor tenga acceso a este tenant
    if (roleInfo.tenant_ids && !roleInfo.tenant_ids.includes(activeTenantId)) {
      return res.status(403).json({ error: 'No tiene acceso al cliente seleccionado' });
    }
    
    req.activeTenantId = activeTenantId;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Error verificando permisos' });
  }
}

app.get('/api/auth/user', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await getReplitUser(userId);
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

app.get('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, profile_image_url, phone FROM replit_users WHERE id = $1',
      [String(userId)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

app.put('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const contentType = req.headers['content-type'] || '';
    
    let first_name, last_name, phone, remove_photo;
    
    if (contentType.includes('multipart/form-data')) {
      const MAX_BYTES = 1 * 1024 * 1024; // 1MB
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        total += chunk.length;
        if (total > MAX_BYTES) {
          return res.status(413).json({ error: 'Payload demasiado grande' });
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      const boundary = contentType.split('boundary=')[1];
      const parts = body.split('--' + boundary);
      
      for (const part of parts) {
        if (part.includes('name="first_name"')) {
          first_name = part.split('\r\n\r\n')[1]?.split('\r\n')[0];
        } else if (part.includes('name="last_name"')) {
          last_name = part.split('\r\n\r\n')[1]?.split('\r\n')[0];
        } else if (part.includes('name="phone"')) {
          phone = part.split('\r\n\r\n')[1]?.split('\r\n')[0];
        } else if (part.includes('name="remove_photo"')) {
          remove_photo = part.split('\r\n\r\n')[1]?.split('\r\n')[0] === 'true';
        }
      }
      
      if (first_name !== undefined) first_name = sanitizeString(first_name);
      if (last_name !== undefined) last_name = sanitizeString(last_name);
      if (phone !== undefined) phone = sanitizeString(phone);
    } else {
      const data = req.body || {};
      first_name = data.first_name;
      last_name = data.last_name;
      phone = data.phone;
      remove_photo = data.remove_photo;
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (first_name !== undefined) { updates.push('first_name = $' + paramCount++); values.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = $' + paramCount++); values.push(last_name); }
    if (phone !== undefined) { updates.push('phone = $' + paramCount++); values.push(phone); }
    if (remove_photo) { updates.push('profile_image_url = $' + paramCount++); values.push(null); }
    
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(String(userId));
      await pool.query(
        `UPDATE replit_users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
      
      if (first_name !== undefined || last_name !== undefined) {
        const nombre = [first_name, last_name].filter(Boolean).join(' ');
        if (nombre) {
          await pool.query('UPDATE usuarios SET nombre = $1 WHERE replit_user_id = $2', [nombre, String(userId)]);
        }
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

app.get('/api/me', async (req, res) => {
  console.log('[DEBUG] /api/me called, DEV_BYPASS:', DEV_BYPASS);
  if (DEV_BYPASS) {
    const clientes = await pool.query('SELECT id, nombre FROM clientes WHERE activo = true ORDER BY nombre LIMIT 1');
    const cliente = clientes.rows[0] || { id: 1, nombre: 'Demo Cliente' };
    return res.json({
      user: {
        id: 'dev-user-1',
        email: 'dev@localhost',
        nombre: 'Desarrollador',
        rol: 'administrador',
        usuario_id: 1,
        tenant_id: cliente.id,
        tenant_nombre: cliente.nombre,
        tenants_disponibles: clientes.rows,
        active_tenant_id: cliente.id,
        active_tenant_nombre: cliente.nombre,
        requires_client_selection: false,
        vinculado: true,
        profile_image_url: null
      }
    });
  }
  if (req.isAuthenticated() && req.user?.claims) {
    const claims = req.user.claims;
    const roleInfo = await getUserRoleAndCampos(claims.sub);

    // Usuario inactivo o pendiente de activación
    if (roleInfo.activo === false) {
      return res.status(403).json({ error: 'Usuario inactivo o pendiente', user: null });
    }

    let tenantsDisponibles = [];
    let tenantNombre = null;
    let activeTenantNombre = null;

    // Usar la función unificada para determinar tenant
    const activeTenantId = resolveTenantContext(roleInfo, req.session);

    // LÓGICA DE VISIBILIDAD DE TENANTS
    if (roleInfo.rol === 'cliente') {
       if (roleInfo.tenant_id) {
         const tResult = await pool.query('SELECT nombre FROM clientes WHERE id = $1', [roleInfo.tenant_id]);
         if (tResult.rows.length > 0) {
            tenantNombre = tResult.rows[0].nombre;
            activeTenantNombre = tenantNombre;
            tenantsDisponibles = [{ id: roleInfo.tenant_id, nombre: tenantNombre }];
         }
       }
    } 
    else if (roleInfo.rol === 'auditor') {
       if (roleInfo.tenant_ids && roleInfo.tenant_ids.length > 0) {
         const tResult = await pool.query(
           'SELECT id, nombre FROM clientes WHERE id = ANY($1) AND activo = true ORDER BY nombre',
           [roleInfo.tenant_ids]
         );
         tenantsDisponibles = tResult.rows;
       }
    } 
    else if (roleInfo.rol === 'administrador') {
       const tResult = await pool.query('SELECT id, nombre FROM clientes WHERE activo = true ORDER BY nombre');
       tenantsDisponibles = tResult.rows;
    }

    // Resolver nombre de tenant activo si falta (para auditor/admin con sesión)
    if (activeTenantId && !activeTenantNombre) {
        const activeTenantResult = await pool.query('SELECT nombre FROM clientes WHERE id = $1', [activeTenantId]);
        activeTenantNombre = activeTenantResult.rows[0]?.nombre;
    }

    // CLIENTES nunca requieren selección, su tenant viene de la BD
    // ADMINISTRADORES tampoco requieren selección obligatoria - pueden acceder al panel sin cliente
    // Solo AUDITORES requieren selección obligatoria cuando no tienen tenant activo
    const requiresClientSelection = roleInfo.rol === 'auditor' && !activeTenantId;

    // RESPUESTA SIMPLE: Sin session.save(), el middleware getActiveTenantId obtiene el tenant de la BD para clientes
    res.json({
      user: {
        id: claims.sub,
        email: claims.email,
        nombre: claims.first_name || claims.email?.split('@')[0] || 'Usuario',
        rol: roleInfo.rol,
        usuario_id: roleInfo.usuario_id,
        tenant_id: roleInfo.tenant_id,
        tenant_nombre: tenantNombre,
        tenants_disponibles: tenantsDisponibles,
        active_tenant_id: activeTenantId,
        active_tenant_nombre: activeTenantNombre,
        requires_client_selection: requiresClientSelection,
        vinculado: roleInfo.vinculado !== false,
        profile_image_url: claims.profile_image_url
      }
    });
  } else {
    res.json({ user: null });
  }
});

// ENDPOINT: Seleccionar tenant activo (para auditor/admin)
app.post('/api/select-tenant', isAuthenticated, apiWriteLimiter, [
  body('tenant_id').isInt({ min: 1 }).withMessage('ID de cliente invalido')
], handleValidationErrors, async (req, res) => {
  try {
    const tenant_id = validateInteger(req.body.tenant_id, 'tenant_id');
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);

    // CLIENTE: Validar que solo intente seleccionar SU tenant asignado
    if (roleInfo.rol === 'cliente') {
      if (parseInt(roleInfo.tenant_id) !== parseInt(tenant_id)) {
         return res.status(403).json({ error: 'No tiene permiso para acceder a este cliente' });
      }
    }

    // Validar que el tenant existe y esta activo
    const tenantResult = await pool.query('SELECT id, nombre FROM clientes WHERE id = $1 AND activo = true', [tenant_id]);
    if (tenantResult.rows.length === 0) {
      return res.status(400).json({ error: 'Cliente no encontrado o inactivo' });
    }

    // AUDITOR: verificar que tiene acceso a este tenant
    if (roleInfo.rol === 'auditor') {
      if (!roleInfo.tenant_ids || !roleInfo.tenant_ids.includes(parseInt(tenant_id))) {
        return res.status(403).json({ error: 'No tiene acceso a este cliente' });
      }
    }

    // Guardar en sesion
    req.session.active_tenant_id = parseInt(tenant_id);
    
    try {
      await saveSession(req);
      console.log('[TENANT SELECT] saveSession OK, rol:', roleInfo.rol, 'tenant_id:', tenant_id);
    } catch (sessionErr) {
      console.error('[TENANT SELECT] saveSession FAIL, rol:', roleInfo.rol, 'tenant_id:', tenant_id, 'err:', sessionErr.message);
      return res.status(500).json({ error: 'Error guardando sesión' });
    }

    res.json({ 
      success: true, 
      active_tenant_id: parseInt(tenant_id),
      active_tenant_nombre: tenantResult.rows[0].nombre
    });
  } catch (err) {
    console.error('Error seleccionando tenant:', err);
    res.status(500).json({ error: 'Error al seleccionar cliente' });
  }
});

// ENDPOINT: Cambiar tenant activo (SOLO ADMINISTRADOR)
app.post('/api/admin/change-tenant', isAuthenticated, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    
    // Validación de rol
    if (roleInfo.rol !== 'administrador') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    const tenant_id = parseInt(req.body.tenant_id);

    // Validación estricta de tenant
    if (!Number.isInteger(tenant_id) || tenant_id <= 0) {
      return res.status(400).json({ error: 'Tenant inválido' });
    }

    // Verificar que el tenant exista
    const result = await pool.query(
      'SELECT id, nombre FROM clientes WHERE id = $1',
      [tenant_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    // Persistir tenant activo en sesión
    req.session.active_tenant_id = tenant_id;

    try {
      await saveSession(req);
      console.log('[ADMIN CHANGE-TENANT] OK, tenant_id:', tenant_id);
    } catch (sessionErr) {
      console.error('[ADMIN CHANGE-TENANT] saveSession FAIL:', sessionErr.message);
      return res.status(500).json({ error: 'Error guardando sesión' });
    }

    return res.json({
      ok: true,
      tenant: {
        id: result.rows[0].id,
        nombre: result.rows[0].nombre
      }
    });
  } catch (err) {
    console.error('Error cambiando tenant:', err);
    res.status(500).json({ error: 'Error al cambiar empresa activa' });
  }
});

// ENDPOINT: Limpiar tenant activo (cambiar cliente)
// Nota: Este endpoint no requiere body params, validacion minima para cumplir politica de seguridad
app.post('/api/clear-tenant', isAuthenticated, apiWriteLimiter, handleValidationErrors, async (req, res) => {
  try {
    // Sanitizar cualquier dato extra en el body por seguridad
    if (req.body && Object.keys(req.body).length > 0) {
      sanitizeObject(req.body);
    }
    
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);

    // CLIENTE no puede limpiar su tenant
    if (roleInfo.rol === 'cliente') {
      securityLog('TENANT_CLEAR_BLOCKED', { reason: 'client_role' }, req);
      return res.status(403).json({ error: 'Los clientes no pueden cambiar de tenant' });
    }

    // Limpiar de sesion
    req.session.active_tenant_id = null;
    
    try {
      await saveSession(req);
      console.log('[TENANT CLEAR] saveSession OK, rol:', roleInfo.rol);
    } catch (sessionErr) {
      console.error('[TENANT CLEAR] saveSession FAIL, rol:', roleInfo.rol, 'err:', sessionErr.message);
      return res.status(500).json({ error: 'Error guardando sesión' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error limpiando tenant:', err);
    res.status(500).json({ error: 'Error al limpiar cliente activo' });
  }
});

// ENDPOINT DE DATOS: Filtra por tenant activo ESTRICTAMENTE
app.get('/api/catalogs', isAuthenticated, requireActiveTenant, async (req, res) => {
  try {
    // FILTRADO ESTRICTO: Solo el tenant activo (req.activeTenantId)
    const activeTenantId = req.activeTenantId;

    // Queries filtradas por tenant_id exacto
    const camposQuery = 'SELECT id, nombre, descripcion, tenant_id FROM campos WHERE activo = true AND tenant_id = $1 ORDER BY nombre';
    
    // Actividades: globales (tenant_id NULL) o específicas del tenant
    const actividadesQuery = 'SELECT id, nombre, tenant_id FROM actividades WHERE tenant_id IS NULL OR tenant_id = $1 ORDER BY nombre';
    // Categorías: SOLO tipo CLIENTE del tenant activo (sin globales/estándar)
    const categoriasQuery = `SELECT c.id, c.nombre, c.actividad_id, c.agrup1, c.agrup2, c.peso_estandar, c.tenant_id, c.es_estandar, c.activo, a.nombre as actividad_nombre 
      FROM categorias c JOIN actividades a ON c.actividad_id = a.id 
      WHERE c.tenant_id = $1
        AND c.tipo = 'CLIENTE'
        AND c.activo = true
        AND (a.tenant_id IS NULL OR a.tenant_id = $1)
      ORDER BY a.nombre, c.nombre`;

    // FILTRADO ESTRICTO: Todas las queries usan activeTenantId
    const [tipos, actividades, categorias, campos, cuentas, planes] = await Promise.all([
      pool.query('SELECT id, codigo, nombre, requiere_origen_destino, requiere_campo_destino FROM tipos_evento ORDER BY nombre'),
      pool.query(actividadesQuery, [activeTenantId]),
      pool.query(categoriasQuery, [activeTenantId]),
      pool.query(camposQuery, [activeTenantId]),
      pool.query('SELECT id, codigo, nombre, plan_cuenta_id FROM cuentas ORDER BY codigo'),
      pool.query('SELECT id, codigo, nombre FROM planes_cuenta ORDER BY codigo')
    ]);

    res.json({
      tipos_evento: tipos.rows,
      actividades: actividades.rows,
      categorias: categorias.rows,
      campos: campos.rows,
      cuentas: cuentas.rows,
      planes_cuenta: planes.rows
    });
  } catch (err) {
    console.error('Catalogs error:', err);
    res.status(500).json({ error: 'Error al cargar catalogos' });
  }
});

// ENDPOINT DE DATOS: Filtra eventos por tenant activo ESTRICTAMENTE
app.get('/api/eventos', isAuthenticated, requireActiveTenant, apiReadLimiter, async (req, res) => {
  try {
    // FILTRADO ESTRICTO: Solo el tenant activo
    const activeTenantId = req.activeTenantId;

    let query = `
      SELECT e.*, te.nombre as tipo_nombre, te.codigo as tipo_codigo,
             c.nombre as campo_nombre,
             ao.nombre as actividad_origen_nombre, ad.nombre as actividad_destino_nombre,
             co.nombre as categoria_origen_nombre, cd.nombre as categoria_destino_nombre,
             cat.nombre as categoria_nombre
      FROM eventos e
      JOIN tipos_evento te ON e.tipo_evento_id = te.id
      JOIN campos c ON e.campo_id = c.id
      LEFT JOIN actividades ao ON e.actividad_origen_id = ao.id
      LEFT JOIN actividades ad ON e.actividad_destino_id = ad.id
      LEFT JOIN categorias co ON e.categoria_origen_id = co.id
      LEFT JOIN categorias cd ON e.categoria_destino_id = cd.id
      LEFT JOIN categorias cat ON e.categoria_id = cat.id
      WHERE c.tenant_id = $1
      ORDER BY e.fecha DESC, e.created_at DESC
    `;

    const result = await pool.query(query, [activeTenantId]);
    res.json({ eventos: result.rows });
  } catch (err) {
    console.error('Eventos error:', err);
    res.status(500).json({ error: 'Error al cargar eventos' });
  }
});

// ============================================================
// HELPERS PARA CATEGORIAS GESTOR (Fase 2)
// ============================================================

async function getGestorActivityId(client) {
  const result = await client.query(
    "SELECT id FROM actividades WHERE tenant_id IS NULL AND UPPER(nombre)='GESTOR' LIMIT 1"
  );
  if (result.rows.length === 0) {
    throw new Error('Actividad GESTOR no encontrada - ejecute la migración de Fase 1');
  }
  return result.rows[0].id;
}

async function ensureSinAsignarGestorCategory(tenantId, client) {
  const existing = await client.query(
    "SELECT id FROM categorias WHERE tenant_id=$1 AND tipo='GESTOR' AND nombre='SIN_ASIGNAR' LIMIT 1",
    [tenantId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const gestorActividadId = await getGestorActivityId(client);
  const insertResult = await client.query(
    "INSERT INTO categorias (nombre, actividad_id, tenant_id, tipo, source) VALUES ('SIN_ASIGNAR', $1, $2, 'GESTOR', 'system') RETURNING id",
    [gestorActividadId, tenantId]
  );
  return insertResult.rows[0].id;
}

async function resolveCategoriaGestorId(tenantId, categoriaClienteId, client) {
  const mapeo = await client.query(
    "SELECT categoria_gestor_id FROM categorias_mapeo WHERE tenant_id=$1 AND categoria_cliente_id=$2 AND activo=TRUE LIMIT 1",
    [tenantId, categoriaClienteId]
  );
  if (mapeo.rows.length > 0) {
    return mapeo.rows[0].categoria_gestor_id;
  }
  return await ensureSinAsignarGestorCategory(tenantId, client);
}

async function validateCategoriaCliente(categoriaId, activeTenantId, client) {
  const result = await client.query(
    "SELECT id, tipo, tenant_id FROM categorias WHERE id=$1 LIMIT 1",
    [categoriaId]
  );
  if (result.rows.length === 0) {
    return { valid: false, error: 'Categoría no encontrada' };
  }
  const cat = result.rows[0];
  if (cat.tipo !== 'CLIENTE') {
    return { valid: false, error: 'La categoría seleccionada no es válida para eventos (debe ser tipo CLIENTE del cliente activo).' };
  }
  if (cat.tenant_id !== null && cat.tenant_id !== activeTenantId) {
    return { valid: false, error: 'La categoría seleccionada no es válida para eventos (debe ser tipo CLIENTE del cliente activo).' };
  }
  return { valid: true };
}

async function generateAsientos(evento, client) {
  const tipoResult = await client.query('SELECT codigo FROM tipos_evento WHERE id = $1', [evento.tipo_evento_id]);
  const tipoCodigo = tipoResult.rows[0]?.codigo;

  const asientos = [];
  const cabezas = evento.cabezas;
  const kg = evento.kg_totales;
  const kg_cabeza = evento.kg_cabeza;
  const categoriaId = evento.categoria_id || evento.categoria_origen_id;

  const asientoMap = {
    'APERTURA': [{ c: 'ACT001', t: 'DEBE' }, { c: 'PN001', t: 'HABER' }],
    'NACIMIENTO': [{ c: 'ACT001', t: 'DEBE' }, { c: 'PN001', t: 'HABER' }],
    'DESTETE': [{ c: 'ACT001', t: 'DEBE' }, { c: 'PN001', t: 'HABER' }],
    'COMPRA': [{ c: 'ACT001', t: 'DEBE' }, { c: 'RES002', t: 'HABER' }],
    'VENTA': [{ c: 'RES001', t: 'DEBE' }, { c: 'ACT001', t: 'HABER' }],
    'MORTANDAD': [{ c: 'RES003', t: 'DEBE' }, { c: 'ACT001', t: 'HABER' }],
    'CONSUMO': [{ c: 'RES004', t: 'DEBE' }, { c: 'ACT001', t: 'HABER' }]
  };

  if (asientoMap[tipoCodigo]) {
    asientoMap[tipoCodigo].forEach(a => {
      asientos.push({ cuenta_codigo: a.c, tipo: a.t, cabezas, kg, kg_cabeza, categoria_id: categoriaId });
    });
  } else if (tipoCodigo === 'CAMBIO_ACTIVIDAD') {
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'DEBE', cabezas, kg, kg_cabeza, actividad_id: evento.actividad_destino_id, categoria_id: evento.categoria_destino_id });
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'HABER', cabezas, kg, kg_cabeza, actividad_id: evento.actividad_origen_id, categoria_id: evento.categoria_origen_id });
  } else if (tipoCodigo === 'CAMBIO_CATEGORIA') {
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'DEBE', cabezas, kg, kg_cabeza, categoria_id: evento.categoria_destino_id });
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'HABER', cabezas, kg, kg_cabeza, categoria_id: evento.categoria_origen_id });
  } else if (tipoCodigo === 'RECUENTO') {
    // RECUENTO es solo informativo - NO genera asientos contables
    // No modifica el stock, solo registra la verificación física
  } else if (tipoCodigo === 'TRASLADO') {
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'DEBE', cabezas, kg, kg_cabeza, campo_id: evento.campo_destino_id, categoria_id: categoriaId });
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'HABER', cabezas, kg, kg_cabeza, campo_id: evento.campo_id, categoria_id: categoriaId });
  } else if (tipoCodigo === 'AJUSTE_KG') {
    if (kg >= 0) {
      asientos.push({ cuenta_codigo: 'ACT001', tipo: 'DEBE', cabezas: 0, kg: Math.abs(kg), kg_cabeza, categoria_id: categoriaId });
      asientos.push({ cuenta_codigo: 'RES008', tipo: 'HABER', cabezas: 0, kg: Math.abs(kg), kg_cabeza, categoria_id: categoriaId });
    } else {
      asientos.push({ cuenta_codigo: 'RES008', tipo: 'DEBE', cabezas: 0, kg: Math.abs(kg), kg_cabeza, categoria_id: categoriaId });
      asientos.push({ cuenta_codigo: 'ACT001', tipo: 'HABER', cabezas: 0, kg: Math.abs(kg), kg_cabeza, categoria_id: categoriaId });
    }
  } else {
    asientos.push({ cuenta_codigo: 'ACT001', tipo: 'DEBE', cabezas, kg, kg_cabeza, categoria_id: categoriaId });
    asientos.push({ cuenta_codigo: 'PN002', tipo: 'HABER', cabezas, kg, kg_cabeza, categoria_id: categoriaId });
  }

  return asientos;
}

app.post('/api/eventos', isAuthenticated, requireActiveTenant, apiWriteLimiter, [
  body('fecha').isISO8601().withMessage('Fecha invalida'),
  body('tipo_evento_id').isInt({ min: 1 }).withMessage('Tipo de evento invalido'),
  body('campo_id').isInt({ min: 1 }).withMessage('Campo invalido'),
  body('lote_id').optional().isInt({ min: 1 }).withMessage('Lote invalido'),
  body('cabezas').optional().isInt({ min: 0, max: 999999 }).withMessage('Cabezas invalidas'),
  body('kg_cabeza').optional().isFloat({ min: 0, max: 99999 }).withMessage('Kg por cabeza invalido'),
  body('kg_totales').optional().isFloat({ min: -9999999, max: 9999999 }).withMessage('Kg totales invalidos'),
  body('observaciones').optional().isString().isLength({ max: 2000 }).withMessage('Observaciones muy largas')
], handleValidationErrors, async (req, res) => {
  console.log('[EVENTOS POST]', {
    method: req.method,
    user_sub: req.user?.claims?.sub,
    activeTenantId: req.activeTenantId,
    body: req.body
  });

  const sanitizedBody = sanitizeObject(req.body);
  const {
    fecha, tipo_evento_id, campo_id,
    actividad_origen_id, actividad_destino_id,
    categoria_id, categoria_origen_id, categoria_destino_id,
    campo_destino_id, cabezas, kg_totales, observaciones
  } = sanitizedBody;

  const kg_cabeza = sanitizedBody.kg_cabeza;
  const activeTenantId = req.activeTenantId;

  if (!activeTenantId || activeTenantId <= 0) {
    return res.status(400).json({ error: 'Tenant inválido' });
  }

  if (!fecha || !tipo_evento_id || !campo_id) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Validar que el campo pertenece al tenant activo
  const campoCheck = await pool.query('SELECT id FROM campos WHERE id = $1 AND tenant_id = $2', [campo_id, activeTenantId]);
  if (campoCheck.rows.length === 0) {
    return res.status(403).json({ error: 'El campo seleccionado no pertenece a este cliente' });
  }

  const tipoResult = await pool.query('SELECT codigo, requiere_origen_destino, requiere_campo_destino FROM tipos_evento WHERE id = $1', [tipo_evento_id]);
  if (!tipoResult.rows[0]) {
    return res.status(400).json({ error: 'Tipo de evento no valido' });
  }
  const tipoEvento = tipoResult.rows[0];
  const isAjusteKg = tipoEvento.codigo === 'AJUSTE_KG';

  if (!isAjusteKg && (cabezas === undefined || cabezas === null || cabezas <= 0)) {
    return res.status(400).json({ error: 'El numero de cabezas es obligatorio' });
  }

  if (!isAjusteKg && (!kg_cabeza || kg_cabeza === '' || kg_cabeza === 0)) {
    return res.status(400).json({ error: 'El peso por cabeza (Kg) es obligatorio' });
  }

  if (isAjusteKg && (!kg_totales || kg_totales === 0)) {
    return res.status(400).json({ error: 'El ajuste de kilogramos es obligatorio y no puede ser cero' });
  }

  const calculatedKgTotales = isAjusteKg ? parseFloat(kg_totales) : (kg_cabeza && cabezas ? parseFloat(kg_cabeza) * parseInt(cabezas) : (kg_totales || null));
  const finalCabezas = isAjusteKg ? 0 : cabezas;
  const finalKgCabeza = isAjusteKg ? 0 : kg_cabeza;

  if (!tipoEvento.requiere_origen_destino) {
    if (!categoria_id || categoria_id === '' || categoria_id === 0) {
      return res.status(400).json({ error: 'La categoria es obligatoria' });
    }
  } else {
    if (!categoria_origen_id || !categoria_destino_id) {
      return res.status(400).json({ error: 'Las categorias de origen y destino son obligatorias' });
    }
  }

  if (tipoEvento.requiere_campo_destino && !campo_destino_id) {
    return res.status(400).json({ error: 'El campo de destino es obligatorio' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolver usuario_id numérico desde replit_user_id
    const replitUserId = String(req.user.claims.sub);
    const userResult = await client.query('SELECT id FROM usuarios WHERE replit_user_id = $1', [replitUserId]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Usuario no encontrado en el sistema' });
    }
    const usuarioId = userResult.rows[0].id;

    // Validar categorías tipo CLIENTE
    const categoriasAValidar = [];
    if (categoria_id) categoriasAValidar.push(categoria_id);
    if (categoria_origen_id) categoriasAValidar.push(categoria_origen_id);
    if (categoria_destino_id) categoriasAValidar.push(categoria_destino_id);

    for (const catId of categoriasAValidar) {
      const validacion = await validateCategoriaCliente(catId, activeTenantId, client);
      if (!validacion.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: validacion.error });
      }
    }

    // Resolver categoria_gestor_id (usar destino si hay origen/destino, sino categoria_id)
    const categoriaParaGestor = tipoEvento.requiere_origen_destino ? categoria_destino_id : categoria_id;
    const categoriaGestorIdResuelta = categoriaParaGestor 
      ? await resolveCategoriaGestorId(activeTenantId, categoriaParaGestor, client)
      : null;

    const eventoResult = await client.query(`
      INSERT INTO eventos (fecha, tipo_evento_id, campo_id, lote_id, 
        actividad_origen_id, actividad_destino_id, 
        categoria_id, categoria_origen_id, categoria_destino_id,
        campo_destino_id, lote_destino_id, cabezas, kg_cabeza, kg_totales, observaciones, usuario_id, categoria_gestor_id)
      VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [fecha, tipo_evento_id, campo_id,
        actividad_origen_id || null, actividad_destino_id || null,
        categoria_id || null, categoria_origen_id || null, categoria_destino_id || null,
        campo_destino_id || null, finalCabezas, finalKgCabeza, calculatedKgTotales, observaciones || null, usuarioId, categoriaGestorIdResuelta]);

    const eventoId = eventoResult.rows[0].id;

    let actividadFromCategoria = null;
    const catIdForActivity = categoria_id || categoria_origen_id;
    if (catIdForActivity && !actividad_origen_id) {
      const catActResult = await client.query('SELECT actividad_id FROM categorias WHERE id = $1', [catIdForActivity]);
      actividadFromCategoria = catActResult.rows[0]?.actividad_id || null;
    }

    const asientosData = await generateAsientos({
      tipo_evento_id, cabezas: finalCabezas, kg_totales: calculatedKgTotales, kg_cabeza,
      actividad_origen_id, actividad_destino_id,
      categoria_id, categoria_origen_id, categoria_destino_id,
      campo_id, campo_destino_id, lote_id: null, lote_destino_id: null
    }, client);

    for (const asiento of asientosData) {
      const cuentaResult = await client.query('SELECT id FROM cuentas WHERE codigo = $1', [asiento.cuenta_codigo]);
      const cuentaId = cuentaResult.rows[0]?.id;

      if (cuentaId) {
        await client.query(`
          INSERT INTO asientos (evento_id, fecha, cuenta_id, tipo, cabezas, kg, kg_cabeza, campo_id, lote_id, actividad_id, categoria_id, categoria_gestor_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [eventoId, fecha, cuentaId, asiento.tipo, asiento.cabezas, asiento.kg || null, asiento.kg_cabeza || null,
            asiento.campo_id || campo_id, null, 
            asiento.actividad_id || actividad_origen_id || actividadFromCategoria,
            asiento.categoria_id || categoria_id || null, categoriaGestorIdResuelta]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, id: eventoId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating evento:', err);
    res.status(500).json({ error: 'Error al crear evento' });
  } finally {
    client.release();
  }
});

// PUT: Editar evento
app.put('/api/eventos/:id', isAuthenticated, requireActiveTenant, apiWriteLimiter, [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('fecha').optional().isISO8601().withMessage('Fecha invalida'),
  body('cabezas').optional().isInt({ min: 0, max: 999999 }).withMessage('Cabezas invalidas'),
  body('kg_cabeza').optional().isFloat({ min: 0, max: 99999 }).withMessage('Kg por cabeza invalido'),
  body('kg_totales').optional().isFloat({ min: -9999999, max: 9999999 }).withMessage('Kg totales invalidos'),
  body('observaciones').optional().isString().isLength({ max: 2000 }).withMessage('Observaciones muy largas')
], handleValidationErrors, async (req, res) => {
  const eventoId = parseInt(req.params.id);
  const activeTenantId = req.activeTenantId;
  
  console.log('[EVENT ENDPOINT HIT]', {
    method: req.method,
    path: req.path,
    id: req.params.id,
    user_sub: req.user?.claims?.sub,
    activeTenantId
  });
  console.log('[EVENTOS PUT]', {
    method: req.method,
    user_sub: req.user?.claims?.sub,
    activeTenantId,
    params: req.params,
    body: req.body
  });
  
  // Validar tenant
  if (!activeTenantId || activeTenantId <= 0) {
    return res.status(400).json({ error: 'Tenant inválido' });
  }
  
  // Validar rol: solo admin y auditor pueden editar eventos
  const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
  if (!['administrador', 'auditor'].includes(roleInfo.rol)) {
    return res.status(403).json({ error: 'Acceso denegado: no puede editar eventos' });
  }
  
  const sanitizedBody = sanitizeObject(req.body);
  const { fecha, cabezas, kg_cabeza, kg_totales, observaciones } = sanitizedBody;

  const client = await pool.connect();
  try {
    const eventoCheck = await client.query(`
      SELECT e.id, c.tenant_id FROM eventos e
      JOIN campos c ON e.campo_id = c.id
      WHERE e.id = $1 AND c.tenant_id = $2
    `, [eventoId, activeTenantId]);

    if (eventoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado o no pertenece a este cliente' });
    }

    await client.query('BEGIN');

    const updates = [];
    const values = [];
    let idx = 1;

    if (fecha) { updates.push(`fecha = $${idx++}`); values.push(fecha); }
    if (cabezas !== undefined) { updates.push(`cabezas = $${idx++}`); values.push(cabezas); }
    if (kg_cabeza !== undefined) { updates.push(`kg_cabeza = $${idx++}`); values.push(kg_cabeza); }
    if (kg_totales !== undefined) { updates.push(`kg_totales = $${idx++}`); values.push(kg_totales); }
    if (observaciones !== undefined) { updates.push(`observaciones = $${idx++}`); values.push(observaciones); }

    if (updates.length > 0) {
      values.push(eventoId);
      await client.query(`UPDATE eventos SET ${updates.join(', ')} WHERE id = $${idx}`, values);

      if (fecha) {
        await client.query('UPDATE asientos SET fecha = $1 WHERE evento_id = $2', [fecha, eventoId]);
      }
      if (cabezas !== undefined || kg_totales !== undefined) {
        const newKg = kg_totales || (kg_cabeza && cabezas ? kg_cabeza * cabezas : null);
        await client.query(`
          UPDATE asientos SET cabezas = $1, kg = $2, kg_cabeza = $3 WHERE evento_id = $4
        `, [cabezas || 0, newKg, kg_cabeza || null, eventoId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating evento:', err);
    res.status(500).json({ error: 'Error al actualizar evento' });
  } finally {
    client.release();
  }
});

// DELETE: Eliminar evento y sus asientos (SOLO ADMIN/AUDITOR)
app.delete('/api/eventos/:id', isAuthenticated, requireActiveTenant, apiWriteLimiter, [
  param('id').isInt({ min: 1 }).withMessage('ID inválido')
], handleValidationErrors, async (req, res) => {
  const eventoId = parseInt(req.params.id);
  const activeTenantId = req.activeTenantId;

  console.log('[EVENT ENDPOINT HIT]', {
    method: req.method,
    path: req.path,
    id: req.params.id,
    user_sub: req.user?.claims?.sub,
    activeTenantId
  });
  console.log('[EVENTOS DELETE]', {
    method: req.method,
    user_sub: req.user?.claims?.sub,
    activeTenantId,
    params: req.params
  });

  // Validar tenant
  if (!activeTenantId || activeTenantId <= 0) {
    return res.status(400).json({ error: 'Tenant inválido' });
  }

  // Validar rol: solo admin y auditor pueden eliminar eventos
  const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
  if (!['administrador', 'auditor'].includes(roleInfo.rol)) {
    return res.status(403).json({ error: 'Acceso denegado: no puede eliminar eventos' });
  }

  const client = await pool.connect();
  try {
    console.log('[EVENT SQL CHECK]', { evento_id: eventoId, tenant_id: activeTenantId });
    const eventoCheck = await client.query(`
      SELECT e.id, c.tenant_id FROM eventos e
      JOIN campos c ON e.campo_id = c.id
      WHERE e.id = $1 AND c.tenant_id = $2
    `, [eventoId, activeTenantId]);
    console.log('[EVENT SQL CHECK RESULT]', { rowCount: eventoCheck.rowCount });

    if (eventoCheck.rows.length === 0) {
      console.log('[EVENT SQL CHECK FAILED] Evento no encontrado');
      return res.status(404).json({ error: 'Evento no encontrado o no pertenece a este cliente' });
    }

    await client.query('BEGIN');
    const delAsientos = await client.query('DELETE FROM asientos WHERE evento_id = $1', [eventoId]);
    console.log('[EVENT SQL DELETE asientos]', { rowCount: delAsientos.rowCount });
    const delEvento = await client.query('DELETE FROM eventos WHERE id = $1', [eventoId]);
    console.log('[EVENT SQL DELETE evento]', { rowCount: delEvento.rowCount });
    await client.query('COMMIT');

    console.log('[EVENT DELETE SUCCESS]');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[EVENT DELETE ERROR]', err);
    res.status(500).json({ error: 'Error al eliminar evento' });
  } finally {
    client.release();
  }
});

// ENDPOINT DE DATOS: Filtra ledger (mayor) por tenant activo ESTRICTAMENTE
app.get('/api/ledger', isAuthenticated, requireActiveTenant, apiReadLimiter, [
  query('mes').optional().custom((value) => {
    if (value === 'Todos' || value === '' || value === undefined) return true;
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value));
  }).withMessage('Mes inválido. Use formato YYYY-MM o "Todos".')
], handleValidationErrors, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const { mes, campo_id, categoria_id, desde, hasta, categoria_view } = req.query;
    const vistaGestor = categoria_view === 'gestor';
    
    // Query base con ambas categorías (cliente y gestor)
    let query = `
      SELECT a.id, a.fecha, a.tipo, a.cabezas, a.kg, a.kg_cabeza,
             c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
             pc.codigo as plan_codigo, pc.nombre as plan_nombre,
             ca.nombre as campo_nombre,
             act.nombre as actividad_nombre,
             cat_c.id as categoria_cliente_id, cat_c.nombre as categoria_cliente_nombre,
             cm.categoria_gestor_id as categoria_gestor_id,
             COALESCE(cat_g.nombre, 'SIN_ASIGNAR') as categoria_gestor_nombre,
             ${vistaGestor 
               ? 'cm.categoria_gestor_id as categoria_id, COALESCE(cat_g.nombre, \'SIN_ASIGNAR\') as categoria_nombre'
               : 'cat_c.id as categoria_id, cat_c.nombre as categoria_nombre'},
             e.id as evento_id,
             te.nombre as tipo_evento_nombre
      FROM asientos a
      JOIN cuentas c ON a.cuenta_id = c.id
      JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
      JOIN eventos e ON a.evento_id = e.id
      JOIN tipos_evento te ON e.tipo_evento_id = te.id
      LEFT JOIN campos ca ON a.campo_id = ca.id
      LEFT JOIN actividades act ON a.actividad_id = act.id
      LEFT JOIN categorias cat_c ON a.categoria_id = cat_c.id
      LEFT JOIN categorias_mapeo cm ON cm.tenant_id = $1 AND cm.categoria_cliente_id = a.categoria_id AND cm.activo = true
      LEFT JOIN categorias cat_g ON cat_g.id = cm.categoria_gestor_id
      WHERE ca.tenant_id = $1
    `;

    const params = [activeTenantId];

    // Filtro por rango de fechas (desde/hasta) - tiene prioridad sobre mes
    if (desde && desde !== 'Todos' && desde !== '') {
      params.push(desde + ' 00:00:00');
      query += ` AND a.fecha >= $${params.length}::timestamp`;
    }
    if (hasta && hasta !== 'Todos' && hasta !== '') {
      params.push(hasta + ' 23:59:59');
      query += ` AND a.fecha <= $${params.length}::timestamp`;
    }
    // Filtro por mes (legacy, si no hay desde/hasta)
    if (mes && mes !== 'Todos' && mes !== '' && !desde && !hasta) {
      params.push(mes);
      query += ` AND TO_CHAR(a.fecha, 'YYYY-MM') = $${params.length}`;
    }
    if (campo_id && campo_id !== 'Todos' && campo_id !== '') {
      params.push(campo_id);
      query += ` AND a.campo_id = $${params.length}`;
    }
    if (categoria_id && categoria_id !== 'Todos' && categoria_id !== '') {
      params.push(parseInt(categoria_id));
      if (vistaGestor) {
        query += ` AND cm.categoria_gestor_id = $${params.length}`;
      } else {
        query += ` AND a.categoria_id = $${params.length}`;
      }
    }

    query += ' ORDER BY a.fecha DESC, e.id, a.id';

    const mesesQuery = `SELECT DISTINCT TO_CHAR(a.fecha, 'YYYY-MM') as mes 
                        FROM asientos a 
                        LEFT JOIN campos ca ON a.campo_id = ca.id 
                        WHERE ca.tenant_id = $1 
                        ORDER BY mes ASC`;

    const [result, mesesResult] = await Promise.all([
      pool.query(query, params),
      pool.query(mesesQuery, [activeTenantId])
    ]);

    res.json({ 
      asientos: result.rows,
      meses: mesesResult.rows.map(r => r.mes)
    });
  } catch (err) {
    console.error('Ledger error:', err);
    res.status(500).json({ error: 'Error al cargar mayor' });
  }
});

// ENDPOINT DE DATOS: Filtra balance por tenant activo ESTRICTAMENTE
app.get('/api/balance', isAuthenticated, requireActiveTenant, apiReadLimiter, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const { categoria_id, campo_id, desde, hasta, categoria_view } = req.query;
    const vistaGestor = categoria_view === 'gestor';
    
    const params = [activeTenantId];
    let conditions = ['ca.tenant_id = $1'];

    // Filtro por rango de fechas
    if (desde && desde !== 'Todos' && desde !== '') {
      params.push(desde + ' 00:00:00');
      conditions.push(`a.fecha >= $${params.length}::timestamp`);
    }
    if (hasta && hasta !== 'Todos' && hasta !== '') {
      params.push(hasta + ' 23:59:59');
      conditions.push(`a.fecha <= $${params.length}::timestamp`);
    }
    if (categoria_id && categoria_id !== 'Todos' && categoria_id !== '') {
      params.push(parseInt(categoria_id));
      if (vistaGestor) {
        conditions.push(`cm.categoria_gestor_id = $${params.length}`);
      } else {
        conditions.push(`a.categoria_id = $${params.length}`);
      }
    }
    if (campo_id && campo_id !== 'Todos' && campo_id !== '') {
      params.push(campo_id);
      conditions.push(`a.campo_id = $${params.length}`);
    }

    const whereClause = ' WHERE ' + conditions.join(' AND ');

    // Construir query según vista
    let balanceQuery;
    if (vistaGestor) {
      balanceQuery = `
        SELECT 
          pc.codigo as plan_codigo, pc.nombre as plan_nombre,
          ca.id as campo_id, ca.nombre as campo_nombre,
          c.id as cuenta_id, c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
          cm.categoria_gestor_id as categoria_id, 
          COALESCE(cat_g.nombre, 'SIN_ASIGNAR') as categoria_nombre,
          cat_c.id as categoria_cliente_id, cat_c.nombre as categoria_cliente_nombre,
          cm.categoria_gestor_id as categoria_gestor_id,
          COALESCE(cat_g.nombre, 'SIN_ASIGNAR') as categoria_gestor_nombre,
          TO_CHAR(a.fecha, 'YYYY-MM') as mes,
          CASE 
            WHEN pc.codigo = 'RES' THEN 
              -1 * SUM(CASE WHEN a.tipo = 'DEBE' THEN a.cabezas ELSE -a.cabezas END)
            ELSE 
              SUM(CASE WHEN a.tipo = 'DEBE' THEN a.cabezas ELSE -a.cabezas END)
          END as saldo_cabezas,
          CASE 
            WHEN pc.codigo = 'RES' THEN 
              -1 * SUM(CASE WHEN a.tipo = 'DEBE' THEN COALESCE(a.kg, 0) ELSE -COALESCE(a.kg, 0) END)
            ELSE 
              SUM(CASE WHEN a.tipo = 'DEBE' THEN COALESCE(a.kg, 0) ELSE -COALESCE(a.kg, 0) END)
          END as saldo_kg
        FROM asientos a
        JOIN eventos e ON a.evento_id = e.id
        JOIN cuentas c ON a.cuenta_id = c.id
        JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
        LEFT JOIN campos ca ON a.campo_id = ca.id
        LEFT JOIN categorias cat_c ON a.categoria_id = cat_c.id
        LEFT JOIN categorias_mapeo cm ON cm.tenant_id = $1 AND cm.categoria_cliente_id = a.categoria_id AND cm.activo = true
        LEFT JOIN categorias cat_g ON cat_g.id = cm.categoria_gestor_id
        ${whereClause}
        GROUP BY pc.codigo, pc.nombre, ca.id, ca.nombre, c.id, c.codigo, c.nombre, 
                 cm.categoria_gestor_id, cat_g.nombre, cat_c.id, cat_c.nombre, TO_CHAR(a.fecha, 'YYYY-MM')
        ORDER BY 
          CASE pc.codigo WHEN 'ACT' THEN 1 WHEN 'PN' THEN 2 WHEN 'RES' THEN 3 ELSE 4 END,
          ca.nombre, c.codigo, COALESCE(cat_g.nombre, 'SIN_ASIGNAR'), mes
      `;
    } else {
      balanceQuery = `
        SELECT 
          pc.codigo as plan_codigo, pc.nombre as plan_nombre,
          ca.id as campo_id, ca.nombre as campo_nombre,
          c.id as cuenta_id, c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
          cat.id as categoria_id, cat.nombre as categoria_nombre,
          cat.id as categoria_cliente_id, cat.nombre as categoria_cliente_nombre,
          cm.categoria_gestor_id as categoria_gestor_id,
          COALESCE(cat_g.nombre, 'SIN_ASIGNAR') as categoria_gestor_nombre,
          TO_CHAR(a.fecha, 'YYYY-MM') as mes,
          CASE 
            WHEN pc.codigo = 'RES' THEN 
              -1 * SUM(CASE WHEN a.tipo = 'DEBE' THEN a.cabezas ELSE -a.cabezas END)
            ELSE 
              SUM(CASE WHEN a.tipo = 'DEBE' THEN a.cabezas ELSE -a.cabezas END)
          END as saldo_cabezas,
          CASE 
            WHEN pc.codigo = 'RES' THEN 
              -1 * SUM(CASE WHEN a.tipo = 'DEBE' THEN COALESCE(a.kg, 0) ELSE -COALESCE(a.kg, 0) END)
            ELSE 
              SUM(CASE WHEN a.tipo = 'DEBE' THEN COALESCE(a.kg, 0) ELSE -COALESCE(a.kg, 0) END)
          END as saldo_kg
        FROM asientos a
        JOIN eventos e ON a.evento_id = e.id
        JOIN cuentas c ON a.cuenta_id = c.id
        JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
        LEFT JOIN campos ca ON a.campo_id = ca.id
        LEFT JOIN categorias cat ON a.categoria_id = cat.id
        LEFT JOIN categorias_mapeo cm ON cm.tenant_id = $1 AND cm.categoria_cliente_id = a.categoria_id AND cm.activo = true
        LEFT JOIN categorias cat_g ON cat_g.id = cm.categoria_gestor_id
        ${whereClause}
        GROUP BY pc.codigo, pc.nombre, ca.id, ca.nombre, c.id, c.codigo, c.nombre, 
                 cat.id, cat.nombre, cm.categoria_gestor_id, cat_g.nombre, TO_CHAR(a.fecha, 'YYYY-MM')
        ORDER BY 
          CASE pc.codigo WHEN 'ACT' THEN 1 WHEN 'PN' THEN 2 WHEN 'RES' THEN 3 ELSE 4 END,
          ca.nombre, c.codigo, cat.nombre, mes
      `;
    }

    const mesesQuery = `SELECT DISTINCT TO_CHAR(a.fecha, 'YYYY-MM') as mes 
                        FROM asientos a 
                        LEFT JOIN campos ca ON a.campo_id = ca.id 
                        WHERE ca.tenant_id = $1 
                        ORDER BY mes ASC`;

    const [balanceResult, mesesResult] = await Promise.all([
      pool.query(balanceQuery, params),
      pool.query(mesesQuery, [activeTenantId])
    ]);

    res.json({
      balance: balanceResult.rows,
      meses: mesesResult.rows.map(r => r.mes)
    });
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Error al cargar balance' });
  }
});

app.get('/api/admin/usuarios', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.nombre, u.activo, u.created_at, r.nombre as rol, r.id as rol_id
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.nombre
    `);
    res.json({ usuarios: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

app.post('/api/admin/usuarios', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('email').isEmail().withMessage('Email invalido'),
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('rol_id').optional().isInt({ min: 1 }).withMessage('Rol invalido'),
  body('tenant_id').optional().isInt({ min: 1 }).withMessage('Tenant invalido')
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { nombre, rol_id, tenant_id } = sanitizedBody;
    
    // Canonicalizar email SIEMPRE
    const email = canonicalizeEmail(sanitizedBody.email);
    if (!email) {
      return res.status(400).json({ error: 'Email invalido' });
    }
    
    const finalRolId = rol_id || 3;
    const rolesMap = { 1: 'Administrador', 2: 'Auditor', 3: 'Cliente' };
    const rolNombre = rolesMap[finalRolId] || 'Cliente';
    
    // UPSERT: Idempotente - si existe, actualiza; si no, crea
    const result = await pool.query(
      `INSERT INTO usuarios (email, nombre, rol_id, tenant_id, activo) 
       VALUES ($1, $2, $3, $4, true) 
       ON CONFLICT (email) DO UPDATE SET 
         nombre = EXCLUDED.nombre,
         rol_id = EXCLUDED.rol_id,
         tenant_id = EXCLUDED.tenant_id,
         activo = true
       RETURNING id`,
      [email, nombre, finalRolId, tenant_id || null]
    );
    
    const newUserId = result.rows[0].id;

    // Si es Auditor (rol_id=2) y viene un tenant_id, crear la relación en auditor_clientes
    if (finalRolId === 2 && tenant_id) {
      await pool.query(
        'INSERT INTO auditor_clientes (auditor_id, tenant_id) VALUES ($1, $2)',
        [newUserId, tenant_id]
      );
    }
    
    const loginUrl = `${getPublicUrl(req)}/api/login`;
    const mailOptions = {
      from: `"Gestor Ganadero" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Bienvenido a Gestor Ganadero - Acceso Habilitado',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #dc2626, #991b1b); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; background: #f9fafb; }
            .highlight { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
            .btn { display: inline-block; background: #dc2626; color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
            .btn:hover { background: #991b1b; }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Gestor Ganadero</h1>
          </div>
          <div class="content">
            <h2>Hola ${nombre},</h2>
            <p>Te damos la bienvenida al sistema de Gestor Ganadero.</p>
            <div class="highlight">
              <strong>Tu cuenta ha sido creada con los siguientes datos:</strong><br>
              <strong>Email:</strong> ${email}<br>
              <strong>Rol:</strong> ${rolNombre}
            </div>
            <p>Para acceder al sistema, haz clic en el siguiente botón e inicia sesión con tu cuenta de Google, GitHub o Apple asociada a este email:</p>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="btn">Acceder al Sistema</a>
            </p>
            <p>Si tienes alguna pregunta, contacta al administrador del sistema.</p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático. Por favor no respondas a este correo.</p>
          </div>
        </body>
        </html>
      `
    };
    
    try {
      await emailTransporter.sendMail(mailOptions);
      console.log(`[EMAIL] Invitación enviada a ${email}`);
    } catch (emailErr) {
      console.error(`[EMAIL ERROR] No se pudo enviar invitación a ${email}:`, emailErr.message);
    }
    
    res.json({ success: true, id: result.rows[0].id, message: 'Usuario invitado creado. Se vinculará automáticamente cuando inicie sesión.' });
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.delete('/api/admin/usuarios/:id', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  param('id').isInt({ min: 1 }).withMessage('ID inválido')
], handleValidationErrors, async (req, res) => {
  const userId = parseInt(req.params.id);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1) Obtener replit_user_id ANTES de borrar el usuario
    const userCheck = await client.query('SELECT id, replit_user_id FROM usuarios WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const replitUserId = userCheck.rows[0].replit_user_id;
    
    // 2) No bloquear por eventos: desvincular eventos del usuario (mantener datos contables)
    await client.query('UPDATE eventos SET usuario_id = NULL WHERE usuario_id = $1', [userId]);
    
    // 3) Desvincular validaciones de eventos
    await client.query('UPDATE eventos SET validado_por = NULL WHERE validado_por = $1', [userId]);
    
    // 4) Eliminar asignaciones y sesiones
    await client.query('DELETE FROM auditor_clientes WHERE auditor_id = $1', [userId]);
    await client.query('DELETE FROM user_sessions_legacy WHERE usuario_id = $1', [userId]);
    
    // 5) Desasignar campos de clientes
    await client.query('UPDATE campos SET cliente_id = NULL WHERE cliente_id = $1', [userId]);
    
    // 6) Eliminar usuario interno
    await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    
    // 7) Si estaba vinculado a Replit, eliminar también replit_users para que NO reaparezca como "sin vincular"
    if (replitUserId) {
      await client.query('DELETE FROM replit_users WHERE id = $1', [replitUserId]);
    }
    
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error eliminando usuario:', err);
    
    // Mensaje claro si falla por NOT NULL en eventos.usuario_id
    const msg = String(err?.message || '');
    if (msg.toLowerCase().includes('null') && msg.toLowerCase().includes('usuario_id')) {
      return res.status(500).json({
        error: 'No se pudo eliminar porque eventos.usuario_id no permite NULL. Se requiere ajustar la columna.'
      });
    }
    
    return res.status(500).json({ error: 'Error al eliminar usuario' });
  } finally {
    client.release();
  }
});

app.put('/api/admin/usuarios/:id', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  param('id').isInt({ min: 1 }).withMessage('ID inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, activo, rol, rol_id, tenant_id } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nombre !== undefined) { updates.push('nombre = $' + paramCount++); values.push(nombre); }
    if (email !== undefined) { updates.push('email = $' + paramCount++); values.push(email); }
    if (activo !== undefined) { updates.push('activo = $' + paramCount++); values.push(activo); }
    if (rol_id !== undefined) { 
      updates.push('rol_id = $' + paramCount++); 
      values.push(rol_id); 
    } else if (rol !== undefined) {
      const rolResult = await pool.query('SELECT id FROM roles WHERE nombre = $1', [rol]);
      if (rolResult.rows[0]) { updates.push('rol_id = $' + paramCount++); values.push(rolResult.rows[0].id); }
    }
    if (tenant_id !== undefined) { 
      updates.push('tenant_id = $' + paramCount++); 
      values.push(tenant_id); 
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
    }
    
    // También actualizar first_name y last_name en replit_users
    if (nombre !== undefined) {
      const usuarioResult = await pool.query('SELECT replit_user_id FROM usuarios WHERE id = $1', [id]);
      const replitUserId = usuarioResult.rows[0]?.replit_user_id;
      if (replitUserId) {
        const nameParts = nombre.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        await pool.query('UPDATE replit_users SET first_name = $1, last_name = $2 WHERE id = $3', [firstName, lastName, replitUserId]);
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.post('/api/admin/reset-dev-db', isAuthenticated, isAdminOnly, async (req, res) => {
  const resetSecret = req.get('x-reset-secret');
  if (!process.env.RESET_DB_SECRET || resetSecret !== process.env.RESET_DB_SECRET) {
    securityLog('RESET_DB_BLOCKED', { reason: 'invalid_secret' }, req);
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  if (process.env.REPLIT_DEPLOYMENT) {
    return res.status(403).json({ error: 'No permitido en producción' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE 
        sessions,
        auditor_clientes, 
        asientos, 
        eventos, 
        lotes_actividades,
        lotes, 
        campos, 
        usuarios, 
        clientes 
      RESTART IDENTITY CASCADE
    `);
    await client.query('COMMIT');
    
    console.log('[ADMIN] Database reset ejecutado');
    res.json({ success: true, message: 'Base de datos reiniciada' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en reset-dev-db:', err);
    res.status(500).json({ error: 'Error al reiniciar base de datos' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/campos', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.session?.active_tenant_id;

    let query = `
      SELECT c.*, cl.nombre as tenant_nombre
      FROM campos c
      LEFT JOIN clientes cl ON c.tenant_id = cl.id
    `;
    const params = [];

    // Prioridad: active_tenant_id de sesión > tenant_ids del rol
    if (activeTenantId) {
      query += ' WHERE c.tenant_id = $1';
      params.push(activeTenantId);
    } else if (roleInfo.tenant_ids !== null && roleInfo.tenant_ids.length > 0) {
      query += ' WHERE c.tenant_id = ANY($1)';
      params.push(roleInfo.tenant_ids);
    } else if (roleInfo.tenant_ids !== null && roleInfo.tenant_ids.length === 0) {
      query += ' WHERE 1=0';
    }

    query += ' ORDER BY c.nombre';

    const result = await pool.query(query, params);
    res.json({ campos: result.rows });
  } catch (err) {
    console.error('Error loading campos:', err);
    res.status(500).json({ error: 'Error al cargar campos' });
  }
});

app.post('/api/admin/campos', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, apiWriteLimiter, [
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('descripcion').optional().isString().trim().isLength({ max: 1000 }).withMessage('Descripcion muy larga'),
  body('tenant_id').optional().isInt({ min: 1 }).withMessage('Tenant invalido')
], handleValidationErrors, async (req, res) => {
  const roleInfo = req.roleInfo;
  const sanitizedBody = sanitizeObject(req.body);
  const { nombre, descripcion, tenant_id } = sanitizedBody;

  const effectiveTenantId = req.activeTenantId || req.session?.active_tenant_id || tenant_id || roleInfo.tenant_id;

  if (!effectiveTenantId) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente antes de crear campos' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO campos (nombre, descripcion, tenant_id) VALUES ($1, $2, $3) RETURNING id',
      [nombre, descripcion || null, effectiveTenantId]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear campo' });
  }
});

app.get('/api/admin/lotes', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.session?.active_tenant_id;

    let query = `
      SELECT l.*, c.nombre as campo_nombre
      FROM lotes l 
      JOIN campos c ON l.campo_id = c.id
    `;
    const params = [];

    if (activeTenantId) {
      query += ' WHERE c.tenant_id = $1';
      params.push(activeTenantId);
    } else if (roleInfo.tenant_ids !== null && roleInfo.tenant_ids.length > 0) {
      query += ' WHERE c.tenant_id = ANY($1)';
      params.push(roleInfo.tenant_ids);
    } else if (roleInfo.tenant_ids !== null && roleInfo.tenant_ids.length === 0) {
      query += ' WHERE 1=0';
    }

    query += ' ORDER BY c.nombre, l.nombre';

    const lotesResult = await pool.query(query, params);
    
    // Cargar actividades de cada lote
    const lotes = await Promise.all(lotesResult.rows.map(async (lote) => {
      const actRes = await pool.query(`
        SELECT a.id as actividad_id, a.nombre as actividad_nombre
        FROM lotes_actividades la
        JOIN actividades a ON la.actividad_id = a.id
        WHERE la.lote_id = $1
      `, [lote.id]);
      return {
        ...lote,
        actividades: actRes.rows,
        actividades_nombres: actRes.rows.map(a => a.actividad_nombre).join(', ') || 'Todas'
      };
    }));
    
    res.json({ lotes });
  } catch (err) {
    console.error('Error cargando lotes:', err);
    res.status(500).json({ error: 'Error al cargar lotes' });
  }
});

app.post('/api/admin/lotes', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, apiWriteLimiter, [
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('campo_id').isInt({ min: 1 }).withMessage('Campo invalido'),
  body('actividades').optional().isArray().withMessage('Actividades debe ser un array')
], handleValidationErrors, async (req, res) => {
  const client = await pool.connect();
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { nombre, campo_id, actividades } = sanitizedBody;
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    const campoCheck = await client.query('SELECT tenant_id FROM campos WHERE id = $1', [campo_id]);
    if (campoCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Campo no encontrado' });
    }
    
    if (activeTenantId && campoCheck.rows[0].tenant_id !== activeTenantId) {
      return res.status(403).json({ error: 'El campo seleccionado no pertenece al cliente activo' });
    }
    
    await client.query('BEGIN');
    
    const result = await client.query(
      'INSERT INTO lotes (nombre, campo_id) VALUES ($1, $2) RETURNING id',
      [nombre, campo_id]
    );
    const loteId = result.rows[0].id;
    
    if (actividades && actividades.length > 0) {
      for (const actId of actividades) {
        await client.query('INSERT INTO lotes_actividades (lote_id, actividad_id) VALUES ($1, $2)', [loteId, actId]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, id: loteId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando lote:', err);
    res.status(500).json({ error: 'Error al crear lote' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/categorias', isAuthenticated, isAdminOrAuditor, requireActiveTenant, async (req, res) => {
  try {
    const tenantId = req.activeTenantId;
    
    // Requerir tenant activo para categorías
    if (!tenantId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para administrar categorías' });
    }
    
    const tipoFiltro = req.query.tipo; // 'CLIENTE' o 'GESTOR' (opcional)
    
    let query, params = [tenantId];
    
    if (tipoFiltro === 'GESTOR') {
      // Categorías GESTOR: solo del tenant activo (no globales)
      query = `
        SELECT c.*, a.nombre as actividad_nombre
        FROM categorias c
        JOIN actividades a ON c.actividad_id = a.id
        WHERE c.tipo = 'GESTOR' AND c.tenant_id = $1 AND c.activo = TRUE
          AND (a.tenant_id IS NULL OR a.tenant_id = $1)
        ORDER BY a.nombre, c.nombre
      `;
    } else {
      // Por defecto: Categorías CLIENTE del tenant activo
      query = `
        SELECT c.*, a.nombre as actividad_nombre
        FROM categorias c
        JOIN actividades a ON c.actividad_id = a.id
        WHERE c.tipo = 'CLIENTE' AND c.tenant_id = $1
          AND (a.tenant_id IS NULL OR a.tenant_id = $1)
        ORDER BY c.activo DESC, a.nombre, c.nombre
      `;
    }
    
    const result = await pool.query(query, params);
    res.json({ categorias: result.rows });
  } catch (err) {
    console.error('Error cargando categorias:', err);
    res.status(500).json({ error: 'Error al cargar categorias' });
  }
});

app.post('/api/admin/categorias', isAuthenticated, isAdminOrAuditor, requireActiveTenant, apiWriteLimiter, [
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('actividad_id').isInt({ min: 1 }).withMessage('Actividad invalida'),
  body('peso_estandar').optional().isFloat({ min: 0, max: 99999 })
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { nombre, actividad_id, peso_estandar } = sanitizedBody;
    const tenantId = req.activeTenantId;
    
    // Requerir tenant activo para categorías
    if (!tenantId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para crear categorías' });
    }
    
    // Verificar que la actividad exista y sea accesible
    const actCheck = await pool.query('SELECT tenant_id FROM actividades WHERE id = $1', [actividad_id]);
    if (actCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Actividad no encontrada' });
    }
    const actTenantId = actCheck.rows[0].tenant_id;
    
    // La actividad debe ser global o del mismo tenant
    if (actTenantId !== null && actTenantId !== tenantId) {
      return res.status(403).json({ error: 'La actividad no pertenece al cliente activo' });
    }
    
    // Crear categoría tipo CLIENTE para el tenant activo
    const result = await pool.query(
      `INSERT INTO categorias (nombre, actividad_id, peso_estandar, tenant_id, es_estandar, activo, tipo) 
       VALUES ($1, $2, $3, $4, false, true, 'CLIENTE') RETURNING id`,
      [nombre, actividad_id, peso_estandar || null, tenantId]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error creando categoria:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: 'Error al crear categoria' });
  }
});

app.get('/api/admin/roles', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json({ roles: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar roles' });
  }
});

app.get('/api/admin/actividades', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.session?.active_tenant_id;
    
    let query = 'SELECT * FROM actividades';
    const params = [];
    
    // Filtrar por tenant activo (mostrar globales + específicas del tenant)
    if (activeTenantId) {
      query += ' WHERE tenant_id IS NULL OR tenant_id = $1';
      params.push(activeTenantId);
    } else if (roleInfo.rol !== 'administrador' && roleInfo.tenant_ids && roleInfo.tenant_ids.length > 0) {
      query += ' WHERE tenant_id IS NULL OR tenant_id = ANY($1)';
      params.push(roleInfo.tenant_ids);
    }
    
    query += ' ORDER BY nombre';
    const result = await pool.query(query, params);
    res.json({ actividades: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar actividades' });
  }
});

app.post('/api/admin/actividades', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, apiWriteLimiter, [
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('descripcion').optional().isString().trim().isLength({ max: 1000 })
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { nombre, descripcion } = sanitizedBody;
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Crear actividad asignada al tenant activo
    const result = await pool.query(
      'INSERT INTO actividades (nombre, descripcion, tenant_id) VALUES ($1, $2, $3) RETURNING id',
      [nombre, descripcion || null, activeTenantId || null]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear actividad' });
  }
});

app.get('/api/admin/tipos-evento', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT te.*, pc.nombre as plan_nombre
      FROM tipos_evento te
      LEFT JOIN planes_cuenta pc ON te.plan_cuenta_id = pc.id
      ORDER BY te.codigo
    `);
    res.json({ tipos_evento: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar tipos de evento' });
  }
});

app.post('/api/admin/tipos-evento', isAuthenticated, isAdminOrAuditor, apiWriteLimiter, [
  body('codigo').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Codigo invalido'),
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('plan_cuenta_id').optional().isInt({ min: 1 }),
  body('requiere_origen_destino').optional().isBoolean(),
  body('requiere_campo_destino').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { codigo, nombre, plan_cuenta_id, requiere_origen_destino, requiere_campo_destino } = sanitizedBody;
    const result = await pool.query(
      `INSERT INTO tipos_evento (codigo, nombre, plan_cuenta_id, requiere_origen_destino, requiere_campo_destino) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [codigo, nombre, plan_cuenta_id || null, requiere_origen_destino || false, requiere_campo_destino || false]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear tipo de evento' });
  }
});

app.get('/api/admin/cuentas', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, pc.codigo as plan_codigo, pc.nombre as plan_nombre
      FROM cuentas c
      JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
      ORDER BY pc.codigo, c.codigo
    `);
    res.json({ cuentas: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar cuentas' });
  }
});

app.post('/api/admin/cuentas', isAuthenticated, isAdminOrAuditor, apiWriteLimiter, [
  body('codigo').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Codigo invalido'),
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('plan_cuenta_id').isInt({ min: 1 }).withMessage('Plan de cuenta invalido'),
  body('tipo_normal').optional().isString().trim().isLength({ max: 20 })
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { codigo, nombre, plan_cuenta_id, tipo_normal } = sanitizedBody;
    const result = await pool.query(
      'INSERT INTO cuentas (codigo, nombre, plan_cuenta_id, tipo_normal) VALUES ($1, $2, $3, $4) RETURNING id',
      [codigo, nombre, plan_cuenta_id, tipo_normal]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cuenta' });
  }
});

app.get('/api/admin/planes-cuenta', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM planes_cuenta ORDER BY codigo');
    res.json({ planes_cuenta: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar planes de cuenta' });
  }
});

app.post('/api/admin/planes-cuenta', isAuthenticated, isAdminOrAuditor, apiWriteLimiter, [
  body('codigo').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Codigo invalido'),
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido')
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { codigo, nombre } = sanitizedBody;
    const result = await pool.query(
      'INSERT INTO planes_cuenta (codigo, nombre) VALUES ($1, $2) RETURNING id',
      [codigo, nombre]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear plan de cuenta' });
  }
});

app.put('/api/admin/campos/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    const campoCheck = await pool.query('SELECT tenant_id FROM campos WHERE id = $1', [req.params.id]);
    if (campoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }
    
    const campoTenantId = campoCheck.rows[0].tenant_id;
    if (activeTenantId && campoTenantId !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para modificar este campo' });
    }
    
    const effectiveTenantId = activeTenantId || campoTenantId;
    
    await pool.query(
      'UPDATE campos SET nombre = $1, descripcion = $2, tenant_id = $3, activo = $4 WHERE id = $5',
      [nombre, descripcion || null, effectiveTenantId, activo !== false, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar campo' });
  }
});

app.delete('/api/admin/campos/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Verificar que el campo pertenezca al tenant activo (para auditores)
    const campoCheck = await pool.query('SELECT tenant_id FROM campos WHERE id = $1', [req.params.id]);
    if (campoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }
    
    if (activeTenantId && campoCheck.rows[0].tenant_id !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para eliminar este campo' });
    }
    
    await pool.query('DELETE FROM campos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar campo. Verifique que no tenga registros asociados.' });
  }
});

// Asignar campo a cliente (solo admin)
app.put('/api/admin/campos/:id/cliente', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const { cliente_id } = req.body;
    
    // Verificar que el campo existe
    const campoCheck = await pool.query('SELECT id FROM campos WHERE id = $1', [req.params.id]);
    if (campoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }
    
    // Verificar que el cliente existe (si se proporciona)
    if (cliente_id) {
      const clienteCheck = await pool.query('SELECT id FROM clientes WHERE id = $1 AND activo = true', [cliente_id]);
      if (clienteCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Cliente no encontrado o inactivo' });
      }
    }
    
    await pool.query('UPDATE campos SET tenant_id = $1 WHERE id = $2', [cliente_id || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error asignando campo a cliente:', err);
    res.status(500).json({ error: 'Error al asignar campo a cliente' });
  }
});

app.put('/api/admin/lotes/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre, campo_id, actividades, activo } = req.body;
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    const loteCheck = await client.query(`
      SELECT l.id, c.tenant_id 
      FROM lotes l 
      JOIN campos c ON l.campo_id = c.id 
      WHERE l.id = $1
    `, [req.params.id]);
    
    if (loteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    
    if (activeTenantId && loteCheck.rows[0].tenant_id !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para modificar este lote' });
    }
    
    if (campo_id) {
      const campoCheck = await client.query('SELECT tenant_id FROM campos WHERE id = $1', [campo_id]);
      if (campoCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Campo no encontrado' });
      }
      if (activeTenantId && campoCheck.rows[0].tenant_id !== activeTenantId) {
        return res.status(403).json({ error: 'El campo seleccionado no pertenece al cliente activo' });
      }
    }
    
    await client.query('BEGIN');
    
    await client.query(
      'UPDATE lotes SET nombre = $1, campo_id = $2, activo = $3 WHERE id = $4',
      [nombre, campo_id, activo !== false, req.params.id]
    );
    
    await client.query('DELETE FROM lotes_actividades WHERE lote_id = $1', [req.params.id]);
    
    if (actividades && actividades.length > 0) {
      for (const actId of actividades) {
        await client.query('INSERT INTO lotes_actividades (lote_id, actividad_id) VALUES ($1, $2)', [req.params.id, actId]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error actualizando lote:', err);
    res.status(500).json({ error: 'Error al actualizar lote' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/lotes/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Verificar que el lote pertenezca al tenant activo via campo
    const loteCheck = await pool.query(`
      SELECT l.id, c.tenant_id 
      FROM lotes l 
      JOIN campos c ON l.campo_id = c.id 
      WHERE l.id = $1
    `, [req.params.id]);
    
    if (loteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    
    if (activeTenantId && loteCheck.rows[0].tenant_id !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para eliminar este lote' });
    }
    
    await pool.query('DELETE FROM lotes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar lote. Verifique que no tenga registros asociados.' });
  }
});

app.put('/api/admin/categorias/:id', isAuthenticated, isAdminOrAuditor, requireActiveTenant, [
  body('activo').optional().isBoolean().withMessage('Valor de activo inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const { nombre, actividad_id, peso_estandar, activo } = req.body;
    const tenantId = req.activeTenantId;
    
    // Requerir tenant activo para categorías
    if (!tenantId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para modificar categorías' });
    }
    
    // Verificar que la categoría existe y pertenece al tenant
    const catCheck = await pool.query(
      "SELECT tenant_id, tipo FROM categorias WHERE id = $1",
      [req.params.id]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    
    const catTenantId = catCheck.rows[0].tenant_id;
    const catTipo = catCheck.rows[0].tipo;
    
    // Solo permitir modificar categorías CLIENTE del tenant activo
    if (catTipo !== 'CLIENTE') {
      return res.status(403).json({ error: 'Solo se pueden modificar categorías de tipo CLIENTE desde este panel' });
    }
    if (catTenantId !== tenantId) {
      return res.status(403).json({ error: 'No tiene permiso para modificar esta categoria' });
    }
    
    // Validar actividad
    if (actividad_id) {
      const actCheck = await pool.query('SELECT tenant_id FROM actividades WHERE id = $1', [actividad_id]);
      if (actCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Actividad no encontrada' });
      }
      const actTenantId = actCheck.rows[0].tenant_id;
      if (actTenantId !== null && actTenantId !== tenantId) {
        return res.status(403).json({ error: 'La actividad no pertenece al cliente activo' });
      }
    }
    
    // Construir UPDATE
    let query = 'UPDATE categorias SET nombre = $1, actividad_id = $2, peso_estandar = $3';
    const params = [nombre, actividad_id, peso_estandar || null];
    
    if (typeof activo === 'boolean') {
      query += ', activo = $4 WHERE id = $5';
      params.push(activo, req.params.id);
    } else {
      query += ' WHERE id = $4';
      params.push(req.params.id);
    }
    
    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando categoria:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: 'Error al actualizar categoria' });
  }
});

// SOFT DELETE: Desactivar categoría CLIENTE del tenant activo
app.delete('/api/admin/categorias/:id', isAuthenticated, isAdminOrAuditor, requireActiveTenant, async (req, res) => {
  try {
    const tenantId = req.activeTenantId;
    
    // Requerir tenant activo para categorías
    if (!tenantId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para desactivar categorías' });
    }
    
    // Verificar que la categoría existe y pertenece al tenant
    const catCheck = await pool.query(
      "SELECT tenant_id, tipo FROM categorias WHERE id = $1",
      [req.params.id]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    
    const catTenantId = catCheck.rows[0].tenant_id;
    const catTipo = catCheck.rows[0].tipo;
    
    // Solo permitir desactivar categorías CLIENTE del tenant activo
    if (catTipo !== 'CLIENTE') {
      return res.status(403).json({ error: 'Solo se pueden desactivar categorías de tipo CLIENTE desde este panel' });
    }
    if (catTenantId !== tenantId) {
      return res.status(403).json({ error: 'No tiene permiso para desactivar esta categoria' });
    }
    
    // SOFT DELETE
    await pool.query('UPDATE categorias SET activo = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Categoria desactivada' });
  } catch (err) {
    console.error('Error desactivando categoria:', err);
    res.status(500).json({ error: 'Error al desactivar categoria' });
  }
});

// ============================================================
// CRUD CATEGORIAS MAPEO (Fase 3)
// ============================================================

// GET: Listar mapeos del tenant activo
app.get('/api/admin/categorias-mapeo', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Tanto admin como auditor requieren tenant activo para mapeo
    if (!activeTenantId) {
      return res.status(403).json({ error: 'Debe seleccionar un cliente antes de mapear categorías' });
    }
    
    // Auditor: validar acceso al tenant
    if (roleInfo.rol === 'auditor') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM auditor_clientes WHERE usuario_id = (SELECT id FROM usuarios WHERE replit_user_id = $1) AND cliente_id = $2',
        [req.user.claims.sub, activeTenantId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'No tiene acceso a este cliente' });
      }
    }
    
    const result = await pool.query(`
      SELECT 
        cm.categoria_cliente_id,
        cc.nombre AS categoria_cliente_nombre,
        cm.categoria_gestor_id,
        cg.nombre AS categoria_gestor_nombre,
        cm.activo,
        cm.updated_at
      FROM categorias_mapeo cm
      JOIN categorias cc ON cm.categoria_cliente_id = cc.id
      JOIN categorias cg ON cm.categoria_gestor_id = cg.id
      WHERE cm.tenant_id = $1 AND cm.activo = TRUE
      ORDER BY cc.nombre
    `, [activeTenantId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error cargando mapeos:', err);
    res.status(500).json({ error: 'Error al cargar mapeos de categorías' });
  }
});

// GET: Categorías para pantalla de mapeo (CLIENTE y GESTOR separadas)
app.get('/api/admin/categorias-mapeo/listas', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? parseInt(req.query.tenantId) : (req.activeTenantId || req.session?.active_tenant_id);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Debe especificar tenantId o tener un tenant activo' });
    }
    
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    
    if (roleInfo.rol === 'auditor') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM auditor_clientes WHERE usuario_id = (SELECT id FROM usuarios WHERE replit_user_id = $1) AND cliente_id = $2',
        [req.user.claims.sub, tenantId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'No tiene acceso a este cliente' });
      }
    }
    
    const [clienteResult, gestorResult, mapeosResult] = await Promise.all([
      pool.query(`
        SELECT id, nombre, actividad_id, agrup1, agrup2
        FROM categorias 
        WHERE tenant_id = $1 AND tipo = 'CLIENTE' AND activo = true
        ORDER BY nombre
      `, [tenantId]),
      pool.query(`
        SELECT id, nombre, external_id, last_synced_at
        FROM categorias 
        WHERE tenant_id = $1 AND tipo = 'GESTOR' AND activo = true
        ORDER BY nombre
      `, [tenantId]),
      pool.query(`
        SELECT categoria_cliente_id, categoria_gestor_id
        FROM categorias_mapeo 
        WHERE tenant_id = $1 AND activo = true
      `, [tenantId])
    ]);
    
    res.json({
      categoriasCliente: clienteResult.rows,
      categoriasGestor: gestorResult.rows,
      mapeos: mapeosResult.rows
    });
  } catch (err) {
    console.error('Error cargando listas de categorías para mapeo:', err);
    res.status(500).json({ error: 'Error al cargar categorías' });
  }
});

// GET: Status de mapeo del tenant activo
app.get('/api/admin/categorias-mapeo/status', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    if (!activeTenantId) {
      return res.status(403).json({ error: 'Debe seleccionar un cliente antes de mapear categorías' });
    }
    
    // Total de categorías Cliente activas del tenant
    const totalResult = await pool.query(`
      SELECT COUNT(*) AS total FROM categorias 
      WHERE tipo = 'CLIENTE' AND activo = TRUE AND tenant_id = $1
    `, [activeTenantId]);
    
    // Categorías Cliente con mapeo activo
    const mapeadasResult = await pool.query(`
      SELECT COUNT(DISTINCT categoria_cliente_id) AS mapeadas 
      FROM categorias_mapeo 
      WHERE tenant_id = $1 AND activo = TRUE
    `, [activeTenantId]);
    
    const total_cliente = parseInt(totalResult.rows[0].total) || 0;
    const mapeadas = parseInt(mapeadasResult.rows[0].mapeadas) || 0;
    
    res.json({
      total_cliente,
      mapeadas,
      sin_mapear: total_cliente - mapeadas
    });
  } catch (err) {
    console.error('Error obteniendo status de mapeo:', err);
    res.status(500).json({ error: 'Error al obtener status de mapeo' });
  }
});

// POST: Crear/actualizar mapeo (UPSERT)
app.post('/api/admin/categorias-mapeo', isAuthenticated, isAdminOrAuditor, apiWriteLimiter, [
  body('categoria_cliente_id').isInt({ min: 1 }).withMessage('categoria_cliente_id inválido'),
  body('categoria_gestor_id').isInt({ min: 1 }).withMessage('categoria_gestor_id inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    if (!activeTenantId) {
      return res.status(403).json({ error: 'Debe seleccionar un cliente antes de mapear categorías' });
    }
    
    // Auditor: validar acceso al tenant
    if (roleInfo.rol === 'auditor') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM auditor_clientes WHERE usuario_id = (SELECT id FROM usuarios WHERE replit_user_id = $1) AND cliente_id = $2',
        [req.user.claims.sub, activeTenantId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'No tiene acceso a este cliente' });
      }
    }
    
    const { categoria_cliente_id, categoria_gestor_id } = req.body;
    
    // Validar categoria_cliente_id: debe ser tipo CLIENTE y pertenecer al tenant
    const clienteCatCheck = await pool.query(
      "SELECT id FROM categorias WHERE id = $1 AND tipo = 'CLIENTE' AND tenant_id = $2 AND activo = TRUE",
      [categoria_cliente_id, activeTenantId]
    );
    if (clienteCatCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Categoría cliente inválida' });
    }
    
    // Validar categoria_gestor_id: debe ser tipo GESTOR y accesible al tenant
    // GESTOR puede ser global (tenant_id NULL) o del tenant específico
    const gestorCatCheck = await pool.query(
      "SELECT id FROM categorias WHERE id = $1 AND tipo = 'GESTOR' AND (tenant_id IS NULL OR tenant_id = $2) AND activo = TRUE",
      [categoria_gestor_id, activeTenantId]
    );
    if (gestorCatCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Categoría gestor inválida' });
    }
    
    // UPSERT: usar ON CONFLICT
    await pool.query(`
      INSERT INTO categorias_mapeo (tenant_id, categoria_cliente_id, categoria_gestor_id, activo, updated_at, updated_by_replit_id)
      VALUES ($1, $2, $3, TRUE, NOW(), $4)
      ON CONFLICT (tenant_id, categoria_cliente_id)
      DO UPDATE SET categoria_gestor_id = $3, activo = TRUE, updated_at = NOW(), updated_by_replit_id = $4
    `, [activeTenantId, categoria_cliente_id, categoria_gestor_id, req.user.claims.sub]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error creando mapeo:', err);
    res.status(500).json({ error: 'Error al crear mapeo de categoría' });
  }
});

// DELETE: Desactivar mapeo (soft delete)
app.delete('/api/admin/categorias-mapeo/:categoria_cliente_id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    if (!activeTenantId) {
      return res.status(403).json({ error: 'Debe seleccionar un cliente antes de mapear categorías' });
    }
    
    // Auditor: validar acceso al tenant
    if (roleInfo.rol === 'auditor') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM auditor_clientes WHERE usuario_id = (SELECT id FROM usuarios WHERE replit_user_id = $1) AND cliente_id = $2',
        [req.user.claims.sub, activeTenantId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'No tiene acceso a este cliente' });
      }
    }
    
    const categoriaClienteId = parseInt(req.params.categoria_cliente_id);
    
    // Soft delete
    await pool.query(
      'UPDATE categorias_mapeo SET activo = FALSE, updated_at = NOW(), updated_by_replit_id = $1 WHERE tenant_id = $2 AND categoria_cliente_id = $3',
      [req.user.claims.sub, activeTenantId, categoriaClienteId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando mapeo:', err);
    res.status(500).json({ error: 'Error al eliminar mapeo de categoría' });
  }
});

// ============================================================
// IMPORTACIÓN DE CATEGORÍAS CLIENTE (CSV/XLSX)
// ============================================================

app.get('/api/admin/categorias-cliente/plantilla', isAuthenticated, isAdminOrAuditor, (req, res) => {
  const csvContent = 'Nombre,Actividad,Peso estandar\nVaca,CRIA,450\nNovillo,INVERNADA,380\nTernero,RECRIA,180\n';
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_categorias.csv"');
  res.send(csvContent);
});

const uploadCategoriasCliente = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function normalizeCategoriaRow(row) {
  const result = {
    nombre: null,
    actividad: null,
    peso_estandar: null,
    activo: true,
    errors: [],
    warnings: []
  };
  
  const nombre = (row.nombre || row.Nombre || row.NOMBRE || '').toString().trim();
  if (!nombre) {
    result.errors.push({ field: 'nombre', code: 'missing_nombre', message: 'Nombre de categoría requerido' });
  } else {
    result.nombre = nombre;
  }
  
  const actividad = (row.actividad || row.Actividad || row.ACTIVIDAD || '').toString().trim().toUpperCase();
  if (!actividad) {
    result.errors.push({ field: 'actividad', code: 'missing_actividad', message: 'Actividad requerida' });
  } else {
    result.actividad = actividad;
  }
  
  const pesoRaw = row.peso_estandar || row['peso estandar'] || row['Peso Estándar'] || row['peso estándar'] || 
                  row.Peso_Estandar || row.PESO_ESTANDAR || row['Peso estandar'] || row['peso_estandar'] ||
                  row['Peso estndar'] || row['peso estndar'] || row.PesoEstandar || row['Peso Estandar'];
  if (pesoRaw !== undefined && pesoRaw !== null && pesoRaw !== '') {
    const pesoNum = parseFloat(pesoRaw);
    if (isNaN(pesoNum)) {
      result.errors.push({ field: 'peso_estandar', code: 'invalid_peso_estandar', message: `Peso estándar inválido: ${pesoRaw}` });
    } else {
      result.peso_estandar = pesoNum;
    }
  }
  
  return result;
}

app.post('/api/admin/categorias-cliente/import', isAuthenticated, isAdminOrAuditor, uploadCategoriasCliente.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const roleInfo = await getUserRoleAndCampos(req.user.claims.sub);
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    if (!activeTenantId) {
      return res.status(403).json({ status: 'error', error: 'Debe seleccionar un cliente antes de importar categorías' });
    }
    
    if (roleInfo.rol === 'auditor') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM auditor_clientes WHERE usuario_id = (SELECT id FROM usuarios WHERE replit_user_id = $1) AND cliente_id = $2',
        [req.user.claims.sub, activeTenantId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ status: 'error', error: 'No tiene acceso a este cliente' });
      }
    }
    
    if (!req.file) {
      return res.status(400).json({ status: 'error', error: 'No se proporcionó archivo' });
    }
    
    const dryRun = req.query.dryRun !== 'false';
    const formatParam = req.query.format || 'auto';
    
    let rows = [];
    const fileName = req.file.originalname || '';
    const mimeType = req.file.mimetype || '';
    
    let detectedFormat = formatParam;
    if (formatParam === 'auto') {
      if (mimeType.includes('csv') || fileName.toLowerCase().endsWith('.csv')) {
        detectedFormat = 'csv';
      } else if (mimeType.includes('sheet') || mimeType.includes('excel') || 
                 fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
        detectedFormat = 'xlsx';
      } else {
        return res.status(400).json({ status: 'error', error: 'Formato de archivo no soportado' });
      }
    }
    
    try {
      if (detectedFormat === 'csv') {
        const csvContent = req.file.buffer.toString('utf-8');
        const firstLine = csvContent.split('\n')[0] || '';
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        rows = csvParse(csvContent, {
          columns: (header) => header.map(col => col.trim()),
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          delimiter: delimiter
        });
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        rows = rawRows.map(row => {
          const normalized = {};
          for (const [key, val] of Object.entries(row)) {
            normalized[key.trim()] = val;
          }
          return normalized;
        });
      }
    } catch (parseErr) {
      console.error('Error parsing file:', parseErr);
      return res.status(400).json({ status: 'error', error: `Error al leer archivo: ${parseErr.message}` });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(400).json({ status: 'error', error: 'Archivo vacío o sin datos válidos' });
    }
    
    await client.query('BEGIN');
    
    const actividadesResult = await client.query(
      'SELECT id, nombre FROM actividades WHERE tenant_id = $1 OR tenant_id IS NULL',
      [activeTenantId]
    );
    const actividadesMap = {};
    actividadesResult.rows.forEach(a => {
      actividadesMap[a.nombre.toLowerCase()] = a.id;
    });
    
    const categoriasResult = await client.query(
      "SELECT id, nombre FROM categorias WHERE tenant_id = $1 AND tipo = 'CLIENTE'",
      [activeTenantId]
    );
    const categoriasMap = {};
    categoriasResult.rows.forEach(c => {
      categoriasMap[c.nombre.toLowerCase()] = { id: c.id, nombre: c.nombre };
    });
    
    const summary = {
      total_rows: rows.length,
      valid_rows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      duplicates_in_file: 0
    };
    const errorsDetail = [];
    const preview = [];
    const seenNombres = new Set();
    
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const normalized = normalizeCategoriaRow(row);
      
      if (normalized.errors.some(e => e.code === 'missing_nombre')) {
        summary.skipped++;
        if (errorsDetail.length < 50) {
          errorsDetail.push({ row: rowNum, field: 'nombre', code: 'missing_nombre', message: 'Nombre requerido' });
        }
        continue;
      }
      
      if (normalized.errors.length > 0) {
        summary.errors++;
        normalized.errors.forEach(e => {
          if (errorsDetail.length < 50) {
            errorsDetail.push({ row: rowNum, ...e });
          }
        });
        continue;
      }
      
      const nombreKey = normalized.nombre.toLowerCase();
      if (seenNombres.has(nombreKey)) {
        summary.duplicates_in_file++;
        continue;
      }
      seenNombres.add(nombreKey);
      
      if (!normalized.actividad) {
        summary.errors++;
        if (errorsDetail.length < 50) {
          errorsDetail.push({ row: rowNum, field: 'actividad', code: 'missing_actividad', message: 'Actividad requerida' });
        }
        continue;
      }
      
      let actividadId = actividadesMap[normalized.actividad.toLowerCase()];
      if (!actividadId) {
        summary.errors++;
        if (errorsDetail.length < 50) {
          errorsDetail.push({ row: rowNum, field: 'actividad', code: 'actividad_not_found', message: `Actividad "${normalized.actividad}" no existe` });
        }
        continue;
      }
      
      const existingCat = categoriasMap[nombreKey];
      let action;
      
      if (existingCat) {
        action = 'updated';
        summary.updated++;
        if (!dryRun) {
          await client.query(`
            UPDATE categorias SET 
              actividad_id = $1, agrup1 = $2, agrup2 = $3, peso_estandar = $4, 
              activo = $5, source = 'IMPORT', external_id = NULL, last_synced_at = NULL
            WHERE id = $6
          `, [actividadId, normalized.agrup1, normalized.agrup2, normalized.peso_estandar, normalized.activo, existingCat.id]);
        }
      } else {
        action = 'inserted';
        summary.inserted++;
        if (!dryRun) {
          const insertResult = await client.query(`
            INSERT INTO categorias (tenant_id, tipo, nombre, actividad_id, agrup1, agrup2, peso_estandar, activo, es_estandar, source, external_id, last_synced_at)
            VALUES ($1, 'CLIENTE', $2, $3, $4, $5, $6, $7, FALSE, 'IMPORT', NULL, NULL) RETURNING id
          `, [activeTenantId, normalized.nombre, actividadId, normalized.agrup1, normalized.agrup2, normalized.peso_estandar, normalized.activo]);
          categoriasMap[nombreKey] = { id: insertResult.rows[0].id, nombre: normalized.nombre };
        }
      }
      
      summary.valid_rows++;
      
      if (preview.length < 50) {
        preview.push({
          row: rowNum,
          nombre: normalized.nombre,
          actividad: normalized.actividad,
          peso_estandar: normalized.peso_estandar,
          action: action
        });
      }
    }
    
    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
    
    console.log(`[IMPORT] Categorías Cliente: dryRun=${dryRun}, tenant=${activeTenantId}, inserted=${summary.inserted}, updated=${summary.updated}`);
    
    res.json({
      status: 'ok',
      dryRun: dryRun,
      tenant_id: activeTenantId,
      summary: summary,
      errors_detail: errorsDetail,
      preview: preview
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing categorias:', err);
    res.status(500).json({ status: 'error', error: 'Error interno al importar categorías' });
  } finally {
    client.release();
  }
});

// POST JSON import: formato 3 columnas (nombre, actividad, peso_estandar)
app.post('/api/admin/categorias/import-cliente', isAuthenticated, isAdminOrAuditor, requireActiveTenant, apiWriteLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.activeTenantId;
    
    // CRÍTICO: Requerir tenant activo incluso para admin
    if (!tenantId) {
      return res.status(400).json({ status: 'error', error: 'Debe seleccionar un cliente antes de importar categorías' });
    }
    
    const { rows } = req.body;
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ status: 'error', error: 'Se requiere un array de filas (rows)' });
    }
    
    await client.query('BEGIN');
    
    // Obtener actividades existentes del tenant
    const actividadesResult = await client.query(
      'SELECT id, nombre FROM actividades WHERE tenant_id = $1 OR tenant_id IS NULL',
      [tenantId]
    );
    const actividadesMap = {};
    actividadesResult.rows.forEach(a => {
      actividadesMap[a.nombre.toLowerCase()] = a.id;
    });
    
    // Obtener categorías CLIENTE existentes del tenant
    const categoriasResult = await client.query(
      "SELECT id, nombre FROM categorias WHERE tenant_id = $1 AND tipo = 'CLIENTE'",
      [tenantId]
    );
    const categoriasMap = {};
    categoriasResult.rows.forEach(c => {
      categoriasMap[c.nombre.toLowerCase()] = c.id;
    });
    
    const summary = { inserted: 0, updated: 0, errors: 0, duplicates_in_file: 0 };
    const errors = [];
    const seenNombres = new Set();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIdx = i + 1;
      
      // Validar nombre
      const nombre = (row.nombre || '').toString().trim();
      if (!nombre) {
        summary.errors++;
        errors.push({ rowIndex: rowIdx, message: 'Nombre requerido' });
        continue;
      }
      
      // Detectar duplicados en el archivo
      const nombreKey = nombre.toLowerCase();
      if (seenNombres.has(nombreKey)) {
        summary.duplicates_in_file++;
        continue;
      }
      seenNombres.add(nombreKey);
      
      // Validar actividad
      const actividadNombre = (row.actividad || '').toString().trim();
      if (!actividadNombre) {
        summary.errors++;
        errors.push({ rowIndex: rowIdx, message: 'Actividad requerida' });
        continue;
      }
      
      // Peso estándar (opcional)
      let pesoEstandar = null;
      if (row.peso_estandar !== undefined && row.peso_estandar !== null && row.peso_estandar !== '') {
        const pesoNum = parseFloat(row.peso_estandar);
        if (!isNaN(pesoNum) && pesoNum >= 0) {
          pesoEstandar = pesoNum;
        }
      }
      
      // Resolver o crear actividad (siempre para el tenant)
      let actividadId = actividadesMap[actividadNombre.toLowerCase()];
      if (!actividadId) {
        const newAct = await client.query(
          'INSERT INTO actividades (nombre, descripcion, tenant_id) VALUES ($1, $2, $3) RETURNING id',
          [actividadNombre, 'Creada por importación', tenantId]
        );
        actividadId = newAct.rows[0].id;
        actividadesMap[actividadNombre.toLowerCase()] = actividadId;
      }
      
      // Upsert categoría
      const existingId = categoriasMap[nombreKey];
      
      if (existingId) {
        await client.query(
          'UPDATE categorias SET actividad_id = $1, peso_estandar = $2 WHERE id = $3',
          [actividadId, pesoEstandar, existingId]
        );
        summary.updated++;
      } else {
        const insertResult = await client.query(
          `INSERT INTO categorias (tenant_id, tipo, nombre, actividad_id, peso_estandar, activo, es_estandar)
           VALUES ($1, 'CLIENTE', $2, $3, $4, true, false) RETURNING id`,
          [tenantId, nombre, actividadId, pesoEstandar]
        );
        categoriasMap[nombreKey] = insertResult.rows[0].id;
        summary.inserted++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`[IMPORT JSON] tenant=${tenantId}, inserted=${summary.inserted}, updated=${summary.updated}`);
    
    res.json({ status: 'ok', summary, errors });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en import JSON:', err);
    res.status(500).json({ status: 'error', error: 'Error interno al importar' });
  } finally {
    client.release();
  }
});

app.put('/api/admin/actividades/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Verificar que la actividad pertenezca al tenant activo
    const actCheck = await pool.query('SELECT tenant_id FROM actividades WHERE id = $1', [req.params.id]);
    if (actCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }
    
    const actTenantId = actCheck.rows[0].tenant_id;
    if (activeTenantId && actTenantId !== null && actTenantId !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para modificar esta actividad' });
    }
    if (activeTenantId && actTenantId === null) {
      return res.status(403).json({ error: 'No puede modificar actividades globales. Cree una actividad especifica para su cliente.' });
    }
    
    await pool.query('UPDATE actividades SET nombre = $1, descripcion = $2 WHERE id = $3', [nombre, descripcion || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar actividad' });
  }
});

app.delete('/api/admin/actividades/:id', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId || req.session?.active_tenant_id;
    
    // Verificar que la actividad pertenezca al tenant activo
    const actCheck = await pool.query('SELECT tenant_id FROM actividades WHERE id = $1', [req.params.id]);
    if (actCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }
    
    const actTenantId = actCheck.rows[0].tenant_id;
    if (activeTenantId && actTenantId !== null && actTenantId !== activeTenantId) {
      return res.status(403).json({ error: 'No tiene permiso para eliminar esta actividad' });
    }
    if (activeTenantId && actTenantId === null) {
      return res.status(403).json({ error: 'No puede eliminar actividades globales' });
    }
    
    await pool.query('DELETE FROM actividades WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar actividad. Verifique que no tenga registros asociados.' });
  }
});

app.put('/api/admin/tipos-evento/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const { codigo, nombre, requiere_origen_destino, requiere_campo_destino } = req.body;
    await pool.query(
      'UPDATE tipos_evento SET codigo = $1, nombre = $2, requiere_origen_destino = $3, requiere_campo_destino = $4 WHERE id = $5',
      [codigo, nombre, requiere_origen_destino || false, requiere_campo_destino || false, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tipo de evento' });
  }
});

app.delete('/api/admin/tipos-evento/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    await pool.query('DELETE FROM tipos_evento WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar tipo de evento. Verifique que no tenga registros asociados.' });
  }
});

app.put('/api/admin/cuentas/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const { codigo, nombre, plan_cuenta_id, tipo_normal } = req.body;
    await pool.query(
      'UPDATE cuentas SET codigo = $1, nombre = $2, plan_cuenta_id = $3, tipo_normal = $4 WHERE id = $5',
      [codigo, nombre, plan_cuenta_id, tipo_normal, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cuenta' });
  }
});

app.delete('/api/admin/cuentas/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    await pool.query('DELETE FROM cuentas WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cuenta. Verifique que no tenga registros asociados.' });
  }
});

app.put('/api/admin/planes-cuenta/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    await pool.query('UPDATE planes_cuenta SET codigo = $1, nombre = $2 WHERE id = $3', [codigo, nombre, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar plan de cuenta' });
  }
});

app.delete('/api/admin/planes-cuenta/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    await pool.query('DELETE FROM planes_cuenta WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar plan de cuenta. Verifique que no tenga registros asociados.' });
  }
});

app.get('/api/admin/clientes', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, c.nombre, c.descripcion, c.activo,
        (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = c.id) as usuarios_count,
        (SELECT COUNT(*) FROM campos ca WHERE ca.tenant_id = c.id) as campos_count,
        CASE WHEN ec.id IS NOT NULL AND ec.enabled THEN true ELSE false END as gestor_configured,
        ec.gestor_database_id,
        ec.gestor_base_url,
        ec.auth_scheme,
        ec.gestor_api_key_last4,
        ec.last_test_at,
        ec.last_test_ok
      FROM clientes c
      LEFT JOIN empresa_gestor_config ec ON ec.cliente_id = c.id
      WHERE c.activo = true
      ORDER BY c.nombre
    `);
    res.json({ clientes: result.rows });
  } catch (err) {
    console.error('Error loading clientes:', err);
    res.status(500).json({ error: 'Error al cargar clientes' });
  }
});

app.post('/api/admin/clientes', isAuthenticated, isAdminOrAuditor, apiWriteLimiter, [
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('descripcion').optional().isString().trim().isLength({ max: 1000 }).withMessage('Descripcion muy larga')
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { nombre, descripcion } = sanitizedBody;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await pool.query(
      'INSERT INTO clientes (nombre, descripcion) VALUES ($1, $2) RETURNING id',
      [nombre, descripcion || null]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating cliente:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

app.put('/api/admin/clientes/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    await pool.query(
      'UPDATE clientes SET nombre = $1, descripcion = $2, activo = $3 WHERE id = $4',
      [nombre, descripcion || null, activo !== false, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating cliente:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.delete('/api/admin/clientes/:id', isAuthenticated, isAdminOrAuditor, async (req, res) => {
  try {
    await pool.query('UPDATE clientes SET activo = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

// ============================================================
// GESTOR MAX - CONFIGURACIÓN DE CONEXIÓN POR EMPRESA
// ============================================================

// PUT: Guardar/actualizar conexión Gestor Max (Solo Admin)
app.put('/api/admin/clientes/:id/gestor-config', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('gestor_database_id').isInt({ min: 1 }).withMessage('Database ID inválido'),
  body('gestor_api_key').isString().isLength({ min: 20 }).withMessage('API Key debe tener al menos 20 caracteres'),
  body('gestor_base_url').optional().isURL({ protocols: ['https'] }).withMessage('URL base inválida'),
  body('auth_scheme').optional().isIn(['bearer', 'x-api-key']).withMessage('Esquema de auth inválido'),
  body('enabled').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    if (!ENCRYPTION_ENABLED) {
      return res.status(503).json({ error: 'Falta APP_ENCRYPTION_KEY_B64. Configuración de Gestor Max deshabilitada.' });
    }
    
    const clienteId = parseInt(req.params.id);
    const { gestor_database_id, gestor_api_key, auth_scheme, enabled } = req.body;
    let gestor_base_url = (req.body.gestor_base_url || 'https://api.gestormax.com').replace(/\/+$/, '');
    
    try {
      const parsedUrl = new URL(gestor_base_url);
      if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
        return res.status(400).json({ error: 'URL Base debe ser solo dominio (ej: https://api.gestormax.com), sin paths como /v3/...', code: 'INVALID_BASE_URL' });
      }
      gestor_base_url = `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch (urlErr) {
      return res.status(400).json({ error: 'URL Base inválida. Use formato https://dominio.com', code: 'INVALID_BASE_URL' });
    }
    
    // Verificar que el cliente existe
    const clienteCheck = await pool.query('SELECT id FROM clientes WHERE id = $1 AND activo = true', [clienteId]);
    if (clienteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    
    // Encriptar API key
    const encryptedKey = encryptCredential(gestor_api_key);
    const last4 = gestor_api_key.slice(-4);
    
    // UPSERT
    await pool.query(`
      INSERT INTO empresa_gestor_config 
        (cliente_id, gestor_database_id, gestor_api_key_enc, gestor_api_key_last4, gestor_base_url, auth_scheme, enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (cliente_id) DO UPDATE SET
        gestor_database_id = EXCLUDED.gestor_database_id,
        gestor_api_key_enc = EXCLUDED.gestor_api_key_enc,
        gestor_api_key_last4 = EXCLUDED.gestor_api_key_last4,
        gestor_base_url = EXCLUDED.gestor_base_url,
        auth_scheme = EXCLUDED.auth_scheme,
        enabled = EXCLUDED.enabled,
        updated_at = now()
    `, [
      clienteId,
      gestor_database_id,
      encryptedKey,
      last4,
      gestor_base_url || 'https://api.gestormax.com',
      auth_scheme || 'bearer',
      enabled !== false
    ]);
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando config Gestor Max:', err);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// POST: Probar conexión con Gestor Max (Solo Admin)
app.post('/api/admin/clientes/:id/gestor-test', isAuthenticated, isAdminOnly, apiWriteLimiter, async (req, res) => {
  try {
    if (!ENCRYPTION_ENABLED) {
      return res.status(503).json({ error: 'Falta APP_ENCRYPTION_KEY_B64. Configuración de Gestor Max deshabilitada.' });
    }
    
    const clienteId = parseInt(req.params.id);
    
    const configResult = await pool.query(
      'SELECT gestor_database_id, gestor_api_key_enc, gestor_base_url, auth_scheme FROM empresa_gestor_config WHERE cliente_id = $1 AND enabled = true',
      [clienteId]
    );
    
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hay configuración de Gestor Max para esta empresa' });
    }
    
    const config = configResult.rows[0];
    let apiKey;
    try {
      apiKey = decryptCredential(config.gestor_api_key_enc);
    } catch (decryptErr) {
      await pool.query(
        'UPDATE empresa_gestor_config SET last_test_at = now(), last_test_ok = false, last_test_error = $1 WHERE cliente_id = $2',
        ['Error desencriptando credenciales', clienteId]
      );
      return res.status(500).json({ ok: false, status: 0, message: 'Error desencriptando credenciales' });
    }
    
    let testOk = false;
    let testError = null;
    let total = 0;
    let haciendaTotal = 0;
    let sample = [];
    
    try {
      const conceptos = await listConceptosGestor(config.gestor_database_id, apiKey, {
        baseUrl: config.gestor_base_url,
        authScheme: config.auth_scheme,
        soloFisicos: true
      });
      total = Array.isArray(conceptos) ? conceptos.length : 0;
      
      const haciendaConceptos = (conceptos || []).filter(item => 
        (item.grupoConceptos || '').toUpperCase() === 'HACIENDA' && item.tipo === 'Concepto'
      );
      haciendaTotal = haciendaConceptos.length;
      sample = haciendaConceptos.slice(0, 3).map(c => ({ codConcepto: c.codConcepto, descripcion: c.descripcion }));
      testOk = true;
    } catch (fetchErr) {
      testError = fetchErr.message.substring(0, 300);
    }
    
    await pool.query(
      'UPDATE empresa_gestor_config SET last_test_at = now(), last_test_ok = $1, last_test_error = $2 WHERE cliente_id = $3',
      [testOk, testError, clienteId]
    );
    
    if (testOk) {
      res.json({ ok: true, total, hacienda_total: haciendaTotal, sample });
    } else {
      res.json({ ok: false, message: testError });
    }
  } catch (err) {
    console.error('Error probando conexión Gestor Max:', err);
    res.status(500).json({ error: 'Error al probar conexión' });
  }
});

// POST: Sincronizar conceptos HACIENDA desde Gestor Max (Solo Admin)
app.post('/api/admin/clientes/:id/gestor/sync-conceptos', isAuthenticated, isAdminOnly, apiWriteLimiter, async (req, res) => {
  try {
    if (!ENCRYPTION_ENABLED) {
      return res.status(503).json({ error: 'Falta APP_ENCRYPTION_KEY_B64. Configuración de Gestor Max deshabilitada.' });
    }
    
    const clienteId = parseInt(req.params.id);
    
    const configResult = await pool.query(
      'SELECT gestor_database_id, gestor_api_key_enc, gestor_base_url, auth_scheme FROM empresa_gestor_config WHERE cliente_id = $1 AND enabled = true',
      [clienteId]
    );
    
    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: 'No hay configuración de Gestor Max para esta empresa' });
    }
    
    const config = configResult.rows[0];
    let apiKey;
    try {
      apiKey = decryptCredential(config.gestor_api_key_enc);
    } catch (decryptErr) {
      return res.status(500).json({ ok: false, message: 'Error desencriptando credenciales' });
    }
    
    let conceptos;
    try {
      conceptos = await listConceptosGestor(config.gestor_database_id, apiKey, {
        baseUrl: config.gestor_base_url,
        authScheme: config.auth_scheme,
        soloFisicos: true
      });
    } catch (fetchErr) {
      return res.status(502).json({ ok: false, message: fetchErr.message });
    }
    
    const haciendaConceptos = (conceptos || []).filter(item => 
      (item.grupoConceptos || '').toUpperCase() === 'HACIENDA' && 
      item.tipo === 'Concepto' && 
      item.habilitado === true
    );
    
    const client = await pool.connect();
    let synced = 0;
    try {
      await client.query('BEGIN');
      
      await client.query(
        `UPDATE categorias SET activo = false WHERE tenant_id = $1 AND tipo = 'GESTOR'`,
        [clienteId]
      );
      
      for (const item of haciendaConceptos) {
        await client.query(`
          INSERT INTO categorias 
            (tenant_id, tipo, nombre, external_id, activo, source, last_synced_at, actividad_id, es_estandar)
          VALUES ($1, 'GESTOR', $2, $3, true, 'gestor_sync', NOW(), NULL, false)
          ON CONFLICT (tenant_id, external_id) WHERE tipo = 'GESTOR' DO UPDATE SET
            nombre = EXCLUDED.nombre,
            activo = true,
            source = 'gestor_sync',
            last_synced_at = NOW()
        `, [
          clienteId,
          item.descripcion || `Concepto ${item.codConcepto}`,
          String(item.codConcepto)
        ]);
        synced++;
      }
      
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
    
    res.json({ ok: true, synced });
  } catch (err) {
    console.error('Error sincronizando conceptos Gestor Max:', err);
    res.status(500).json({ error: 'Error al sincronizar conceptos' });
  }
});

app.get('/api/admin/auditor-clientes', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ac.id, ac.auditor_id, ac.tenant_id as cliente_id,
             ua.nombre as auditor_nombre, ua.email as auditor_email,
             c.nombre as cliente_nombre
      FROM auditor_clientes ac
      JOIN usuarios ua ON ac.auditor_id = ua.id
      JOIN clientes c ON ac.tenant_id = c.id
      ORDER BY ua.nombre, c.nombre
    `);

    const auditores = await pool.query(`
      SELECT u.id, u.nombre, u.email FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE r.nombre = 'auditor' AND u.activo = true
      ORDER BY u.nombre
    `);

    const clientes = await pool.query(`
      SELECT id, nombre FROM clientes WHERE activo = true ORDER BY nombre
    `);

    res.json({
      asignaciones: result.rows,
      auditores: auditores.rows,
      clientes: clientes.rows
    });
  } catch (err) {
    console.error('Error loading auditor-clientes:', err);
    res.status(500).json({ error: 'Error al cargar asignaciones de auditores' });
  }
});

app.post('/api/admin/auditor-clientes', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('auditor_id').isInt({ min: 1 }).withMessage('Auditor invalido'),
  body('tenant_id').isInt({ min: 1 }).withMessage('Cliente invalido')
], handleValidationErrors, async (req, res) => {
  try {
    const { auditor_id, tenant_id } = req.body;
    if (!auditor_id || !tenant_id) {
      return res.status(400).json({ error: 'Auditor y cliente son obligatorios' });
    }

    const existing = await pool.query(
      'SELECT id FROM auditor_clientes WHERE auditor_id = $1 AND tenant_id = $2',
      [auditor_id, tenant_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Esta asignacion ya existe' });
    }

    const result = await pool.query(
      'INSERT INTO auditor_clientes (auditor_id, tenant_id) VALUES ($1, $2) RETURNING id',
      [auditor_id, tenant_id]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating auditor-cliente:', err);
    res.status(500).json({ error: 'Error al crear asignacion' });
  }
});

app.delete('/api/admin/auditor-clientes/:id', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM auditor_clientes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar asignacion' });
  }
});

app.delete('/api/admin/replit-users/:id', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  param('id').notEmpty().withMessage('ID inválido')
], handleValidationErrors, async (req, res) => {
  const replitId = req.params.id;
  
  try {
    const linkedCheck = await pool.query('SELECT id FROM usuarios WHERE replit_user_id = $1', [replitId]);
    if (linkedCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Este usuario está vinculado al sistema. Elimínelo desde la gestión de usuarios vinculados.' });
    }
    
    const result = await pool.query('DELETE FROM replit_users WHERE id = $1 RETURNING id', [replitId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario de Replit no encontrado' });
    }
    
    res.json({ success: true, message: 'Usuario de Replit eliminado correctamente' });
  } catch (err) {
    console.error('Error eliminando usuario de Replit:', err);
    res.status(500).json({ error: 'Error al eliminar usuario de Replit' });
  }
});

app.get('/api/admin/replit-users', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ru.id as replit_id, ru.email, ru.first_name, ru.last_name,
             u.id as usuario_id, u.nombre, u.tenant_id, u.activo, r.nombre as rol, r.id as rol_id,
             c.nombre as tenant_nombre, 'replit' as origen
      FROM replit_users ru
      LEFT JOIN usuarios u ON u.replit_user_id = ru.id
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN clientes c ON u.tenant_id = c.id
      
      UNION ALL
      
      SELECT NULL as replit_id, u.email, 
             SPLIT_PART(u.nombre, ' ', 1) as first_name,
             CASE WHEN POSITION(' ' IN u.nombre) > 0 THEN SUBSTRING(u.nombre FROM POSITION(' ' IN u.nombre) + 1) ELSE '' END as last_name,
             u.id as usuario_id, u.nombre, u.tenant_id, u.activo, r.nombre as rol, r.id as rol_id,
             c.nombre as tenant_nombre, 'invitado' as origen
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN clientes c ON u.tenant_id = c.id
      WHERE u.replit_user_id IS NULL
      
      ORDER BY email
    `);
    const roles = await pool.query('SELECT id, nombre FROM roles ORDER BY id');
    const clientes = await pool.query('SELECT id, nombre FROM clientes WHERE activo = true ORDER BY nombre');
    res.json({ usuarios: result.rows, roles: roles.rows, clientes: clientes.rows });
  } catch (err) {
    console.error('Error loading replit-users:', err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

app.post('/api/admin/vincular-usuario', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('replit_user_id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('ID de Replit invalido'),
  body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre invalido'),
  body('rol_id').isInt({ min: 1 }).withMessage('Rol invalido'),
  body('tenant_id').optional().isInt({ min: 1 }).withMessage('Tenant invalido')
], handleValidationErrors, async (req, res) => {
  try {
    const sanitizedBody = sanitizeObject(req.body);
    const { replit_user_id, nombre, rol_id, tenant_id } = sanitizedBody;
    if (!replit_user_id || !nombre || !rol_id) {
      return res.status(400).json({ error: 'Replit user, nombre y rol son obligatorios' });
    }

    const rolResult = await pool.query('SELECT nombre FROM roles WHERE id = $1', [rol_id]);
    const rolNombre = rolResult.rows[0]?.nombre;

    if (rolNombre === 'cliente' && !tenant_id) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente (tenant) para usuarios tipo cliente' });
    }

    const existing = await pool.query('SELECT id FROM usuarios WHERE replit_user_id = $1', [replit_user_id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Este usuario de Replit ya esta vinculado' });
    }
    const replitUser = await pool.query('SELECT email FROM replit_users WHERE id = $1', [replit_user_id]);
    const email = replitUser.rows[0]?.email || '';

    const finalTenantId = rolNombre === 'cliente' ? tenant_id : null;

    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id, replit_user_id, activo) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
      [nombre, email, 'replit_auth', rol_id, finalTenantId, replit_user_id]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error vinculando usuario:', err);
    res.status(500).json({ error: 'Error al vincular usuario' });
  }
});

app.put('/api/admin/usuarios/:id/rol', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const { rol_id, tenant_id } = req.body;
    if (!rol_id) {
      return res.status(400).json({ error: 'El rol es obligatorio' });
    }

    const rolResult = await pool.query('SELECT nombre FROM roles WHERE id = $1', [rol_id]);
    const rolNombre = rolResult.rows[0]?.nombre;

    const finalTenantId = rolNombre === 'cliente' ? (tenant_id || null) : null;

    await pool.query('UPDATE usuarios SET rol_id = $1, tenant_id = $2 WHERE id = $3', [rol_id, finalTenantId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando rol:', err);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

app.put('/api/admin/usuarios/:id/tenant', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const { tenant_id } = req.body;
    await pool.query('UPDATE usuarios SET tenant_id = $1 WHERE id = $2', [tenant_id || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error asignando tenant:', err);
    res.status(500).json({ error: 'Error al asignar tenant' });
  }
});


// ============================================================
// MANEJADOR DE RUTAS NO ENCONTRADAS (SPA fallback)
// ============================================================
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// MANEJADOR DE ERRORES GLOBAL (Seguro - no expone detalles)
// ============================================================
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack, '\nPath:', req.path);
  securityLog('SERVER_ERROR', { 
    message: err.message, 
    path: req.path,
    method: req.method
  }, req);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El contenido es demasiado grande' });
  }
  
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Sesion invalida, recargue la pagina' });
  }
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Error interno del servidor' : (err.message || 'Error desconocido')
  });
});

// ============================================================
// MANEJADOR DE ERRORES NO CAPTURADOS
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SECURITY] Servidor iniciado con protecciones activas`);
  console.log(`[INFO] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[INFO] Helmet: Habilitado`);
  console.log(`[INFO] Rate Limiting: Habilitado`);
  console.log(`[INFO] CORS: Configurado`);
  console.log(`[INFO] HPP: Habilitado`);
});