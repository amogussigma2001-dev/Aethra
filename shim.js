// Хранилище Aethra: на этом телефоне (по умолчанию) или общее через Firebase Realtime Database.
(function () {
  var CFG = window.AETHRA_CONFIG || {};
  var URL_ = (CFG.FIREBASE_URL || '').replace(/\/+$/, '');
  var key = function (p) { return p.replace(/\//g, '~'); };
  var safe = function (v) { try { return typeof v === 'string' ? JSON.parse(v) : (v || {}); } catch (e) { return {}; } };

  // ---------- хранилище на телефоне ----------
  var local = (function () {
    var L = {}, W = {};
    var ld = function (k) {
      if (!L[k]) { try { L[k] = JSON.parse(localStorage.getItem('ae:' + k) || '{}'); } catch (e) { L[k] = {}; } }
      return L[k];
    };
    var sv = function (k) { localStorage.setItem('ae:' + k, JSON.stringify(L[k])); };
    var fire = function (k) { (W[k] || []).forEach(function (f) { f(Object.assign({}, ld(k))); }); };
    return {
      get: async function (k, id) { var v = ld(k)[id]; return v === undefined ? null : v; },
      list: async function (k) { return Object.assign({}, ld(k)); },
      put: async function (k, id, v) { ld(k)[id] = v; sv(k); fire(k); },
      del: async function (k, id) { delete ld(k)[id]; sv(k); fire(k); },
      push: async function (k, v) {
        var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        ld(k)[id] = v; sv(k); fire(k); return id;
      },
      watch: function (k, cb) {
        (W[k] = W[k] || []).push(cb);
        setTimeout(function () { cb(Object.assign({}, ld(k))); }, 0);
        return function () { W[k] = W[k].filter(function (f) { return f !== cb; }); };
      }
    };
  })();

  // ---------- общая база (Firebase Realtime Database, REST) ----------
  var feeds = {};
  var fb = {
    u: function (k, id) { return URL_ + '/db/' + encodeURIComponent(k) + (id ? '/' + encodeURIComponent(id) : '') + '.json'; },
    get: async function (k, id) { var r = await fetch(this.u(k, id)); if (!r.ok) throw new Error('net'); return r.json(); },
    list: async function (k) { var r = await fetch(this.u(k)); if (!r.ok) throw new Error('net'); return (await r.json()) || {}; },
    put: async function (k, id, v) { var r = await fetch(this.u(k, id), { method: 'PUT', body: JSON.stringify(v) }); if (!r.ok) throw new Error('net'); },
    del: async function (k, id) { var r = await fetch(this.u(k, id), { method: 'DELETE' }); if (!r.ok) throw new Error('net'); },
    push: async function (k, v) { var r = await fetch(this.u(k), { method: 'POST', body: JSON.stringify(v) }); if (!r.ok) throw new Error('net'); return (await r.json()).name; },
    watch: function (k, cb) {
      var f = feeds[k];
      if (!f) {
        f = feeds[k] = { m: {}, subs: new Set(), got: false };
        var fire = function () { f.subs.forEach(function (c) { c(Object.assign({}, f.m)); }); };
        var es = f.es = new EventSource(this.u(k));
        es.addEventListener('put', function (e) {
          var d = JSON.parse(e.data);
          if (d.path === '/') { f.m = Object.assign({}, d.data || {}); }
          else { var id = d.path.slice(1).split('/')[0]; if (d.data == null) delete f.m[id]; else f.m[id] = d.data; }
          f.got = true; fire();
        });
        es.addEventListener('patch', function (e) {
          var d = JSON.parse(e.data);
          if (d.path === '/') Object.keys(d.data || {}).forEach(function (i) { if (d.data[i] == null) delete f.m[i]; else f.m[i] = d.data[i]; });
          f.got = true; fire();
        });
        f.t = setTimeout(function () { if (!f.got) { f.got = true; fire(); } }, 6000);
      }
      f.subs.add(cb);
      if (f.got) setTimeout(function () { cb(Object.assign({}, f.m)); }, 0);
      return function () {
        f.subs.delete(cb);
        if (!f.subs.size) { f.es.close(); clearTimeout(f.t); delete feeds[k]; }
      };
    }
  };
  var backend = URL_ ? fb : local;

  // ---------- интерфейс коллекций ----------
  function Q(k, o) { this.k = k; this.o = o || {}; }
  Q.prototype.orderBy = function (f, d) { return new Q(this.k, Object.assign({}, this.o, { f: f, d: d || 'asc' })); };
  Q.prototype.limit = function (n) { return new Q(this.k, Object.assign({}, this.o, { n: n })); };
  Q.prototype.apply = function (map) {
    var o = this.o;
    var a = Object.keys(map).map(function (id) { return { id: id, d: safe(map[id]) }; });
    if (o.f) { var m = o.d === 'desc' ? -1 : 1; a.sort(function (x, y) { return ((x.d[o.f] > y.d[o.f]) - (x.d[o.f] < y.d[o.f])) * m; }); }
    if (o.n) a = a.slice(0, o.n);
    return { docs: a.map(function (x) { return { id: x.id, exists: true, data: function () { return x.d; } }; }) };
  };
  Q.prototype.get = async function () { return this.apply(await backend.list(this.k)); };
  Q.prototype.onSnapshot = function (cb) { var q = this; return backend.watch(this.k, function (m) { cb(q.apply(m)); }); };
  Q.prototype.add = async function (d) { return { id: await backend.push(this.k, JSON.stringify(d)) }; };
  Q.prototype.doc = function (id) {
    var k = this.k;
    return {
      id: id,
      get: async function () { var v = await backend.get(k, id); var d = v == null ? null : safe(v); return { id: id, exists: d != null, data: function () { return d; } }; },
      set: async function (d) { await backend.put(k, id, JSON.stringify(d)); },
      update: async function (d) {
        var v = await backend.get(k, id); if (v == null) throw new Error('not found');
        await backend.put(k, id, JSON.stringify(Object.assign({}, safe(v), d)));
      },
      delete: async function () { await backend.del(k, id); }
    };
  };

  var uid = localStorage.getItem('aethra_uid');
  if (!uid) { uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('aethra_uid', uid); }
  var api = {
    db: { collection: function (p) { return new Q(key(p)); } },
    user: { id: async function () { return uid; }, isOwner: async function () { return false; }, canEdit: async function () { return false; } },
    assets: {
      upload: async function (blob) {
        var d = await new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob); });
        return { id: d, url: d };
      }
    }
  };
  window.claude = { use: async function (n) { return api[n]; } };

  // одноразовое пояснение, если общая база не подключена
  if (!URL_ && typeof document !== 'undefined' && !localStorage.getItem('aethra_note')) {
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top,0px));z-index:99;background:#17201a;color:#fff;padding:12px 14px;border-radius:14px;font:14px system-ui;display:flex;gap:12px;align-items:center';
      b.innerHTML = '<span style="flex:1">Сейчас всё хранится только на этом телефоне. Чтобы общаться с другими людьми, подключите общую базу — инструкция в README.</span><b style="font-size:20px;padding:4px 8px">✕</b>';
      b.onclick = function () { localStorage.setItem('aethra_note', '1'); b.remove(); };
      document.body.appendChild(b); localStorage.setItem('aethra_note', '1'); setTimeout(function () { b.remove(); }, 12000);
    });
  }
})();
