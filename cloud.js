// cloud.js — optional sign-in and Firestore sync, shared by Ciaran's apps.
// Every app keeps working from this browser's storage when signed out or
// when CONFIG is null. Signed in, data lives at users/<uid>/... and is
// visible on any device signed in to the same account.
(function () {
  // Firebase project "ciaran-apps". The web config is not a secret: the
  // Firestore rules (only the signed-in owner can read or write
  // users/<their uid>/...) are what keep the data private.
  const CONFIG = {
    apiKey: "AIzaSyDcxeNsspPlb6Tijn6dJ4qU4EiYujVy2fg",
    authDomain: "ciaran-apps.firebaseapp.com",
    projectId: "ciaran-apps",
    storageBucket: "ciaran-apps.firebasestorage.app",
    messagingSenderId: "437535359271",
    appId: "1:437535359271:web:6ce2c64c0742a40d6d2902"
  };

  const listeners = [];
  let user = null;
  let ready = false;

  const Cloud = (window.Cloud = {
    enabled: !!(CONFIG && window.firebase),
    get user() { return user; },
    // Called with the user (or null) once sign-in state is known, then on every change.
    onUser(fn) { listeners.push(fn); if (ready) safe(fn, user); },
    userRef() { return user ? firebase.firestore().collection('users').doc(user.uid) : null; },
    // Per-device, per-account flag: has this device's local data been uploaded once?
    migrated(key) { try { return localStorage.getItem(flag(key)) === '1'; } catch (e) { return false; } },
    markMigrated(key) { try { localStorage.setItem(flag(key), '1'); } catch (e) {} },
    // Write up to any number of docs, 400 per batch (Firestore allows 500).
    async putAll(colRef, map) {
      const ids = Object.keys(map);
      for (let i = 0; i < ids.length; i += 400) {
        const b = firebase.firestore().batch();
        ids.slice(i, i + 400).forEach((id) => b.set(colRef.doc(id), clean(map[id])));
        await b.commit();
      }
    },
    clean,
    note,
  });

  function flag(key) { return 'cloud-migrated:' + key + ':' + (user ? user.uid : ''); }
  function safe(fn, u) { try { fn(u); } catch (e) { console.error(e); } }
  // Firestore rejects undefined values; JSON round-trip drops them.
  function clean(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- account bar ----------
  const css = `
  .cloudbar{font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;background:Canvas;color:CanvasText;
    border-bottom:1px solid color-mix(in srgb,CanvasText 15%,transparent);padding:8px 16px;display:flex;flex-wrap:wrap;
    align-items:center;gap:8px}
  .cloudbar .msg{flex:1 1 200px;min-width:0}
  .cloudbar .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:1px}
  .cloudbar .ok{background:#2f9e5b}.cloudbar .warn{background:#d08a1a}.cloudbar .bad{background:#c8443a}
  .cloudbar button{font:inherit;border:1px solid color-mix(in srgb,CanvasText 25%,transparent);background:transparent;
    color:inherit;border-radius:6px;padding:4px 10px;cursor:pointer}
  .cloudbar form{display:flex;flex-wrap:wrap;gap:6px;width:100%}
  .cloudbar input{font:inherit;flex:1 1 160px;min-width:0;padding:6px 8px;border-radius:6px;
    border:1px solid color-mix(in srgb,CanvasText 25%,transparent);background:Canvas;color:CanvasText}
  .cloudbar .err{color:#c8443a;width:100%}`;
  let bar, noteText = '';

  function note(text) { noteText = text || ''; render(); }

  function render() {
    if (!bar) return;
    if (!Cloud.enabled) { bar.hidden = true; return; }
    bar.hidden = false;
    if (!ready) { bar.innerHTML = '<span class="msg"><span class="dot warn"></span>Connecting…</span>'; return; }
    if (user) {
      bar.innerHTML = `<span class="msg"><span class="dot ok"></span>${noteText || 'Synced to your account'} · <b></b></span>
        <button type="button" data-a="out">Sign out</button>`;
      bar.querySelector('b').textContent = user.email || '';
      return;
    }
    bar.innerHTML = `<span class="msg"><span class="dot bad"></span>Not signed in: data is saved on this device only.</span>
      <button type="button" data-a="show">Sign in to sync</button>
      <form hidden><input type="email" name="e" placeholder="Email" autocomplete="username" required>
        <input type="password" name="p" placeholder="Password" autocomplete="current-password" required>
        <button type="submit">Sign in</button><span class="err" role="status"></span></form>`;
  }

  function mount() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bar = document.createElement('div'); bar.className = 'cloudbar'; bar.hidden = true;
    document.body.insertBefore(bar, document.body.firstChild);
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (a === 'show') { bar.querySelector('form').hidden = false; e.target.hidden = true; bar.querySelector('input').focus(); }
      if (a === 'out') firebase.auth().signOut();
    });
    bar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = f.querySelector('.err');
      err.textContent = 'Signing in…';
      try { await firebase.auth().signInWithEmailAndPassword(f.e.value.trim(), f.p.value); }
      catch (x) {
        const c = x && x.code || '';
        err.textContent = /invalid|wrong-password|user-not-found/.test(c) ? 'That email and password don’t match. Check them and try again.'
          : /network/.test(c) ? 'No connection. Try again when you’re online.'
          : /too-many/.test(c) ? 'Too many attempts. Wait a minute and try again.'
          : 'Couldn’t sign in (' + c + ').';
      }
    });
    render();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  if (!Cloud.enabled) { ready = true; return; }

  firebase.initializeApp(CONFIG);
  // Keeps a local copy and queues writes while offline.
  firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
  firebase.auth().onAuthStateChanged((u) => {
    user = u; ready = true; noteText = '';
    render();
    listeners.forEach((fn) => safe(fn, u));
  });
})();
