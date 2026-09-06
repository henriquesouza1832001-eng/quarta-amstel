window._baresOriginais = [];

window._renderLista = function (bares) {
  window._baresOriginais = bares || [];
  const lista = document.getElementById('lista-bares');
  if (!lista) return;

  if (!bares || !bares.length) {
    lista.innerHTML = '<div class="loading" style="padding-top:60px">Nenhum bar encontrado na sua região.</div>';
    return;
  }

  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
};

function _renderCardBar(bar) {
  const distStr = bar.distancia_km != null
    ? bar.distancia_km < 1
      ? `${Math.round(bar.distancia_km * 1000)} m · ${bar.bairro}`
      : `${bar.distancia_km.toFixed(1)} km · ${bar.bairro}`
    : bar.bairro;

  const statusHtml = bar.horario
    ? `<div class="bar-card__status">Aberto · ${bar.horario}</div>`
    : '';

  const campanhaHtml = bar.campanha_ativa
    ? `<div class="bar-card__campanha">
        <svg class="bar-card__campanha-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 3h14v4l-2 10H7L5 7V3z M9 3v4 M15 3v4"/>
        </svg>
        ${bar.campanha_ativa.promocao}
      </div>`
    : '';

  const imgHtml = bar.foto_url
    ? `<img src="${bar.foto_url}" alt="${bar.nome}" loading="lazy" onerror="this.outerHTML='<div class=\\'bar-card__placeholder\\'></div>'">`
    : `<div class="bar-card__placeholder"></div>`;

  return `
    <div class="bar-card" onclick="window._verBar('${bar.id}')">
      <div class="bar-card__img">${imgHtml}</div>
      <div class="bar-card__body">
        <div class="bar-card__nome">${bar.nome}</div>
        <div class="bar-card__endereco">${distStr}</div>
        ${statusHtml}
        ${campanhaHtml}
      </div>
      <div class="bar-card__actions">
        <button class="bar-card__fav" onclick="event.stopPropagation(); this.classList.toggle('active')" aria-label="Favoritar">
          <svg class="fav-icon-empty" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <svg class="fav-icon-filled" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <svg class="bar-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  `;
}

let _filtroAtivo = 'proximos';

window._filtrar = function (filtro) {
  _filtroAtivo = filtro;
  document.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('filtro-' + filtro)?.classList.add('active');

  let bares = window._baresOriginais || [];

  if (filtro === 'abertos') {
    bares = bares.filter(b => b.horario);
  }

  const lista = document.getElementById('lista-bares');
  if (!lista) return;
  if (!bares.length) {
    lista.innerHTML = '<div class="loading" style="padding-top:40px">Nenhum bar encontrado.</div>';
    return;
  }
  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
};

let _buscaTimeout = null;

window._buscar = function (query) {
  clearTimeout(_buscaTimeout);
  _buscaTimeout = setTimeout(() => _executarBusca(query), 300);
};

async function _executarBusca(query) {
  const lista = document.getElementById('lista-bares');
  if (!lista) return;

  if (!query || query.trim().length < 2) {
    window._filtrar(_filtroAtivo);
    return;
  }

  const local = (window._baresOriginais || []).filter(b =>
    b.nome.toLowerCase().includes(query.toLowerCase()) ||
    b.bairro.toLowerCase().includes(query.toLowerCase())
  );

  if (local.length) {
    lista.innerHTML = local.map(bar => _renderCardBar(bar)).join('');
    return;
  }

  lista.innerHTML = '<div class="loading"></div>';

  try {
    const params = new URLSearchParams({ search: query.trim() });
    if (window._userLat) params.set('lat', window._userLat);
    if (window._userLng) params.set('lng', window._userLng);

    const resp = await fetch(`${WORKER}/bares?${params}`);
    const data = await resp.json();

    if (!data.ok || !data.bares?.length) {
      lista.innerHTML = `<div class="loading" style="padding-top:40px">Nenhum bar encontrado para "${query}"</div>`;
      return;
    }

    data.bares.forEach(b => {
      if (!window._bares.find(x => x.id === b.id)) window._bares.push(b);
    });

    lista.innerHTML = data.bares.map(bar => _renderCardBar(bar)).join('');
  } catch {
    lista.innerHTML = '<div class="loading" style="padding-top:40px">Erro ao buscar. Verifique sua conexão.</div>';
  }
}