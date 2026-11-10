import { z } from "zod"
import { EXPERIENCE_LEVELS } from "@/lib/db/schema"

/** Validation for a job posting, shared by the create and edit routes. */
export const jobInput = z.object({
  title: z.string().trim().min(2, "Add a job title.").max(100),
  company: z.string().trim().min(1, "Add the company name.").max(100),
  location: z.string().trim().max(100).optional().transform((v) => v || null),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  description: z.string().trim().min(20, "Describe the role in at least a sentence or two.").max(6000),
  responsibilities: z.string().trim().max(4000).optional().transform((v) => v || null),
})
