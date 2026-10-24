import { z } from "zod";
import { CATEGORIES, STATUSES, CLAIM_STATUSES } from "./models.js";
export const problem = (status, message) =>
  Object.assign(new Error(message), { status });
export const text = (min, max) => z.string().trim().min(min).max(max);
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Use no more than 72 UTF-8 bytes.",
  );
export const itemInput = z
  .object({
    kind: z.enum(["Lost", "Found"]),
    title: text(5, 100),
    description: text(20, 2000),
    category: z.enum(CATEGORIES),
    location: text(2, 100),
    happenedAt: z.iso.datetime(),
  })
  .strict()
  .refine((v) => new Date(v.happenedAt).getTime() <= Date.now() + 300000, {
    message: "The report time cannot be in the future.",
    path: ["happenedAt"],
  })
  .refine((v) => new Date(v.happenedAt).getTime() >= Date.UTC(2000, 0, 1), {
    message: "Use a date from the year 2000 onward.",
    path: ["happenedAt"],
  });
const pagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(9),
};
export const itemListInput = z
  .object({
    ...pagination,
    search: text(0, 100).optional(),
    category: z.enum(CATEGORIES).optional(),
    kind: z.enum(["Lost", "Found"]).optional(),
    status: z.enum(STATUSES).optional(),
    scope: z.enum(["all", "mine"]).default("all"),
  })
  .strict();
export const claimListInput = z
  .object({
    ...pagination,
    limit: z.coerce.number().int().min(1).max(30).default(10),
    status: z.enum(CLAIM_STATUSES).optional(),
    itemId: z
      .string()
      .regex(/^[a-fA-F0-9]{24}$/)
      .optional(),
  })
  .strict();
export function claimView(c, student) {
  return {
    id: String(c._id),
    reference: "RN-" + String(c._id).slice(-6).toUpperCase(),
    evidence: c.evidence,
    status: c.status,
    submittedAt: c.submittedAt,
    reviewedAt: c.reviewedAt,
    reviewNote: c.reviewNote,
    ...(student
      ? {
          student: {
            id: String(student._id),
            name: student.name,
            email: student.email,
          },
        }
      : {}),
  };
}
export function itemView(i, user) {
  const claims = i.claims || [],
    own = claims.find((c) => String(c.student) === String(user._id));
  return {
    id: String(i._id),
    kind: i.kind,
    title: i.title,
    description: i.description,
    category: i.category,
    location: i.location,
    happenedAt: i.happenedAt,
    status: i.status,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    isOwner: String(i.createdBy) === String(user._id),
    claimCount: claims.length,
    myClaim: own ? claimView(own) : null,
  };
}
export const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
