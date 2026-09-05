// ── iOS Install Banner ──
// Detecta iOS + Safari fora do modo standalone e exibe banner

(function () {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const isDismissed = localStorage.getItem('ios_banner_dismissed');

  if (!isIos || isStandalone || isDismissed) return;

  // Aguarda o app carregar
  window.addEventListener('load', function () {
    setTimeout(showIosBanner, 2000);
  });

  function showIosBanner() {
    if (document.getElementById('ios-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.innerHTML = `
      <div class="ios-banner__header">
        <img src="/logos/Logo-256.png" alt="Amstel" class="ios-banner__logo" onerror="this.style.display='none'">
        <div class="ios-banner__title">
          Instale o app para receber notificações
          <small>Adicione à tela inicial do iPhone gratuitamente</small>
        </div>
        <button class="ios-banner__close" onclick="window._fecharIosBanner()" aria-label="Fechar">✕</button>
      </div>
      <div class="ios-banner__steps">
        <div class="ios-banner__step">
          <div class="ios-banner__step-num">1</div>
          <span class="ios-banner__step-icon">⬆️</span>
          <span>Toque em <strong>Compartilhar</strong> na barra do Safari</span>
        </div>
        <div class="ios-banner__step">
          <div class="ios-banner__step-num">2</div>
          <span class="ios-banner__step-icon">➕</span>
          <span>Selecione <strong>"Adicionar à Tela de Início"</strong></span>
        </div>
        <div class="ios-banner__step">
          <div class="ios-banner__step-num">3</div>
          <span class="ios-banner__step-icon">🍺</span>
          <span>Abra o app pela tela inicial e aceite as <strong>notificações</strong></span>
        </div>
      </div>
      <div class="ios-banner__arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8102E" stroke-width="2.5" stroke-linecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    `;

    document.body.appendChild(banner);
  }

  window._fecharIosBanner = function () {
    const banner = document.getElementById('ios-install-banner');
    if (banner) {
      banner.style.transform = 'translateY(100%)';
      banner.style.opacity = '0';
      banner.style.transition = 'all 0.3s ease';
      setTimeout(() => banner.remove(), 300);
    }
    localStorage.setItem('ios_banner_dismissed', '1');
  };
})();