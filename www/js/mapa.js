let _mapa = null;
let _marcadores = [];
let _barSelecionado = null;
let _userMarker = null;
let _filtroMapaAtivo = 'proximos';
let _userLoc = null;

function _esconderLoadingMapa() {
  const el = document.getElementById('mapa-loading');
  if (!el) return;
  el.classList.add('saindo');
  setTimeout(() => el.classList.add('hidden'), 300);
}

window._mostrarLoadingMapa = function () {
  const el = document.getElementById('mapa-loading');
  if (!el) return;
  const fill = document.getElementById('beer-fill');
  if (fill) {
    fill.style.animation = 'none';
    void fill.offsetHeight;
    fill.style.animation = '';
  }
  const err = document.getElementById('mapa-loading-error');
  const txt = document.getElementById('mapa-loading-text');
  if (err) err.classList.add('hidden');
  if (txt) txt.classList.remove('hidden');
  el.classList.remove('hidden', 'saindo');
};

window._setLoadingErro = function (tipo) {
  const err = document.getElementById('mapa-loading-error');
  const txt = document.getElementById('mapa-loading-text');
  if (txt) txt.classList.add('hidden');
  if (!err) return;
  err.classList.remove('hidden');
  if (tipo === 'denied') {
    err.innerHTML = `
      <p class="map-location-loading__error-text">
        Precisamos da sua localização para encontrar os bares mais próximos.
        Permita o acesso nas configurações do navegador.
      </p>`;
  } else {
    err.innerHTML = `
      <p class="map-location-loading__error-text">
        Não conseguimos encontrar sua localização.
      </p>
      <button class="map-location-loading__error-btn" onclick="window._tentarLocNovamente()">
        Tentar novamente
      </button>`;
  }
};

window._tentarLocNovamente = function () {
  window._mostrarLoadingMapa();
  window._resetGeolocalizacao && window._resetGeolocalizacao();
  window._iniciarGeolocalizacao && window._iniciarGeolocalizacao();
};

window._initMapa = function (loc) {
  if (_mapa) return;

  const locValida = (l) => l && !isNaN(parseFloat(l.lat)) && !isNaN(parseFloat(l.lng));
  const locEfetiva = locValida(loc) ? loc : null;
  const centro = locEfetiva
    ? [+locEfetiva.lat, +locEfetiva.lng]
    : [-18.5, -45.5];
  const zoom = locEfetiva ? 13 : 6;
  _userLoc = locEfetiva;
  _esconderLoadingMapa();
  window._mapaAguardandoLoc = false;

 window._mapa = _mapa = L.map('mapa', {
    center: centro,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    renderer: L.canvas(),
  });

  _mapa.on('click', () => {
    _fecharCardMapa();
  });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  _carregarTiles(isDark);

  if (locEfetiva) _renderUserMarker(locEfetiva);
  if (window._bares?.length && window._locationState?.status === 'ready') {
    _renderMarcadores(window._bares);
  }

  const observer = new MutationObserver(() => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    _carregarTiles(dark);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!document.documentElement.getAttribute('data-theme')) _carregarTiles(e.matches);
  });
};

window._renderUserMarker = function (loc, localizando) {
  if (!_mapa) return;
  if (_userMarker) _mapa.removeLayer(_userMarker);
  const userIcon = L.divIcon({
    html: `<div class="user-pin ${localizando ? 'user-pin--localizando' : ''}">
      <div class="user-pin__dot"></div>
      <div class="user-pin__halo"></div>
      ${localizando ? '<div class="user-pin__ring"></div>' : ''}
    </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    className: '',
  });
  _userMarker = L.marker([loc.lat, loc.lng], { icon: userIcon, zIndexOffset: -100 }).addTo(_mapa);
}

window._centralizarUsuario = function () {
  const btn = document.getElementById('mapa-btn-localizar');
  if (btn) btn.classList.add('loading');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      _userLoc = loc;
      window._userLat = loc.lat;
      window._userLng = loc.lng;
      window._renderUserMarker(loc);
      _mapa.flyTo([loc.lat, loc.lng], 14, { animate: true, duration: 0.8 });
      if (btn) btn.classList.remove('loading');
    },
    () => { if (btn) btn.classList.remove('loading'); },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
};

window._filtrarMapa = function (filtro) {
  _filtroMapaAtivo = filtro;
  document.querySelectorAll('.mapa-filtros .filtro-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('mapa-filtro-' + filtro)?.classList.add('active');

  let bares = window._bares || [];
  if (filtro === 'abertos') {
    bares = bares.filter(b => {
      return window._barAbertoAgora?.(b) === true;
    });
  }
  _renderMarcadores(bares);
};

window._buscarMapa = function (query) {
  const clear = document.getElementById('mapa-busca-clear');
  if (clear) clear.classList.toggle('hidden', !query);

  const termo = (query || '').trim().toLowerCase();

  const bares = (window._bares || []).filter(bar => {
    if (!termo) return true;

    return (
      String(bar.nome || '').toLowerCase().includes(termo) ||
      String(bar.bairro || '').toLowerCase().includes(termo) ||
      String(bar.cidade || '').toLowerCase().includes(termo) ||
      String(bar.endereco || '').toLowerCase().includes(termo)
    );
  });
  _renderMarcadores(bares);
};

window._limparBuscaMapa = function () {
  const input = document.getElementById('mapa-busca-input');
  if (input) input.value = '';
  const clear = document.getElementById('mapa-busca-clear');
  if (clear) clear.classList.add('hidden');
  _renderMarcadores(window._bares || []);
};

function _carregarTiles(dark) {
  if (_mapa) {
    _mapa.eachLayer(layer => { if (layer instanceof L.TileLayer) _mapa.removeLayer(layer); });
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
    keepBuffer: 4,
    updateWhenIdle: false,
    updateWhenZooming: false,
  }).addTo(_mapa);
}

function _pinHtml(selecionado) {
  const cls = selecionado
    ? 'pin-amstel pin-amstel--sel'
    : 'pin-amstel';

  return `
    <div class="${cls}">
      <img
        src="/logos/Logo-256.png"
        alt=""
        draggable="false"
        onerror="this.style.display='none'"
      >
    </div>
  `;
}

function _criarIconePin(selecionado = false) {
  const tamanho = selecionado ? 50 : 40;

  return L.divIcon({
    html: _pinHtml(selecionado),
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    className: '',
  });
}

function _fecharCardMapa() {
  if (_barSelecionado && _barSelecionado._marker) {
    _barSelecionado._marker.setIcon(_criarIconePin(false));
    _barSelecionado._marker.setZIndexOffset(0);
  }

  _barSelecionado = null;
  window._barProximo = null;

  const card = document.getElementById('card-proximo');

  if (card) {
    card.classList.add('hidden');
    card.innerHTML = '';
  }
}

window._fecharCardMapa = _fecharCardMapa;

window._renderMarcadoresMapa = function (bares) {
  _renderMarcadores(bares);
};

function _renderMarcadores(bares) {
  if (!_mapa) return;

  _marcadores.forEach(marker => {
    try {
      _mapa.removeLayer(marker);
    } catch {}
  });

  _marcadores = [];
  _barSelecionado = null;
  window._barProximo = null;

  const card = document.getElementById('card-proximo');

  if (card) {
    card.classList.add('hidden');
    card.innerHTML = '';
  }

  bares = (bares || []).filter(bar =>
    bar.lat != null &&
    bar.lng != null &&
    !isNaN(parseFloat(bar.lat)) &&
    !isNaN(parseFloat(bar.lng))
  );

  bares.forEach(bar => {
    const marker = L.marker(
      [parseFloat(bar.lat), parseFloat(bar.lng)],
      {
        icon: _criarIconePin(false),
        zIndexOffset: 0,
      }
    );

    bar._marker = marker;

    marker.on('click', event => {
      if (event?.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
      }

      if (
        _barSelecionado &&
        _barSelecionado !== bar &&
        _barSelecionado._marker
      ) {
        _barSelecionado._marker.setIcon(_criarIconePin(false));
        _barSelecionado._marker.setZIndexOffset(0);
      }

      marker.setIcon(_criarIconePin(true));
      marker.setZIndexOffset(1000);

      _barSelecionado = bar;
      window._barProximo = bar;

      _mostrarCardBar(bar);
    });

    marker.addTo(_mapa);
    _marcadores.push(marker);
  });

  const temGPS =
    window._locationState?.status === 'ready' &&
    window._locationState?.coords;

  if (
    temGPS &&
    bares.length > 0 &&
    _mapa &&
    _marcadores.length > 0
  ) {
    try {
      const group = L.featureGroup(_marcadores);
      const bounds = group.getBounds();

      if (bounds.isValid()) {
        _mapa.fitBounds(bounds.pad(0.2), {
          maxZoom: 14,
          animate: true
        });
      }
    } catch (e) {
      console.warn('[mapa] fitBounds inválido:', e);
    }
  }
}

function _mostrarCardBar(bar) {
  _barSelecionado = bar;
  window._barProximo = bar;

  const card = document.getElementById('card-proximo');
  if (!card) return;

  const d = Number(bar.distancia_km);

  const distStr = Number.isFinite(d)
    ? `${d < 1
        ? Math.round(d * 1000) + ' m'
        : d.toFixed(1) + ' km'} · ${bar.bairro || ''}`
    : (bar.bairro || '');

 const statusHorario =
  typeof window._statusHorarioBar === 'function'
    ? window._statusHorarioBar(bar)
    : null;

let statusHtml = '';

if (statusHorario?.aberto === true) {
  statusHtml = `
    <div class="prox-status">
      ${statusHorario.texto}
    </div>
  `;
} else if (statusHorario?.aberto === false) {
  statusHtml = `
    <div class="prox-status prox-status--fechado">
      Fechado agora
    </div>
  `;
}

  const promoHtml = bar.campanha_ativa
    ? `
      <div class="prox-promo">
        ${bar.campanha_ativa.promocao}
      </div>
    `
    : '';

  const imgHtml = bar.foto_url
    ? `
      <img
        src="${bar.foto_url}"
        alt="${bar.nome || ''}"
        onerror="this.style.display='none'; this.parentElement.classList.add('card-proximo__img--fallback')"
      >
    `
    : `<img src="/logos/Logo-256.png" alt="Amstel">`;

  const nomeEscapado = String(bar.nome || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  card.innerHTML = `
    <div class="card-proximo__img">
      ${imgHtml}
    </div>

    <div class="card-proximo__info">
      <strong>${bar.nome || ''}</strong>
      <span>${distStr}</span>

      ${statusHtml}
      ${promoHtml}
    </div>

    <button
      class="btn-ver-rota"
      onclick="window._abrirSeletorRota(
        ${bar.lat},
        ${bar.lng},
        '${nomeEscapado}'
      )"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>

      Ver rota
    </button>
  `;

  card.classList.remove('hidden');
}

const _origCarregar = window._carregarBares;


window._carregarBares = async function () {
  const bares = await _origCarregar();
  if (_mapa) _renderMarcadores(bares);
  return bares;
};

window._onMapaAtivado = function () {
  if (_mapa) {
    setTimeout(() => {
      _mapa.invalidateSize();
    }, 100);
  }
};