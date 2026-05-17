// Supabase auth wiring for Mount Readmore.
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

  const client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  let currentUser = null;
  let currentProfile = null;
  let userBooksById = {};   // book_id -> { status, date_read }
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

  function notify() {
    const snapshot = { user: currentUser, profile: currentProfile, userBooks: userBooksById };
    subscribers.forEach(cb => {
      try { cb(snapshot); } catch (e) { console.error(e); }
    });
  }

  async function bootstrap() {
    const { data: { session } } = await client.auth.getSession();
    currentUser = session?.user || null;
    await Promise.all([loadProfile(), loadUserBooks()]);
    notify();
    client.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      await Promise.all([loadProfile(), loadUserBooks()]);
      notify();
    });
  }

  function showSignInModal() {
    let dlg = document.getElementById('mr-signin-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'mr-signin-dialog';
      dlg.className = 'mr-signin-dialog';
      dlg.innerHTML = `
        <form id="mr-signin-form" class="mr-signin-form">
          <h2>Sign in to Mount Readmore</h2>
          <p>We'll email you a magic link — no password needed.</p>
          <label class="mr-signin-label">
            <span>Email</span>
            <input type="email" id="mr-signin-email" required placeholder="you@example.com" autocomplete="email">
          </label>
          <div class="mr-signin-actions">
            <button type="submit" id="mr-signin-submit" class="mr-btn-primary">Send link</button>
            <button type="button" id="mr-signin-cancel" class="mr-btn-ghost">Cancel</button>
          </div>
          <div class="mr-signin-status" id="mr-signin-status"></div>
        </form>
      `;
      document.body.appendChild(dlg);
      dlg.querySelector('#mr-signin-cancel').addEventListener('click', () => dlg.close());
      dlg.querySelector('#mr-signin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = dlg.querySelector('#mr-signin-email').value.trim();
        const status = dlg.querySelector('#mr-signin-status');
        const submit = dlg.querySelector('#mr-signin-submit');
        if (!email) return;
        submit.disabled = true;
        status.textContent = 'Sending…';
        status.className = 'mr-signin-status';
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) {
          status.textContent = 'Error: ' + error.message;
          status.className = 'mr-signin-status error';
          submit.disabled = false;
        } else {
          status.textContent = '✓ Check your inbox for the magic link.';
          status.className = 'mr-signin-status success';
        }
      });
    }
    dlg.querySelector('#mr-signin-email').value = '';
    dlg.querySelector('#mr-signin-status').textContent = '';
    dlg.querySelector('#mr-signin-submit').disabled = false;
    dlg.showModal();
  }

  async function listFriends() {
    if (!currentUser) return [];
    const { data, error } = await client.from('friendships')
      .select('user_id_a, user_id_b, created_at')
      .or(`user_id_a.eq.${currentUser.id},user_id_b.eq.${currentUser.id}`);
    if (error) { console.error('friendships load:', error); return []; }
    const friendIds = (data || []).map(f =>
      f.user_id_a === currentUser.id ? f.user_id_b : f.user_id_a
    );
    if (friendIds.length === 0) return [];
    const { data: profs, error: pErr } = await client.from('profiles')
      .select('id, handle, profile_visibility, on_leaderboard')
      .in('id', friendIds);
    if (pErr) { console.error('friend profiles load:', pErr); return []; }
    return profs || [];
  }

  async function addFriendByHandle(handle) {
    if (!currentUser) throw new Error('Not signed in');
    const clean = String(handle || '').replace(/^@/, '').trim().toLowerCase();
    if (!clean) throw new Error('Handle is empty');
    const { data: target, error: lookupErr } = await client.from('profiles')
      .select('id, handle').eq('handle', clean).maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!target) throw new Error(`No user with handle @${clean}`);
    if (target.id === currentUser.id) throw new Error("Can't friend yourself");
    const [a, b] = currentUser.id < target.id
      ? [currentUser.id, target.id]
      : [target.id, currentUser.id];
    const { error } = await client.from('friendships')
      .insert({ user_id_a: a, user_id_b: b });
    if (error && error.code !== '23505') throw error;  // ignore "already friends"
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
  }

  async function setBookStatus(bookId, status) {
    // status: 'read' | 'started' | 'nightstand' | null (null = remove)
    if (!currentUser) throw new Error('Not signed in');
    if (status === null) {
      const { error } = await client.from('user_books')
        .delete()
        .eq('user_id', currentUser.id).eq('book_id', bookId);
      if (error) throw error;
      delete userBooksById[bookId];
    } else {
      const row = { user_id: currentUser.id, book_id: bookId, status };
      if (status === 'read' && !userBooksById[bookId]?.date_read) {
        row.date_read = new Date().toISOString().slice(0, 10);
      }
      const { data, error } = await client.from('user_books')
        .upsert(row, { onConflict: 'user_id,book_id' })
        .select('book_id,status,date_read,updated_at')
        .single();
      if (error) throw error;
      userBooksById[bookId] = data;
    }
    notify();
  }

  async function updateProfile(patch) {
    if (!currentUser) throw new Error('Not signed in');
    const allowed = ['handle', 'profile_visibility', 'on_leaderboard'];
    const safe = {};
    for (const k of allowed) if (k in patch) safe[k] = patch[k];
    if (Object.keys(safe).length === 0) return currentProfile;
    const { data, error } = await client.from('profiles')
      .update(safe).eq('id', currentUser.id)
      .select('*').single();
    if (error) throw error;
    currentProfile = data;
    notify();
    return data;
  }

  window.MR_AUTH = {
    client,
    get user() { return currentUser; },
    get profile() { return currentProfile; },
    get userBooks() { return userBooksById; },
    statusFor(bookId) { return userBooksById[bookId]?.status || null; },
    onChange(cb) { subscribers.add(cb); return () => subscribers.delete(cb); },
    signOut: async () => { await client.auth.signOut(); },
    showSignInModal,
    setBookStatus,
    listFriends,
    addFriendByHandle,
    removeFriend,
    updateProfile,
  };

  bootstrap();
})();
