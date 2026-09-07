
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS bares (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  nome        TEXT NOT NULL,
  endereco    TEXT NOT NULL,
  bairro      TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  estado      TEXT NOT NULL CHECK(length(estado) = 2),
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  telefone    TEXT,
  horario     TEXT,
  descricao   TEXT,
  foto_url    TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  aprovado    INTEGER NOT NULL DEFAULT 0, -- preview antes de publicar
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bares_cidade ON bares(cidade, estado);
CREATE INDEX IF NOT EXISTS idx_bares_ativo ON bares(ativo, aprovado);
CREATE INDEX IF NOT EXISTS idx_bares_coords ON bares(lat, lng);

CREATE TABLE IF NOT EXISTS campanhas (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  promocao    TEXT NOT NULL, -- ex: "Chopp R$8 toda quarta"
  cidade      TEXT,          -- NULL = campanha nacional
  estado      TEXT,          -- NULL = campanha nacional
  bar_id      TEXT REFERENCES bares(id) ON DELETE SET NULL,
  inicio      TEXT NOT NULL,
  fim         TEXT NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_por  TEXT NOT NULL,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campanhas_ativo ON campanhas(ativo, inicio, fim);
CREATE INDEX IF NOT EXISTS idx_campanhas_cidade ON campanhas(cidade, estado);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,  -- AES-256 encrypted
  auth_key    TEXT NOT NULL,  -- AES-256 encrypted (auth é palavra reservada)
  lat         REAL,           -- arredondado 2 casas (bairro, não endereço)
  lng         REAL,
  cidade      TEXT,
  estado      TEXT,
  device_hash TEXT,           -- SHA-256 do user-agent (fingerprint anônimo)
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_push TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_cidade ON push_subscriptions(cidade, estado);
CREATE INDEX IF NOT EXISTS idx_push_ativo ON push_subscriptions(ativo);

CREATE TABLE IF NOT EXISTS push_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  campanha_id TEXT REFERENCES campanhas(id),
  enviado_por TEXT NOT NULL,
  cidade      TEXT,
  estado      TEXT,
  total       INTEGER NOT NULL DEFAULT 0,
  enviados    INTEGER NOT NULL DEFAULT 0,
  falhas      INTEGER NOT NULL DEFAULT 0,
  tipo        TEXT NOT NULL DEFAULT 'manual', -- manual | cron
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email        TEXT NOT NULL UNIQUE,
  senha_hash   TEXT NOT NULL,  -- bcrypt custo 12
  nome         TEXT NOT NULL,
role                   TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('master','admin','viewer')),
cidade                 TEXT,
estado                 TEXT,

can_security            INTEGER NOT NULL DEFAULT 0,
can_manage_admins       INTEGER NOT NULL DEFAULT 0,
can_manage_all_regions  INTEGER NOT NULL DEFAULT 0,

totp_secret             TEXT,
  totp_ativo   INTEGER NOT NULL DEFAULT 0,
  ultimo_login TEXT,
  ativo        INTEGER NOT NULL DEFAULT 1,
  criado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  admin_id     TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  ip           TEXT,
  user_agent   TEXT,
  expira_em    TEXT NOT NULL,
  criado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessoes_admin ON sessoes(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(refresh_token);

CREATE TABLE IF NOT EXISTS security_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tipo        TEXT NOT NULL, -- brute_force | sql_injection | rate_limit | geo_block | suspicious
  nivel       INTEGER NOT NULL DEFAULT 1, -- 1=info | 2=aviso | 3=critico
  ip          TEXT NOT NULL,
  pais        TEXT,
  cidade_ip   TEXT,
  rota        TEXT,
  metodo      TEXT,
  payload     TEXT,          -- sanitizado, sem dados sensíveis
  bloqueado   INTEGER NOT NULL DEFAULT 0,
  alerta_enviado INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_nivel ON security_log(nivel, criado_em);
CREATE INDEX IF NOT EXISTS idx_security_ip ON security_log(ip);
CREATE INDEX IF NOT EXISTS idx_security_tipo ON security_log(tipo);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  ip          TEXT NOT NULL UNIQUE,
  motivo      TEXT NOT NULL,
  permanente  INTEGER NOT NULL DEFAULT 0,
  expira_em   TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocked_ip ON blocked_ips(ip);

CREATE TABLE IF NOT EXISTS rate_limit (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  ip          TEXT NOT NULL,
  rota        TEXT NOT NULL,
  contador    INTEGER NOT NULL DEFAULT 1,
  janela_inicio TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ip, rota)
);

CREATE INDEX IF NOT EXISTS idx_rate_ip_rota ON rate_limit(ip, rota);

CREATE TABLE IF NOT EXISTS config (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  descricao   TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO config (chave, valor, descricao) VALUES
  ('raio_busca_km', '50', 'Raio de busca de bares em km'),
  ('push_horarios', '17:00,18:00,19:00', 'Horários do cron push (quarta)'),
  ('push_ativo', '1', 'Push automático ativo'),
  ('age_gate_min', '18', 'Idade mínima'),
  ('age_gate_max', '80', 'Idade máxima'),
  ('rate_limit_api', '100', 'Req por minuto — API pública'),
  ('rate_limit_admin', '30', 'Req por minuto — Admin'),
  ('rate_limit_login', '5', 'Tentativas de login por 15min'),
  ('alert_email', 'henriquesouza1832001@gmail.com', 'Email para alertas de segurança'),
  ('geoblock_ativo', '1', 'Bloquear acessos fora do Brasil');
