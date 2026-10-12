import { prisma } from "../config/db.js";

const getMovieComments = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true },
    });
    if (!movie) return res.status(404).json({ message: "Filme não encontrado" });

    const comments = await prisma.movieComment.findMany({
      where: { movieId: movie.id, parentId: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        user: { select: { id: true, name: true } },
        replies: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    return res.json(comments);
  } catch (error) {
    console.error("Erro ao buscar comentários:", error);
    return res.status(500).json({ message: "Erro ao buscar comentários" });
  }
};

const createMovieComment = async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
      select: { id: true },
    });
    if (!movie) return res.status(404).json({ message: "Filme não encontrado" });

    const parentId = req.body.parentId ?? null;
    if (parentId) {
      const parent = await prisma.movieComment.findUnique({
        where: { id: parentId },
        select: { id: true, movieId: true, parentId: true },
      });
      if (!parent || parent.movieId !== movie.id || parent.parentId) {
        return res.status(400).json({ message: "Resposta inválida para este filme" });
      }
    }

    const comment = await prisma.movieComment.create({
      data: {
        movieId: movie.id,
        userId: req.user.id,
        parentId,
        body: req.body.body,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    return res.status(201).json(comment);
  } catch (error) {
    console.error("Erro ao publicar comentário:", error);
    return res.status(500).json({ message: "Erro ao publicar comentário" });
  }
};

const removeMovieComment = async (req, res) => {
  try {
    const comment = await prisma.movieComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, userId: true },
    });
    if (!comment) return res.status(404).json({ message: "Comentário não encontrado" });
    if (comment.userId !== req.user.id) {
      return res.status(403).json({ message: "Você só pode remover seus próprios comentários" });
    }

    await prisma.movieComment.delete({ where: { id: comment.id } });
    return res.status(200).json({ message: "Comentário removido" });
  } catch (error) {
    console.error("Erro ao remover comentário:", error);
    return res.status(500).json({ message: "Erro ao remover comentário" });
  }
};

export { createMovieComment, getMovieComments, removeMovieComment };
