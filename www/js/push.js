
const VAPID_PUBLIC_KEY = BEtCI3-OkWZ7H6yDuwQl9EWaCgvK-wygfkSXLmAUxUuKRnMJ7jSNw34ZDLCy-QxDHIOVNafd4JTpJaPYUiHUlhs

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

    await fetch(`${WORKER}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        lat: window._userLat ? Math.round(window._userLat * 100) / 100 : null,
        lng: window._userLng ? Math.round(window._userLng * 100) / 100 : null,
        cidade: 'Belo Horizonte',
        estado: 'MG',
      }),
    });

    console.log('[Push] Subscription salva com sucesso');
  } catch (e) {
    console.error('[Push] Erro:', e);
  }
};

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
