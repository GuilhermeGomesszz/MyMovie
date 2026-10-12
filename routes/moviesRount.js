import express from 'express';
import authMiddleware from "../middlesware/authMiddlesware.js";
import { validateRequest } from "../validators/validationRequest.js";
import {
    communityReviewSchema,
    movieAvailabilitySchema,
    movieCategoriesSchema,
} from "../validators/movieFeatureValidators.js";
import {
    getMoviesByCategory,
    getMovieById,
    getMovieReviews,
    saveMovieReview,
    removeMovieReview,
    setMovieCategories,
    saveMovieAvailability,
    removeMovieAvailability,
} from "../Controller/movieController.js";
import {
    discoverMovies,
    getMovieCategories,
    getRecommendations,
    getTmdbMovieDetails,
    importTmdbMovie,
    searchMovies,
} from "../Controller/movieDiscoveryController.js";
import {
    createMovieComment,
    getMovieComments,
    removeMovieComment,
} from "../Controller/movieCommentController.js";
import { movieCommentSchema } from "../validators/commentValidators.js";
import { optionalAuthMiddleware } from "../middlesware/authMiddlesware.js";

const router = express.Router();

router.get("/hello", (req, res) => {
    res.json({ message: "Hello, World!" });
});

router.get("/search", optionalAuthMiddleware, searchMovies);
router.get("/discover", discoverMovies);
router.get("/recommendations", authMiddleware, getRecommendations);
router.get("/categories", getMovieCategories);
router.get("/categories/:categoryId/movies", getMoviesByCategory);
router.get("/tmdb/:tmdbId", getTmdbMovieDetails);
router.post("/import/:tmdbId", authMiddleware, importTmdbMovie);
router.get("/:movieId/comments", getMovieComments);
router.post("/:movieId/comments", authMiddleware, validateRequest(movieCommentSchema), createMovieComment);
router.delete("/:movieId/comments/:commentId", authMiddleware, removeMovieComment);
router.get("/:movieId/reviews", getMovieReviews);
router.put("/:movieId/reviews", authMiddleware, validateRequest(communityReviewSchema), saveMovieReview);
router.delete("/:movieId/reviews", authMiddleware, removeMovieReview);
router.put("/:movieId/categories", authMiddleware, validateRequest(movieCategoriesSchema), setMovieCategories);
router.post("/:movieId/availability", authMiddleware, validateRequest(movieAvailabilitySchema), saveMovieAvailability);
router.delete("/:movieId/availability/:availabilityId", authMiddleware, removeMovieAvailability);
router.get("/:movieId", getMovieById);

export default router;