window._baresOriginais = [];
window._filtroAtivo = 'proximos';

window._renderLista = function (bares, estado) {
  window._baresOriginais = bares || [];
  const lista = document.getElementById('lista-bares');
  if (!lista) return;

  if (estado === 'loading') {
    lista.innerHTML = _estadoHtml('loading');
    document.querySelector('.filtros-row')?.classList.add('hidden');
    document.querySelector('.busca-lista-wrap')?.classList.add('hidden');
    return;
  }
  document.querySelector('.filtros-row')?.classList.remove('hidden');
  document.querySelector('.busca-lista-wrap')?.classList.remove('hidden');

  if (estado === 'erro') {
    lista.innerHTML = _estadoHtml('erro');
    return;
  }

  if (estado === 'sem-internet') {
    lista.innerHTML = _estadoHtml('sem-internet');
    return;
  }

  if (estado === 'localizacao-negada') {
    lista.innerHTML = _estadoHtml('localizacao-negada');
    return;
  }

  if (!bares || !bares.length) {
    lista.innerHTML = _estadoHtml('vazio');
    return;
  }

  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
};

function _estadoHtml(tipo) {
  const ir = `<button class="estado-btn-sec" onclick="window._mudarTab('mapa')">Ver no mapa</button>`;

  const estados = {
    loading: `<div class="skeleton-list">
      ${[1,2,3,4].map(() => `
        <div class="skeleton-card">
          <div class="skeleton-img"></div>
          <div class="skeleton-body">
            <div class="skeleton-line skeleton-line--title"></div>
            <div class="skeleton-line skeleton-line--sub"></div>
            <div class="skeleton-line skeleton-line--tag"></div>
          </div>
        </div>
      `).join('')}
    </div>`,

    vazio: `<div class="estado-wrap">
      <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="32" cy="32" r="28"/>
        <path d="M22 32h20M32 22v20" opacity=".3"/>
        <path d="M20 44 Q32 20 44 44" stroke-width="2"/>
      </svg>
      <p class="estado-titulo">Ainda não encontramos um Amstel por aqui.</p>
      <p class="estado-txt">Confira sua localização ou veja no mapa os bares participantes.</p>
      ${ir}
    </div>`,

    erro: `<div class="estado-wrap">
      <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="32" cy="32" r="28"/>
        <path d="M32 20v16M32 42v2" stroke-width="2.5"/>
      </svg>
      <p class="estado-titulo">Algo deu errado.</p>
      <p class="estado-txt">Não conseguimos carregar os bares. Tente novamente.</p>
      <button class="estado-btn-pri" onclick="window._carregarBares().then(b=>window._renderLista(b))">Tentar novamente</button>
    </div>`,

    'sem-internet': `<div class="estado-wrap">
      <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M8 8l48 48M20 44a17 17 0 0 1 24-24M32 56a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke-width="2"/>
      </svg>
      <p class="estado-titulo">Sem conexão.</p>
      <p class="estado-txt">Verifique sua internet e tente novamente.</p>
      <button class="estado-btn-pri" onclick="window._carregarBares().then(b=>window._renderLista(b))">Tentar novamente</button>
    </div>`,

    'localizacao-negada': `<div class="estado-wrap">
      <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M32 8C21 8 12 17 12 28c0 16 20 28 20 28s20-12 20-28C52 17 43 8 32 8z" stroke-width="2"/>
        <circle cx="32" cy="28" r="6" stroke-width="2"/>
        <path d="M16 16l32 32" stroke-width="2" stroke="var(--amstel-red)"/>
      </svg>
      <p class="estado-titulo">Localização não disponível.</p>
      <p class="estado-txt">Permita o acesso à sua localização para encontrar bares próximos.</p>
      ${ir}
    </div>`,

    'sem-abertos': `<div class="estado-wrap">
      <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="32" cy="32" r="28" stroke-width="2"/>
        <path d="M32 18v14l8 8" stroke-width="2.5"/>
      </svg>
      <p class="estado-titulo">Nenhum bar aberto agora.</p>
      <p class="estado-txt">Volte mais tarde ou veja todos os bares participantes.</p>
      <button class="estado-btn-sec" onclick="window._filtrar('proximos')">Ver todos os bares</button>
    </div>`,
  };

  return estados[tipo] || estados.vazio;
}

function _renderCardBar(bar) {
  const distStr = bar.distancia_km != null
    ? bar.distancia_km < 1
      ? `${Math.round(bar.distancia_km * 1000)} m · ${bar.bairro}`
      : `${bar.distancia_km.toFixed(1)} km · ${bar.bairro}`
    : bar.bairro;

  const statusHorario =
  typeof window._statusHorarioBar === 'function'
    ? window._statusHorarioBar(bar)
    : null;

let statusHtml = '';

if (statusHorario?.aberto === true) {
  statusHtml = `
    <div class="bar-card__status">
      ${statusHorario.texto}
    </div>`;
} else if (statusHorario?.aberto === false) {
  statusHtml = `
    <div class="bar-card__status bar-card__status--fechado">
      Fechado agora
    </div>`;
}

  const campanhaHtml = bar.campanha_ativa
    ? `<div class="bar-card__campanha">
        <svg class="bar-card__campanha-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 3h14v4l-2 10H7L5 7V3z M9 3v4 M15 3v4"/>
        </svg>
        ${bar.campanha_ativa.promocao}
      </div>`
    : '';

  const imgHtml = bar.foto_url
    ? `<img src="${bar.foto_url}" alt="${bar.nome}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.onerror=null;this.src='/logos/Logo-256.png';this.classList.add('bar-card__img--fallback')">`
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
        <button class="bar-card__fav" onclick="event.stopPropagation(); this.classList.add('animating'); this.classList.toggle('active'); setTimeout(()=>this.classList.remove('animating'),220)" aria-label="Favoritar">
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

window._filtrar = function (filtro) {
  window._filtroAtivo = filtro;
  document.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('filtro-' + filtro)?.classList.add('active');

  let bares = window._baresOriginais || [];

  if (filtro === 'abertos') {
    bares = bares.filter(b => {
      return window._barAbertoAgora?.(b) === true;
    });

    if (!bares.length) {
      document.getElementById('lista-bares').innerHTML = _estadoHtml('sem-abertos');
      return;
    }
  }

  

  const lista = document.getElementById('lista-bares');
  if (!lista) return;
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

  const termo = (query || '').trim().toLowerCase();

  if (termo.length < 2) {
    window._filtrar(_filtroAtivo);
    return;
  }

  let bares = (window._baresOriginais || []).filter(bar => {
  const nome = String(bar.nome || '').toLowerCase();
  const bairro = String(bar.bairro || '').toLowerCase();
  const cidade = String(bar.cidade || '').toLowerCase();
  const endereco = String(bar.endereco || '').toLowerCase();

  return (
    nome.includes(termo) ||
    bairro.includes(termo) ||
    cidade.includes(termo) ||
    endereco.includes(termo)
  );
});
if (window._filtroAtivo === 'abertos') {
  bares = bares.filter(bar =>
    window._barAbertoAgora?.(bar) === true
  );
}

  if (!bares.length) {
    lista.innerHTML = `
      <div class="estado-wrap">
        <svg class="estado-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="28" cy="28" r="18" stroke-width="2"/>
          <path d="M40 40l12 12" stroke-width="2.5"/>
        </svg>

        <p class="estado-titulo">Não encontramos esse bar.</p>

        <p class="estado-txt">
          Procure pelo nome, bairro ou região entre os bares próximos de você.
        </p>

        <button
          class="estado-btn-pri"
          onclick="document.getElementById('busca-input').value=''; window._filtrar(window._filtroAtivo)"
        >
          Limpar busca
        </button>
      </div>
    `;
    return;
  }

  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
}