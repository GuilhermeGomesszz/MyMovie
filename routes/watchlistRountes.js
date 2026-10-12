import express from "express";

import { addToWatchlist, getWatchlist, removeFromWatchlist, addPut} from "../Controller/watchlistController.js";

import authMiddleware  from "../middlesware/authMiddlesware.js";

import { validateRequest } from "../validators/validationRequest.js";
import { addToWatchlistSchema } from "../validators/watchlistvalidators.js";



const router = express.Router();

router.use(authMiddleware); // Apply the authMiddleware to all routes in this router

router.get("/", getWatchlist);
router.post("/", validateRequest(addToWatchlistSchema), addToWatchlist);

router.delete("/:id", removeFromWatchlist);

router.put("/:id", validateRequest(addToWatchlistSchema), addPut);

export default router;