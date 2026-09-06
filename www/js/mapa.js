let _mapa = null;
let _marcadores = [];
let _barSelecionado = null;

window._initMapa = function (loc) {
  const centro = loc ? [loc.lat, loc.lng] : [-19.9167, -43.9345];

  _mapa = L.map('mapa', {
    center: centro,
    zoom: 13,
    zoomControl: false,
    attributionControl: false,
  });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  _carregarTiles(isDark);

  if (loc) {
    const userIcon = L.divIcon({
      html: `<div style="
        width:14px;height:14px;
        background:#4A90E2;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 0 8px rgba(74,144,226,0.2);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    });
    L.marker([loc.lat, loc.lng], { icon: userIcon }).addTo(_mapa);
  }

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

function _carregarTiles(dark) {
  if (_mapa) {
    _mapa.eachLayer(layer => { if (layer instanceof L.TileLayer) _mapa.removeLayer(layer); });
  }

  const url = dark
    ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
    : 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

  L.tileLayer(url, { maxZoom: 20 }).addTo(_mapa);
}

function _renderMarcadores(bares) {
  _marcadores.forEach(m => _mapa.removeLayer(m));
  _marcadores = [];

  bares.forEach((bar, i) => {
    const pinIcon = L.divIcon({
      html: `<div style="
        width:42px;height:42px;
        background:#C8102E;
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 12px rgba(200,16,46,0.5);
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        overflow:hidden;
      ">
        <img src="/logos/Logo-256.png" style="
          width:30px;height:30px;
          object-fit:contain;
          transform:rotate(45deg);
          border-radius:50%;
        " onerror="this.style.display='none'">
      </div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -42],
      className: '',
    });

    const marker = L.marker([bar.lat, bar.lng], { icon: pinIcon });

    marker.on('click', () => {
      _mostrarCardBar(bar);
    });

    marker.addTo(_mapa);
    _marcadores.push(marker);

    if (i === 0) {
      _mostrarCardBar(bar);
    }
  });

  if (bares.length > 0 && _mapa) {
    const group = L.featureGroup(_marcadores);
    _mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
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