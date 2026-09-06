
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

function _pedirLocalizacao() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        window._userLat = pos.coords.latitude;
        window._userLng = pos.coords.longitude;
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

window._carregarBares = async function () {
  try {
    let url = `${WORKER}/bares`;
    const params = new URLSearchParams();

    if (window._userLat && window._userLng) {
      params.set('lat', window._userLat);
      params.set('lng', window._userLng);
    }

    if (params.toString()) url += `?${params}`;

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
  if (tab === 'mapa') {
    if (window._initMapa && !_mapa) {
      window._initMapa(window._userLoc || null);
    }
    if (window._onMapaAtivado) window._onMapaAtivado();
  }
  document.querySelectorAll('.nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
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

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${bar.lat},${bar.lng}&navigate=yes`;

  content.innerHTML = `
    <div class="bar-detail__nome">${bar.nome}</div>
    <div class="bar-detail__bairro">${bar.bairro} · ${bar.cidade}, ${bar.estado}</div>
    ${campanhaHtml}
    <div class="bar-detail__info">
      <div class="bar-detail__info-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${bar.endereco}${distStr ? ` · ${distStr}` : ''}</span>
      </div>
      ${bar.horario ? `
      <div class="bar-detail__info-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${bar.horario}</span>
      </div>` : ''}
      ${bar.telefone ? `
      <div class="bar-detail__info-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.09a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>${bar.telefone}</span>
      </div>` : ''}
    </div>
    <div class="bar-detail__acoes">
      <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none;text-align:center;flex:1">Google Maps</a>
      <a href="${wazeUrl}" target="_blank" rel="noopener" class="btn-outline" style="text-decoration:none;text-align:center;flex:1">Waze</a>
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

  const [loc, bares] = await Promise.all([
    _pedirLocalizacao(),
    window._carregarBares().catch(() => []),
  ]);

  if (window._renderLista) {
    window._renderLista(bares, bares.length ? undefined : (loc ? undefined : 'localizacao-negada'));
  }

  if (window._initMapa) requestAnimationFrame(() => window._initMapa(loc));

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
