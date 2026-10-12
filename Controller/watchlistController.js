import {prisma} from '../config/db.js';

const getWatchlist = async (req, res) => {
    try {
        const watchlist = await prisma.watchlistItem.findMany({
            where: { userId: req.user.id },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            include: { movie: true },
        });
        return res.json(watchlist);
    } catch (error) {
        console.error("Erro ao buscar lista de filmes:", error);
        return res.status(500).json({ message: "Erro ao buscar sua lista de filmes" });
    }
};

const addToWatchlist = async (req, res) => {
    const { movieId, status, rating, notes} = req.body;

    const movie = await prisma.movie.findUnique({
        where: { id: movieId },

    });

    if (!movie) {
        return res.status(404).json({ message: "Filme não encontrado" });
    }

    const existingWatchList = await prisma.watchlistItem.findUnique({
        where: { userId_movieId: {
                userId: req.user.id,
                movieId: movieId,
            },
        },
    });
    if (existingWatchList) {
        return res.status(400).json({ message: "Filme já está na lista de observação" });
    }

    const watchlistItem = await prisma.watchlistItem.create({
        data: {
            userId:req.user.id,
            movieId: movieId,
            status: status || "TO_WATCH",
            rating: rating,
            notes: notes
        }
    });
    res.status(201).json(watchlistItem);
};

const removeFromWatchlist = async (req, res) => {
    const watchlistItemId = await prisma.watchlistItem.findUnique({

        where: { id: req.params.id },
    });
    if (!watchlistItemId) {
        return res.status(404).json({ message: "Item da lista de observação não encontrado" });
    }

    if (watchlistItemId.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
    }

    await prisma.watchlistItem.delete({
        where: { id: req.params.id },
    });
    res.status(200).json({ message: "Item removido da lista de observação" });
}


const addPut = async (req, res) => {
    try{
        const {movieId, status, rating, notes} = req.body;
        const movie = await prisma.watchlistItem.findUnique({
            where: { userId_movieId: {
                    userId: req.user.id,
                    movieId: movieId,
                },
            },
        });

        if (!movie) return res.status(404).json({ message: "Filme não encontrado na lista de observação" });

        const updatedMovie = await prisma.watchlistItem.update({
            where: { userId_movieId: {
                    userId: req.user.id,
                    movieId: movieId,
                },
            },
            data: {
                status: status,
                rating: rating,
                notes: notes
            }
        });
        res.json(updatedMovie);
    } catch (error) {
        res.status(500).json({ message: "Erro ao atualizar o item da lista de observação" });
    }
}

export {addToWatchlist, getWatchlist, removeFromWatchlist, addPut};