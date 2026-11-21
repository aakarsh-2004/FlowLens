import { z } from "zod";

export const organizationParams = z.object({ organizationId: z.uuid() });
export const organizationSchema = z.object({ name: z.string().trim().min(1).max(200) });
export const organizationUpdateSchema = organizationSchema.partial().strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");

export const organizationMemberSchema = z.object({
  id: z.uuid().optional(),
  user_id: z.uuid(),
  role: z.string().trim().min(1).max(100),
  is_organization_admin: z.boolean().default(false),
  created_at: z.iso.datetime().transform((value) => new Date(value)).optional(),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
export type OrganizationMemberInput = z.infer<typeof organizationMemberSchema>;
