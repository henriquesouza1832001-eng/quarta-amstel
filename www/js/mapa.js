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

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  _carregarTiles(isDark);

  if (locEfetiva) _renderUserMarker(locEfetiva);

  _renderMarcadores(window._bares || []);

  const observer = new MutationObserver(() => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    _carregarTiles(dark);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!document.documentElement.getAttribute('data-theme')) _carregarTiles(e.matches);
  });
};

window._renderUserMarker = function (loc) {
  if (!_mapa) return;
  if (_userMarker) _mapa.removeLayer(_userMarker);
  const userIcon = L.divIcon({
    html: `<div class="user-pin">
      <div class="user-pin__dot"></div>
      <div class="user-pin__halo"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
    { timeout: 6000, maximumAge: 30000 }
  );
};

window._filtrarMapa = function (filtro) {
  _filtroMapaAtivo = filtro;
  document.querySelectorAll('.mapa-filtros .filtro-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('mapa-filtro-' + filtro)?.classList.add('active');

  let bares = window._bares || [];
  if (filtro === 'abertos') bares = bares.filter(b => b.horario);
  if (filtro === 'promocao') bares = bares.filter(b => b.campanha_ativa);
  _renderMarcadores(bares);
};

window._buscarMapa = function (query) {
  const clear = document.getElementById('mapa-busca-clear');
  if (clear) clear.classList.toggle('hidden', !query);

  const bares = (window._bares || []).filter(b =>
    !query || b.nome.toLowerCase().includes(query.toLowerCase()) ||
    b.bairro.toLowerCase().includes(query.toLowerCase())
  );
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
  const cls = selecionado ? 'pin-amstel pin-amstel--sel' : 'pin-amstel';
  return `<div class="${cls}">
    <img src="/logos/Logo-256.png" style="width:24px;height:24px;object-fit:contain;transform:rotate(45deg);border-radius:50%;" onerror="this.style.display='none'">
  </div>`;
}

window._renderMarcadoresMapa = function(bares) { _renderMarcadores(bares); };

function _renderMarcadores(bares) {
  _marcadores.forEach(m => _mapa.removeLayer(m));
  _marcadores = [];

  const card = document.getElementById('card-proximo');
  if (card && !bares.length) card.classList.add('hidden');

  bares = bares.filter(b => b.lat != null && b.lng != null && !isNaN(b.lat) && !isNaN(b.lng));

  bares.forEach((bar, i) => {
    const isSel = i === 0;
    const marker = L.marker([bar.lat, bar.lng], {
      icon: L.divIcon({
        html: _pinHtml(isSel),
        iconSize: isSel ? [44, 54] : [36, 44],
        iconAnchor: isSel ? [22, 54] : [18, 44],
        className: '',
      }),
      zIndexOffset: isSel ? 1000 : 0,
    });

    marker.on('click', () => {
      if (_barSelecionado && _barSelecionado._marker) {
        _barSelecionado._marker.setIcon(L.divIcon({
          html: _pinHtml(false),
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          className: '',
        }));
        _barSelecionado._marker.setZIndexOffset(0);
      }
      marker.setIcon(L.divIcon({
        html: _pinHtml(true),
        iconSize: [44, 54],
        iconAnchor: [22, 54],
        className: '',
      }));
      marker.setZIndexOffset(1000);
      bar._marker = marker;
      _barSelecionado = bar;
      _mostrarCardBar(bar);
    });

    bar._marker = marker;
    if (isSel) {
      bar._marker = marker;
      _barSelecionado = bar;
    }

    marker.addTo(_mapa);
    _marcadores.push(marker);

    if (isSel) _mostrarCardBar(bar);
  });

  if (bares.length > 0 && _mapa && _marcadores.length > 0) {
    try {
      const group = L.featureGroup(_marcadores);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        _mapa.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
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

  const d = bar.distancia_km;
  const distStr = d != null
    ? `${d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km'} · ${bar.bairro}`
    : bar.bairro;

  const statusHtml = bar.horario
    ? `<div class="prox-status">Aberto · ${bar.horario}</div>`
    : '';

  const promoHtml = bar.campanha_ativa
    ? `<div class="prox-promo">🍺 ${bar.campanha_ativa.promocao}</div>`
    : '';

  const imgHtml = bar.foto_url
    ? `<img src="${bar.foto_url}" alt="${bar.nome}" onerror="this.parentElement.innerHTML='🍺'">`
    : '🍺';

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}`;

  card.innerHTML = `
    <div class="card-proximo__img">${imgHtml}</div>
    <div class="card-proximo__info">
      <strong>${bar.nome}</strong>
      <span>${distStr}</span>
      ${statusHtml}
      ${promoHtml}
    </div>
    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-ver-rota">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
      Ver rota
    </a>
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