// This release gate closes ingress before any legacy or V111 writer is selected.
export function heldForV111Cutover(env) {
  const phase = env.UAA_V111_CUTOVER;
  if (phase === undefined) return env.UAA_V2_ENABLED === '1';
  return phase !== 'active' || env.UAA_V2_ENABLED !== '1';
}

// Only established signed operations can reach an owning service while held.
// Each receiver checks the canonical origin, peer key, payload and nonce.
export function offlineSecurityRequest(request, env, app) {
  if (env.UAA_V111_CUTOVER !== 'held' || env.UAA_V2_ENABLED !== '1') return false;
  if (request.method !== 'POST' || request.headers.has('Origin') || request.headers.has('Cookie')) return false;
  const url = new URL(request.url);
  if (url.search) return false;
  // The owning authority handler authenticates Academy and checks the exact
  // held generation before accepting a first Studio permission snapshot.
  if (app === 'studio' && url.pathname === '/internal/academy/source-authority/v2') {
    return request.headers.has('X-UAA-Authority-Key');
  }
  if (!request.headers.has('X-UAA-Service-Key')) return false;
  if (app === 'academy') return url.pathname === '/internal/auth/v2/reconcile';
  return ['studio', 'hifz'].includes(app) && url.pathname === '/internal/auth/v2/events';
}

export function cutoverUnavailable() {
  return Response.json({
    success: false,
    code: 'V111_CUTOVER_HOLD',
    error: 'The app is temporarily unavailable during an update.',
  }, {
    status: 503,
    headers: {'Cache-Control': 'no-store', 'Retry-After': '60'},
  });
}

export function requireV111CutoverOpen(env) {
  if (heldForV111Cutover(env)) {
    throw Object.assign(Error('The app is temporarily unavailable during an update.'), {
      status: 503, code: 'V111_CUTOVER_HOLD',
    });
  }
}
