const MGL = 'https://mgl-api.henriquesouza.workers.dev';
const APP = 'https://quarta-amstel.pages.dev';
const SID = 'amstel';

export async function onRequest(context) {
  const ip = context.request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
  const ipKey = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;

  try {
    const resp = await fetch(`${MGL}/x/chk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: ipKey, sid: SID }),
    });

    const data = await resp.json();

    if (!data.ok) {
      return Response.redirect(`${APP}/`, 302);
    }

    return context.next();
  } catch {
    return Response.redirect(`${APP}/`, 302);
  }
}