import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Copia estos valores desde Project Settings > API en Supabase.
const SUPABASE_URL = 'https://fiqjhwmrvihavlnsmecs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Rp4HhRwdnrpi44zfGvxJg_h9IaGPNj';
const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const grid = document.querySelector('#news-grid');
const notice = document.querySelector('#notice');
const categoriesEl = document.querySelector('#category-list');
const categorySelect = document.querySelector('#news-category');
const editorArea = document.querySelector('#editor-area');
const authDialog = document.querySelector('#auth-dialog');
let categories = [];
let activeCategory = 'all';
let authMode = 'login';
let currentUser = null;

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle('error', error);
  notice.classList.remove('hidden');
}
function clearNotice() { notice.classList.add('hidden'); notice.textContent = ''; }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
}
function formattedDate(value) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function renderCategoryButtons() {
  categoriesEl.innerHTML = `<button class="category-chip ${activeCategory === 'all' ? 'selected' : ''}" data-category="all">Todo</button>` + categories.map(c => `<button class="category-chip ${activeCategory === String(c.id) ? 'selected' : ''}" data-category="${c.id}">${escapeHtml(c.name)}</button>`).join('');
  categorySelect.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}
function renderNews(rows) {
  document.querySelector('#news-count').textContent = `${rows.length} ${rows.length === 1 ? 'HISTORIA' : 'HISTORIAS'}`;
  if (!rows.length) {
    grid.innerHTML = '<div class="empty-card">Aún no hay noticias en esta categoría.<br>Vuelve pronto para descubrir nuevas historias.</div>';
    return;
  }
  grid.innerHTML = rows.map((item, index) => {
    const image = item.image_url
      ? `<img class="news-image" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;news-image-placeholder&quot;>e.</div>'">`
      : `<div class="news-image-placeholder">e.</div>`;
    return `<article class="news-card" style="animation-delay:${index * 70}ms">${image}<div class="news-meta"><span class="news-category">${escapeHtml(item.categories?.name || 'Noticias')}</span><time>${formattedDate(item.published_at)}</time></div><h3>${escapeHtml(item.title)}</h3><p class="news-summary">${escapeHtml(item.summary || '')}</p>${item.content ? `<details><summary class="text-button">Leer noticia</summary><div class="news-content">${escapeHtml(item.content)}</div></details>` : ''}</article>`;
  }).join('');
}
async function loadNews() {
  if (!supabase) {
    grid.innerHTML = '<div class="empty-card">Conecta tu proyecto Supabase para ver y publicar noticias.<br>Abre <strong>app.js</strong> y agrega la URL y la clave pública de tu proyecto.</div>';
    document.querySelector('#news-count').textContent = 'CONFIGURACIÓN PENDIENTE';
    return;
  }
  clearNotice();
  let query = supabase.from('news').select('id,title,summary,content,image_url,published_at,categories(name)').eq('status', 'publicada').order('published_at', { ascending: false });
  if (activeCategory !== 'all') query = query.eq('category_id', Number(activeCategory));
  const { data, error } = await query;
  if (error) { grid.innerHTML = ''; showNotice(`No se pudieron cargar las noticias: ${error.message}`, true); return; }
  renderNews(data || []);
}
async function loadCategories() {
  if (!supabase) { categories = [{id: 1, name: 'Local'}, {id: 2, name: 'Deportes'}, {id: 3, name: 'Tecnología'}]; renderCategoryButtons(); return; }
  const { data, error } = await supabase.from('categories').select('id,name').order('name');
  if (error) { showNotice(`No se pudieron cargar las categorías: ${error.message}`, true); return; }
  categories = data || [];
  renderCategoryButtons();
}
async function syncSession(session) {
  currentUser = session?.user || null;
  const openButton = document.querySelector('#auth-open');
  const signoutButton = document.querySelector('#signout');
  const label = document.querySelector('#user-label');
  if (!currentUser) {
    openButton.classList.remove('hidden'); signoutButton.classList.add('hidden'); label.textContent = ''; editorArea.classList.add('hidden'); return;
  }
  openButton.classList.add('hidden'); signoutButton.classList.remove('hidden');
  const { data } = await supabase.from('profiles').select('display_name,roles(name)').eq('id', currentUser.id).maybeSingle();
  label.textContent = data?.display_name || currentUser.email;
  const role = data?.roles?.name || 'lector';
  const canEdit = ['editor', 'administrador'].includes(role);
  editorArea.classList.toggle('hidden', !canEdit);
  document.querySelector('#role-badge').textContent = role;
}
function setAuthMode(mode) {
  authMode = mode;
  const register = mode === 'register';
  document.querySelector('#auth-title').innerHTML = register ? 'Crea tu cuenta<span class="brand-dot">.</span>' : 'Bienvenido<span class="brand-dot">.</span>';
  document.querySelector('#auth-description').textContent = register ? 'Regístrate para guardar tu perfil y participar.' : 'Inicia sesión para acceder a tu cuenta.';
  document.querySelector('#name-field').classList.toggle('hidden', !register);
  document.querySelector('#auth-submit').innerHTML = register ? 'Crear cuenta <span>↗</span>' : 'Iniciar sesión <span>↗</span>';
  document.querySelector('#auth-toggle').textContent = register ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  document.querySelector('#auth-message').textContent = '';
  document.querySelector('#auth-form [name="password"]').autocomplete = register ? 'new-password' : 'current-password';
}

document.querySelector('#auth-open').addEventListener('click', () => { if (!supabase) { showNotice('Primero conecta la URL y la clave pública de Supabase en app.js.', true); return; } setAuthMode('login'); authDialog.showModal(); });
document.querySelector('#auth-toggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  const form = new FormData(event.currentTarget);
  const email = form.get('email'); const password = form.get('password');
  const message = document.querySelector('#auth-message');
  const result = authMode === 'register'
    ? await supabase.auth.signUp({ email, password, options: { data: { display_name: form.get('display_name') || 'Lector' } } })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) { message.textContent = result.error.message; return; }
  if (authMode === 'register' && !result.data.session) { message.textContent = 'Cuenta creada. Revisa tu correo para confirmar el registro.'; return; }
  authDialog.close(); event.currentTarget.reset(); await syncSession(result.data.session);
});
document.querySelector('#signout').addEventListener('click', async () => { await supabase.auth.signOut(); });
categoriesEl.addEventListener('click', event => {
  const button = event.target.closest('[data-category]'); if (!button) return;
  activeCategory = button.dataset.category; renderCategoryButtons(); loadNews();
});
document.querySelector('#news-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!supabase || !currentUser) return;
  const form = new FormData(event.currentTarget); const publish = form.get('publish') === 'on';
  const row = {
    title: form.get('title').trim(), slug: slugify(form.get('title').trim()), summary: form.get('summary').trim() || null,
    content: form.get('content').trim(), image_url: form.get('image_url').trim() || null,
    category_id: Number(form.get('category')), author_id: currentUser.id,
    status: publish ? 'publicada' : 'borrador', published_at: publish ? new Date().toISOString() : null
  };
  const { error } = await supabase.from('news').insert(row);
  if (error) { showNotice(`No se pudo guardar: ${error.message}`, true); return; }
  event.currentTarget.reset(); showNotice(publish ? 'Noticia publicada.' : 'Borrador guardado.'); await loadNews();
});

categoriesEl.addEventListener('click', event => {
  const button = event.target.closest('[data-category]'); if (!button) return;
  document.querySelectorAll('.category-chip').forEach(chip => chip.classList.toggle('selected', chip === button));
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => { queueMicrotask(() => syncSession(session)); });
}
await loadCategories();
await loadNews();
