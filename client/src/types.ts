export type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
};
export type ClaimStatus = "Pending" | "Approved" | "Rejected" | "Withdrawn";
export type ItemStatus = "Open" | "Claimed" | "Returned" | "Closed";
export type Claim = {
  id: string;
  reference: string;
  evidence: string;
  status: ClaimStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  student?: { id: string; name: string; email: string };
};
export type ItemRecord = {
  id: string;
  kind: "Lost" | "Found";
  title: string;
  description: string;
  category: string;
  location: string;
  happenedAt: string;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  claimCount: number;
  myClaim: Claim | null;
};
export type ItemInput = Pick<
  ItemRecord,
  "kind" | "title" | "description" | "category" | "location" | "happenedAt"
>;
export type ClaimRow = { item: ItemRecord; claim: Claim };
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
};
export type Stats = {
  lost: number;
  found: number;
  reunited: number;
  myReports: number;
  pendingClaims: number;
  totalClaims: number;
};
export type Meta = {
  categories: string[];
  statuses: ItemStatus[];
  claimStatuses: ClaimStatus[];
};
export const date = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const dateTime = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const localInput = (v: string | Date) => {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
