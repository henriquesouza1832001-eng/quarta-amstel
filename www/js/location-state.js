window._locationState = {
  status: 'idle',   
  coords: null,
  startedAt: null,
  error: null,
};

window._locationStateListeners = [];

window._onLocationState = function (fn) {
  window._locationStateListeners.push(fn);
};

function _emitLocationState() {
  window._locationStateListeners.forEach(fn => {
    try { fn(window._locationState); } catch {}
  });
}

window._iniciarGeolocalizacao = function () {
  const state = window._locationState;
  if (state.status === 'ready' && state.coords) return;
  if (state.status === 'locating') return;

  if (!navigator.geolocation) {
    state.status = 'error';
    state.error = 'unsupported';
    _emitLocationState();
    return;
  }

  state.status = 'locating';
  state.startedAt = Date.now();
  state.error = null;
  _emitLocationState();

  navigator.geolocation.getCurrentPosition(
    pos => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      state.status = 'ready';
      state.coords = coords;
      state.error = null;
      try {
        localStorage.setItem('amstel_loc', JSON.stringify({
          lat: coords.lat, lng: coords.lng, ts: Date.now()
        }));
      } catch {}
      window._userLat = coords.lat;
      window._userLng = coords.lng;
      window._userLoc = coords;

      _emitLocationState();
    },
    err => {
      if (err.code === 1) {
        state.status = 'denied';
      } else {
        state.status = 'error';
      }
      state.error = err.code;
      _emitLocationState();
    },
    { timeout: 10000, maximumAge: 60000 }
  );
};

window._resetGeolocalizacao = function () {
  window._locationState.status = 'idle';
  window._locationState.coords = null;
  window._locationState.startedAt = null;
  window._locationState.error = null;
  _emitLocationState();
};
(function () {
  try {
    const raw = localStorage.getItem('amstel_loc');
    if (!raw) return;
    const s = JSON.parse(raw);
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
    if (!s.lat || !s.lng || isNaN(s.lat) || isNaN(s.lng)) return;
    if (Date.now() - s.ts > MAX_AGE) return;
    window._locSalvaRecente = { lat: s.lat, lng: s.lng };
    window._userLat = s.lat;
    window._userLng = s.lng;
    window._userLoc = window._locSalvaRecente;
  } catch {}
})();