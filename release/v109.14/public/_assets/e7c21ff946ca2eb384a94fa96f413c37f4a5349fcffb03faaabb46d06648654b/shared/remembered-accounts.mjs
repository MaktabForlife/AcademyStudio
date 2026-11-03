// Reused bounded remembered-ID helpers from the Academy account switcher.
// Remembered IDs are display hints only. Every account switch uses server PIN verification.
export const rememberedKey = base => 'm4l_circles_remembered_ids_v1:' + encodeURIComponent(String(base || '').replace(/\/$/, ''));
const validId = id => typeof id === 'string' && /^[A-Za-z0-9._~-]{1,128}$/.test(id);

export function readRemembered(storage, base) {
  try {
    const raw = storage.getItem(rememberedKey(base)) || '[]';
    if (raw.length > 65536) return [];
    const rows = JSON.parse(raw), seen = new Set();
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => validId(row?.id) && Number.isFinite(row.lastUsed) && row.lastUsed >= 0)
      .sort((a, b) => b.lastUsed - a.lastUsed).filter(row => {
        const id = row.id.toUpperCase();
        if (seen.has(id)) return false;
        seen.add(id); return true;
      }).slice(0, 10).map(row => ({ id: row.id, name: String(row.name || '').slice(0, 128), lastUsed: row.lastUsed }));
  } catch { return []; }
}

export function forgetRemembered(storage, base, id) {
  try {
    if (!id) storage.removeItem(rememberedKey(base));
    else storage.setItem(rememberedKey(base), JSON.stringify(readRemembered(storage, base).filter(row => row.id.toUpperCase() !== id.toUpperCase())));
    return true;
  } catch { return false; }
}

export function rememberVerified(storage, base, account, now = Date.now()) {
  const id = String(account?.uniqueid || '').trim();
  if (!validId(id)) return false;
  const row = { id, name: String(account.displayName || '').trim().slice(0, 128), lastUsed: now };
  try {
    storage.setItem(rememberedKey(base), JSON.stringify([row, ...readRemembered(storage, base).filter(saved => saved.id.toUpperCase() !== id.toUpperCase())].slice(0, 10)));
    return true;
  } catch { return false; }
}

