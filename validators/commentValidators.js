import { z } from "zod";

const movieCommentSchema = z.object({
  body: z.string().trim().min(1, "O comentário não pode ficar vazio").max(2000),
  parentId: z.string().min(1).optional(),
});

export { movieCommentSchema };
