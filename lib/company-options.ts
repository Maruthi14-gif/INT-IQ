/** Company form options, shared by the database schema and the browser form (no database code here). */
export const COMPANY_INDUSTRIES = [
  "IT services",
  "Software product",
  "Fintech",
  "E-commerce",
  "Consulting",
  "Education",
  "Healthcare",
  "Manufacturing",
  "Other",
] as const
export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number]

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const
export type CompanySize = (typeof COMPANY_SIZES)[number]
