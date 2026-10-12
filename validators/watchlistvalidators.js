import {z} from 'zod';

const addToWatchlistSchema = z.object({
  movieId: z.string().min(1, { message: "Movie ID is required" }),
  rating: z.number().min(0).max(10).optional(),
  status: z.enum(["TO_WATCH", "WATCHING", "WATCHED", "DROPPED"]).optional(),
  notes: z.string().optional(),
});

export { addToWatchlistSchema };