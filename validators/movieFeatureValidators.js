import { z } from "zod";

const communityReviewSchema = z.object({
  rating: z.number().int().min(0).max(10),
  review: z.string().trim().max(2000).optional(),
  recommends: z.boolean(),
});

const movieCategoriesSchema = z.object({
  categories: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    externalId: z.union([
      z.string().trim().min(1).max(100),
      z.number().int().nonnegative().transform(String),
    ]).optional(),
  })).max(30),
});

const movieAvailabilitySchema = z.object({
  provider: z.string().trim().min(1).max(100),
  type: z.enum(["CINEMA", "STREAMING", "RENTAL", "PURCHASE"]),
  url: z.string().url().optional(),
  region: z.string().trim().min(2).max(10).default("BR"),
});

export {
  communityReviewSchema,
  movieCategoriesSchema,
  movieAvailabilitySchema,
};
