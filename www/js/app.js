
const WORKER = 'https://quartaamstel-worker.henriquesouza.workers.dev';

window._bares = [];
window._userLat = null;
window._userLng = null;
window._barProximo = null;
window._deferredInstall = null;

window._toggleTheme = function () {
  const atual = document.documentElement.getAttribute('data-theme');
  const novo = atual === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novo);
  localStorage.setItem('amstel_theme', novo);
};

function _initTheme() {
  const salvo = localStorage.getItem('amstel_theme');
  if (salvo) {
    document.documentElement.setAttribute('data-theme', salvo);
  }
}

window._confirmarIdade = function () {
  const dia  = parseInt(document.getElementById('ag-dia').value);
  const mes  = parseInt(document.getElementById('ag-mes').value);
  const ano  = parseInt(document.getElementById('ag-ano').value);
  const erro = document.getElementById('ag-erro');

  erro.classList.add('hidden');

  if (!dia || !mes || !ano || isNaN(dia) || isNaN(mes) || isNaN(ano)) {
    _mostrarErroAge('Preencha sua data de nascimento completa.');
    return;
  }

  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) {
    _mostrarErroAge('Data inválida. Verifique e tente novamente.');
    return;
  }

  const nascimento = new Date(ano, mes - 1, dia);
  const hoje = new Date();

  if (isNaN(nascimento.getTime())) {
    _mostrarErroAge('Data inválida.');
    return;
  }

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;

  const configMin = 18;
  const configMax = 80;

  if (idade < configMin) {
    _mostrarErroAge('Você precisa ter pelo menos 18 anos para acessar este site.');
    return;
  }

  if (idade > configMax) {
    _mostrarErroAge('Este aplicativo não está disponível para maiores de 80 anos.');
    return;
  }

  const expira = new Date();
  expira.setDate(expira.getDate() + 30);
  document.cookie = `amstel_age=ok; expires=${expira.toUTCString()}; path=/; SameSite=Strict`;
  localStorage.setItem('amstel_age', 'ok');

  document.getElementById('age-gate').classList.add('hidden');
  _iniciarApp();
};

function _mostrarErroAge(msg) {
  const erro = document.getElementById('ag-erro');
  erro.textContent = msg;
  erro.classList.remove('hidden');
}

function _verificarIdade() {
  const cookie = document.cookie.includes('amstel_age=ok');
  const local = localStorage.getItem('amstel_age') === 'ok';
  return cookie || local;
}

document.addEventListener('DOMContentLoaded', () => {
  ['ag-dia', 'ag-mes', 'ag-ano'].forEach(id => {
    document.getElementById(id)?.addEventListener('keypress', e => {
      if (e.key === 'Enter') window._confirmarIdade();
    });
  });

  document.getElementById('ag-dia')?.addEventListener('input', e => {
    if (e.target.value.length >= 2) document.getElementById('ag-mes')?.focus();
  });
  document.getElementById('ag-mes')?.addEventListener('input', e => {
    if (e.target.value.length >= 2) document.getElementById('ag-ano')?.focus();
  });
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._deferredInstall = e;

  if (_verificarIdade()) {
    setTimeout(_mostrarInstallPrompt, 2000);
  }
});

function _mostrarInstallPrompt() {
  if (!window._deferredInstall) return;
  if (localStorage.getItem('amstel_install_dismissed')) return;
  document.getElementById('install-prompt')?.classList.remove('hidden');
}

window._instalarPWA = async function () {
  if (!window._deferredInstall) return;
  window._deferredInstall.prompt();
  const { outcome } = await window._deferredInstall.userChoice;
  window._deferredInstall = null;
  document.getElementById('install-prompt')?.classList.add('hidden');
};

window._fecharInstall = function () {
  document.getElementById('install-prompt')?.classList.add('hidden');
  localStorage.setItem('amstel_install_dismissed', '1');
};

async function _registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[SW] Registrado:', reg.scope);
    return reg;
  } catch (e) {
    console.error('[SW] Erro:', e);
  }
}



window._carregarBares = async function () {
  try {
    const lat = Number(window._userLat);
    const lng = Number(window._userLng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (lat === 0 && lng === 0)
    ) {
      window._bares = [];
      return [];
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng)
    });

    const url = `${WORKER}/bares?${params.toString()}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.ok) {
      window._bares = data.bares || [];
      return window._bares;
    }
    return [];
  } catch (e) {
    console.error('[Bares]', e);
    return [];
  }
};

window._mudarTab = function (tab) {
  // Muda a tab PRIMEIRO para o container ter dimensões
  document.querySelectorAll('.nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));

  if (tab === 'mapa') {
    if (window._mapa) {
      window._onMapaAtivado && window._onMapaAtivado();
    } else {
      setTimeout(() => {
        const loc = window._locationState?.coords || null;
        window._initMapa(loc);
      }, 80);
    }
  }
};
function _detectarPlataforma() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  return { isIOS, isAndroid };
}

window._abrirSeletorRota = function (lat, lng, nome) {
  document.getElementById('modal-bar')?.classList.add('hidden');
  document.body.style.overflow = 'hidden';

  const { isIOS, isAndroid } = _detectarPlataforma();

  const mapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const mapsDeep = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
  const wazeDeep = `waze://?ll=${lat},${lng}&navigate=yes`;
  const wazeWeb = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const appleUrl = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;

  const modal = document.getElementById('modal-rota');
  if (!modal) return;

  const iconApple = `<svg viewBox="0 0 48 48" width="28" height="28"><rect width="48" height="48" rx="10" fill="#fff"/><path d="M24 6C14.06 6 6 14.06 6 24s8.06 18 18 18 18-8.06 18-18S33.94 6 24 6zm0 2c8.84 0 16 7.16 16 16S32.84 40 24 40 8 32.84 8 24 15.16 8 24 8zm-1 5v12.17l-4.59-4.58-1.41 1.41L24 28.83l7-7-1.41-1.41L25 24.17V13h-2z" fill="#1C8EF9"/><path d="M24 14l-7 7 1.41 1.41L23 17.83V30h2V17.83l4.59 4.58L31 21l-7-7z" fill="#34A853"/></svg>`;

  const iconGMaps = `<img src="/assets/icons/google-maps.png" width="28" height="28" style="border-radius:6px">`;

  const iconWaze = `<img src="/assets/icons/waze.png" width="28" height="28" style="border-radius:6px">`;

  const iconAppleMaps = `<img src="/assets/icons/apple-maps.png" width="28" height="28" style="border-radius:6px">`;

  const opcoes = isIOS ? [
    { label: 'Apple Maps', icon: iconAppleMaps, deep: appleUrl, web: appleUrl },
    { label: 'Google Maps', icon: iconGMaps, deep: mapsDeep, web: mapsWeb },
    { label: 'Waze', icon: iconWaze, deep: wazeDeep, web: wazeWeb },
  ] : [
    { label: 'Google Maps', icon: iconGMaps, deep: mapsDeep, web: mapsWeb },
    { label: 'Waze', icon: iconWaze, deep: wazeDeep, web: wazeWeb },
  ];

  document.getElementById('modal-rota-nome').textContent = nome;
  document.getElementById('modal-rota-opcoes').innerHTML = opcoes.map(op => `
    <button class="rota-opcao" onclick="window._abrirApp('${op.deep}', '${op.web}')">
      <span class="rota-opcao__icon">${op.icon}</span>
      <span class="rota-opcao__label">${op.label}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  `).join('');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window._abrirApp = function (deep, web) {
  // Tenta deeplink, fallback para web após 1.5s
  window.location.href = deep;
  setTimeout(() => { window.open(web, '_blank'); }, 1500);
  window._fecharModalRota();
};

window._fecharModalRota = function () {
  document.getElementById('modal-rota')?.classList.add('hidden');
  document.body.style.overflow = '';
};
window._statusHorarioBar = function(bar) {
  const horarios = Array.isArray(bar?.horarios) ? bar.horarios : [];
  if (!horarios.length) return null;

  const agora = new Date();
  const dia = agora.getDay();
  const minutos = agora.getHours() * 60 + agora.getMinutes();

  const paraMin = h => {
    if (!h) return null;
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };

  // Horário de hoje
  const hoje = horarios.find(h => Number(h.dia_semana) === dia);

  if (hoje && Number(hoje.aberto) === 1) {
    const abre = paraMin(hoje.abertura);
    const fecha = paraMin(hoje.fechamento);

    if (abre !== null && fecha !== null) {
      // Fecha no mesmo dia
      if (fecha > abre && minutos >= abre && minutos < fecha) {
        return {
          aberto: true,
          texto: `Aberto até ${hoje.fechamento}`
        };
      }

      // Atravessa meia-noite
      if (fecha <= abre && minutos >= abre) {
        return {
          aberto: true,
          texto: `Aberto até ${hoje.fechamento}`
        };
      }
    }
  }

  // Verifica se ainda está aberto pelo dia anterior
  const diaAnterior = (dia + 6) % 7;
  const ontem = horarios.find(h => Number(h.dia_semana) === diaAnterior);

  if (ontem && Number(ontem.aberto) === 1) {
    const abre = paraMin(ontem.abertura);
    const fecha = paraMin(ontem.fechamento);

    if (
      abre !== null &&
      fecha !== null &&
      fecha <= abre &&
      minutos < fecha
    ) {
      return {
        aberto: true,
        texto: `Aberto até ${ontem.fechamento}`
      };
    }
  }

  return {
    aberto: false,
    texto: 'Fechado agora'
  };
};

window._barAbertoAgora = function(bar) {
  return window._statusHorarioBar(bar)?.aberto ?? null;
};
window._verBar = function (id) {
  const bar = window._bares.find(b => b.id === id);
  if (!bar) return;

  const modal = document.getElementById('modal-bar');
  const content = document.getElementById('modal-bar-content');

  const distStr = bar.distancia_km != null
    ? bar.distancia_km < 1
      ? `${Math.round(bar.distancia_km * 1000)}m de você`
      : `${bar.distancia_km.toFixed(1)}km de você`
    : '';

  const campanhaHtml = bar.campanha_ativa ? `
    <div class="bar-detail__campanha">
      <div class="bar-detail__campanha-label">🍺 Promoção ativa hoje</div>
      <div class="bar-detail__campanha-texto">${bar.campanha_ativa.promocao}</div>
    </div>
  ` : '';

  const fotoHtml = bar.foto_url
    ? `<div class="bar-detail__foto"><img src="${bar.foto_url}" alt="${bar.nome}" onerror="this.parentElement.innerHTML='<div class=bar-detail__foto-placeholder></div>'"></div>`
    : `<div class="bar-detail__foto"><div class="bar-detail__foto-placeholder"></div></div>`;

  const abertoAgora =
    typeof window._barAbertoAgora === 'function'
      ? window._barAbertoAgora(bar)
      : null;

  const statusHtml = bar.horario
    ? `<div class="bar-detail__info-item ${
        abertoAgora === true
          ? 'bar-detail__info-item--aberto'
          : abertoAgora === false
            ? 'bar-detail__info-item--fechado'
            : ''
      }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>${
          abertoAgora === true
            ? `Aberto agora · ${bar.horario}`
            : abertoAgora === false
              ? `Fechado agora · ${bar.horario}`
              : bar.horario
        }</span>
      </div>`
    : '';

  content.innerHTML = `
    ${fotoHtml}
    <div class="bar-detail__nome">${bar.nome}</div>
    <div class="bar-detail__bairro">${bar.bairro} · ${bar.cidade}, ${bar.estado}${distStr ? ` · ${distStr}` : ''}</div>
    ${campanhaHtml}
    <div class="bar-detail__info">
      <div class="bar-detail__info-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${bar.endereco}</span>
      </div>
      ${statusHtml}
      ${bar.telefone ? `
      <div class="bar-detail__info-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.09a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>${bar.telefone}</span>
      </div>` : ''}
    </div>
    <div class="bar-detail__acoes">
      <button class="btn-primary" style="flex:1" onclick="window._abrirSeletorRota(${bar.lat}, ${bar.lng}, '${bar.nome.replace(/'/g, "\\'")}')">
        Ver rota
      </button>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window._fecharModal = function () {
  document.getElementById('modal-bar')?.classList.add('hidden');
  document.body.style.overflow = '';
};

window._toast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
};



async function _iniciarApp() {
  document.getElementById('app')?.classList.remove('hidden');
  window._mudarTab('descobrir');

  const swReg = await _registrarSW();

  if (window._renderLista) window._renderLista([], 'loading');

  if (window._iniciarGeolocalizacao) {
    window._iniciarGeolocalizacao();
  }

  if (window._onLocationState) {
    window._onLocationState(async function (state) {
      if (state.status === 'locating') {
        const locAprox = window._locSalvaRecente;
        if (locAprox && window._mapa && window._renderUserMarker) {
          window._renderUserMarker(locAprox, true);
        }
      } else if (state.status === 'ready' && state.coords) {
        const bares = await window._carregarBares().catch(() => []);
        window._bares = bares;

        if (window._renderLista) window._renderLista(bares);

        if (window._mapa) {
          window._mapa.flyTo([state.coords.lat, state.coords.lng], 13, { animate: true, duration: 0.6 });
          if (window._renderUserMarker) window._renderUserMarker(state.coords, false);
          if (bares.length && window._renderMarcadoresMapa) {
            window._renderMarcadoresMapa(bares);
          }
        }
      } else if (state.status === 'denied' || state.status === 'error') {
        const bares = await window._carregarBares().catch(() => []);
        window._bares = bares;
        if (window._renderLista) {
          window._renderLista(bares, 'localizacao-negada');
        }
      }
    });
  }

  setTimeout(async () => {
    if (window._solicitarPush && swReg) {
      await window._solicitarPush(swReg);
    }
  }, 3000);

  if (location.search.includes('push=1')) {
    window._mudarTab('descobrir');
    if (window._userLat && window._userLng && bares.length) {
      window._verBar(bares[0].id);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _initTheme();

  if (_verificarIdade()) {
    document.getElementById('age-gate')?.classList.add('hidden');
    _iniciarApp();
    setTimeout(_mostrarInstallPrompt, 3000);
  } else {
    document.getElementById('age-gate')?.classList.remove('hidden');
  }
});
