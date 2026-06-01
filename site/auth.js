// Supabase auth wiring for Readmore.
// Exposes window.MR_AUTH with: client, current user/profile, onChange listener,
// signInModal trigger, signOut, and a refreshable cache of the current user's
// user_books rows.

(() => {
  'use strict';
  const cfg = window.MR_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL) {
    console.warn('MR_AUTH: missing window.MR_CONFIG — auth disabled');
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('MR_AUTH: supabase-js not loaded — auth disabled');
    return;
  }

  // Bypass the Web Locks API for the auth-token mutex. supabase-js v2 uses
  // navigator.locks to coordinate token refresh across tabs, but a stuck
  // context (closed-but-orphaned tab, separate Chrome window outside this
  // session) can hold the exclusive lock forever and freeze every getSession
  // / from() call in the SDK. We're a single-user app per browser — racing
  // refreshes across tabs is not a concern. Pass-through lock removes the
  // hang entirely.
  const noopLock = async (_name, _acquireTimeout, fn) => fn();
  const client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, lock: noopLock } }
  );

  let currentUser = null;
  let currentProfile = null;
  let userBooksById = {};       // book_id -> { status, date_read }
  let friendsList = [];         // [{ id, handle, profile_visibility, on_leaderboard }]
  let leaderboardOverall = [];  // [{ user_id, handle, read_count, pct, rank, total_books }]
  let leaderboardByAward = [];  // [{ user_id, handle, hugo_read, nebula_read, ... }]
  const subscribers = new Set();

  async function loadProfile() {
    if (!currentUser) { currentProfile = null; return; }
    const { data, error } = await client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if (error) console.error('profile load:', error);
    currentProfile = data || null;
  }

  async function loadUserBooks() {
    if (!currentUser) { userBooksById = {}; return; }
    const { data, error } = await client.from('user_books')
      .select('book_id,status,date_read,updated_at')
      .eq('user_id', currentUser.id);
    if (error) { console.error('user_books load:', error); userBooksById = {}; return; }
    const next = {};
    for (const r of data || []) next[r.book_id] = r;
    userBooksById = next;
  }

  // Friends + leaderboards are tiny per-user payloads. Load them once at
  // bootstrap (and on auth/userBooks change) so consumer pages render
  // synchronously instead of firing on-demand queries each navigation.
  async function loadFriends() {
    if (!currentUser) { friendsList = []; return; }
    // friendships RLS gates on auth.uid(), so this MUST carry the token.
    try {
      const uid = currentUser.id;
      const edges = await _authedRest(
        `friendships?select=user_id_a,user_id_b&or=(user_id_a.eq.${uid},user_id_b.eq.${uid})`);
      const friendIds = (edges || []).map(f => f.user_id_a === uid ? f.user_id_b : f.user_id_a);
      if (friendIds.length === 0) { friendsList = []; return; }
      friendsList = await _authedRest(
        `profiles?select=id,handle,profile_visibility,on_leaderboard&id=in.(${friendIds.join(',')})`);
    } catch (e) { console.error('friends load:', e); friendsList = []; }
  }

  async function loadLeaderboards() {
    // leaderboard_overall + leaderboard_by_award are SECURITY DEFINER views
    // friends-scoped by auth.uid() — they return ZERO rows unless the token is
    // attached, so query them with the explicit-token fetch (not client.from).
    if (!currentUser) { leaderboardOverall = []; leaderboardByAward = []; return; }
    try {
      const [overall, byAward] = await Promise.all([
        _authedRest('leaderboard_overall?select=*&order=rank'),
        _authedRest('leaderboard_by_award?select=*&order=rank'),
      ]);
      leaderboardOverall = overall || [];
      leaderboardByAward = byAward || [];
    } catch (e) {
      console.error('leaderboard load:', e);
      leaderboardOverall = []; leaderboardByAward = [];
    }
  }

  // Tracks whether bootstrap has fired at least one notify. New subscribers
  // added after that point need to be primed immediately — otherwise an
  // app.js init() race (bootstrap completes during init's `await
  // fetch('data.json')`, before init reaches the onChange call) silently
  // drops the only notification, leaving friends/leaderboard data unrendered.
  let bootstrapNotified = false;
  function _currentSnapshot() {
    return {
      user: currentUser, profile: currentProfile, userBooks: userBooksById,
      friends: friendsList, leaderboardOverall, leaderboardByAward,
    };
  }
  function notify() {
    bootstrapNotified = true;
    const snapshot = _currentSnapshot();
    subscribers.forEach(cb => {
      try { cb(snapshot); } catch (e) { console.error(e); }
    });
  }

  async function bootstrap() {
    const { data: { session } } = await client.auth.getSession();
    currentUser = session?.user || null;
    _loadLocalUnread();
    // Load everything user-scoped in parallel. Pages waiting on MR_AUTH.ready
    // get friends + leaderboard data without firing extra queries.
    await Promise.all([loadProfile(), loadUserBooks(), loadFriends(), loadLeaderboards()]);
    notify();
    client.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      _loadLocalUnread();
      await Promise.all([loadProfile(), loadUserBooks(), loadFriends(), loadLeaderboards()]);
      notify();
    });
  }

  function showSignInModal(prefillEmail) {
    let dlg = document.getElementById('mr-signin-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'mr-signin-dialog';
      dlg.className = 'mr-signin-dialog';
      // Two-step modal: phase 'email' collects the address and triggers
      // signInWithOtp (which emails BOTH a magic link AND a one-time code).
      // Phase 'code' takes the OTP and calls verifyOtp — the fallback when
      // the magic-link redirect can't deep-link back into the app (Safari
      // private mode, in-app browsers, embedded webviews, etc.).
      dlg.innerHTML = `
        <form id="mr-signin-form" class="mr-signin-form" data-phase="email">
          <h2>Sign in to Readmore</h2>
          <p id="mr-signin-blurb">We'll email you a magic link and a one-time code — no password needed.</p>

          <div class="mr-signin-phase mr-signin-phase-email">
            <label class="mr-signin-label">
              <span>Email</span>
              <input type="email" id="mr-signin-email" required placeholder="you@example.com" autocomplete="email">
            </label>
            <div class="mr-signin-actions">
              <button type="submit" id="mr-signin-submit" class="mr-btn-primary">Send code</button>
              <button type="button" id="mr-signin-cancel" class="mr-btn-ghost">Cancel</button>
            </div>
          </div>

          <div class="mr-signin-phase mr-signin-phase-code" hidden>
            <p class="mr-signin-blurb-code">Code sent to <strong id="mr-signin-email-display"></strong>. Paste the code from the email below — or just click the magic link in the email.</p>
            <label class="mr-signin-label">
              <span>Code from email</span>
              <input type="text" id="mr-signin-code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" pattern="[0-9 ]{4,10}">
            </label>
            <div class="mr-signin-actions">
              <button type="button" id="mr-signin-verify" class="mr-btn-primary">Sign in</button>
              <button type="button" id="mr-signin-back" class="mr-btn-ghost">← Use a different email</button>
            </div>
            <p class="mr-signin-resend">Didn't get a code? <button type="button" id="mr-signin-resend">Resend</button></p>
          </div>

          <div class="mr-signin-status" id="mr-signin-status"></div>
        </form>
      `;
      document.body.appendChild(dlg);

      const phaseEl = (p) => dlg.querySelector('.mr-signin-phase-' + p);
      const showPhase = (p) => {
        dlg.querySelector('#mr-signin-form').dataset.phase = p;
        phaseEl('email').hidden = p !== 'email';
        phaseEl('code').hidden = p !== 'code';
      };

      const REDIRECT_URL = 'https://readmoresff.org/';

      const sendCode = async (email) => {
        const status = dlg.querySelector('#mr-signin-status');
        status.textContent = 'Sending…';
        status.className = 'mr-signin-status';
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: REDIRECT_URL }
        });
        if (error) {
          status.textContent = 'Error: ' + error.message;
          status.className = 'mr-signin-status error';
          return false;
        }
        status.textContent = '✓ Check your email for the code (or click the magic link).';
        status.className = 'mr-signin-status success';
        return true;
      };

      dlg.querySelector('#mr-signin-cancel').addEventListener('click', () => dlg.close());
      dlg.querySelector('#mr-signin-back').addEventListener('click', () => {
        showPhase('email');
        dlg.querySelector('#mr-signin-status').textContent = '';
        setTimeout(() => dlg.querySelector('#mr-signin-email')?.focus(), 0);
      });

      // Phase-email submit → send the code, advance to phase-code.
      dlg.querySelector('#mr-signin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (dlg.querySelector('#mr-signin-form').dataset.phase !== 'email') return;
        const email = dlg.querySelector('#mr-signin-email').value.trim();
        const submit = dlg.querySelector('#mr-signin-submit');
        if (!email) return;
        submit.disabled = true;
        const ok = await sendCode(email);
        submit.disabled = false;
        if (!ok) return;
        dlg.querySelector('#mr-signin-email-display').textContent = email;
        dlg.dataset.email = email;
        showPhase('code');
        setTimeout(() => dlg.querySelector('#mr-signin-code')?.focus(), 0);
      });

      dlg.querySelector('#mr-signin-resend').addEventListener('click', async () => {
        const email = dlg.dataset.email;
        if (!email) return;
        await sendCode(email);
      });

      const submitCode = async () => {
        const email = dlg.dataset.email;
        const codeInput = dlg.querySelector('#mr-signin-code');
        const token = (codeInput.value || '').replace(/\s+/g, '').trim();
        const status = dlg.querySelector('#mr-signin-status');
        const verifyBtn = dlg.querySelector('#mr-signin-verify');
        if (!email || !token) return;
        verifyBtn.disabled = true;
        status.textContent = 'Verifying…';
        status.className = 'mr-signin-status';
        const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        verifyBtn.disabled = false;
        if (error) {
          status.textContent = 'Invalid code: ' + error.message;
          status.className = 'mr-signin-status error';
          return;
        }
        status.textContent = '✓ Signed in.';
        status.className = 'mr-signin-status success';
        // onAuthStateChange fires; close after a tick so the user sees success.
        setTimeout(() => dlg.close(), 600);
      };

      dlg.querySelector('#mr-signin-verify').addEventListener('click', submitCode);
      dlg.querySelector('#mr-signin-code').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitCode(); }
      });
    }
    // Reset to phase-email on each open so a fresh sign-in attempt starts clean.
    dlg.querySelector('.mr-signin-phase-email').hidden = false;
    dlg.querySelector('.mr-signin-phase-code').hidden = true;
    dlg.querySelector('#mr-signin-form').dataset.phase = 'email';
    dlg.querySelector('#mr-signin-email').value = prefillEmail || '';
    dlg.querySelector('#mr-signin-code').value = '';
    dlg.querySelector('#mr-signin-status').textContent = '';
    dlg.querySelector('#mr-signin-submit').disabled = false;
    dlg.showModal();
    setTimeout(() => dlg.querySelector('#mr-signin-email')?.focus(), 0);
  }

  // Race a query against a timeout so a stuck SDK call doesn't freeze callers.
  // Returns { data, error } shape; on timeout `error` describes the timeout.
  async function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve({ data: null, error: { message: `${label} timed out after ${ms}ms` } }), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  // Legacy callsites still call MR_AUTH.listFriends() — return the preloaded
  // list synchronously. The bootstrap already populated friendsList; if a
  // page wants to force a refresh it can call refreshFriends() instead.
  async function listFriends() {
    return friendsList;
  }
  async function refreshFriends() {
    await Promise.all([loadFriends(), loadLeaderboards()]);
    notify();
  }
  // Same reload, but WITHOUT notify() — for callers that patch their own DOM
  // and must not trigger the global onChange re-render (which would loop if the
  // caller runs during a render).
  async function refreshFriendsQuiet() {
    await Promise.all([loadFriends(), loadLeaderboards()]);
  }
  function invalidateFriendsCache() { /* no-op — kept for backwards compat */ }

  async function addFriendByHandle(handle) {
    if (!currentUser) throw new Error('Not signed in');
    const clean = String(handle || '').replace(/^@/, '').trim().toLowerCase();
    if (!clean) throw new Error('Handle is empty');
    // Case-insensitive handle lookup — ilike with no wildcards is just a
    // case-insensitive eq.
    const { data: target, error: lookupErr } = await client.from('profiles')
      .select('id, handle').ilike('handle', clean).maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!target) throw new Error(`No user with handle @${clean}`);
    if (target.id === currentUser.id) throw new Error("Can't friend yourself");
    const [a, b] = currentUser.id < target.id
      ? [currentUser.id, target.id]
      : [target.id, currentUser.id];
    const { error } = await client.from('friendships')
      .insert({ user_id_a: a, user_id_b: b });
    if (error && error.code !== '23505') throw error;  // ignore "already friends"
    await refreshFriends();
    return target;
  }

  async function removeFriend(friendId) {
    if (!currentUser) throw new Error('Not signed in');
    const [a, b] = currentUser.id < friendId
      ? [currentUser.id, friendId]
      : [friendId, currentUser.id];
    const { error } = await client.from('friendships')
      .delete().eq('user_id_a', a).eq('user_id_b', b);
    if (error) throw error;
    await refreshFriends();
  }

  // Read Supabase session token from localStorage. We use this for direct
  // REST calls when the JS client's .update()/.upsert() chains hang (seen
  // sporadically during write paths; reads work fine).
  function _getAccessToken() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v?.access_token) return v.access_token;
        if (v?.currentSession?.access_token) return v.currentSession.access_token;
      } catch {}
    }
    return null;
  }

  // Authenticated PostgREST GET with the access token attached EXPLICITLY.
  // client.from() does not reliably attach the session token in this app (the
  // noopLock bypass + storage timing), so any query gated by auth.uid() —
  // friendships, the friends-scoped leaderboard views — silently returns zero
  // rows. The token is read from localStorage (same source setBookStatus uses
  // for writes), guaranteeing auth.uid() resolves server-side.
  async function _authedRest(pathAndQuery, ms = 8000) {
    const token = _getAccessToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
        headers: {
          apikey: cfg.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token || cfg.SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Local-only 'unread' tracker. The user_books.status column has a CHECK
  // constraint that only allows 'read' | 'nightstand' | 'started', so we
  // can't persist 'unread' server-side without a schema migration.
  // Track explicit-skip decisions in localStorage instead — surfaced via
  // statusFor() so the Sort queue, badges, and Stats all see 'unread'.
  const _localUnread = new Set();
  function _localUnreadKey() {
    return currentUser ? `mr-unread-${currentUser.id}` : null;
  }
  function _loadLocalUnread() {
    _localUnread.clear();
    const k = _localUnreadKey();
    if (!k) return;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      for (const id of arr) _localUnread.add(id);
    } catch {}
  }
  function _saveLocalUnread() {
    const k = _localUnreadKey();
    if (!k) return;
    try { localStorage.setItem(k, JSON.stringify([...
      _localUnread])); } catch {}
  }

  async function setBookStatus(bookId, status) {
    // status: 'read' | 'nightstand' | 'unread' | 'started' | null (null = remove)
    if (!currentUser) throw new Error('Not signed in');
    const uid = currentUser.id;

    // 'unread' = explicit "I won't read this." DB doesn't accept the value
    // (CHECK constraint), so persist to localStorage and delete any prior
    // user_books row so the book doesn't double-count.
    if (status === 'unread') {
      _localUnread.add(bookId);
      _saveLocalUnread();
      // Drop any DB row that might exist for this book (was read/nightstand).
      const hadRow = !!userBooksById[bookId];
      delete userBooksById[bookId];
      notify();
      if (hadRow) {
        try {
          const token = _getAccessToken();
          await fetch(`${cfg.SUPABASE_URL}/rest/v1/user_books?user_id=eq.${uid}&book_id=eq.${encodeURIComponent(bookId)}`, {
            method: 'DELETE',
            headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
          });
        } catch (e) { console.error('setBookStatus unread-cleanup failed:', e); }
      }
      return;
    }
    // Any non-unread status (or null) → drop the book from the local-unread set first.
    if (_localUnread.has(bookId)) {
      _localUnread.delete(bookId);
      _saveLocalUnread();
    }

    // Update local cache FIRST so the UI (Sort queue, stats, badges)
    // reflects intent immediately even if the network call is slow/failing.
    // Background save below; if it fails the cache stays optimistic for this
    // session and we log the error.
    const prev = userBooksById[bookId];
    if (status === null) {
      delete userBooksById[bookId];
    } else {
      const dateRead = status === 'read'
        ? (prev?.date_read || new Date().toISOString().slice(0, 10))
        : null;
      userBooksById[bookId] = {
        book_id: bookId, status,
        date_read: dateRead,
        updated_at: new Date().toISOString(),
      };
    }
    notify();
    // Direct REST write — bypasses the JS client's hang-prone wrapper.
    const token = _getAccessToken();
    const url = cfg.SUPABASE_URL;
    const key = cfg.SUPABASE_PUBLISHABLE_KEY;
    try {
      if (status === null) {
        const resp = await fetch(`${url}/rest/v1/user_books?user_id=eq.${uid}&book_id=eq.${encodeURIComponent(bookId)}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`delete failed: ${resp.status}`);
      } else {
        const row = { user_id: uid, book_id: bookId, status };
        if (status === 'read' && !prev?.date_read) {
          row.date_read = new Date().toISOString().slice(0, 10);
        }
        const resp = await fetch(`${url}/rest/v1/user_books?on_conflict=user_id,book_id`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(row),
        });
        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`upsert ${resp.status}: ${body.slice(0,200)}`);
        }
        const arr = await resp.json();
        if (arr?.[0]) userBooksById[bookId] = arr[0];
      }
    } catch (e) {
      // Keep the optimistic local cache. The save can be retried on next
      // action; the user sees their intent honored on this page at least.
      console.error('setBookStatus REST failed:', e);
      // Don't revert — UX is better when the user's action sticks visually.
      // If the server permanently rejects, a refresh will resync the truth.
      throw e;
    }
    // Refresh the leaderboard so own row's read_count reflects the new
    // count immediately (Home + Leaderboard + Compare all read from this).
    // Fire-and-forget — the user's status change is already persisted.
    loadLeaderboards().then(notify).catch(e => console.error('leaderboard refresh:', e));
    notify();
  }

  async function updateProfile(patch) {
    if (!currentUser) throw new Error('Not signed in');
    const allowed = ['handle', 'profile_visibility', 'on_leaderboard'];
    const safe = {};
    for (const k of allowed) if (k in patch) safe[k] = patch[k];
    if (Object.keys(safe).length === 0) return currentProfile;
    // Bound the call so a stuck Supabase request (network hiccup, web-locks
    // contention from another tab, hung CDN) surfaces as an error in the UI
    // instead of leaving the Save button on "Saving…" forever.
    const { data, error } = await withTimeout(
      client.from('profiles')
        .update(safe).eq('id', currentUser.id)
        .select('*').single(),
      10000, 'profile update'
    );
    if (error) throw error;
    currentProfile = data;
    notify();
    return data;
  }

  // `ready` resolves after the initial bootstrap (getSession + profile +
  // userBooks + friends + leaderboards). Pages that read MR_AUTH.* should
  // await it first to avoid the race where user is set but the rest isn't.
  const readyPromise = bootstrap();

  window.MR_AUTH = {
    client,
    ready: readyPromise,
    get user() { return currentUser; },
    get profile() { return currentProfile; },
    get userBooks() { return userBooksById; },
    get friends() { return friendsList; },
    get leaderboardOverall() { return leaderboardOverall; },
    get leaderboardByAward() { return leaderboardByAward; },
    statusFor(bookId) {
      if (_localUnread.has(bookId)) return 'unread';
      return userBooksById[bookId]?.status || null;
    },
    onChange(cb) {
      subscribers.add(cb);
      // If bootstrap already fired its initial notify, replay it for this
      // late subscriber on a microtask so the caller's setup code can
      // finish before the callback runs.
      if (bootstrapNotified) {
        const snapshot = _currentSnapshot();
        queueMicrotask(() => { try { cb(snapshot); } catch (e) { console.error(e); } });
      }
      return () => subscribers.delete(cb);
    },
    signOut: async () => {
      // client.auth.signOut() defaults to scope:'global', which fires a network
      // revoke through the same SDK machinery that hangs elsewhere in this app
      // (see _authedRest / direct-fetch writes) — the await never resolves, so
      // the caller's redirect never runs and the button looks dead. Use the
      // local scope (no network call) and don't let it block forever.
      try {
        await Promise.race([
          client.auth.signOut({ scope: 'local' }),
          new Promise(res => setTimeout(res, 1500)),
        ]);
      } catch (e) { console.warn('signOut (sdk):', e); }
      // localStorage is the source of truth for "are we signed in" in this app
      // (_getAccessToken reads it directly). Wipe the token so any reload — and
      // any SDK autoRefresh that outraced the call above — comes up signed out.
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach(k => localStorage.removeItem(k));
      } catch {}
      currentUser = null;
      currentProfile = null;
      userBooksById = {};
      friendsList = [];
      leaderboardOverall = [];
      leaderboardByAward = [];
      notify();
    },
    showSignInModal,
    setBookStatus,
    listFriends,
    refreshFriends,
    refreshFriendsQuiet,
    invalidateFriendsCache,
    addFriendByHandle,
    removeFriend,
    updateProfile,
  };
})();
