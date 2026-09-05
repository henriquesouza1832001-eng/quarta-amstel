
let _mapa = null;
let _marcadores = [];

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
        box-shadow:0 0 0 4px rgba(74,144,226,0.3);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    });

    L.marker([loc.lat, loc.lng], { icon: userIcon })
      .addTo(_mapa)
      .bindPopup('Você está aqui');
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

  L.tileLayer(url, {
    maxZoom: 20,
    attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap',
  }).addTo(_mapa);
}

function _renderMarcadores(bares) {
  _marcadores.forEach(m => _mapa.removeLayer(m));
  _marcadores = [];

  const hoje = new Date().getDay(); // 3 = quarta
  let barMaisProximo = null;

  bares.forEach((bar, i) => {
    const temCampanha = !!bar.campanha_ativa;

    const pinIcon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;
        background:${temCampanha ? '#F5A623' : '#C8102E'};
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 10px rgba(${temCampanha ? '245,166,35' : '200,16,46'},0.5);
        cursor:pointer;
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: '',
    });

    const marker = L.marker([bar.lat, bar.lng], { icon: pinIcon });

    const distStr = bar.distancia_km != null
      ? bar.distancia_km < 1
        ? `${Math.round(bar.distancia_km * 1000)}m`
        : `${bar.distancia_km.toFixed(1)}km`
      : '';

    marker.bindPopup(`
      <div style="min-width:160px;padding:4px 0">
        <strong style="font-size:0.9rem">${bar.nome}</strong>
        <div style="font-size:0.75rem;color:#666;margin-top:2px">${bar.bairro}${distStr ? ` · ${distStr}` : ''}</div>
        ${temCampanha ? `<div style="font-size:0.75rem;color:#C8102E;font-weight:600;margin-top:4px">🍺 ${bar.campanha_ativa.promocao}</div>` : ''}
        <button onclick="window._verBar('${bar.id}')" style="
          margin-top:8px;padding:6px 14px;
          background:#C8102E;color:white;border:none;
          border-radius:20px;font-size:0.78rem;font-weight:600;
          cursor:pointer;width:100%;
        ">Ver detalhes</button>
      </div>
    `);

    marker.addTo(_mapa);
    _marcadores.push(marker);

    if (i === 0 && !barMaisProximo) {
      barMaisProximo = bar;
    }
  });

  if (barMaisProximo) {
    window._barProximo = barMaisProximo;
    _atualizarCardProximo(barMaisProximo);
  }

  if (bares.length > 0 && _mapa) {
    const group = L.featureGroup(_marcadores);
    _mapa.fitBounds(group.getBounds().pad(0.1), { maxZoom: 15 });
  }
}

function _atualizarCardProximo(bar) {
  const card = document.getElementById('card-proximo');
  if (!card) return;

  const hoje = new Date().getDay() === 3; // quarta

  const badge = document.getElementById('prox-badge');
  if (badge) badge.style.background = bar.campanha_ativa ? '#F5A623' : '#C8102E';

  const nome = document.getElementById('prox-nome');
  if (nome) nome.textContent = bar.nome;

  const dist = document.getElementById('prox-distancia');
  if (dist) {
    const d = bar.distancia_km;
    dist.textContent = d != null
      ? `${bar.bairro} · ${d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km'} de você`
      : bar.bairro;
  }

  const promo = document.getElementById('prox-promocao');
  if (promo) {
    promo.textContent = bar.campanha_ativa
      ? `🍺 ${bar.campanha_ativa.promocao}`
      : hoje ? 'Verifique as promoções de hoje' : '';
  }

  card.classList.remove('hidden');
}

const _origCarregar = window._carregarBares;
window._carregarBares = async function () {
  const bares = await _origCarregar();
  if (_mapa) _renderMarcadores(bares);
  return bares;
};
