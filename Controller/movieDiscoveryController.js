import { prisma } from "../config/db.js";
import {
  discoverTmdbMovies,
  getTmdbGenres,
  getTmdbMovie,
  searchTmdbMovies,
  tmdbImage,
} from "../services/tmdbService.js";

const normalizeQuery = (query) => query
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .trim()
  .replace(/\s+/g, " ");

const getGenreMap = async () => {
  const genres = await getTmdbGenres();
  return new Map(genres.map((genre) => [genre.id, genre]));
};

const mapTmdbMovie = (movie, genreMap, localMovie = null) => ({
  id: localMovie?.id ?? `tmdb-${movie.id}`,
  localMovieId: localMovie?.id ?? null,
  tmdbId: movie.id,
  title: movie.title ?? movie.original_title ?? "Filme sem título",
  overview: movie.overview ?? "",
  releaseYear: Number(movie.release_date?.slice(0, 4)) || null,
  runtime: movie.runtime ?? 0,
  posterUrl: tmdbImage(movie.poster_path),
  backdropUrl: tmdbImage(movie.backdrop_path, "w1280"),
  genres: Array.isArray(movie.genres) && typeof movie.genres[0] === "string"
    ? movie.genres
    : (movie.genre_ids ?? movie.genres?.map(({ id }) => id) ?? [])
      .map((id) => genreMap.get(id)?.name)
      .filter(Boolean),
  voteAverage: movie.vote_average ?? null,
  communityRating: localMovie?.communityRating ?? null,
  source: localMovie ? "database" : "tmdb",
});

const findLocalMovies = async (query) => prisma.$queryRaw`
  SELECT
    movie."id",
    movie."tmdbId",
    movie."title",
    movie."overview",
    movie."releaseYear",
    movie."runtime",
    movie."posterUrl",
    movie."genres",
    similarity(movie."title", ${query}) AS "relevance"
  FROM "Movie" AS movie
  WHERE movie."title" ILIKE ${`%${query}%`}
     OR movie."overview" ILIKE ${`%${query}%`}
     OR movie."genres" @> ARRAY[${query}]::text[]
     OR movie."genres" @> ARRAY[${query.toLocaleLowerCase("pt-BR").replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"))}]::text[]
  ORDER BY "relevance" DESC, movie."createdAt" DESC
  LIMIT 15
`;

const getSearchGenreTrends = async (query, userId) => {
  const normalized = normalizeQuery(query);
  const userTrends = userId
    ? await prisma.searchEvent.groupBy({
        by: ["genre"],
        where: { userId, normalizedQuery: { contains: normalized } },
        _count: { _all: true },
      })
    : [];
  const trends = userTrends.length
    ? userTrends
    : await prisma.searchEvent.groupBy({
        by: ["genre"],
        where: { normalizedQuery: { contains: normalized } },
        _count: { _all: true },
      });
  return new Map(trends.map(({ genre, _count }) => [genre, _count._all]));
};

const searchMovies = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ message: "A busca precisa ter entre 2 e 120 caracteres" });
  }

  try {
    const [localMovies, genreTrends] = await Promise.all([
      findLocalMovies(query),
      getSearchGenreTrends(query, req.user?.id),
    ]);
    let tmdbResults = [];
    let tmdbError = null;
    let genreMap = new Map();
    try {
      const [result, genres] = await Promise.all([searchTmdbMovies(query), getTmdbGenres()]);
      tmdbResults = result.results ?? [];
      genreMap = new Map(genres.map((genre) => [genre.id, genre]));
    } catch (error) {
      tmdbError = { message: error.message, statusCode: error.statusCode ?? 502 };
    }

    const localByTmdbId = new Map(
      localMovies.filter(({ tmdbId }) => tmdbId).map((movie) => [movie.tmdbId, movie]),
    );
    const localTitles = new Set(localMovies.map(({ title, releaseYear }) =>
      `${normalizeQuery(title)}-${releaseYear}`));
    const movies = [
      ...localMovies.map((movie) => mapTmdbMovie({
        ...movie,
        genre_ids: [],
        release_date: String(movie.releaseYear),
      }, genreMap, movie)),
      ...tmdbResults
        .filter((movie) => !localByTmdbId.has(movie.id))
        .filter((movie) => !localTitles.has(
          `${normalizeQuery(movie.title ?? "")}-${Number(movie.release_date?.slice(0, 4)) || null}`,
        ))
        .map((movie) => mapTmdbMovie(movie, genreMap, localByTmdbId.get(movie.id))),
    ];
    movies.sort((left, right) => {
      const trendScore = (movie) => movie.genres.reduce(
        (score, genre) => score + (genreTrends.get(genre) ?? 0),
        0,
      );
      return trendScore(right) - trendScore(left);
    });

    const searchedGenres = [...new Set(movies.flatMap(({ genres }) => genres))];
    if (searchedGenres.length) {
      await prisma.searchEvent.createMany({
        data: searchedGenres.map((genre) => ({
          normalizedQuery: normalizeQuery(query),
          genre,
          userId: req.user?.id ?? null,
        })),
      });
    }

    const smartGenres = [...genreTrends]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }));

    return res.json({ data: movies, smartGenres, tmdbError });
  } catch (error) {
    console.error("Erro ao buscar filmes:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao buscar filmes",
    });
  }
};

const discoverMovies = async (req, res) => {
  const sort = ["popular", "top_rated", "upcoming"].includes(req.query.sort)
    ? req.query.sort
    : "popular";
  const page = Number(req.query.page ?? 1);
  const genreId = req.query.genreId === undefined ? undefined : Number(req.query.genreId);
  if (!Number.isInteger(page) || page < 1 || page > 500
      || (genreId !== undefined && (!Number.isInteger(genreId) || genreId < 1))) {
    return res.status(400).json({ message: "Parâmetros de descoberta inválidos" });
  }

  try {
    const [result, genreMap] = await Promise.all([
      discoverTmdbMovies(sort, { page, genreId, region: "BR" }),
      getGenreMap(),
    ]);
    const ids = (result.results ?? []).map(({ id }) => id);
    const localMovies = ids.length
      ? await prisma.movie.findMany({
          where: { tmdbId: { in: ids } },
          select: { id: true, tmdbId: true },
        })
      : [];
    const localByTmdbId = new Map(localMovies.map((movie) => [movie.tmdbId, movie]));
    return res.json({
      data: (result.results ?? []).map((movie) =>
        mapTmdbMovie(movie, genreMap, localByTmdbId.get(movie.id))),
      page: result.page,
      totalPages: result.total_pages,
    });
  } catch (error) {
    console.error("Erro ao carregar catálogo TMDB:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao carregar catálogo",
    });
  }
};

const getTmdbMovieDetails = async (req, res) => {
  const tmdbId = Number(req.params.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return res.status(400).json({ message: "ID TMDB inválido" });
  }

  try {
    const [movie, genreMap, localMovie] = await Promise.all([
      getTmdbMovie(tmdbId),
      getGenreMap(),
      prisma.movie.findUnique({
        where: { tmdbId },
        include: {
          categories: { include: { category: true } },
          availability: true,
        },
      }),
    ]);
    const community = localMovie
      ? await prisma.communityReview.aggregate({
          where: { movieId: localMovie.id },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : null;
    return res.json({
      ...mapTmdbMovie(movie, genreMap, localMovie),
      overview: movie.overview ?? "",
      runtime: movie.runtime ?? 0,
      categories: localMovie
        ? localMovie.categories.map(({ category }) => category)
        : (movie.genres ?? []).map(({ id, name }) => ({ id: String(id), name, externalId: String(id) })),
      availability: localMovie?.availability ?? [],
      communityRating: community?._avg.rating ?? null,
      communityRatingCount: community?._count._all ?? 0,
      localMovieId: localMovie?.id ?? null,
    });
  } catch (error) {
    console.error("Erro ao buscar detalhes no TMDB:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao buscar detalhes do filme",
    });
  }
};

const getMovieCategories = async (_req, res) => {
  try {
    const genres = await getTmdbGenres();
    return res.json({
      data: genres.map(({ id, name }) => ({
        id: String(id),
        name,
        externalId: String(id),
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar gêneros no TMDB:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao buscar gêneros do TMDB",
    });
  }
};

const importTmdbMovie = async (req, res) => {
  const tmdbId = Number(req.params.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return res.status(400).json({ message: "ID TMDB inválido" });
  }

  try {
    const details = await getTmdbMovie(tmdbId);
    const genres = details.genres ?? [];
    const imported = await prisma.$transaction(async (transaction) => {
      const movie = await transaction.movie.upsert({
        where: { tmdbId },
        create: {
          tmdbId,
          title: details.title ?? details.original_title ?? "Filme sem título",
          overview: details.overview ?? "",
          releaseYear: Number(details.release_date?.slice(0, 4)) || 0,
          genres: genres.map(({ name }) => name),
          runtime: details.runtime ?? 0,
          posterUrl: tmdbImage(details.poster_path),
          createdBy: req.user.id,
        },
        update: {
          title: details.title ?? details.original_title ?? "Filme sem título",
          overview: details.overview ?? "",
          releaseYear: Number(details.release_date?.slice(0, 4)) || 0,
          genres: genres.map(({ name }) => name),
          runtime: details.runtime ?? 0,
          posterUrl: tmdbImage(details.poster_path),
        },
      });
      return movie;
    });
    return res.status(200).json(imported);
  } catch (error) {
    console.error("Erro ao importar filme do TMDB:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao importar filme",
    });
  }
};

const getRecommendations = async (req, res) => {
  try {
    const watchlist = await prisma.watchlistItem.findMany({
      where: { userId: req.user.id, status: { not: "DROPPED" } },
      include: { movie: true },
    });
    const genreWeights = new Map();
    const savedTmdbIds = new Set(watchlist.map(({ movie }) => movie.tmdbId).filter(Boolean));
    for (const item of watchlist) {
      const statusWeight = item.status === "WATCHED" ? 3 : item.status === "WATCHING" ? 2 : 1;
      const ratingWeight = item.rating ? Math.max(0.5, item.rating / 5) : 1;
      for (const genre of item.movie.genres) {
        genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + statusWeight * ratingWeight);
      }
    }

    const genreMap = await getGenreMap();
    const topGenres = [...genreWeights]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
    const genreIds = new Map([...genreMap.values()].map(({ id, name }) => [name, id]));
    const recommendations = topGenres.length
      ? (await Promise.all(topGenres.map(([genre]) => {
          const genreId = genreIds.get(genre);
          return genreId
            ? discoverTmdbMovies("popular", { genreId })
            : Promise.resolve({ results: [] });
        }))).flatMap(({ results }) => results ?? [])
      : (await discoverTmdbMovies("popular")).results ?? [];
    const uniqueMovies = [...new Map(recommendations.map((movie) => [movie.id, movie])).values()]
      .filter((movie) => !savedTmdbIds.has(movie.id))
      .slice(0, 18);
    const localMovies = uniqueMovies.length
      ? await prisma.movie.findMany({
          where: { tmdbId: { in: uniqueMovies.map(({ id }) => id) } },
          select: { id: true, tmdbId: true },
        })
      : [];
    const localByTmdbId = new Map(localMovies.map((movie) => [movie.tmdbId, movie]));
    return res.json({
      data: uniqueMovies.map((movie) => mapTmdbMovie(movie, genreMap, localByTmdbId.get(movie.id))),
      basedOn: topGenres.map(([name]) => name),
    });
  } catch (error) {
    console.error("Erro ao gerar recomendações:", error);
    return res.status(error.statusCode ?? 500).json({
      message: error.statusCode ? error.message : "Erro ao gerar recomendações",
    });
  }
};

export {
  discoverMovies,
  getMovieCategories,
  getRecommendations,
  getTmdbMovieDetails,
  importTmdbMovie,
  searchMovies,
};
