import { prisma } from "../config/db.js";

const handleError = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({ message });
};

const getPagination = (req, res) => {
  const requestedLimit = Number(req.query.limit ?? 20);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    res.status(400).json({ message: "O limite precisa ser um número inteiro positivo" });
    return null;
  }

  return {
    limit: Math.min(requestedLimit, 50),
    cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
  };
};

const getCommunitySummary = async (movieId) => {
  const [ratingSummary, recommendationGroups] = await Promise.all([
    prisma.communityReview.aggregate({
      where: { movieId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.communityReview.groupBy({
      by: ["recommends"],
      where: { movieId },
      _count: { _all: true },
    }),
  ]);
  const reviewCount = ratingSummary._count._all;
  const recommendationCount = recommendationGroups.find(({ recommends }) => recommends)?._count._all ?? 0;

  return {
    averageRating: ratingSummary._avg.rating,
    reviewCount,
    recommendationCount,
    recommendationRate: reviewCount
      ? Math.round((recommendationCount / reviewCount) * 1000) / 10
      : null,
  };
};

const getMovieCategory = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        externalId: true,
        _count: { select: { movies: true } },
      },
    });

    return res.json(categories);
  } catch (error) {
    return handleError(res, error, "Erro ao buscar categorias");
  }
};

const getMoviesByCategory = async (req, res) => {
  const pagination = getPagination(req, res);
  if (!pagination) return;

  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.categoryId },
      select: { id: true },
    });
    if (!category) {
      return res.status(404).json({ message: "Categoria não encontrada" });
    }

    if (pagination.cursor) {
      const cursorMovie = await prisma.movieCategory.findUnique({
        where: {
          movieId_categoryId: {
            movieId: pagination.cursor,
            categoryId: category.id,
          },
        },
      });
      if (!cursorMovie) {
        return res.status(400).json({ message: "Cursor inválido para esta categoria" });
      }
    }

    const movies = await prisma.movie.findMany({
      where: { categories: { some: { categoryId: category.id } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        title: true,
        overview: true,
        releaseYear: true,
        runtime: true,
        posterUrl: true,
      },
    });

    const hasMore = movies.length > pagination.limit;
    const page = movies.slice(0, pagination.limit);
    const ratings = page.length
      ? await prisma.communityReview.groupBy({
          by: ["movieId"],
          where: { movieId: { in: page.map(({ id }) => id) } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const ratingsByMovie = new Map(ratings.map((rating) => [rating.movieId, rating]));

    return res.json({
      data: page.map((movie) => {
        const communityRating = ratingsByMovie.get(movie.id);
        return {
          ...movie,
          communityRating: communityRating?._avg.rating ?? null,
          communityRatingCount: communityRating?._count._all ?? 0,
        };
      }),
      pageInfo: {
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    return handleError(res, error, "Erro ao buscar filmes da categoria");
  }
};

const getMovieById = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      include: {
        categories: { include: { category: true } },
        availability: { orderBy: [{ type: "asc" }, { provider: "asc" }] },
      },
    });
    if (!movie) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }

    const communitySummary = await getCommunitySummary(movie.id);

    return res.json({
      ...movie,
      categories: movie.categories.map(({ category }) => category),
      communityRating: communitySummary.averageRating,
      communityRatingCount: communitySummary.reviewCount,
      communityRecommendationCount: communitySummary.recommendationCount,
      communityRecommendationRate: communitySummary.recommendationRate,
    });
  } catch (error) {
    return handleError(res, error, "Erro ao buscar filme");
  }
};

const getMovieReviews = async (req, res) => {
  const pagination = getPagination(req, res);
  if (!pagination) return;

  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true },
    });
    if (!movie) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }

    if (pagination.cursor) {
      const cursorReview = await prisma.communityReview.findFirst({
        where: { id: pagination.cursor, movieId: movie.id },
        select: { id: true },
      });
      if (!cursorReview) {
        return res.status(400).json({ message: "Cursor inválido para este filme" });
      }
    }

    const [summary, reviews] = await Promise.all([
      getCommunitySummary(movie.id),
      prisma.communityReview.findMany({
        where: { movieId: movie.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pagination.limit + 1,
        ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          rating: true,
          review: true,
          recommends: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    const hasMore = reviews.length > pagination.limit;
    const page = reviews.slice(0, pagination.limit);

    return res.json({
      summary: {
        ...summary,
      },
      data: page,
      pageInfo: {
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    return handleError(res, error, "Erro ao buscar avaliações da comunidade");
  }
};

const saveMovieReview = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true },
    });
    if (!movie) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }

    const { rating, review, recommends } = req.body;
    const savedReview = await prisma.communityReview.upsert({
      where: {
        userId_movieId: { userId: req.user.id, movieId: movie.id },
      },
      create: {
        userId: req.user.id,
        movieId: movie.id,
        rating,
        review: review || null,
        recommends,
      },
      update: {
        rating,
        review: review || null,
        recommends,
      },
    });

    return res.json(savedReview);
  } catch (error) {
    return handleError(res, error, "Erro ao salvar avaliação");
  }
};

const removeMovieReview = async (req, res) => {
  try {
    const review = await prisma.communityReview.findUnique({
      where: {
        userId_movieId: {
          userId: req.user.id,
          movieId: req.params.movieId,
        },
      },
      select: { id: true },
    });
    if (!review) {
      return res.status(404).json({ message: "Você ainda não avaliou este filme" });
    }

    await prisma.communityReview.delete({ where: { id: review.id } });
    return res.status(200).json({ message: "Avaliação removida" });
  } catch (error) {
    return handleError(res, error, "Erro ao remover avaliação");
  }
};

const findOrCreateCategory = async (transaction, category) => {
  if (category.externalId) {
    const byExternalId = await transaction.category.findUnique({
      where: { externalId: category.externalId },
    });
    if (byExternalId) return byExternalId;
  }

  const byName = await transaction.category.findUnique({
    where: { name: category.name },
  });
  if (byName) {
    if (category.externalId && byName.externalId && byName.externalId !== category.externalId) {
      const error = new Error(`A categoria "${category.name}" já está vinculada a outro ID externo`);
      error.statusCode = 409;
      throw error;
    }
    if (category.externalId && !byName.externalId) {
      return transaction.category.update({
        where: { id: byName.id },
        data: { externalId: category.externalId },
      });
    }
    return byName;
  }

  return transaction.category.create({ data: category });
};

const setMovieCategories = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true, createdBy: true },
    });
    if (!movie) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }
    if (movie.createdBy !== req.user.id) {
      return res.status(403).json({ message: "Somente quem cadastrou o filme pode alterar suas categorias" });
    }

    const categories = await prisma.$transaction(async (transaction) => {
      const resolvedCategories = [];
      for (const category of req.body.categories) {
        resolvedCategories.push(await findOrCreateCategory(transaction, category));
      }

      await transaction.movieCategory.deleteMany({ where: { movieId: movie.id } });
      if (resolvedCategories.length) {
        await transaction.movieCategory.createMany({
          data: resolvedCategories.map((category) => ({
            movieId: movie.id,
            categoryId: category.id,
          })),
          skipDuplicates: true,
        });
      }

      await transaction.movie.update({
        where: { id: movie.id },
        data: { genres: [...new Set(resolvedCategories.map(({ name }) => name))] },
      });

      return resolvedCategories;
    });

    return res.json(categories);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return handleError(res, error, "Erro ao atualizar categorias do filme");
  }
};

const saveMovieAvailability = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true, createdBy: true },
    });
    if (!movie) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }
    if (movie.createdBy !== req.user.id) {
      return res.status(403).json({ message: "Somente quem cadastrou o filme pode alterar onde assistir" });
    }

    const { provider, type, url, region } = req.body;
    const availability = await prisma.movieAvailability.upsert({
      where: {
        movieId_provider_type_region: {
          movieId: movie.id,
          provider,
          type,
          region: region || "BR",
        },
      },
      create: {
        movieId: movie.id,
        provider,
        type,
        url,
        region: region || "BR",
      },
      update: { url },
    });

    return res.json(availability);
  } catch (error) {
    return handleError(res, error, "Erro ao salvar disponibilidade do filme");
  }
};

const removeMovieAvailability = async (req, res) => {
  try {
    const availability = await prisma.movieAvailability.findUnique({
      where: { id: req.params.availabilityId },
      include: { movie: { select: { createdBy: true } } },
    });
    if (!availability || availability.movieId !== req.params.movieId) {
      return res.status(404).json({ message: "Disponibilidade não encontrada" });
    }
    if (availability.movie.createdBy !== req.user.id) {
      return res.status(403).json({ message: "Somente quem cadastrou o filme pode alterar onde assistir" });
    }

    await prisma.movieAvailability.delete({ where: { id: availability.id } });
    return res.status(200).json({ message: "Disponibilidade removida" });
  } catch (error) {
    return handleError(res, error, "Erro ao remover disponibilidade do filme");
  }
};

export {
  getMovieCategory,
  getMoviesByCategory,
  getMovieById,
  getMovieReviews,
  saveMovieReview,
  removeMovieReview,
  setMovieCategories,
  saveMovieAvailability,
  removeMovieAvailability,
};
