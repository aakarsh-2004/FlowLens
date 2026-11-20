import { z } from "zod";

const passwordSchema = z.string().min(1, "Password is required").refine(
  (password) => Buffer.byteLength(password, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes",
);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("A valid email is required")),
  password: passwordSchema,
});

export const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1, "Name is required").max(100),
  password: passwordSchema.min(8, "Password must contain at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
