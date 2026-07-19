import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  image: z
    .union([z.url("Enter a valid image URL").max(2_048), z.literal("")]),
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
