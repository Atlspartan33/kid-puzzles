// IndexedDB storage for pictures added from the device. Nothing leaves the tablet.
const DB = 'kid-puzzles', STORE = 'photos';
let dbp = null;

function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Storage is full'));
  }));
}

export const listPhotos = () => tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => y.created - x.created));
export const addPhoto = rec => tx('readwrite', s => s.put(rec));
export const deletePhoto = id => tx('readwrite', s => s.delete(id));

// Decode, fix orientation, keep a sane aspect (no panoramas), shrink to 2048px, make a thumb.
export async function processImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
  const maxA = 1.6, minA = 0.625;
  if (sw / sh > maxA) { const nw = sh * maxA; sx = (sw - nw) / 2; sw = nw; }
  if (sw / sh < minA) { const nh = sw / minA; sy = (sh - nh) / 2; sh = nh; }
  const toBlob = (max, q) => {
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode failed')), 'image/jpeg', q));
  };
  const [blob, thumb] = await Promise.all([toBlob(2048, 0.88), toBlob(480, 0.8)]);
  bmp.close?.();
  return { id: 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob, thumb, created: Date.now() };
}
