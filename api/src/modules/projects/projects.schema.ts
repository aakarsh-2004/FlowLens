import { z } from "zod";
import { Role } from "../../../generated/prisma/enums.js";

const name = z.string().trim().min(1).max(200);
const status = z.string().trim().min(1).max(100).nullable().optional();
const date = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));
const timestamp = z.iso.datetime().transform((value) => new Date(value));

export const projectParams = z.object({ projectId: z.uuid() });
export const featureParams = projectParams.extend({ featureId: z.uuid() });
export const milestoneParams = projectParams.extend({ milestoneId: z.uuid() });

const projectFields = z.object({
  name,
  description: z.string().max(10000).nullable().optional(),
  status,
  start_date: date,
  end_date: date,
  isActive: z.boolean().default(true),
});
export const projectSchema = projectFields.refine(
  (data) => data.end_date >= data.start_date, "End date must be on or after start date",
);

export const projectMemberSchema = z.object({
  id: z.uuid().optional(),
  user_id: z.uuid(),
  project_role: z.string().trim().min(1).max(100),
  role: z.enum(Role),
  joined_at: timestamp.optional(),
  created_at: timestamp.optional(),
});

export const featureSchema = z.object({
  name,
  description: z.string().max(10000).nullable().optional(),
  status,
  owner_id: z.uuid(),
  target_date: date,
  isActive: z.boolean().default(true),
});

export const milestoneSchema = z.object({
  name,
  status,
  feature_id: z.uuid(),
  planned_at: date,
  completed_at: date.nullable().optional(),
  isActive: z.boolean().default(true),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectMemberInput = z.infer<typeof projectMemberSchema>;
export type FeatureInput = z.infer<typeof featureSchema>;
export type MilestoneInput = z.infer<typeof milestoneSchema>;

// Override creation defaults so omitted PATCH fields stay unchanged.
export const projectUpdateSchema = projectFields.partial().extend({ isActive: z.boolean().optional() }).strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export const featureUpdateSchema = featureSchema.partial().extend({ isActive: z.boolean().optional() }).strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export const milestoneUpdateSchema = milestoneSchema.partial().extend({ isActive: z.boolean().optional() }).strict()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type FeatureUpdateInput = z.infer<typeof featureUpdateSchema>;
export type MilestoneUpdateInput = z.infer<typeof milestoneUpdateSchema>;
