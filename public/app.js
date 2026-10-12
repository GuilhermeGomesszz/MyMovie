const state = {
  user: null,
  genres: [],
  watchlist: [],
  currentMovie: null,
  searchTimer: null,
  toastTimer: null,
  watchlistFilter: "ALL",
  categoryId: null,
  categoryMovies: [],
  authMode: "login",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Não foi possível concluir a solicitação (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const posterMarkup = (movie) => {
  const poster = movie.posterUrl || "";
  return `<div class="movie-poster">${poster
    ? `<img src="${escapeHtml(poster)}" alt="Pôster de ${escapeHtml(movie.title)}" loading="lazy" onerror="this.style.display='none'">`
    : ""}${movie.voteAverage ? `<span class="movie-rating">★ ${Number(movie.voteAverage).toFixed(1)}</span>` : movie.communityRating ? `<span class="movie-rating">★ ${Number(movie.communityRating).toFixed(1)}</span>` : ""}</div>`;
};

function movieCard(movie, { watchlistItem = null } = {}) {
  const movieId = movie.localMovieId || movie.id;
  const subtitle = [
    movie.releaseYear || (movie.release_date || "").slice(0, 4),
    (movie.genres || []).slice(0, 2).join(" · "),
  ].filter(Boolean).join(" · ");
  return `<article class="movie-card" tabindex="0" role="button" data-open-movie="${escapeHtml(movieId)}">
    <div class="movie-poster-wrap">${posterMarkup(movie)}
      <button class="movie-add" data-add-movie="${escapeHtml(movie.localMovieId || (movie.tmdbId ? `tmdb-${movie.tmdbId}` : movie.id))}" aria-label="Adicionar ${escapeHtml(movie.title)} à minha lista">${watchlistItem ? "✓" : "+"}</button>
    </div>
    <div class="movie-info"><h3 class="movie-title">${escapeHtml(movie.title)}</h3><p class="movie-subtitle">${escapeHtml(watchlistItem ? statusLabel(watchlistItem.status) : subtitle || "Descubra este filme")}</p></div>
  </article>`;
}

function renderMovies(target, movies, options = {}) {
  const container = typeof target === "string" ? $(target) : target;
  if (!container) return;
  if (!movies?.length) {
    container.innerHTML = `<div class="empty-state"><h3>Ainda não há filmes por aqui</h3><p>${escapeHtml(options.emptyMessage || "Tente novamente mais tarde.")}</p></div>`;
    return;
  }
  container.innerHTML = movies.map((movie) => movieCard(movie, options)).join("");
}

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3200);
}

function statusLabel(status) {
  return ({
    TO_WATCH: "Quero assistir",
    WATCHING: "Assistindo",
    WATCHED: "Já assisti",
    DROPPED: "Abandonei",
  })[status] || status;
}

function setActiveView(view) {
  $$(".view").forEach((section) => section.classList.remove("is-visible"));
  $(`#${view}View`)?.classList.add("is-visible");
  $$("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $("#searchResults").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (view === "categories") loadCategories();
  if (view === "watchlist") loadWatchlist();
  if (view === "recommendations") loadRecommendations();
}

function showLoading(target, count = 6) {
  const container = $(target);
  if (container) container.innerHTML = Array.from({ length: count }, () => '<div class="skeleton"></div>').join("");
}

async function loadDiscovery(sort, target) {
  showLoading(target);
  try {
    const result = await api(`/movie/discover?sort=${encodeURIComponent(sort)}`);
    renderMovies(target, result.data);
    if (sort === "popular" && result.data.length) setHero(result.data[0]);
  } catch (error) {
    $(target).innerHTML = `<div class="empty-state"><h3>Não foi possível carregar os filmes</h3><p>${escapeHtml(error.message)}. Confira a configuração da API do TMDB.</p></div>`;
  }
}

function setHero(movie) {
  state.heroMovie = movie;
  $("#hero").style.setProperty("--hero-image", `url("${String(movie.backdropUrl || movie.posterUrl).replace(/["\\]/g, "")}")`);
  $(".hero-image").style.backgroundImage = `linear-gradient(90deg, #15141afa 0%, #15141ab8 37%, #15141a42 74%, #15141a48 100%), linear-gradient(0deg, #101014 0%, transparent 28%), url("${String(movie.backdropUrl || movie.posterUrl).replace(/["\\]/g, "")}")`;
  $("#heroKicker").textContent = "EM DESTAQUE";
  $("#heroTitle").textContent = movie.title;
  $("#heroTitle").style.whiteSpace = "normal";
  $("#heroOverview").textContent = movie.overview || "Uma história esperando para ser descoberta.";
  $("#heroMeta").innerHTML = [movie.releaseYear, ...(movie.genres || []).slice(0, 2)]
    .filter(Boolean).map((value) => `<span>${escapeHtml(value)}</span>`).join("");
  $("#heroDetails").hidden = false;
}

async function loadCategories() {
  try {
    const result = await api("/movie/categories");
    state.genres = result.data || [];
    renderCategoryControls();
    if (state.categoryId) await loadCategoryMovies(state.categoryId);
    else if (state.genres.length) await loadCategoryMovies(state.genres[0].externalId);
  } catch (error) {
    $("#categoryFilters").innerHTML = "";
    $("#categoryGrid").innerHTML = `<div class="empty-state"><h3>Não foi possível carregar as categorias</h3><p>${escapeHtml(error.message)}. Configure a chave do TMDB no ambiente do servidor.</p></div>`;
  }
}

function renderCategoryControls() {
  const controls = state.genres.map((genre) =>
    `<button class="category-filter ${String(genre.externalId) === String(state.categoryId) ? "is-active" : ""}" data-category-id="${escapeHtml(genre.externalId)}">${escapeHtml(genre.name)}</button>`,
  ).join("");
  $("#categoryFilters").innerHTML = controls;
  $("#genreChips").innerHTML = state.genres.slice(0, 8).map((genre) =>
    `<button class="genre-chip" data-category-id="${escapeHtml(genre.externalId)}">${escapeHtml(genre.name)}</button>`,
  ).join("");
}

async function loadCategoryMovies(genreId) {
  state.categoryId = String(genreId);
  $$(".category-filter").forEach((button) =>
    button.classList.toggle("is-active", button.dataset.categoryId === state.categoryId));
  const category = state.genres.find(({ externalId }) => String(externalId) === state.categoryId);
  if (category) $("#categoryGrid").setAttribute("aria-label", `Filmes de ${category.name}`);
  showLoading("#categoryGrid", 12);
  try {
    const result = await api(`/movie/discover?sort=popular&genreId=${encodeURIComponent(genreId)}`);
    state.categoryMovies = result.data || [];
    renderMovies("#categoryGrid", state.categoryMovies, { emptyMessage: "Não encontramos filmes para essa categoria." });
  } catch (error) {
    $("#categoryGrid").innerHTML = `<div class="empty-state"><h3>Não foi possível carregar esta categoria</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadWatchlist() {
  if (!state.user) {
    $("#watchlistGrid").innerHTML = `<div class="empty-state"><h3>Sua próxima sessão começa com uma lista</h3><p>Entre ou crie uma conta para guardar filmes, marcar o que já assistiu e receber recomendações feitas para você.</p><button class="button button-primary" data-open-auth>Entrar ou criar conta</button></div>`;
    $("#watchlistFilters").innerHTML = "";
    return;
  }
  try {
    state.watchlist = await api("/watchlist");
    renderWatchlistFilters();
    renderWatchlist();
  } catch (error) {
    if (error.status === 401) setUser(null);
    $("#watchlistGrid").innerHTML = `<div class="empty-state"><h3>Não foi possível carregar sua lista</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderWatchlistFilters() {
  const filters = [
    ["ALL", "Todos"],
    ["TO_WATCH", "Quero assistir"],
    ["WATCHING", "Assistindo"],
    ["WATCHED", "Já assisti"],
    ["DROPPED", "Abandonei"],
  ];
  $("#watchlistFilters").innerHTML = filters.map(([value, label]) =>
    `<button class="status-filter ${value === state.watchlistFilter ? "is-active" : ""}" data-watchlist-filter="${value}">${label}</button>`,
  ).join("");
}

function renderWatchlist() {
  const items = state.watchlist.filter((item) =>
    state.watchlistFilter === "ALL" || item.status === state.watchlistFilter);
  const target = $("#watchlistGrid");
  if (!items.length) {
    target.innerHTML = `<div class="empty-state"><h3>Seu próximo filme está por aí</h3><p>Adicione um filme à lista e ele aparece aqui.</p><button class="button button-primary" data-view="categories">Explorar categorias</button></div>`;
    return;
  }
  target.innerHTML = items.map((item) => movieCard(item.movie, { watchlistItem: item })).join("");
  $$(".movie-card", target).forEach((card) => {
    const item = items.find(({ movie }) => (movie.tmdbId ? `tmdb-${movie.tmdbId}` : movie.id) === card.dataset.openMovie
      || movie.id === card.dataset.openMovie);
    if (item) {
      const status = document.createElement("select");
      status.className = "status-filter";
      status.setAttribute("aria-label", `Status de ${item.movie.title}`);
      status.style.marginTop = "8px";
      status.dataset.watchlistStatus = item.movie.id;
      status.innerHTML = ["TO_WATCH", "WATCHING", "WATCHED", "DROPPED"].map((value) =>
        `<option value="${value}" ${item.status === value ? "selected" : ""}>${statusLabel(value)}</option>`,
      ).join("");
      card.querySelector(".movie-info").append(status);
    }
  });
}

async function loadRecommendations() {
  if (!state.user) {
    $("#recommendationsPageGrid").innerHTML = `<div class="empty-state"><h3>Recomendações que evoluem com você</h3><p>Entre para receber sugestões baseadas nos filmes que você adicionou e nos gêneros que mais gosta.</p><button class="button button-primary" data-open-auth>Entrar ou criar conta</button></div>`;
    $("#recommendationsIntro").textContent = "Suas escolhas ajudam a encontrar o próximo filme perfeito.";
    return;
  }
  showLoading("#recommendationsPageGrid", 12);
  try {
    const result = await api("/movie/recommendations");
    renderMovies("#recommendationsPageGrid", result.data, { emptyMessage: "Adicione mais filmes à sua lista para receber novas sugestões." });
    $("#recommendationsIntro").textContent = result.basedOn?.length
      ? `Sugestões inspiradas nos gêneros ${result.basedOn.join(", ")} da sua lista.`
      : "Um ponto de partida: os filmes populares de hoje. Adicione alguns títulos para personalizar as próximas sugestões.";
  } catch (error) {
    $("#recommendationsPageGrid").innerHTML = `<div class="empty-state"><h3>Não foi possível gerar recomendações</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function setUser(user) {
  state.user = user;
  $("#accountLabel").textContent = user?.name?.split(/\s+/)[0] || "Entrar";
  $("#accountButton").setAttribute("aria-label", user ? `Sair da conta de ${user.name}` : "Entrar ou criar conta");
  $("#recommendationsSection").hidden = !user;
  if (user) {
    loadWatchlist();
    loadRecommendationPreview();
  } else {
    state.watchlist = [];
    $("#recommendationsGrid").innerHTML = "";
  }
}

async function loadRecommendationPreview() {
  try {
    const result = await api("/movie/recommendations");
    renderMovies("#recommendationsGrid", result.data?.slice(0, 8));
    $("#recommendationBasis").textContent = result.basedOn?.length
      ? `Com base em ${result.basedOn.join(", ")}`
      : "Uma seleção popular para começar sua curadoria";
  } catch (error) {
    $("#recommendationsGrid").innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function initializeUser() {
  try {
    setUser(await api("/auth/me"));
  } catch (error) {
    if (error.status !== 401) console.error("Não foi possível verificar a sessão:", error);
    setUser(null);
  }
}

function openAuth() {
  $("#authError").textContent = "";
  $("#authDialog").showModal();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === "register";
  $("#authTitle").textContent = isRegister ? "Faça parte da conversa." : "Entre para sua comunidade.";
  $("#authDescription").textContent = isRegister
    ? "Crie sua conta para montar sua lista e descobrir filmes feitos para você."
    : "Salve filmes, receba recomendações e participe da conversa.";
  $("#nameField").hidden = !isRegister;
  $("#nameField input").required = isRegister;
  $("#authForm [name=password]").autocomplete = isRegister ? "new-password" : "current-password";
  $("#authSubmit").textContent = isRegister ? "Criar minha conta" : "Entrar";
  $("#authToggle").innerHTML = isRegister
    ? "Já tem uma conta? <strong>Entre aqui</strong>"
    : "Ainda não tem conta? <strong>Crie agora</strong>";
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form.entries());
  $("#authError").textContent = "";
  try {
    const result = await api(`/auth/${state.authMode}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setUser(result.data.user);
    $("#authDialog").close();
    event.currentTarget.reset();
    toast(`Boas-vindas${result.data.user.name ? `, ${result.data.user.name.split(" ")[0]}` : ""}!`);
    if ($("#watchlistView").classList.contains("is-visible")) loadWatchlist();
  } catch (error) {
    $("#authError").textContent = error.message;
  }
}

async function signOut() {
  try {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    toast("Você saiu da sua conta.");
    if ($("#watchlistView").classList.contains("is-visible")) loadWatchlist();
  } catch (error) {
    toast(error.message, true);
  }
}

async function searchMovies(query) {
  const results = $("#searchResults");
  if (query.trim().length < 2) {
    results.hidden = true;
    return;
  }
  results.hidden = false;
  results.innerHTML = '<p class="search-empty">Buscando filmes...</p>';
  try {
    const response = await api(`/movie/search?q=${encodeURIComponent(query.trim())}`);
    const smartGenres = response.smartGenres?.length
      ? `<p class="search-label">Seus gêneros em alta</p><div class="smart-genres">${response.smartGenres.map(({ name, count }) => `<span class="smart-genre">${escapeHtml(name)} · ${count}</span>`).join("")}</div>`
      : "";
    const matches = response.data || [];
    const resultsMarkup = matches.map((movie) => `<button class="search-result" data-open-movie="${escapeHtml(movie.localMovieId || movie.id)}">
      <img src="${escapeHtml(movie.posterUrl || "")}" alt="" loading="lazy" onerror="this.style.display='none'">
      <span class="search-result-copy"><strong>${escapeHtml(movie.title)}</strong><span>${escapeHtml([movie.releaseYear, ...(movie.genres || []).slice(0, 2)].filter(Boolean).join(" · "))}</span></span>
    </button>`).join("");
    const tmdbMessage = response.tmdbError
      ? `<p class="search-error">Busca do TMDB indisponível: ${escapeHtml(response.tmdbError.message)}</p>`
      : "";
    results.innerHTML = `${smartGenres}${resultsMarkup || '<p class="search-empty">Nenhum filme encontrado. Tente outro título ou gênero.</p>'}${tmdbMessage}`;
  } catch (error) {
    results.innerHTML = `<p class="search-error">${escapeHtml(error.message)}</p>`;
  }
}

async function addToWatchlist(movieId) {
  if (!state.user) {
    openAuth();
    toast("Entre para adicionar filmes à sua lista.");
    return;
  }
  try {
    const isTmdbId = String(movieId).startsWith("tmdb-");
    const movie = isTmdbId
      ? await api(`/movie/import/${encodeURIComponent(String(movieId).slice(5))}`, { method: "POST" })
      : await api(`/movie/${encodeURIComponent(movieId)}`);
    await api("/watchlist", {
      method: "POST",
      body: JSON.stringify({ movieId: movie.id, status: "TO_WATCH" }),
    });
    state.watchlist = await api("/watchlist");
    toast("Adicionado à sua lista.");
    if ($("#watchlistView").classList.contains("is-visible")) renderWatchlist();
    if (state.currentMovie && (state.currentMovie.tmdbId === movie.tmdbId || state.currentMovie.id === movie.id)) {
      state.currentMovie.localMovieId = movie.id;
      updateMovieAction(movie.id);
      loadCommunity(movie.id);
    }
  } catch (error) {
    toast(error.message, true);
  }
}

function updateMovieAction(movieId) {
  const saved = state.watchlist.some(({ movie }) => movie.id === movieId);
  const button = $("#movieAddButton");
  if (button) {
    button.textContent = saved ? "✓ Na sua lista" : "+ Adicionar à minha lista";
    button.disabled = saved;
  }
}

async function openMovie(movieId) {
  let movie;
  try {
    const knownMovie = state.currentMovie?.id === movieId ? state.currentMovie : null;
    if (knownMovie?.tmdbId || String(movieId).startsWith("tmdb-")) {
      const tmdbId = knownMovie?.tmdbId || String(movieId).slice(5);
      movie = await api(`/movie/tmdb/${encodeURIComponent(tmdbId)}`);
    } else {
      movie = await api(`/movie/${encodeURIComponent(movieId)}`);
      movie.tmdbId = movie.tmdbId || null;
      movie.localMovieId = movie.id;
    }
    state.currentMovie = movie;
    renderMovieDialog(movie);
    $("#movieDialog").showModal();
    if (movie.localMovieId) loadCommunity(movie.localMovieId);
  } catch (error) {
    toast(error.message, true);
  }
}

function renderMovieDialog(movie) {
  const backdrop = movie.backdropUrl || movie.posterUrl || "";
  $("#movieDialogContent").innerHTML = `
    <section class="movie-detail-hero" style="background-image:url('${escapeHtml(backdrop)}')">
      <div class="movie-detail-copy">
        <p class="section-kicker">CINEPHILE SELEÇÃO</p>
        <h2>${escapeHtml(movie.title)}</h2>
        <div class="detail-meta">${[movie.releaseYear, movie.runtime ? `${movie.runtime} min` : null, movie.voteAverage ? `★ ${Number(movie.voteAverage).toFixed(1)} TMDB` : null].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <div class="detail-genres">${(movie.genres || []).map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}</div>
      </div>
    </section>
    <div class="movie-detail-body">
      <p class="movie-detail-overview">${escapeHtml(movie.overview || "A sinopse deste filme ainda não está disponível.")}</p>
      <div class="detail-actions">
        <button id="movieAddButton" class="button button-primary" data-add-movie="${escapeHtml(movie.localMovieId || (movie.tmdbId ? `tmdb-${movie.tmdbId}` : movie.id))}">+ Adicionar à minha lista</button>
        <span id="movieCommunitySummary" class="section-note"></span>
      </div>
      <div class="detail-columns">
        <section class="detail-panel">
          <h3>Deixe sua avaliação</h3>
          <div id="reviewPanel"></div>
        </section>
        <section class="detail-panel">
          <h3>Conversa da comunidade</h3>
          <div id="commentPanel"></div>
        </section>
      </div>
    </div>`;
  if (movie.localMovieId) updateMovieAction(movie.localMovieId);
  renderReviewPanel(movie);
  renderCommentPanel(movie, []);
}

function renderReviewPanel(movie) {
  const panel = $("#reviewPanel");
  if (!state.user) {
    panel.innerHTML = '<p class="login-hint">Entre para avaliar o filme e recomendar para a comunidade.</p><button class="button button-ghost" data-open-auth>Entrar</button>';
    return;
  }
  panel.innerHTML = `<form id="reviewForm" class="review-form">
    <label>Sua nota
      <select name="rating"><option value="10">10 · Obra-prima</option><option value="9">9 · Incrível</option><option value="8">8 · Muito bom</option><option value="7">7 · Bom</option><option value="6">6 · Legal</option><option value="5">5 · Mediano</option><option value="4">4 · Fraco</option><option value="3">3 · Ruim</option><option value="2">2 · Muito ruim</option><option value="1">1 · Péssimo</option><option value="0">0 · Não gostei</option></select>
    </label>
    <label>O que achou?<textarea name="review" maxlength="2000" placeholder="Conte para a comunidade..."></textarea></label>
    <label>Você recomenda?
      <select name="recommends"><option value="true">Sim, recomendo</option><option value="false">Não recomendo</option></select>
    </label>
    <button class="button button-primary" type="submit">Publicar avaliação</button>
  </form>`;
  $("#reviewForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    let localId = state.currentMovie.localMovieId;
    try {
      if (!localId) localId = await importCurrentMovie();
      const data = new FormData(event.currentTarget);
      await api(`/movie/${encodeURIComponent(localId)}/reviews`, {
        method: "PUT",
        body: JSON.stringify({
          rating: Number(data.get("rating")),
          review: data.get("review"),
          recommends: data.get("recommends") === "true",
        }),
      });
      toast("Avaliação publicada!");
      loadCommunity(localId);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function importCurrentMovie() {
  if (!state.user) {
    openAuth();
    throw new Error("Entre para continuar.");
  }
  const movie = state.currentMovie;
  if (!movie.tmdbId) throw new Error("Este filme ainda não está disponível para avaliação.");
  const imported = await api(`/movie/import/${encodeURIComponent(movie.tmdbId)}`, { method: "POST" });
  movie.localMovieId = imported.id;
  state.currentMovie = movie;
  updateMovieAction(imported.id);
  return imported.id;
}

async function loadCommunity(movieId) {
  try {
    const [reviews, comments] = await Promise.all([
      api(`/movie/${encodeURIComponent(movieId)}/reviews`),
      api(`/movie/${encodeURIComponent(movieId)}/comments`),
    ]);
    const summary = reviews.summary;
    $("#movieCommunitySummary").textContent = summary.reviewCount
      ? `★ ${summary.averageRating.toFixed(1)} · ${summary.reviewCount} avaliações`
      : "Seja o primeiro a avaliar";
    $("#reviewPanel").insertAdjacentHTML("afterbegin", `<p class="review-summary">${summary.recommendationCount} recomendações da comunidade</p>`);
    renderCommentPanel(state.currentMovie, comments);
  } catch (error) {
    toast(error.message, true);
  }
}

function commentMarkup(comment) {
  const ownComment = state.user?.id === comment.userId;
  const replies = comment.replies || [];
  return `<article class="comment">
    <div class="comment-head"><strong>${escapeHtml(comment.user?.name || "Cinéfilo")}</strong><time>${new Date(comment.createdAt).toLocaleDateString("pt-BR")}</time></div>
    <p class="comment-body">${escapeHtml(comment.body)}</p>
    <button class="comment-action" data-reply-id="${escapeHtml(comment.id)}">Responder${replies.length ? ` · ${replies.length}` : ""}</button>
    ${ownComment ? `<button class="comment-action" data-delete-comment="${escapeHtml(comment.id)}" style="margin-left:10px">Excluir</button>` : ""}
    <div class="comment-replies">${replies.map((reply) => `<article class="comment">
      <div class="comment-head"><strong>${escapeHtml(reply.user?.name || "Cinéfilo")}</strong><time>${new Date(reply.createdAt).toLocaleDateString("pt-BR")}</time></div>
      <p class="comment-body">${escapeHtml(reply.body)}</p>
      ${state.user?.id === reply.userId ? `<button class="comment-action" data-delete-comment="${escapeHtml(reply.id)}">Excluir</button>` : ""}
    </article>`).join("")}</div>
    <div class="reply-slot" data-reply-slot="${escapeHtml(comment.id)}"></div>
  </article>`;
}

function renderCommentPanel(movie, comments) {
  const panel = $("#commentPanel");
  if (!panel) return;
  const movieId = movie.localMovieId;
  const form = state.user
    ? `<form id="commentForm" class="comment-form"><label>Compartilhe sua opinião<textarea name="body" maxlength="2000" required placeholder="O que esse filme despertou em você?"></textarea></label><button class="button button-primary" type="submit">Publicar comentário</button></form>`
    : '<p class="login-hint">Entre para comentar e responder a comunidade.</p><button class="button button-ghost" data-open-auth>Entrar</button>';
  const empty = movieId ? '<p class="login-hint">Ainda não há comentários. Comece a conversa!</p>' : '<p class="login-hint">Adicione este filme à sua lista para abrir a conversa da comunidade.</p>';
  panel.innerHTML = `${form}<div class="comment-list">${comments.length ? comments.map(commentMarkup).join("") : empty}</div>`;

  if (state.user) {
    $("#commentForm")?.addEventListener("submit", (event) =>
      submitComment(event, movie, null));
  }
}

async function submitComment(event, movie, parentId) {
  event.preventDefault();
  const body = new FormData(event.currentTarget).get("body")?.toString().trim();
  if (!body) return;
  try {
    const movieId = movie.localMovieId || await importCurrentMovie();
    await api(`/movie/${encodeURIComponent(movieId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, ...(parentId ? { parentId } : {}) }),
    });
    const comments = await api(`/movie/${encodeURIComponent(movieId)}/comments`);
    renderCommentPanel(state.currentMovie, comments);
    toast(parentId ? "Resposta publicada." : "Comentário publicado.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function updateWatchlistStatus(movieId, status) {
  const item = state.watchlist.find(({ movie }) => movie.id === movieId);
  if (!item) return;
  try {
    await api(`/watchlist/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      body: JSON.stringify({ movieId, status }),
    });
    item.status = status;
    renderWatchlist();
    toast("Sua lista foi atualizada.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function removeComment(commentId) {
  const movieId = state.currentMovie?.localMovieId;
  if (!movieId) return;
  try {
    await api(`/movie/${encodeURIComponent(movieId)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
    const comments = await api(`/movie/${encodeURIComponent(movieId)}/comments`);
    renderCommentPanel(state.currentMovie, comments);
    toast("Comentário removido.");
  } catch (error) {
    toast(error.message, true);
  }
}

$("#searchInput").addEventListener("input", (event) => {
  $("#clearSearch").hidden = !event.target.value;
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => searchMovies(event.target.value), 280);
});
$("#clearSearch").addEventListener("click", () => {
  $("#searchInput").value = "";
  $("#clearSearch").hidden = true;
  $("#searchResults").hidden = true;
  $("#searchInput").focus();
});
$("#searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Escape") $("#searchResults").hidden = true;
  if (event.key === "Enter") searchMovies(event.currentTarget.value);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#searchInput").focus();
  }
});

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-watchlist-status]")) return;
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setActiveView(viewButton.dataset.view);
    return;
  }
  const categoryButton = event.target.closest("[data-category-id]");
  if (categoryButton) {
    const onHome = $("#homeView").classList.contains("is-visible");
    if (onHome) setActiveView("categories");
    await loadCategoryMovies(categoryButton.dataset.categoryId);
    return;
  }
  const openAuthButton = event.target.closest("[data-open-auth]");
  if (openAuthButton) {
    openAuth();
    return;
  }
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    $(`#${closeButton.dataset.close}`).close();
    return;
  }
  const addButton = event.target.closest("[data-add-movie]");
  if (addButton) {
    event.stopPropagation();
    await addToWatchlist(addButton.dataset.addMovie);
    return;
  }
  const openButton = event.target.closest("[data-open-movie]");
  if (openButton) {
    event.preventDefault();
    $("#searchResults").hidden = true;
    await openMovie(openButton.dataset.openMovie);
    return;
  }
  const replyButton = event.target.closest("[data-reply-id]");
  if (replyButton) {
    if (!state.user) {
      openAuth();
      return;
    }
    const slot = $(`[data-reply-slot="${CSS.escape(replyButton.dataset.replyId)}"]`);
    slot.innerHTML = `<form class="inline-reply"><textarea name="body" maxlength="2000" required placeholder="Escreva sua resposta..."></textarea><button class="button button-primary" type="submit">Responder</button></form>`;
    slot.querySelector("form").addEventListener("submit", (submitEvent) =>
      submitComment(submitEvent, state.currentMovie, replyButton.dataset.replyId));
    return;
  }
  const deleteButton = event.target.closest("[data-delete-comment]");
  if (deleteButton) {
    await removeComment(deleteButton.dataset.deleteComment);
  }
});

document.addEventListener("keydown", (event) => {
  const card = event.target.closest(".movie-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openMovie(card.dataset.openMovie);
  }
});

$("#watchlistFilters").addEventListener("click", (event) => {
  const filter = event.target.closest("[data-watchlist-filter]");
  if (!filter) return;
  state.watchlistFilter = filter.dataset.watchlistFilter;
  renderWatchlistFilters();
  renderWatchlist();
});
$("#watchlistGrid").addEventListener("change", (event) => {
  const status = event.target.closest("[data-watchlist-status]");
  if (status) updateWatchlistStatus(status.dataset.watchlistStatus, status.value);
});
$("#authForm").addEventListener("submit", submitAuth);
$("#authToggle").addEventListener("click", () => setAuthMode(state.authMode === "login" ? "register" : "login"));
$("#accountButton").addEventListener("click", () => state.user ? signOut() : openAuth());
$("#heroExplore").addEventListener("click", () => setActiveView("categories"));
$("#heroDetails").addEventListener("click", () => {
  if (state.heroMovie) openMovie(state.heroMovie.localMovieId || state.heroMovie.id);
});
$("#searchResults").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-movie]")) $("#searchInput").blur();
});
$("#movieDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
$("#authDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

setAuthMode("login");
showLoading("#trendingGrid");
showLoading("#topRatedGrid");
loadDiscovery("popular", "#trendingGrid");
loadDiscovery("top_rated", "#topRatedGrid");
loadCategories();
initializeUser();
