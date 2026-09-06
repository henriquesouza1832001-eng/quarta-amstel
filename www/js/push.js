const VAPID_PUBLIC_KEY = 'BCEdJk_Afou5krlxgsxiUDrz4jw3mB1iy7PxKTvnavzn0awOhugF9m-HAJm1f2RWyXkuhtdB1kReM1tsG1hmyoE';

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function _resolverCidadeEstado() {
  if (!window._userLat || !window._userLng) return;
  if (window._pushCidade) return; // já resolveu
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${window._userLat}&lon=${window._userLng}&format=json&accept-language=pt-BR`,
      { headers: { 'User-Agent': 'QuartaAmstel/1.0' } }
    );
    const data = await resp.json();
    window._pushCidade = data.address?.city || data.address?.town || data.address?.municipality || null;
    window._pushEstado = data.address?.state_code || data.address?.state || null;
    const estados = {
      'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA',
      'Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO',
      'Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS',
      'Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR',
      'Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ',
      'Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO',
      'Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE',
      'Tocantins':'TO'
    };
    if (window._pushEstado && estados[window._pushEstado]) {
      window._pushEstado = estados[window._pushEstado];
    }
  } catch {}
}

window._solicitarPush = async function (swReg) {
  if (!('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return;

    let sub = await swReg.pushManager.getSubscription();



    if (!sub) {
      sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON();

    await _resolverCidadeEstado();

    const endpointSalvo = localStorage.getItem('amstel_push_endpoint');
    if (endpointSalvo === subJson.endpoint) {
      console.log('[Push] Subscription já registrada, skip.');
      return;
    }
    const resp = await fetch(`${WORKER}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        lat: window._userLat ? Math.round(window._userLat * 100) / 100 : null,
        lng: window._userLng ? Math.round(window._userLng * 100) / 100 : null,
        cidade: window._pushCidade || null,
        estado: window._pushEstado || null,
      }),
    });

    if (resp.ok) {
      localStorage.setItem('amstel_push_endpoint', subJson.endpoint);
      console.log('[Push] Subscription salva:', subJson.endpoint.slice(0, 60));
    } else if (resp.status === 429) {
      console.warn('[Push] Rate limit atingido — subscription já existe no servidor.');
    }
  } catch (e) {
    console.error('[Push] Erro:', e);
  }
};