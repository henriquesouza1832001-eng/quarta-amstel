const routes = [];
const router = {
  get: (path, fn) => routes.push({ method: 'GET', path, fn }),
  post: (path, fn) => routes.push({ method: 'POST', path, fn }),
  put: (path, fn) => routes.push({ method: 'PUT', path, fn }),
  delete: (path, fn) => routes.push({ method: 'DELETE', path, fn }),
  options: (path, fn) => routes.push({ method: 'OPTIONS', path, fn }),
  all: (path, fn) => routes.push({ method: 'ALL', path, fn }),
  handle: async (request, env, ctx) => {
    const url = new URL(request.url);
    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
    }
    for (const route of routes) {
      const match = matchRoute(route.path, url.pathname);
      if (match && (route.method === method || route.method === 'ALL')) {
        request.params = match;
        return route.fn(request, env, ctx);
      }
    }
    return err('Rota não encontrada', 404);
  }
};

function matchRoute(pattern, pathname) {
  const patParts = pattern.split('/');
  const urlParts = pathname.split('/');
  if (patParts.length !== urlParts.length) return null;
  const params = {};
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = urlParts[i];
    } else if (patParts[i] !== '*' && patParts[i] !== urlParts[i] && pattern !== '*') {
      return null;
    }
  }
  return params;
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...SECURITY_HEADERS, ...CORS_HEADERS },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, erro: msg }, status);
}

async function checkRateLimit(db, ip, rota, limite, janelaMinutos = 1) {
  const agora = new Date();
  const janela = new Date(agora.getTime() - janelaMinutos * 60 * 1000).toISOString();

  try {
    await db.prepare(`DELETE FROM rate_limit WHERE ip = ? AND rota = ? AND janela_inicio < ?`)
      .bind(ip, rota, janela).run();

    await db.prepare(`
      INSERT INTO rate_limit (ip, rota, contador, janela_inicio)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(ip, rota) DO UPDATE SET contador = contador + 1
    `).bind(ip, rota).run();

    const row = await db.prepare(`SELECT contador FROM rate_limit WHERE ip = ? AND rota = ?`)
      .bind(ip, rota).first();

    return (row?.contador || 0) <= limite;
  } catch {
    return true;
  }
}

async function isBlocked(db, ip) {
  try {
    const row = await db.prepare(`
      SELECT id FROM blocked_ips 
      WHERE ip = ? AND (permanente = 1 OR expira_em > datetime('now'))
    `).bind(ip).first();
    return !!row;
  } catch {
    return false;
  }
}

async function logSecurity(db, env, { tipo, nivel, ip, pais, rota, metodo, payload, bloqueado }) {
  try {
    await db.prepare(`
      INSERT INTO security_log (tipo, nivel, ip, pais, rota, metodo, payload, bloqueado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(tipo, nivel, ip, pais || null, rota, metodo, payload || null, bloqueado ? 1 : 0).run();

    if (nivel >= 3) {
      await sendSecurityAlert(env, { tipo, nivel, ip, pais, rota, metodo, payload });
    }
  } catch (e) {
    console.error('[Security Log Error]', e);
  }
}

async function sendSecurityAlert(env, data) {
  try {
    if (!env.RESEND_API_KEY) return;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'seguranca@quartaamstel.com.br',
        to: env.ALERT_EMAIL || 'henriquesouza1832001@gmail.com',
        subject: `🚨 [CRÍTICO] Ameaça detectada — ${data.tipo}`,
        html: `
          <h2>🚨 Alerta de Segurança — Quarta é Dia de Amstel</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td><b>Tipo</b></td><td>${data.tipo}</td></tr>
            <tr><td><b>Nível</b></td><td>${data.nivel === 3 ? '🔴 CRÍTICO' : '🟡 AVISO'}</td></tr>
            <tr><td><b>IP</b></td><td>${data.ip}</td></tr>
            <tr><td><b>País</b></td><td>${data.pais || 'Desconhecido'}</td></tr>
            <tr><td><b>Rota</b></td><td>${data.rota}</td></tr>
            <tr><td><b>Método</b></td><td>${data.metodo}</td></tr>
            <tr><td><b>Horário</b></td><td>${new Date().toISOString()}</td></tr>
            ${data.payload ? `<tr><td><b>Payload</b></td><td><code>${data.payload}</code></td></tr>` : ''}
          </table>
          <p>Acesse o painel de segurança para mais detalhes.</p>
        `,
      }),
    });
  } catch (e) {
    console.error('[Alert Error]', e);
  }
}

function hasSQLInjection(str) {
  if (!str) return false;
  const patterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /(--|\/\*|\*\/|;|\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/i,
    /(\bEXEC\b|\bEXECUTE\b|\bxp_|\bsp_)/i,
    /('|\"|`)(.*?)(\1)/,
  ];
  return patterns.some(p => p.test(str));
}

async function securityMiddleware(request, env) {
  const url = new URL(request.url);
  if (hasSQLInjection(url.search)) return err('Requisição inválida', 400);
  return null;
}

async function signJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7200 })).replace(/=/g, '');
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(request, env, roles = ['master', 'admin', 'viewer']) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  if (!roles.includes(payload.role)) return null;
  return payload;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${saltHex}$${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split('$');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output = [];
  for (const char of str.replace(/=/g, '')) {
    value = (value << 5) | alphabet.indexOf(char.toUpperCase());
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(output);
}

async function generateTOTP(secret, window = 0) {
  const time = Math.floor(Date.now() / 30000) + window;
  const timeBytes = new Uint8Array(8);
  let t = time;
  for (let i = 7; i >= 0; i--) { timeBytes[i] = t & 0xff; t >>= 8; }
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, timeBytes));
  const offset = sig[19] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24 | sig[offset+1] << 16 | sig[offset+2] << 8 | sig[offset+3]) % 1000000;
  return code.toString().padStart(6, '0');
}

async function verifyTOTP(secret, token) {
  for (const w of [-1, 0, 1]) {
    if (await generateTOTP(secret, w) === token) return true;
  }
  return false;
}

function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => chars[b % 32]).join('');
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

router.get('/health', () => json({ ok: true, ts: new Date().toISOString() }));

router.get('/bares', async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const db = env.DB;

  const configRL = await db.prepare(`SELECT valor FROM config WHERE chave = 'rate_limit_api'`).first();
  const limite = parseInt(configRL?.valor || '100');
  if (!(await checkRateLimit(db, ip, '/bares', limite))) {
    return err('Muitas requisições. Tente novamente em breve.', 429);
  }

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') || '0');
  const lng = parseFloat(url.searchParams.get('lng') || '0');
  const search = url.searchParams.get('search')?.trim() || '';
  const cidade = url.searchParams.get('cidade') || '';
  const estado = url.searchParams.get('estado') || '';

  if (hasSQLInjection(search) || hasSQLInjection(cidade)) {
    return err('Parâmetros inválidos', 400);
  }

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return json({
      ok: false,
      codigo: 'LOCALIZACAO_OBRIGATORIA',
      erro: 'Localização necessária para encontrar bares próximos.'
    }, 400);
  }

  const configRaio = await db.prepare(`SELECT valor FROM config WHERE chave = 'raio_busca_km'`).first();
  const raioKm = parseFloat(configRaio?.valor || '50');

  let query = `SELECT * FROM bares WHERE ativo = 1 AND aprovado = 1`;
  const params = [];

  if (search) {
    query += ` AND (nome LIKE ? OR bairro LIKE ? OR endereco LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (cidade) { query += ` AND cidade = ?`; params.push(cidade); }
  if (estado) { query += ` AND estado = ?`; params.push(estado); }

  const { results } = await db.prepare(query).bind(...params).all();

  let bares = results
    .filter(b =>
      b.lat != null &&
      b.lng != null &&
      Number.isFinite(Number(b.lat)) &&
      Number.isFinite(Number(b.lng))
    )
    .map(b => ({
      ...b,
      distancia_km: haversine(
        lat,
        lng,
        Number(b.lat),
        Number(b.lng)
      )
    }))
    .filter(b => b.distancia_km <= raioKm)
    .sort((a, b) => a.distancia_km - b.distancia_km);

  const hoje = new Date().toISOString().split('T')[0];
  const { results: campanhas } = await db.prepare(`
    SELECT bar_id, titulo, promocao FROM campanhas 
    WHERE ativo = 1 AND inicio <= ? AND fim >= ?
  `).bind(hoje, hoje).all();

  const campanhaMap = {};
  campanhas.forEach(c => { campanhaMap[c.bar_id] = c; });

  bares = bares.map(b => ({
    ...b,
    campanha_ativa: campanhaMap[b.id] || null,
  }));

  return json({ ok: true, total: bares.length, bares });
});

router.get('/bares/:id', async (request, env) => {
  const db = env.DB;
  const { id } = request.params;

  if (!/^[a-f0-9]{16}$/.test(id)) return err('ID inválido', 400);

  const bar = await db.prepare(`SELECT * FROM bares WHERE id = ? AND ativo = 1 AND aprovado = 1`).bind(id).first();
  if (!bar) return err('Bar não encontrado', 404);

  const hoje = new Date().toISOString().split('T')[0];
  const campanha = await db.prepare(`
    SELECT titulo, promocao, descricao FROM campanhas
    WHERE bar_id = ? AND ativo = 1 AND inicio <= ? AND fim >= ?
  `).bind(id, hoje, hoje).first();

  return json({ ok: true, bar: { ...bar, campanha_ativa: campanha || null } });
});

router.post('/push/subscribe', async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const db = env.DB;

  if (!(await checkRateLimit(db, ip, '/push/subscribe', 3, 1440))) {
    return err('Limite de subscrições atingido', 429);
  }

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { endpoint, p256dh, auth, lat, lng, cidade, estado } = body;

  if (!endpoint || !p256dh || !auth) return err('Dados de push incompletos');
  if (!endpoint.startsWith('https://')) return err('Endpoint inválido');

  const latRound = lat ? Math.round(lat * 100) / 100 : null;
  const lngRound = lng ? Math.round(lng * 100) / 100 : null;

  const ua = request.headers.get('User-Agent') || '';
  const uaHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ua + ip));
  const deviceHash = Array.from(new Uint8Array(uaHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  try {
    await db.prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth_key, lat, lng, cidade, estado, device_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        lat = excluded.lat, lng = excluded.lng,
        cidade = excluded.cidade, estado = excluded.estado,
        ativo = 1
    `).bind(endpoint, p256dh, auth, latRound, lngRound, cidade || null, estado || null, deviceHash).run();

    return json({ ok: true });
  } catch (e) {
    console.error('[Push Subscribe]', e);
    return err('Erro ao salvar subscription', 500);
  }
});

router.post('/admin/login', async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const pais = request.headers.get('CF-IPCountry') || 'XX';
  const db = env.DB;

  const configRL = await db.prepare(`SELECT valor FROM config WHERE chave = 'rate_limit_login'`).first();
  const limite = parseInt(configRL?.valor || '5');
  if (!(await checkRateLimit(db, ip, '/admin/login', limite, 15))) {
    await logSecurity(db, env, { tipo: 'brute_force', nivel: 3, ip, pais, rota: '/admin/login', metodo: 'POST', bloqueado: true });
    await db.prepare(`INSERT OR IGNORE INTO blocked_ips (ip, motivo, permanente, expira_em) VALUES (?, ?, 0, datetime('now', '+1 hour'))`)
      .bind(ip, 'Brute force no login').run();
    return err('Muitas tentativas. Tente em 1 hora.', 429);
  }

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { email, senha, totp_token } = body;
  if (!email || !senha) return err('Email e senha obrigatórios');

  if (hasSQLInjection(email)) {
    await logSecurity(db, env, { tipo: 'sql_injection', nivel: 3, ip, pais, rota: '/admin/login', metodo: 'POST', payload: email, bloqueado: true });
    return err('Dados inválidos', 400);
  }

  const admin = await db.prepare(`SELECT * FROM admins WHERE email = ? AND ativo = 1`).bind(email.toLowerCase().trim()).first();

  if (!admin || !(await verifyPassword(senha, admin.senha_hash))) {
    await logSecurity(db, env, { tipo: 'login_falha', nivel: 2, ip, pais, rota: '/admin/login', metodo: 'POST', bloqueado: false });
    return err('Email ou senha incorretos', 401);
  }

  if (admin.totp_ativo && admin.totp_secret) {
    if (!totp_token) return json({ ok: false, requer_2fa: true }, 200);
    const valid = await verifyTOTP(admin.totp_secret, totp_token);
    if (!valid) {
      await logSecurity(db, env, { tipo: 'totp_falha', nivel: 2, ip, pais, rota: '/admin/login', metodo: 'POST', bloqueado: false });
      return err('Código 2FA inválido', 401);
    }
  }

  const token = await signJWT({ id: admin.id, email: admin.email, role: admin.role, cidade: admin.cidade, estado: admin.estado }, env.JWT_SECRET);

  const refreshToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
  await db.prepare(`INSERT INTO sessoes (admin_id, refresh_token, ip, user_agent, expira_em) VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`)
    .bind(admin.id, refreshToken, ip, request.headers.get('User-Agent') || '').run();

  await db.prepare(`UPDATE admins SET ultimo_login = datetime('now') WHERE id = ?`).bind(admin.id).run();

  return json({ ok: true, token, refresh_token: refreshToken, admin: { id: admin.id, nome: admin.nome, email: admin.email, role: admin.role } });
});

router.post('/admin/totp/setup', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  const secret = generateTOTPSecret();
  const db = env.DB;
  await db.prepare(`UPDATE admins SET totp_secret = ?, totp_ativo = 0 WHERE id = ?`).bind(secret, admin.id).run();

  const otpauthUrl = `otpauth://totp/QuartaAmstel:${admin.email}?secret=${secret}&issuer=QuartaAmstel`;
  return json({ ok: true, secret, otpauth_url: otpauthUrl });
});

router.post('/admin/totp/confirm', async (request, env) => {
  const adminAuth = await requireAuth(request, env, ['master', 'admin']);
  if (!adminAuth) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const db = env.DB;
  const admin = await db.prepare(`SELECT totp_secret FROM admins WHERE id = ?`).bind(adminAuth.id).first();
  if (!admin?.totp_secret) return err('Setup TOTP não iniciado');

  const valid = await verifyTOTP(admin.totp_secret, body.token);
  if (!valid) return err('Código inválido');

  await db.prepare(`UPDATE admins SET totp_ativo = 1 WHERE id = ?`).bind(adminAuth.id).run();
  return json({ ok: true, mensagem: '2FA ativado com sucesso' });
});

router.get('/admin/bares', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin', 'viewer']);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const url = new URL(request.url);
  const aprovado = url.searchParams.get('aprovado');
  const cidade = url.searchParams.get('cidade');
  const estado = url.searchParams.get('estado');

  let query = `SELECT * FROM bares WHERE 1=1`;
  const params = [];

  if (admin.cidade) { query += ` AND cidade = ?`; params.push(admin.cidade); }
  else if (admin.estado && admin.role !== 'master') { query += ` AND estado = ?`; params.push(admin.estado); }

  if (aprovado !== null && aprovado !== undefined) { query += ` AND aprovado = ?`; params.push(parseInt(aprovado)); }
  if (cidade) { query += ` AND cidade = ?`; params.push(cidade); }
  if (estado) { query += ` AND estado = ?`; params.push(estado); }

  query += ` ORDER BY aprovado ASC, criado_em DESC`;

  const { results } = await db.prepare(query).bind(...params).all();
  return json({ ok: true, total: results.length, bares: results });
});

router.post('/admin/bares', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { nome, endereco, bairro, cidade, estado, lat, lng, telefone, horario, descricao, foto_url } = body;

  if (!nome || !endereco || !bairro || !cidade || !estado || !lat || !lng) {
    return err('Campos obrigatórios: nome, endereco, bairro, cidade, estado, lat, lng');
  }

  if (hasSQLInjection(nome) || hasSQLInjection(endereco)) return err('Dados inválidos', 400);
  if (!/^[A-Z]{2}$/.test(estado)) return err('Estado inválido (use UF ex: MG)');

  const db = env.DB;
  const result = await db.prepare(`
    INSERT INTO bares (nome, endereco, bairro, cidade, estado, lat, lng, telefone, horario, descricao, foto_url, aprovado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(nome, endereco, bairro, cidade, estado.toUpperCase(), lat, lng, telefone || null, horario || null, descricao || null, foto_url || null, admin.role === 'master' ? 1 : 0).run();

  return json({ ok: true, id: result.meta?.last_row_id }, 201);
});

router.put('/admin/bares/:id/aprovar', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  const { id } = request.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return err('ID inválido', 400);

  const db = env.DB;
  await db.prepare(`UPDATE bares SET aprovado = 1, atualizado_em = datetime('now') WHERE id = ?`).bind(id).run();
  return json({ ok: true });
});

router.put('/admin/bares/:id', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  const { id } = request.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return err('ID inválido', 400);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const campos = ['nome', 'endereco', 'bairro', 'cidade', 'estado', 'lat', 'lng', 'telefone', 'horario', 'descricao', 'foto_url', 'ativo'];
  const updates = [];
  const params = [];

  campos.forEach(c => {
    if (body[c] !== undefined) {
      if (hasSQLInjection(String(body[c]))) return;
      updates.push(`${c} = ?`);
      params.push(body[c]);
    }
  });

  if (!updates.length) return err('Nenhum campo para atualizar');
  params.push(id);

  const db = env.DB;
  await db.prepare(`UPDATE bares SET ${updates.join(', ')}, atualizado_em = datetime('now') WHERE id = ?`).bind(...params).run();
  return json({ ok: true });
});

router.post('/admin/bares/import', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { bares } = body;
  if (!Array.isArray(bares) || !bares.length) return err('Lista de bares vazia');
  if (bares.length > 500) return err('Máximo 500 bares por import');

  const db = env.DB;
  let inseridos = 0;
  let erros = [];

  for (const b of bares) {
    try {
      if (!b.nome || !b.lat || !b.lng || !b.cidade || !b.estado) {
        erros.push(`Bar "${b.nome || '?'}" sem campos obrigatórios`);
        continue;
      }
      await db.prepare(`
        INSERT INTO bares (nome, endereco, bairro, cidade, estado, lat, lng, telefone, horario, descricao, aprovado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(b.nome, b.endereco || '', b.bairro || '', b.cidade, b.estado.toUpperCase(), b.lat, b.lng, b.telefone || null, b.horario || null, b.descricao || null).run();
      inseridos++;
    } catch (e) {
      erros.push(`Erro ao inserir "${b.nome}": ${e.message}`);
    }
  }

  return json({ ok: true, inseridos, erros, pendentes_aprovacao: inseridos });
});

router.get('/admin/campanhas', async (request, env) => {
  const admin = await requireAuth(request, env);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const { results } = await db.prepare(`SELECT c.*, b.nome as bar_nome FROM campanhas c LEFT JOIN bares b ON c.bar_id = b.id ORDER BY c.criado_em DESC`).all();
  return json({ ok: true, campanhas: results });
});

router.post('/admin/campanhas', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { titulo, descricao, promocao, cidade, estado, bar_id, inicio, fim } = body;
  if (!titulo || !promocao || !inicio || !fim) return err('Campos obrigatórios: titulo, promocao, inicio, fim');

  const db = env.DB;
  await db.prepare(`
    INSERT INTO campanhas (titulo, descricao, promocao, cidade, estado, bar_id, inicio, fim, criado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(titulo, descricao || null, promocao, cidade || null, estado || null, bar_id || null, inicio, fim, admin.id).run();

  return json({ ok: true }, 201);
});

router.post('/admin/push/send', async (request, env) => {
  const admin = await requireAuth(request, env, ['master', 'admin']);
  if (!admin) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const { titulo, mensagem, cidade, estado, campanha_id, confirmacao } = body;

  if (confirmacao !== 'CONFIRMAR') return err('Digite CONFIRMAR para enviar push');
  if (!titulo || !mensagem) return err('Título e mensagem obrigatórios');

  const db = env.DB;

  if (!(await checkRateLimit(db, admin.id, '/admin/push/send', 3, 1440))) {
    return err('Limite de 3 disparos por dia atingido', 429);
  }

  let query = `SELECT id, endpoint, p256dh, auth_key FROM push_subscriptions WHERE ativo = 1`;
  const params = [];
  if (cidade) { query += ` AND cidade = ?`; params.push(cidade); }
  if (estado) { query += ` AND estado = ?`; params.push(estado); }

  const { results: subs } = await db.prepare(query).bind(...params).all();

  let enviados = 0;
  let falhas = 0;

  const payload = JSON.stringify({
    titulo,
    mensagem,
    icon: '/images/logo.png',
    badge: '/images/badge.png',
    url: '/?push=1',
    timestamp: Date.now(),
  });

  for (const sub of subs) {
    try {
      const result = await sendVapidPush(sub, payload, env);
      if (result === true || result?.success) enviados++;
      else {
        falhas++;
        if (result?.expired) {
          await db.prepare(`UPDATE push_subscriptions SET ativo = 0 WHERE endpoint = ?`)
            .bind(sub.endpoint).run();
        }
      }
    } catch {
      falhas++;
    }
  }

  await db.prepare(`
    INSERT INTO push_log (campanha_id, enviado_por, cidade, estado, total, enviados, falhas, tipo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
  `).bind(campanha_id || null, admin.id, cidade || null, estado || null, subs.length, enviados, falhas).run();

  return json({ ok: true, total: subs.length, enviados, falhas });
});

router.get('/admin/security/logs', async (request, env) => {
  const admin = await requireAuth(request, env, ['master']);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const url = new URL(request.url);
  const nivel = url.searchParams.get('nivel');
  const limite = Math.min(parseInt(url.searchParams.get('limite') || '100'), 500);

  let query = `SELECT * FROM security_log`;
  const params = [];
  if (nivel) { query += ` WHERE nivel >= ?`; params.push(parseInt(nivel)); }
  query += ` ORDER BY criado_em DESC LIMIT ?`;
  params.push(limite);

  const { results } = await db.prepare(query).bind(...params).all();
  return json({ ok: true, logs: results });
});

router.get('/admin/security/blocked', async (request, env) => {
  const admin = await requireAuth(request, env, ['master']);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const { results } = await db.prepare(`SELECT * FROM blocked_ips ORDER BY criado_em DESC`).all();
  return json({ ok: true, blocked: results });
});

router.delete('/admin/security/blocked/:ip', async (request, env) => {
  const admin = await requireAuth(request, env, ['master']);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  await db.prepare(`DELETE FROM blocked_ips WHERE ip = ?`).bind(request.params.ip).run();
  return json({ ok: true });
});

router.get('/admin/stats', async (request, env) => {
  const admin = await requireAuth(request, env);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const [bares, subs, campanhas, pushes, ameacas] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total, SUM(aprovado) as aprovados FROM bares`).first(),
    db.prepare(`SELECT COUNT(*) as total FROM push_subscriptions WHERE ativo = 1`).first(),
    db.prepare(`SELECT COUNT(*) as total FROM campanhas WHERE ativo = 1`).first(),
    db.prepare(`SELECT SUM(enviados) as total FROM push_log`).first(),
    db.prepare(`SELECT COUNT(*) as total FROM security_log WHERE nivel >= 2 AND criado_em > datetime('now', '-24 hours')`).first(),
  ]);

  return json({ ok: true, stats: { bares, subscriptions: subs, campanhas, pushes_enviados: pushes?.total || 0, ameacas_24h: ameacas?.total || 0 } });
});

router.get('/admin/config', async (request, env) => {
  const admin = await requireAuth(request, env, ['master']);
  if (!admin) return err('Não autorizado', 401);

  const db = env.DB;
  const { results } = await db.prepare(`SELECT * FROM config`).all();
  return json({ ok: true, config: results });
});

router.put('/admin/config/:chave', async (request, env) => {
  const admin = await requireAuth(request, env, ['master']);
  if (!admin) return err('Não autorizado', 401);

  let body;
  try { body = await request.json(); } catch { return err('JSON inválido'); }

  const db = env.DB;
  await db.prepare(`UPDATE config SET valor = ?, atualizado_em = datetime('now') WHERE chave = ?`)
    .bind(body.valor, request.params.chave).run();
  return json({ ok: true });
});


// ── VAPID Push — RFC 8291 (aes128gcm) + RFC 8292
// Implementação limpa — sem detecção de endpoint, só aes128gcm

function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDec(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function concatBufs(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

async function hkdfExtract(salt, ikm) {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
}

async function hkdfExpand(prk, info, length) {
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const out = new Uint8Array(length);
  let prev = new Uint8Array(0);
  let offset = 0;
  for (let i = 1; offset < length; i++) {
    const combined = concatBufs(prev, info, new Uint8Array([i]));
    prev = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, combined));
    out.set(prev.slice(0, Math.min(prev.length, length - offset)), offset);
    offset += prev.length;
  }
  return out;
}

async function buildVapidJwt(endpoint, privateKeyB64, publicKeyB64) {
  const origin = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64u(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const pay = b64u(new TextEncoder().encode(JSON.stringify({ aud: origin, exp: now + 43200, sub: 'mailto:admin@quartaamstel.com.br' })));
  const data = `${hdr}.${pay}`;
  const key = await crypto.subtle.importKey('pkcs8', b64uDec(privateKeyB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(data));
  return `${data}.${b64u(sig)}`;
}

async function encryptWebPush(payloadStr, p256dhB64, authB64) {
  const recipientPub = b64uDec(p256dhB64);
  const auth = b64uDec(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const recKey = await crypto.subtle.importKey('raw', recipientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: recKey }, eph.privateKey, 256));

  // RFC 8291 HKDF
  const prkInfo = concatBufs(new TextEncoder().encode('WebPush: info\0'), recipientPub, ephPub);
  const prk = await hkdfExtract(auth, shared);
  const ikm = await hkdfExpand(prk, prkInfo, 32);
  const saltPrk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(saltPrk, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(saltPrk, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // Payload com delimiter
  const plain = new TextEncoder().encode(payloadStr);
  if (plain.length > 3993) throw new Error(`Payload muito grande: ${plain.length} bytes (máx 3993)`);
  const padded = new Uint8Array(plain.length + 1);
  padded.set(plain, 0);
  padded[plain.length] = 0x02;

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // Header RFC 8291
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + ephPub.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = ephPub.length;
  header.set(ephPub, 21);

  return concatBufs(header, encrypted);
}

async function sendVapidPush(sub, payload, env) {
  try {
    const token = await buildVapidJwt(sub.endpoint, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
    const body = await encryptWebPush(payload, sub.p256dh, sub.auth_key);

    const resp = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': `vapid t=${token},k=${env.VAPID_PUBLIC_KEY}`,
        'TTL': '86400',
      },
      body,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error(`[Push] ${resp.status} — ${txt.slice(0, 200)}`);
    }

    return { success: resp.status < 300, expired: resp.status === 410 || resp.status === 404 };
  } catch (e) {
    console.error('[VAPID Push Error]', e.message);
    return { success: false, expired: false };
  }
}
router.options('*', () => new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } }));
router.all('*', () => err('Rota não encontrada', 404));

export default {
  async fetch(request, env, ctx) {
    const block = await securityMiddleware(request, env);
    if (block) return block;

    try {
      return await router.handle(request, env, ctx);
    } catch (e) {
      console.error('[Worker Error]', e);
      return err('Erro interno do servidor', 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};