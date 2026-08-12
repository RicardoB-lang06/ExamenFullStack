const TYPE_NAMES = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

const TYPE_COLORS = {
  normal: ['#ebe7df', '#6f6a61'], fire: ['#f8dfd5', '#a34732'], water: ['#dce8f2', '#356a91'],
  electric: ['#f7edbd', '#927716'], grass: ['#dcebd9', '#4e7a47'], ice: ['#dbefed', '#397b79'],
  fighting: ['#efddd8', '#934838'], poison: ['#ebddec', '#754b7b'], ground: ['#eee3c9', '#866c35'],
  flying: ['#e1e3f1', '#5c6593'], psychic: ['#f5dce5', '#9d4266'], bug: ['#e5e9ca', '#6d7d2b'],
  rock: ['#e8e1cf', '#756642'], ghost: ['#e3dfea', '#665578'], dragon: ['#dedaf0', '#574688'],
  dark: ['#dedbd7', '#544e48'], steel: ['#e1e6e6', '#566d70'], fairy: ['#f4dfea', '#9a5679'],
};

const STAT_NAMES = {
  hp: 'Salud', attack: 'Ataque', defense: 'Defensa',
  'special-attack': 'At. especial', 'special-defense': 'Def. especial', speed: 'Velocidad',
};

// estado de vista
const state = {
  user: null,
  collection: [],
  summary: { total: 0, favorites: 0, typeCounts: {} },
  items: [],
  page: 1,
  totalPages: 1,
  query: '',
  type: '',
  authMode: 'login',
  pendingPokemon: null,
  currentDetail: null,
  suggestions: { insights: null, loading: false },
};

const elements = {
  navLinks: [...document.querySelectorAll('.nav-link')],
  exploreView: document.querySelector('#explore-view'),
  collectionView: document.querySelector('#collection-view'),
  pokemonGrid: document.querySelector('#pokemon-grid'),
  collectionGrid: document.querySelector('#collection-grid'),
  exploreEmpty: document.querySelector('#explore-empty'),
  collectionEmpty: document.querySelector('#collection-empty'),
  pagination: document.querySelector('#pagination'),
  previousPage: document.querySelector('#previous-page'),
  nextPage: document.querySelector('#next-page'),
  pageLabel: document.querySelector('#page-label'),
  resultLabel: document.querySelector('#result-label'),
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#search-input'),
  typeFilter: document.querySelector('#type-filter'),
  collectionSearch: document.querySelector('#collection-search'),
  loginButton: document.querySelector('#login-button'),
  userMenu: document.querySelector('#user-menu'),
  userName: document.querySelector('#user-name'),
  userAvatar: document.querySelector('#user-avatar'),
  navCount: document.querySelector('#nav-count'),
  authModal: document.querySelector('#auth-modal'),
  authForm: document.querySelector('#auth-form'),
  authTitle: document.querySelector('#auth-title'),
  authSubtitle: document.querySelector('#auth-subtitle'),
  authSubmit: document.querySelector('#auth-submit'),
  authToggle: document.querySelector('#auth-toggle'),
  authError: document.querySelector('#auth-error'),
  passwordInput: document.querySelector('[name="password"]'),
  passwordHint: document.querySelector('#password-hint'),
  nameField: document.querySelector('#name-field'),
  detailModal: document.querySelector('#detail-modal'),
  detailContent: document.querySelector('#detail-content'),
  accountModal: document.querySelector('#account-modal'),
  accountName: document.querySelector('#account-name'),
  accountEmail: document.querySelector('#account-email'),
  logoutButton: document.querySelector('#logout-button'),
  totalStat: document.querySelector('#total-stat'),
  favoriteStat: document.querySelector('#favorite-stat'),
  typeStat: document.querySelector('#type-stat'),
  generateSuggestions: document.querySelector('#generate-suggestions'),
  suggestionsStatus: document.querySelector('#suggestions-status'),
  suggestionsResult: document.querySelector('#suggestions-result'),
  suggestionsOverview: document.querySelector('#suggestions-overview'),
  suggestionsStrengths: document.querySelector('#suggestions-strengths'),
  suggestionsGaps: document.querySelector('#suggestions-gaps'),
  suggestionsLabel: document.querySelector('#suggestions-label'),
  suggestionGrid: document.querySelector('#suggestion-grid'),
  toastRegion: document.querySelector('#toast-region'),
};

// llamadas al servidor
async function api(path, options = {}) {
  const request = { ...options, headers: { ...options.headers } };
  if (request.body && typeof request.body !== 'string') {
    request.headers['Content-Type'] = 'application/json';
    request.body = JSON.stringify(request.body);
  }
  const response = await fetch(path, request);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? 'No fue posible completar la solicitud.');
  return payload;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function titleCase(value = '') {
  return value.replace(/(^|-)(\w)/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`);
}

function typePills(types) {
  return types.map((type) => {
    const [background, color] = TYPE_COLORS[type] ?? ['#ecebe6', '#575a54'];
    return `<li class="type-pill" style="--type-bg:${background};--type-color:${color}">${escapeHtml(TYPE_NAMES[type] ?? type)}</li>`;
  }).join('');
}

function collectionItem(pokemonId) {
  return state.collection.find((item) => item.pokemonId === Number(pokemonId));
}

function cardTemplate(pokemon, { collection = false } = {}) {
  const pokemonId = pokemon.id ?? pokemon.pokemonId;
  const stored = collectionItem(pokemonId);
  const [softColor] = TYPE_COLORS[pokemon.types[0]] ?? ['#e8ebdf'];
  const headingId = `pokemon-${collection ? 'collection' : 'catalog'}-${pokemonId}`;
  return `
    <article class="pokemon-card" data-pokemon-id="${pokemonId}" style="--type-soft:${softColor}" aria-labelledby="${headingId}">
      <figure class="card-visual">
        <figcaption class="pokemon-number">#${String(pokemonId).padStart(4, '0')}</figcaption>
        <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(titleCase(pokemon.name))}" loading="lazy" />
      </figure>
      <section class="card-content">
        <ul class="types" aria-label="Tipos">${typePills(pokemon.types)}</ul>
        <h3 id="${headingId}">${escapeHtml(pokemon.name)}</h3>
        <footer class="card-actions">
          ${collection ? `
            <button class="card-action favorite-button ${stored?.isFavorite ? 'is-favorite' : ''}" data-action="favorite" aria-label="${stored?.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}">${stored?.isFavorite ? '♥' : '♡'}</button>
          ` : ''}
          <button class="card-action" data-action="detail" aria-label="Ver detalles">↗</button>
          <button class="card-action primary ${stored ? 'is-added' : ''}" data-action="toggle-collection">
            ${stored ? (collection ? 'Quitar' : 'Guardado ✓') : 'Agregar'}
          </button>
        </footer>
      </section>
    </article>`;
}

function renderSkeletons() {
  elements.pokemonGrid.innerHTML = Array.from({ length: 9 }, () => '<article class="skeleton" aria-hidden="true"></article>').join('');
  elements.exploreEmpty.hidden = true;
  elements.pagination.hidden = true;
}

function renderExplore() {
  elements.pokemonGrid.innerHTML = state.items.map((pokemon) => cardTemplate(pokemon)).join('');
  elements.exploreEmpty.hidden = state.items.length > 0;
  elements.pagination.hidden = state.items.length === 0 || Boolean(state.query);
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= state.totalPages;
  elements.pageLabel.textContent = `Página ${state.page} de ${state.totalPages}`;
  elements.resultLabel.textContent = state.query
    ? `${state.items.length} resultado${state.items.length === 1 ? '' : 's'} para “${state.query}”`
    : `Página ${state.page} · ${state.type ? TYPE_NAMES[state.type] : 'Todos los tipos'}`;
}

function renderCollection() {
  const search = elements.collectionSearch.value.trim().toLowerCase();
  const visible = state.collection.filter((item) => item.name.includes(search));
  elements.collectionGrid.innerHTML = visible.map((pokemon) => cardTemplate(pokemon, { collection: true })).join('');
  elements.collectionEmpty.hidden = visible.length > 0;
  const isFilteredEmpty = state.collection.length > 0 && visible.length === 0;
  if (isFilteredEmpty) {
    elements.collectionEmpty.querySelector('h3').textContent = 'No hay coincidencias en tu colección';
    elements.collectionEmpty.querySelector('p').textContent = 'Prueba con otro nombre.';
    elements.collectionEmpty.querySelector('[data-go-explore]').hidden = true;
  } else {
    elements.collectionEmpty.querySelector('h3').textContent = 'Tu colección espera su primer Pokémon';
    elements.collectionEmpty.querySelector('p').textContent = 'Explora la Pokédex y guarda a los que quieras llevar contigo.';
    elements.collectionEmpty.querySelector('[data-go-explore]').hidden = false;
  }
  elements.totalStat.textContent = state.summary.total;
  elements.favoriteStat.textContent = state.summary.favorites;
  elements.typeStat.textContent = Object.keys(state.summary.typeCounts).length;
  elements.navCount.textContent = state.summary.total;
  renderSuggestions();
}

// pinta sugerencias
function renderSuggestions() {
  const { insights, loading } = state.suggestions;
  const hasCollection = state.collection.length > 0;
  elements.generateSuggestions.disabled = !hasCollection || loading;
  elements.generateSuggestions.textContent = loading ? 'Preparando sugerencias…' : 'Ver sugerencias';

  if (loading) {
    elements.suggestionsStatus.textContent = 'Revisando los tipos de tu colección…';
  } else if (!hasCollection) {
    elements.suggestionsStatus.textContent = 'Agrega al menos un Pokémon para ver sugerencias.';
  } else if (insights) {
    elements.suggestionsStatus.textContent = 'Sugerencias listas. Puedes actualizarlas cuando cambie tu colección.';
  } else {
    elements.suggestionsStatus.textContent = 'Sugerencias basadas en los tipos de tu colección.';
  }

  elements.suggestionsResult.hidden = !insights;
  if (!insights) return;

  elements.suggestionsOverview.textContent = insights.overview;
  elements.suggestionsStrengths.innerHTML = insights.strengths
    .map((strength) => `<li>${escapeHtml(strength)}</li>`)
    .join('');
  elements.suggestionsGaps.innerHTML = insights.gaps
    .map((gap) => `<li>${escapeHtml(gap)}</li>`)
    .join('');
  const generatedAt = new Date(insights.generatedAt);
  const generatedLabel = Number.isNaN(generatedAt.valueOf())
    ? ''
    : ` · ${generatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  elements.suggestionsLabel.textContent = `Basado en los tipos de tu colección${generatedLabel}`;
  elements.suggestionGrid.innerHTML = insights.recommendations.map((recommendation) => {
    const stored = collectionItem(recommendation.pokemonId);
    return `
      <article class="recommendation-card">
        <figure>
          <img src="${escapeHtml(recommendation.image)}" alt="${escapeHtml(titleCase(recommendation.name))}" loading="lazy" />
        </figure>
        <section>
          <h4>${escapeHtml(recommendation.name)}</h4>
          <span class="recommendation-type">${escapeHtml(TYPE_NAMES[recommendation.suggestedType] ?? recommendation.suggestedType)}</span>
          <p>${escapeHtml(recommendation.reason)}</p>
        </section>
        <button class="button ${stored ? 'button-light' : 'button-dark'}" type="button" data-suggestion-add="${recommendation.pokemonId}" ${stored ? 'disabled' : ''}>
          ${stored ? 'Ya está en tu colección' : 'Agregar recomendación'}
        </button>
      </article>`;
  }).join('') || '<p>No fue posible verificar recomendaciones en PokéAPI esta vez.</p>';
}

function renderAccount() {
  elements.loginButton.hidden = Boolean(state.user);
  elements.userMenu.hidden = !state.user;
  if (!state.user) return;
  elements.userName.textContent = state.user.name;
  elements.userAvatar.textContent = state.user.name.slice(0, 1).toUpperCase();
  elements.accountName.textContent = state.user.name;
  elements.accountEmail.textContent = state.user.email;
}

async function loadPokemon() {
  renderSkeletons();
  const params = new URLSearchParams({ page: state.page, limit: 18 });
  if (state.query) params.set('query', state.query);
  if (state.type) params.set('type', state.type);
  try {
    const result = await api(`/api/pokemon?${params}`);
    state.items = result.items;
    state.totalPages = result.totalPages;
  } catch (error) {
    state.items = [];
    toast(error.message, 'error');
  }
  renderExplore();
}

async function loadCollection() {
  state.suggestions.insights = null;
  if (!state.user) {
    state.collection = [];
    state.summary = { total: 0, favorites: 0, typeCounts: {} };
    renderCollection();
    return;
  }
  try {
    const result = await api('/api/collection');
    state.collection = result.items;
    state.summary = result.summary;
    renderCollection();
    renderExplore();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function generateSuggestions() {
  state.suggestions.loading = true;
  renderSuggestions();
  try {
    const result = await api('/api/recommendations', { method: 'POST' });
    state.suggestions.insights = result.insights;
    toast('Sugerencias actualizadas.');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.suggestions.loading = false;
    renderSuggestions();
  }
}

function showView(view) {
  if (view === 'collection' && !state.user) {
    openAuth();
    toast('Inicia sesión para ver tu colección.');
    return;
  }
  elements.exploreView.hidden = view !== 'explore';
  elements.collectionView.hidden = view !== 'collection';
  elements.navLinks.forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAuth(mode = 'login') {
  state.authMode = mode;
  elements.authForm.reset();
  elements.authError.textContent = '';
  updateAuthModal();
  elements.authModal.showModal();
}

function updateAuthModal() {
  const isRegister = state.authMode === 'register';
  elements.nameField.hidden = !isRegister;
  elements.nameField.querySelector('input').required = isRegister;
  elements.authTitle.textContent = isRegister ? 'Crea tu cuenta' : 'Inicia sesión';
  elements.authSubtitle.textContent = isRegister
    ? 'Guarda Pokémon, favoritos y notas en un espacio personal.'
    : 'Accede a tu colección desde cualquier momento.';
  elements.authSubmit.textContent = isRegister ? 'Crear cuenta' : 'Iniciar sesión';
  elements.passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
  elements.passwordInput.minLength = 8;
  elements.passwordInput.placeholder = 'Mínimo 8 caracteres';
  elements.passwordHint.textContent = isRegister
    ? 'Debe tener entre 8 y 128 caracteres.'
    : 'Usa tu contraseña para acceder.';
  elements.authToggle.textContent = isRegister ? 'Iniciar sesión' : 'Crear cuenta';
  elements.authToggle.parentElement.firstChild.textContent = isRegister
    ? '¿Ya tienes una cuenta? '
    : '¿Aún no tienes cuenta? ';
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authError.textContent = '';
  const form = new FormData(elements.authForm);
  const body = Object.fromEntries(form);
  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = 'Un momento…';
  try {
    const result = await api(`/api/auth/${state.authMode}`, { method: 'POST', body });
    if (result.confirmationRequired) {
      elements.authModal.close();
      toast('Cuenta creada. Revisa tu correo para confirmar el acceso.');
      return;
    }
    state.user = result.user;
    renderAccount();
    await loadCollection();
    elements.authModal.close();
    toast(state.authMode === 'register' ? 'Cuenta creada. ¡Bienvenido!' : 'Sesión iniciada.');
    if (state.pendingPokemon) {
      const pokemon = state.pendingPokemon;
      state.pendingPokemon = null;
      await addPokemon(pokemon);
    }
  } catch (error) {
    elements.authError.textContent = error.message;
  } finally {
    elements.authSubmit.disabled = false;
    updateAuthModal();
  }
}

async function addPokemon(pokemon) {
  if (!state.user) {
    state.pendingPokemon = pokemon;
    openAuth();
    toast('Crea una cuenta o inicia sesión para guardar Pokémon.');
    return;
  }
  await api(`/api/collection/${pokemon.id ?? pokemon.pokemonId}`, {
    method: 'POST',
    body: {
      id: pokemon.id ?? pokemon.pokemonId,
      name: pokemon.name,
      image: pokemon.image,
      types: pokemon.types,
    },
  });
  await loadCollection();
  toast(`${titleCase(pokemon.name)} se agregó a tu colección.`);
}

async function removePokemon(pokemonId) {
  const item = collectionItem(pokemonId);
  if (!item) return;
  await api(`/api/collection/${pokemonId}`, { method: 'DELETE' });
  await loadCollection();
  toast(`${titleCase(item.name)} salió de tu colección.`);
}

async function toggleFavorite(pokemonId) {
  const item = collectionItem(pokemonId);
  if (!item) return;
  await api(`/api/collection/${pokemonId}`, {
    method: 'PATCH',
    body: { note: item.note, isFavorite: !item.isFavorite },
  });
  await loadCollection();
}

async function toggleCollection(pokemon) {
  const pokemonId = pokemon.id ?? pokemon.pokemonId;
  try {
    if (collectionItem(pokemonId)) await removePokemon(pokemonId);
    else await addPokemon(pokemon);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function detailTemplate(pokemon) {
  const stored = collectionItem(pokemon.id);
  const [softColor] = TYPE_COLORS[pokemon.types[0]] ?? ['#e8ebdf'];
  const stats = Object.entries(pokemon.stats ?? {}).map(([name, value]) => `
    <div class="stat-line">
      <dt>${escapeHtml(STAT_NAMES[name] ?? name)}</dt>
      <dd class="stat-track" role="meter" aria-valuemin="0" aria-valuemax="180" aria-valuenow="${value}"><i style="width:${Math.min(100, value / 1.8)}%"></i></dd>
      <dd><data value="${value}">${value}</data></dd>
    </div>`).join('');
  return `
    <article class="detail-layout" style="--type-soft:${softColor}" aria-labelledby="detail-pokemon-name">
      <figure class="detail-visual">
        <figcaption class="pokemon-number">#${String(pokemon.id).padStart(4, '0')}</figcaption>
        <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(titleCase(pokemon.name))}" />
      </figure>
      <section class="detail-info">
        <p class="eyebrow">Pokédex nacional</p>
        <h2 id="detail-pokemon-name">${escapeHtml(pokemon.name)}</h2>
        <ul class="types" aria-label="Tipos">${typePills(pokemon.types)}</ul>
        <dl class="detail-metrics">
          <div class="metric"><dt>Altura</dt><dd>${pokemon.height} m</dd></div>
          <div class="metric"><dt>Peso</dt><dd>${pokemon.weight} kg</dd></div>
          <div class="metric" style="grid-column:1/-1"><dt>Habilidades</dt><dd>${escapeHtml(pokemon.abilities?.map(titleCase).join(', ') || '—')}</dd></div>
        </dl>
        <dl class="stats-list" aria-label="Estadísticas base">${stats}</dl>
        ${stored ? `
          <fieldset class="note-editor">
            <legend>Nota personal</legend>
            <textarea id="pokemon-note" maxlength="500" placeholder="¿Por qué forma parte de tu equipo?">${escapeHtml(stored.note)}</textarea>
          </fieldset>` : ''}
        <footer class="detail-actions">
          <button class="button ${stored ? 'button-light remove-button' : 'button-dark'}" data-detail-action="toggle">
            ${stored ? 'Quitar de colección' : 'Agregar a mi colección'}
          </button>
          ${stored ? `<button class="button button-dark" data-detail-action="save">Guardar nota</button>` : ''}
        </footer>
      </section>
    </article>`;
}

async function openDetail(pokemon) {
  elements.detailContent.innerHTML = '<article class="skeleton" style="min-height:520px" aria-label="Cargando detalles"></article>';
  elements.detailModal.showModal();
  try {
    const result = pokemon.stats ? { pokemon } : await api(`/api/pokemon/${pokemon.name}`);
    state.currentDetail = result.pokemon;
    elements.detailContent.innerHTML = detailTemplate(state.currentDetail);
  } catch (error) {
    elements.detailModal.close();
    toast(error.message, 'error');
  }
}

async function saveNote() {
  const item = collectionItem(state.currentDetail.id);
  const note = document.querySelector('#pokemon-note')?.value ?? '';
  await api(`/api/collection/${state.currentDetail.id}`, {
    method: 'PATCH', body: { note, isFavorite: item.isFavorite },
  });
  await loadCollection();
  toast('Nota guardada.');
  elements.detailModal.close();
}

function pokemonFromCard(card) {
  const id = Number(card.dataset.pokemonId);
  return state.items.find((item) => item.id === id) ?? collectionItem(id);
}

async function handleCardAction(event) {
  const button = event.target.closest('[data-action]');
  const card = event.target.closest('.pokemon-card');
  if (!button || !card) return;
  const pokemon = pokemonFromCard(card);
  if (!pokemon) return;
  if (button.dataset.action === 'detail') await openDetail(pokemon);
  if (button.dataset.action === 'toggle-collection') await toggleCollection(pokemon);
  if (button.dataset.action === 'favorite') await toggleFavorite(pokemon.id ?? pokemon.pokemonId);
}

function toast(message, type = 'success') {
  const element = document.createElement('output');
  element.className = `toast ${type}`;
  element.textContent = message;
  elements.toastRegion.append(element);
  setTimeout(() => element.remove(), 3600);
}

function closeModalFromBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

elements.navLinks.forEach((button) => button.addEventListener('click', () => {
  showView(button.dataset.view);
  if (button.dataset.view === 'explore' && state.items.length === 0) loadPokemon();
}));
elements.loginButton.addEventListener('click', () => openAuth());
elements.userMenu.addEventListener('click', () => elements.accountModal.showModal());
elements.authToggle.addEventListener('click', () => {
  state.authMode = state.authMode === 'login' ? 'register' : 'login';
  elements.authForm.reset();
  elements.authError.textContent = '';
  updateAuthModal();
});
elements.authForm.addEventListener('submit', submitAuth);
elements.logoutButton.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  state.collection = [];
  state.summary = { total: 0, favorites: 0, typeCounts: {} };
  state.suggestions.insights = null;
  renderAccount();
  renderCollection();
  renderExplore();
  elements.accountModal.close();
  showView('explore');
  if (state.items.length === 0) loadPokemon();
  toast('Sesión cerrada.');
});

elements.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.query = elements.searchInput.value.trim().toLowerCase();
  state.type = state.query ? '' : elements.typeFilter.value;
  state.page = 1;
  loadPokemon();
});
elements.typeFilter.addEventListener('change', () => {
  elements.searchInput.value = '';
  state.query = '';
  state.type = elements.typeFilter.value;
  state.page = 1;
  loadPokemon();
});
document.querySelector('#clear-search').addEventListener('click', () => {
  elements.searchInput.value = '';
  elements.typeFilter.value = '';
  state.query = '';
  state.type = '';
  state.page = 1;
  loadPokemon();
});
elements.previousPage.addEventListener('click', () => { state.page -= 1; loadPokemon(); window.scrollTo({ top: 540, behavior: 'smooth' }); });
elements.nextPage.addEventListener('click', () => { state.page += 1; loadPokemon(); window.scrollTo({ top: 540, behavior: 'smooth' }); });
elements.collectionSearch.addEventListener('input', renderCollection);
elements.generateSuggestions.addEventListener('click', generateSuggestions);
elements.suggestionGrid.addEventListener('click', async (event) => {
  const pokemonId = Number(event.target.closest('[data-suggestion-add]')?.dataset.suggestionAdd);
  const recommendation = state.suggestions.insights?.recommendations
    .find((item) => item.pokemonId === pokemonId);
  if (!recommendation) return;
  try {
    await addPokemon({
      id: recommendation.pokemonId,
      name: recommendation.name,
      image: recommendation.image,
      types: recommendation.types,
    });
  } catch (error) {
    toast(error.message, 'error');
  }
});
elements.pokemonGrid.addEventListener('click', handleCardAction);
elements.collectionGrid.addEventListener('click', handleCardAction);
document.querySelector('[data-go-explore]').addEventListener('click', () => {
  showView('explore');
  if (state.items.length === 0) loadPokemon();
});

elements.detailContent.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-detail-action]')?.dataset.detailAction;
  if (!action || !state.currentDetail) return;
  try {
    if (action === 'save') await saveNote();
    if (action === 'toggle') {
      await toggleCollection(state.currentDetail);
      elements.detailContent.innerHTML = detailTemplate(state.currentDetail);
    }
  } catch (error) {
    toast(error.message, 'error');
  }
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
[elements.authModal, elements.detailModal, elements.accountModal].forEach((dialog) => {
  dialog.addEventListener('click', closeModalFromBackdrop);
});

// arranque inicial
async function initialize() {
  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
    renderAccount();
    if (user) await loadCollection();
  } catch (error) {
    toast(error.message, 'error');
  }
  const requestedView = location.hash === '#collection' ? 'collection' : 'explore';
  showView(requestedView);
  if (requestedView === 'explore') await loadPokemon();
}

initialize();
