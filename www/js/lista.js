
window._renderLista = function (bares) {
  const lista = document.getElementById('lista-bares');
  const total = document.getElementById('descobrir-total');

  if (!lista) return;

  if (!bares || !bares.length) {
    lista.innerHTML = `<div class="loading" style="padding-top:60px">Nenhum bar encontrado na sua região.</div>`;
    if (total) total.textContent = '';
    return;
  }

  if (total) total.textContent = `${bares.length} bares`;

  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
};

function _renderCardBar(bar) {
  const distStr = bar.distancia_km != null
    ? bar.distancia_km < 1
      ? `${Math.round(bar.distancia_km * 1000)} m · ${bar.bairro}`
      : `${bar.distancia_km.toFixed(1)} km · ${bar.bairro}`
    : bar.bairro;

  const campanhaHtml = bar.campanha_ativa
    ? `<div class="bar-card__campanha">🍺 ${bar.campanha_ativa.promocao}</div>`
    : '';

  const statusHtml = bar.horario
    ? `<div class="bar-card__status">Aberto · ${bar.horario}</div>`
    : '';

  return `
    <div class="bar-card" onclick="window._verBar('${bar.id}')">
      <div class="bar-card__img">🍺</div>
      <div class="bar-card__body">
        <div class="bar-card__nome">${bar.nome}</div>
        <div class="bar-card__endereco">${distStr}</div>
        ${statusHtml}
        ${campanhaHtml}
      </div>
      <div class="bar-card__actions">
        <button class="bar-card__fav" onclick="event.stopPropagation()">♡</button>
        <svg class="bar-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  `;
}

let _filtroAtivo = 'proximos';

window._filtrar = function(filtro) {
  _filtroAtivo = filtro;
  document.querySelectorAll('.filtro-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('filtro-' + filtro)?.classList.add('active');

  let bares = window._bares || [];

  if (filtro === 'abertos') {
    bares = bares.filter(b => b.horario);
  }

  _renderListaFiltrada(bares);
};

function _renderListaFiltrada(bares) {
  const lista = document.getElementById('lista-bares');
  if (!lista) return;
  if (!bares.length) {
    lista.innerHTML = `<div class="loading" style="padding-top:40px">Nenhum bar encontrado.</div>`;
    return;
  }
  lista.innerHTML = bares.map(bar => _renderCardBar(bar)).join('');
}

function _emojiBar(nome) {
  const n = nome.toLowerCase();
  if (n.includes('butec') || n.includes('bar')) return '🍺';
  if (n.includes('pizz')) return '🍕';
  if (n.includes('chur')) return '🥩';
  if (n.includes('petr')) return '⛽';
  if (n.includes('rest')) return '🍽️';
  if (n.includes('pub') || n.includes('botequi')) return '🍻';
  return '🍺';
}

let _buscaTimeout = null;

window._buscar = function (query) {
  const clear = document.getElementById('busca-clear');
  if (clear) clear.classList.toggle('hidden', !query);

  clearTimeout(_buscaTimeout);
  _buscaTimeout = setTimeout(() => _executarBusca(query), 300);
};

async function _executarBusca(query) {
  const lista = document.getElementById('lista-busca');
  if (!lista) return;

  if (!query || query.trim().length < 2) {
    lista.innerHTML = `<div class="busca-empty">Digite para buscar um bar</div>`;
    return;
  }

  lista.innerHTML = `<div class="loading"></div>`;

  try {
    const params = new URLSearchParams({ search: query.trim() });
    if (window._userLat) params.set('lat', window._userLat);
    if (window._userLng) params.set('lng', window._userLng);

    const resp = await fetch(`${WORKER}/bares?${params}`);
    const data = await resp.json();

    if (!data.ok || !data.bares?.length) {
      lista.innerHTML = `<div class="busca-empty">Nenhum bar encontrado para "${query}"</div>`;
      return;
    }

    data.bares.forEach(b => {
      if (!window._bares.find(x => x.id === b.id)) window._bares.push(b);
      else {
        const idx = window._bares.findIndex(x => x.id === b.id);
        window._bares[idx] = b;
      }
    });

    lista.innerHTML = data.bares.map(bar => _renderCardBar(bar)).join('');
  } catch (e) {
    lista.innerHTML = `<div class="busca-empty">Erro ao buscar. Verifique sua conexão.</div>`;
  }
}

window._limparBusca = function () {
  const input = document.getElementById('busca-input');
  if (input) { input.value = ''; input.focus(); }
  const clear = document.getElementById('busca-clear');
  if (clear) clear.classList.add('hidden');
  const lista = document.getElementById('lista-busca');
  if (lista) lista.innerHTML = `<div class="busca-empty">Digite para buscar um bar</div>`;
};
