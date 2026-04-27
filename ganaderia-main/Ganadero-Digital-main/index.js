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
    .replace(/on\\w+=/gi, '')
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
          first_name = part.split('\\r\\n\\r\\n')[1]?.split('\\r\\n')[0];
        } else if (part.includes('name="last_name"')) {
          last_name = part.split('\\r\\n\\r\\n')[1]?.split('\\r\\n')[0];
        } else if (part.includes('name="phone"')) {
          phone = part.split('\\r\\n\\r\\n')[1]?.split('\\r\\n')[0];
        } else if (part.includes('name="remove_photo"')) {
          remove_photo = part.split('\\r\\n\\r\\n')[1]?.split('\\r\\n')[0] === 'true';
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
      pool.query('SELECT id, codigo, nombre, requiere_origen_destino, requiere_campo_destino, cuenta_debe_id, cuenta_haber_id FROM tipos_evento ORDER BY nombre'),
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
// GESTION DE EVENTOS - ESCRITURA Y PREVIEW
// ============================================================

// POST: Previsualizar asiento antes de guardar
app.post('/api/eventos/preview', isAuthenticated, requireActiveTenant, async (req, res) => {
  try {
    const asientos = await generateAsientos(req.body, pool);

    const enriched = await Promise.all(asientos.map(async a => {
      const c = await pool.query(
        'SELECT codigo, nombre FROM cuentas WHERE id = $1',
        [a.cuenta_id]
      );
      return {
        ...a,
        cuenta_codigo: c.rows[0]?.codigo,
        cuenta_nombre: c.rows[0]?.nombre
      };
    }));

    res.json({ asientos: enriched });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST: Registrar un nuevo evento y sus asientos contables
app.post('/api/eventos', isAuthenticated, requireActiveTenant, apiWriteLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const activeTenantId = req.activeTenantId;
    const {
      fecha, tipo_evento_id, campo_id, campo_destino_id,
      actividad_origen_id, actividad_destino_id,
      categoria_id, categoria_origen_id, categoria_destino_id,
      cabezas, kg_totales, kg_cabeza, observaciones
    } = req.body;

    // 1. Validar que el campo pertenece al tenant
    const campoCheck = await client.query('SELECT id FROM campos WHERE id = $1 AND tenant_id = $2', [campo_id, activeTenantId]);
    if (campoCheck.rows.length === 0) {
      throw new Error('El campo seleccionado no es válido o no pertenece a su empresa');
    }

    // 2. Resolver Categoria Gestor (Fase 2)
    const catIdForGestor = categoria_id || categoria_origen_id;
    let categoriaGestorId = null;
    if (catIdForGestor) {
      categoriaGestorId = await resolveCategoriaGestorId(activeTenantId, catIdForGestor, client);
    }

    // 3. Insertar Evento
    const eventoRes = await client.query(`
      INSERT INTO eventos (
        fecha, tipo_evento_id, campo_id, campo_destino_id,
        actividad_origen_id, actividad_destino_id,
        categoria_id, categoria_origen_id, categoria_destino_id,
        categoria_gestor_id, cabezas, kg_totales, kg_cabeza, observaciones,
        usuario_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      fecha, tipo_evento_id, campo_id, campo_destino_id,
      actividad_origen_id, actividad_destino_id,
      categoria_id, categoria_origen_id, categoria_destino_id,
      categoriaGestorId, cabezas, kg_totales, kg_cabeza, observaciones,
      req.user.usuario_id
    ]);

    const eventoId = eventoRes.rows[0].id;

    // 4. Generar Asientos
    const asientos = await generateAsientos(req.body, client);

    // 5. Insertar Asientos
    for (const a of asientos) {
      // Determinar campo_id para el asiento (en traslados varía por línea)
      const asientoCampoId = a.campo_id || campo_id;
      // Determinar actividad_id para el asiento
      const asientoActividadId = a.actividad_id || actividad_origen_id;
      
      // Resolver categoría gestor para esta línea específica si la categoría cambió (ej: Cambio Categoría)
      let asientoCatGestorId = categoriaGestorId;
      if (a.categoria_id && a.categoria_id !== catIdForGestor) {
         asientoCatGestorId = await resolveCategoriaGestorId(activeTenantId, a.categoria_id, client);
      }

      await client.query(`
        INSERT INTO asientos (
          evento_id, fecha, cuenta_id, tipo, cabezas, kg, kg_cabeza,
          campo_id, actividad_id, categoria_id, categoria_gestor_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        eventoId, fecha, a.cuenta_id, a.tipo, a.cabezas, a.kg, a.kg_cabeza,
        asientoCampoId, asientoActividadId, a.categoria_id || categoria_id, asientoCatGestorId
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, id: eventoId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando evento:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE: Eliminar un evento y sus asientos (Cascada manual por seguridad)
app.delete('/api/eventos/:id', isAuthenticated, requireActiveTenant, apiWriteLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const activeTenantId = req.activeTenantId;

    // Verificar que el evento pertenece a un campo del tenant
    const check = await client.query(`
      SELECT e.id FROM eventos e
      JOIN campos c ON e.campo_id = c.id
      WHERE e.id = $1 AND c.tenant_id = $2
    `, [id, activeTenantId]);

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // 1. Eliminar asientos asociados
    await client.query('DELETE FROM asientos WHERE evento_id = $1', [id]);
    // 2. Eliminar el evento
    await client.query('DELETE FROM eventos WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error eliminando evento:', err);
    res.status(500).json({ error: 'Error al eliminar el evento' });
  } finally {
    client.release();
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
  const tipoRes = await client.query(`
    SELECT
      te.codigo,
      te.requiere_origen_destino,
      te.requiere_campo_destino,
      c_d.id   AS cuenta_debe_id,
      c_h.id   AS cuenta_haber_id
    FROM tipos_evento te
    LEFT JOIN cuentas c_d ON te.cuenta_debe_id = c_d.id
    LEFT JOIN cuentas c_h ON te.cuenta_haber_id = c_h.id
    WHERE te.id = $1
  `, [evento.tipo_evento_id]);

  if (!tipoRes.rows[0]) {
    throw new Error(`Tipo de evento no encontrado (id=${evento.tipo_evento_id})`);
  }

  const tipo = tipoRes.rows[0];
  const tipoCodigo = tipo.codigo;

  const asientos = [];
  const cabezas = evento.cabezas;
  const kg = evento.kg_totales;
  const kg_cabeza = evento.kg_cabeza;
  const categoriaId = evento.categoria_id || evento.categoria_origen_id;

  // RECUENTO es informativo — no genera asientos contables
  if (tipoCodigo === 'RECUENTO') {
    return asientos;
  }

  if (!tipo.cuenta_debe_id || !tipo.cuenta_haber_id) {
    throw new Error(
      `El tipo de evento "${tipoCodigo}" no tiene cuentas contables configuradas. ` +
      `Configure cuenta DEBE y HABER en Administración > Tipos de Evento.`
    );
  }

  const cuentaDebeId = tipo.cuenta_debe_id;
  const cuentaHaberId = tipo.cuenta_haber_id;

  if (tipoCodigo === 'CAMBIO_ACTIVIDAD') {
    asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'DEBE',  cabezas, kg, kg_cabeza, actividad_id: evento.actividad_destino_id, categoria_id: evento.categoria_destino_id });
    asientos.push({ cuenta_id: cuentaHaberId, tipo: 'HABER', cabezas, kg, kg_cabeza, actividad_id: evento.actividad_origen_id,  categoria_id: evento.categoria_origen_id });
  } else if (tipoCodigo === 'CAMBIO_CATEGORIA') {
    asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'DEBE',  cabezas, kg, kg_cabeza, categoria_id: evento.categoria_destino_id });
    asientos.push({ cuenta_id: cuentaHaberId, tipo: 'HABER', cabezas, kg, kg_cabeza, categoria_id: evento.categoria_origen_id });
  } else if (tipoCodigo === 'TRANSFERENCIA' || tipoCodigo === 'TRASLADO') {
    asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'DEBE',  cabezas, kg, kg_cabeza, campo_id: evento.campo_destino_id, categoria_id: categoriaId });
    asientos.push({ cuenta_id: cuentaHaberId, tipo: 'HABER', cabezas, kg, kg_cabeza, campo_id: evento.campo_id,         categoria_id: categoriaId });
  } else if (tipoCodigo === 'AJUSTE_KG') {
    const kgAbs = Math.abs(kg);
    if (kg >= 0) {
      asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'DEBE',  cabezas: 0, kg: kgAbs, kg_cabeza, categoria_id: categoriaId });
      asientos.push({ cuenta_id: cuentaHaberId, tipo: 'HABER', cabezas: 0, kg: kgAbs, kg_cabeza, categoria_id: categoriaId });
    } else {
      asientos.push({ cuenta_id: cuentaHaberId, tipo: 'DEBE',  cabezas: 0, kg: kgAbs, kg_cabeza, categoria_id: categoriaId });
      asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'HABER', cabezas: 0, kg: kgAbs, kg_cabeza, categoria_id: categoriaId });
    }
  } else {
    // Tipos estándar: APERTURA, COMPRA, VENTA, NACIMIENTO, MORTANDAD y cualquier tipo personalizado
    asientos.push({ cuenta_id: cuentaDebeId,  tipo: 'DEBE',  cabezas, kg, kg_cabeza, categoria_id: categoriaId });
    asientos.push({ cuenta_id: cuentaHaberId, tipo: 'HABER', cabezas, kg, kg_cabeza, categoria_id: categoriaId });
  }

  // Validar DEBE = HABER antes de devolver
  const totalDebeKg  = asientos.filter(a => a.tipo === 'DEBE').reduce((s, a) => s + Number(a.kg  || 0), 0);
  const totalHaberKg = asientos.filter(a => a.tipo === 'HABER').reduce((s, a) => s + Number(a.kg || 0), 0);

  if (Math.abs(totalDebeKg - totalHaberKg) > 0.01) { // Pequeña tolerancia por flotantes
    throw new Error('Desbalance contable: DEBE y HABER no coinciden. Contacte soporte.');
  }

  return asientos;
}

// ============================================================
// ASOCIACION DE ACTIVIDADES A CAMPOS (PARA UI DE FILTROS)
// ============================================================
app.get('/api/admin/campos/:id/actividades', isAuthenticated, requireActiveTenant, [
  param('id').isInt({ min: 1 }).withMessage('ID de campo inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const campo_id = validateInteger(req.params.id, 'campo_id');

    const campoCheck = await pool.query('SELECT id FROM campos WHERE id = $1 AND tenant_id = $2', [campo_id, activeTenantId]);
    if (campoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campo no encontrado o no pertenece a su empresa' });
    }

    const actividadesDisponibles = await pool.query(
      'SELECT id, nombre FROM actividades WHERE tenant_id IS NULL OR tenant_id = $1 ORDER BY nombre',
      [activeTenantId]
    );

    const asignadas = await pool.query(
      'SELECT actividad_id FROM campo_actividades WHERE campo_id = $1',
      [campo_id]
    );

    res.json({
      actividades: actividadesDisponibles.rows,
      asignadas: asignadas.rows.map(row => row.actividad_id)
    });
  } catch (err) {
    console.error('Error fetching campo actividades:', err);
    res.status(500).json({ error: 'Error al cargar actividades del campo' });
  }
});

// POST: Asociar/desasociar actividades a un campo
app.post('/api/admin/campos/:id/actividades', isAuthenticated, isAdminOrAuditor, requireTenantForAuditor, apiWriteLimiter, [
  param('id').isInt({ min: 1 }).withMessage('ID de campo inválido'),
  body('actividad_id').isInt({ min: 1 }).withMessage('ID de actividad inválido'),
  body('action').isIn(['assign', 'unassign']).withMessage('Acción inválida')
], handleValidationErrors, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id: campo_id } = req.params;
    const { actividad_id, action } = req.body;
    const activeTenantId = req.activeTenantId;

    const campoCheck = await client.query('SELECT tenant_id FROM campos WHERE id = $1', [campo_id]);
    if (campoCheck.rows.length === 0 || campoCheck.rows[0].tenant_id !== activeTenantId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Campo no encontrado o no pertenece a su empresa' });
    }

    if (action === 'assign') {
      await client.query(
        'INSERT INTO campo_actividades (campo_id, actividad_id) VALUES ($1, $2) ON CONFLICT (campo_id, actividad_id) DO NOTHING',
        [campo_id, actividad_id]
      );
    } else { // unassign
      await client.query(
        'DELETE FROM campo_actividades WHERE campo_id = $1 AND actividad_id = $2',
        [campo_id, actividad_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error actualizando asociaciones de campo/actividad:', err);
    res.status(500).json({ error: 'Error al actualizar asociaciones' });
  } finally {
    client.release();
  }
});

// ============================================================\
// BALANCE
// ============================================================\
app.get('/api/balance', isAuthenticated, requireActiveTenant, apiReadLimiter, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const { categoria_id, campo_id, desde, hasta, categoria_view } = req.query;
    const vistaGestor = categoria_view === 'gestor';

    // Construir la consulta base para el balance
    let query = `
      WITH asientos_filtrados AS (
        SELECT
          a.fecha,
          a.tipo,
          a.cabezas,
          a.kg,
          c.plan_cuenta_id,
          c.id AS cuenta_id,
          c.nombre AS cuenta_nombre,
          c.codigo AS cuenta_codigo,
          pc.nombre AS plan_nombre,
          pc.codigo AS plan_codigo,
          ca.id AS campo_id,
          ca.nombre AS campo_nombre,
          a.actividad_id,
          act.nombre AS actividad_nombre,
          ${vistaGestor 
            ? 'COALESCE(cm.categoria_gestor_id, cat_c.id) AS categoria_consolidada_id, COALESCE(cat_g.nombre, \'SIN_ASIGNAR\') AS categoria_consolidada_nombre'
            : 'cat_c.id AS categoria_consolidada_id, cat_c.nombre AS categoria_consolidada_nombre'
          },
          cat_c.id AS categoria_cliente_id,
          cat_c.nombre AS categoria_cliente_nombre,
          COALESCE(cat_g.nombre, 'SIN_ASIGNAR') AS categoria_gestor_nombre
        FROM asientos a
        JOIN cuentas c ON a.cuenta_id = c.id
        JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
        LEFT JOIN campos ca ON a.campo_id = ca.id
        LEFT JOIN actividades act ON a.actividad_id = act.id
        LEFT JOIN categorias cat_c ON a.categoria_id = cat_c.id
        LEFT JOIN categorias_mapeo cm ON cm.tenant_id = $1 AND cm.categoria_cliente_id = a.categoria_id AND cm.activo = true
        LEFT JOIN categorias cat_g ON cat_g.id = cm.categoria_gestor_id
        WHERE ca.tenant_id = $1
    `;

    const params = [activeTenantId];
    
    if (desde && desde !== 'Todos' && desde !== '') {
      params.push(desde + ' 00:00:00');
      query += ` AND a.fecha >= $${params.length}::timestamp`;
    }
    if (hasta && hasta !== 'Todos' && hasta !== '') {
      params.push(hasta + ' 23:59:59');
      query += ` AND a.fecha <= $${params.length}::timestamp`;
    }
    if (campo_id && campo_id !== 'Todos' && campo_id !== '') {
      params.push(campo_id);
      query += ` AND a.campo_id = $${params.length}`;
    }
    if (categoria_id && categoria_id !== 'Todos' && categoria_id !== '') {
      params.push(parseInt(categoria_id));
      if (vistaGestor) {
        query += ` AND COALESCE(cm.categoria_gestor_id, cat_c.id) = $${params.length}`;
      } else {
        query += ` AND a.categoria_id = $${params.length}`;
      }
    }

    query += `
      )
      SELECT
        plan_cuenta_id,
        plan_nombre,
        plan_codigo,
        campo_id,
        campo_nombre,
        actividad_id,
        actividad_nombre,
        categoria_consolidada_id AS categoria_id,
        categoria_consolidada_nombre AS categoria_nombre,
        cuenta_id,
        cuenta_nombre,
        cuenta_codigo,
        SUM(CASE WHEN tipo = 'DEBE' THEN cabezas ELSE 0 END) AS total_debe_cabezas,
        SUM(CASE WHEN tipo = 'HABER' THEN cabezas ELSE 0 END) AS total_haber_cabezas,
        SUM(CASE WHEN tipo = 'DEBE' THEN kg ELSE 0 END) AS total_debe_kg,
        SUM(CASE WHEN tipo = 'HABER' THEN kg ELSE 0 END) AS total_haber_kg
      FROM asientos_filtrados
      GROUP BY
        plan_cuenta_id, plan_nombre, plan_codigo,
        campo_id, campo_nombre,
        actividad_id, actividad_nombre,
        categoria_consolidada_id, categoria_consolidada_nombre,
        cuenta_id, cuenta_nombre, cuenta_codigo
      ORDER BY
        plan_codigo, cuenta_codigo, campo_nombre, actividad_nombre, categoria_nombre
    `;
    
    const result = await pool.query(query, params);
    
    res.json({ balance: result.rows });

  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Error al cargar balance' });
  }
});


// ============================================================\
// MAYOR
// ============================================================\
app.get('/api/ledger', isAuthenticated, requireActiveTenant, apiReadLimiter, [
  query('mes').optional().custom((value) => {
    if (value === 'Todos' || value === '' || value === undefined) return true;
    return /^\\d{4}-(0[1-9]|1[0-2])$/.test(String(value));
  }).withMessage('Mes inválido. Use formato YYYY-MM o "Todos".')
], handleValidationErrors, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const { mes, campo_id, categoria_id, desde, hasta, cuenta_id, categoria_view } = req.query;
    const vistaGestor = categoria_view === 'gestor';
    
    // Query base con ambas categorías (cliente y gestor)
    let query = `
      SELECT a.id, a.fecha, a.tipo, a.cabezas, a.kg, a.kg_cabeza,
             c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
             pc.codigo as plan_codigo, pc.nombre as plan_nombre,
             ca.nombre as campo_nombre,
             cat_c.nombre as categoria_cliente_nombre,
             act.nombre as actividad_nombre,
             te.nombre as tipo_evento_nombre,
             e.fecha AS evento_fecha,
             e.id AS evento_id,
             ${vistaGestor 
               ? 'cm.categoria_gestor_id as categoria_id, COALESCE(cat_g.nombre, \'SIN_ASIGNAR\') as categoria_nombre'
               : 'cat_c.id as categoria_id, cat_c.nombre as categoria_nombre'},
             e.id as event_id
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
    if (cuenta_id && cuenta_id !== '') {
      params.push(parseInt(cuenta_id));
      query += ` AND a.cuenta_id = $${params.length}`;
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

// ============================================================\
// GESTOR MAX - CONFIGURACIÓN DE CONEXIÓN POR EMPRESA
// ============================================================

// GET: Listado de clientes con estado de Gestor Max (Solo Admin)
app.get('/api/admin/clientes', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             egc.gestor_database_id, 
             egc.last_test_at, 
             egc.last_test_ok, 
             egc.last_test_error,
             egc.enabled as gestor_enabled,
             egc.gestor_base_url,
             egc.auth_scheme,
             (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = c.id) as usuarios_count,
             (SELECT COUNT(*) FROM campos ca WHERE ca.tenant_id = c.id) as campos_count,
             CASE WHEN egc.gestor_api_key_enc IS NOT NULL THEN TRUE ELSE FALSE END as gestor_configured
      FROM clientes c
      LEFT JOIN empresa_gestor_config egc ON c.id = egc.cliente_id
      ORDER BY c.nombre
    `);
    res.json({ clientes: result.rows });
  } catch (err) {
    console.error('Error loading clientes:', err);
    res.status(500).json({ error: 'Error al cargar empresas' });
  }
});

// GET: Obtener estado de Gestor Max para el tenant activo
app.get('/api/admin/gestor/status', isAuthenticated, requireActiveTenant, isAdminOrAuditor, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const result = await pool.query(
      'SELECT last_test_at, last_test_ok, last_test_error FROM empresa_gestor_config WHERE cliente_id = $1 AND enabled = true',
      [activeTenantId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }
    
    const config = result.rows[0];
    res.json({
      configured: true,
      last_test_at: config.last_test_at,
      last_test_ok: config.last_test_ok,
      last_test_error: config.last_test_error
    });
  } catch (err) {
    console.error('Error fetching Gestor Max status:', err);
    res.status(500).json({ error: 'Error al obtener estado de integración' });
  }
});

// POST: Probar conexión Gestor Max para el tenant activo
app.post('/api/admin/gestor/test-connection', isAuthenticated, requireActiveTenant, isAdminOrAuditor, apiWriteLimiter, async (req, res) => {
  try {
    const activeTenantId = req.activeTenantId;
    const result = await runGestorTest(activeTenantId);
    res.json(result);
  } catch (err) {
    console.error('Error testing Gestor Max connection:', err);
    res.status(500).json({ error: 'Error al probar conexión' });
  }
});

// Helper function to run the Gestor Max connectivity test
async function runGestorTest(clienteId) {
  const configResult = await pool.query(
    'SELECT gestor_database_id, gestor_api_key_enc, gestor_base_url, auth_scheme FROM empresa_gestor_config WHERE cliente_id = $1 AND enabled = true',
    [clienteId]
  );
  
  if (configResult.rows.length === 0) {
    return { ok: false, message: 'No hay configuración de Gestor Max para esta empresa' };
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
    return { ok: false, message: 'Error desencriptando credenciales' };
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
  
  return { ok: testOk, total, hacienda_total: haciendaTotal, sample, message: testError };
}

// PUT: Guardar/actualizar conexión Gestor Max (Solo Admin)
app.put('/api/admin/clientes/:id/gestor-config', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('gestor_database_id').isInt({ min: 1 }).withMessage('Database ID inválido'),
  body('gestor_api_key').optional().isString().isLength({ min: 20 }).withMessage('API Key debe tener al menos 20 caracteres'),
  body('gestor_base_url').optional().isURL({ protocols: ['https'] }).withMessage('URL base inválida'),
  body('auth_scheme').optional().isIn(['bearer', 'x-api-key']).withMessage('Esquema de auth inválido'),
  body('enabled').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    if (!ENCRYPTION_ENABLED) {
      return res.status(503).json({ error: 'Falta APP_ENCRYPTION_KEY_B64. Configuración de Gestor Max deshabilitada.' });
    }
    
    const clienteId = parseInt(req.params.id);
    const { gestor_database_id, gestor_api_key, gestor_base_url, auth_scheme, enabled } = req.body;
    
    let apiKeyEnc = null;
    if (gestor_api_key && gestor_api_key.trim() !== '') {
      apiKeyEnc = encryptCredential(gestor_api_key);
    }
    
    // Upsert configuration
    const query = `
      INSERT INTO empresa_gestor_config 
        (cliente_id, gestor_database_id, gestor_api_key_enc, gestor_base_url, auth_scheme, enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (cliente_id) DO UPDATE SET
        gestor_database_id = EXCLUDED.gestor_database_id,
        gestor_api_key_enc = COALESCE($3, empresa_gestor_config.gestor_api_key_enc),
        gestor_base_url = EXCLUDED.gestor_base_url,
        auth_scheme = EXCLUDED.auth_scheme,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `;
    
    await pool.query(query, [
      clienteId, 
      gestor_database_id, 
      apiKeyEnc, 
      gestor_base_url || 'https://api.gestormax.com',
      auth_scheme || 'bearer',
      enabled !== false
    ]);
    
    res.json({ success: true, message: 'Configuración guardada correctamente' });
  } catch (err) {
    console.error('Error guardando configuración Gestor Max:', err);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// POST: Probar conexión Gestor Max para una empresa específica (Solo Admin)
app.post('/api/admin/clientes/:id/gestor-test', isAuthenticated, isAdminOnly, apiWriteLimiter, async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const result = await runGestorTest(clienteId);
    res.json(result);
  } catch (err) {
    console.error('Error probando conexión Gestor Max (admin):', err);
    res.status(500).json({ error: 'Error al probar conexión' });
  }
});

// TEMPORARY: Endpoint to run database migration
app.post('/api/admin/run-migration-002', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    await pool.query('ALTER TABLE empresa_gestor_config ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMP, ADD COLUMN IF NOT EXISTS last_test_ok BOOLEAN, ADD COLUMN IF NOT EXISTS last_test_error TEXT;');
    res.json({ success: true, message: 'Migration 002 applied successfully.' });
  } catch (err) {
    console.error('Error applying migration 002:', err);
    res.status(500).json({ success: false, error: 'Error applying migration 002: ' + err.message });
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
// ADMIN - TIPOS DE EVENTO (Módulo 1)
// ============================================================

// GET: Listar tipos de evento con sus cuentas configuradas
app.get('/api/admin/tipos-evento', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT te.*, 
             c_d.nombre as cuenta_debe_nombre, c_d.codigo as cuenta_debe_codigo,
             c_h.nombre as cuenta_haber_nombre, c_h.codigo as cuenta_haber_codigo
      FROM tipos_evento te
      LEFT JOIN cuentas c_d ON te.cuenta_debe_id = c_d.id
      LEFT JOIN cuentas c_h ON te.cuenta_haber_id = c_h.id
      ORDER BY te.nombre
    `);
    res.json({ tipos_evento: result.rows });
  } catch (err) {
    console.error('Error loading admin tipos-evento:', err);
    res.status(500).json({ error: 'Error al cargar tipos de evento' });
  }
});

// POST: Crear nuevo tipo de evento
app.post('/api/admin/tipos-evento', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('codigo').isString().trim().notEmpty().withMessage('Código requerido'),
  body('nombre').isString().trim().notEmpty().withMessage('Nombre requerido'),
  body('requiere_origen_destino').optional().isBoolean(),
  body('requiere_campo_destino').optional().isBoolean(),
  body('cuenta_debe_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('cuenta_haber_id').optional({ nullable: true }).isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
  try {
    const { codigo, nombre, requiere_origen_destino, requiere_campo_destino, cuenta_debe_id, cuenta_haber_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO tipos_evento 
        (codigo, nombre, requiere_origen_destino, requiere_campo_destino, cuenta_debe_id, cuenta_haber_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [codigo.toUpperCase(), nombre, requiere_origen_destino || false, requiere_campo_destino || false, cuenta_debe_id || null, cuenta_haber_id || null]
    );
    
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating tipo-evento:', err);
    res.status(500).json({ error: 'Error al crear tipo de evento' });
  }
});

// PUT: Actualizar tipo de evento
app.put('/api/admin/tipos-evento/:id', isAuthenticated, isAdminOnly, apiWriteLimiter, [
  body('nombre').optional().isString().trim().notEmpty(),
  body('requiere_origen_destino').optional().isBoolean(),
  body('requiere_campo_destino').optional().isBoolean(),
  body('cuenta_debe_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('cuenta_haber_id').optional({ nullable: true }).isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
  try {
    const { nombre, requiere_origen_destino, requiere_campo_destino, cuenta_debe_id, cuenta_haber_id } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${paramCount++}`); values.push(nombre); }
    if (requiere_origen_destino !== undefined) { updates.push(`requiere_origen_destino = $${paramCount++}`); values.push(requiere_origen_destino); }
    if (requiere_campo_destino !== undefined) { updates.push(`requiere_campo_destino = $${paramCount++}`); values.push(requiere_campo_destino); }
    if (cuenta_debe_id !== undefined) { updates.push(`cuenta_debe_id = $${paramCount++}`); values.push(cuenta_debe_id); }
    if (cuenta_haber_id !== undefined) { updates.push(`cuenta_haber_id = $${paramCount++}`); values.push(cuenta_haber_id); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(req.params.id);
    await pool.query(
      `UPDATE tipos_evento SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating tipo-evento:', err);
    res.status(500).json({ error: 'Error al actualizar tipo de evento' });
  }
});

// DELETE: Eliminar tipo de evento
app.delete('/api/admin/tipos-evento/:id', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    // Verificar si tiene eventos asociados
    const check = await pool.query('SELECT id FROM eventos WHERE tipo_evento_id = $1 LIMIT 1', [req.params.id]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un tipo de evento que ya tiene eventos registrados' });
    }
    
    await pool.query('DELETE FROM tipos_evento WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting tipo-evento:', err);
    res.status(500).json({ error: 'Error al eliminar tipo de evento' });
  }
});

// ENDPOINT DE MIGRACIÓN: Asignar cuentas por defecto (Módulo 1)
app.post('/api/admin/migrate-tipos-evento-accounts', isAuthenticated, isAdminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Mapeo solicitado en MODULO2.MD
    const mappings = [
      { code: 'NACIMIENTO', debe: 'ACT001', haber: 'PN001' },
      { code: 'DESTETE', debe: 'ACT001', haber: 'PN001' },
      { code: 'APERTURA', debe: 'ACT001', haber: 'PN001' },
      { code: 'COMPRA', debe: 'ACT001', haber: 'RES002' },
      { code: 'VENTA', debe: 'RES001', haber: 'ACT001' },
      { code: 'MORTANDAD', debe: 'RES003', haber: 'ACT001' },
      { code: 'CONSUMO', debe: 'RES004', haber: 'ACT001' },
      { code: 'TRASLADO', debe: 'ACT001', haber: 'ACT001' },
      { code: 'CAMBIO_ACTIVIDAD', debe: 'ACT001', haber: 'ACT001' },
      { code: 'CAMBIO_CATEGORIA', debe: 'ACT001', haber: 'ACT001' },
      { code: 'AJUSTE_KG', debe: 'ACT001', haber: 'RES008' }
    ];

    for (const m of mappings) {
      await client.query(`
        UPDATE tipos_evento 
        SET 
          cuenta_debe_id = (SELECT id FROM cuentas WHERE codigo = $2),
          cuenta_haber_id = (SELECT id FROM cuentas WHERE codigo = $3)
        WHERE codigo = $1
      `, [m.code, m.debe, m.haber]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Migración de cuentas contables completada' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in migration:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
  console.error('[ERROR]', err.message, err.stack, '\\nPath:', req.path);
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