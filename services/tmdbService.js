const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p";

const requestTmdb = async (path, params = {}) => {
  const apiKey = process.env.TMDB_API_KEY || process.env.API_KEY;
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!apiKey && !accessToken) {
    const error = new Error("Configure TMDB_API_KEY ou TMDB_ACCESS_TOKEN no ambiente do servidor");
    error.statusCode = 503;
    throw error;
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("language", "pt-BR");
  if (apiKey && !accessToken) url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`TMDB respondeu com HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
  return response.json();
};

const tmdbImage = (path, size = "w500") => (
  path ? `${TMDB_IMAGE_URL}/${size}${path}` : ""
);

const getTmdbGenres = async () => {
  const result = await requestTmdb("/genre/movie/list");
  return result.genres ?? [];
};

const getTmdbMovie = async (tmdbId) => (
  requestTmdb(`/movie/${tmdbId}`, { append_to_response: "watch/providers,recommendations" })
);

const searchTmdbMovies = async (query, page = 1) => (
  requestTmdb("/search/movie", { query, page, include_adult: false })
);

const discoverTmdbMovies = async (sort, options = {}) => {
  const endpoints = {
    popular: "/movie/popular",
    top_rated: "/movie/top_rated",
    upcoming: "/movie/upcoming",
  };
  const params = { page: options.page ?? 1 };
  if (options.region) params.region = options.region;
  if (options.genreId) params.with_genres = options.genreId;

  if (options.genreId) {
    params.sort_by = sort === "top_rated" ? "vote_average.desc" : "popularity.desc";
    return requestTmdb("/discover/movie", params);
  }
  return requestTmdb(endpoints[sort] ?? endpoints.popular, params);
};

export {
  discoverTmdbMovies,
  getTmdbGenres,
  getTmdbMovie,
  requestTmdb,
  searchTmdbMovies,
  tmdbImage,
};
