import mongoose from "mongoose";
import { z } from "zod";
import { Item, User, CATEGORIES, STATUSES, CLAIM_STATUSES } from "../models.js";
import {
  problem,
  itemInput,
  itemListInput,
  claimListInput,
  itemView,
  claimView,
  literal,
  text,
  csvCell,
} from "../helpers.js";
export const metadata = (req, res) =>
  res.json({
    categories: CATEGORIES,
    statuses: STATUSES,
    claimStatuses: CLAIM_STATUSES,
  });
export async function byId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id))
    throw problem(404, "Report not found.");
  req.item = await Item.findById(req.params.id);
  if (!req.item) throw problem(404, "Report not found.");
  next();
}
function manager(req) {
  if (
    req.user.role !== "admin" &&
    String(req.item.createdBy) !== String(req.user._id)
  )
    throw problem(
      403,
      "Only the reporter or an administrator can change this report.",
    );
}
export async function list(req, res) {
  const q = itemListInput.parse(req.query),
    filter = {};
  if (q.scope === "mine") filter.createdBy = req.user._id;
  for (const key of ["kind", "category", "status"])
    if (q[key]) filter[key] = q[key];
  if (q.search)
    filter.$or = ["title", "description", "location"].map((k) => ({
      [k]: { $regex: literal(q.search), $options: "i" },
    }));
  const [rows, total] = await Promise.all([
    Item.find(filter)
      .sort({ happenedAt: -1, _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Item.countDocuments(filter),
  ]);
  res.json({
    items: rows.map((i) => itemView(i, req.user)),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
}
export const detail = (req, res) =>
  res.json({ item: itemView(req.item, req.user) });
export async function create(req, res) {
  const value = itemInput.parse(req.body),
    item = await Item.create({ ...value, createdBy: req.user._id });
  res.status(201).json({ item: itemView(item, req.user) });
}
export async function edit(req, res) {
  manager(req);
  const value = itemInput.parse(req.body);
  const item = await Item.findOneAndUpdate(
    { _id: req.item._id, status: "Open", claims: { $size: 0 } },
    { $set: value, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!item)
    throw problem(
      409,
      "Only open reports without claim history can be edited.",
    );
  res.json({ item: itemView(item, req.user) });
}
export async function remove(req, res) {
  manager(req);
  const item = await Item.findOneAndDelete({
    _id: req.item._id,
    status: "Open",
    claims: { $size: 0 },
  });
  if (!item)
    throw problem(
      409,
      "Only open reports without claim history can be deleted.",
    );
  res.status(204).end();
}
export async function changeStatus(req, res) {
  manager(req);
  const { status } = z
    .object({ status: z.enum(["Returned", "Closed"]) })
    .strict()
    .parse(req.body);
  const i = req.item,
    admin = req.user.role === "admin",
    filter = { _id: i._id };
  if (status === "Returned") {
    if (i.kind === "Found") {
      if (!admin)
        throw problem(403, "An administrator must confirm the handover.");
      filter.status = "Claimed";
      filter.approvedClaim = { $ne: null };
    } else filter.status = "Open";
    const item = await Item.findOneAndUpdate(
      filter,
      { $set: { status }, $inc: { __v: 1 } },
      { new: true },
    );
    if (!item)
      throw problem(
        409,
        "This report cannot be marked returned from its current state.",
      );
    return res.json({ item: itemView(item, req.user) });
  }
  filter.status = "Open";
  if (!admin) filter.claims = { $size: 0 };
  const now = new Date();
  const item = await Item.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          status: "Closed",
          updatedAt: now,
          __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
          claims: {
            $map: {
              input: "$claims",
              as: "c",
              in: {
                $cond: [
                  { $eq: ["$$c.status", "Pending"] },
                  {
                    $mergeObjects: [
                      "$$c",
                      {
                        status: "Rejected",
                        reviewedAt: now,
                        reviewedBy: req.user._id,
                        reviewNote:
                          "The report was closed by an administrator.",
                      },
                    ],
                  },
                  "$$c",
                ],
              },
            },
          },
        },
      },
    ],
    { new: true },
  );
  if (!item)
    throw problem(
      409,
      "Only open reports can be closed; reports with claims need an administrator.",
    );
  res.json({ item: itemView(item, req.user) });
}
export async function submitClaim(req, res) {
  if (req.user.role !== "student")
    throw problem(403, "Only students can submit ownership claims.");
  const { evidence } = z
    .object({ evidence: text(20, 1500) })
    .strict()
    .parse(req.body);
  if (req.item.kind !== "Found")
    throw problem(409, "Ownership claims are available only for found items.");
  if (String(req.item.createdBy) === String(req.user._id))
    throw problem(403, "You cannot claim an item you reported.");
  const claim = {
    _id: new mongoose.Types.ObjectId(),
    student: req.user._id,
    evidence,
    status: "Pending",
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
  const item = await Item.findOneAndUpdate(
    {
      _id: req.item._id,
      kind: "Found",
      status: "Open",
      "claims.student": { $ne: req.user._id },
      $expr: { $lt: [{ $size: "$claims" }, 100] },
    },
    { $push: { claims: claim }, $inc: { __v: 1 } },
    { new: true },
  );
  if (!item)
    throw problem(
      409,
      "A claim already exists, the report is no longer open, or the claim limit has been reached.",
    );
  res.status(201).json({ item: itemView(item, req.user) });
}
export async function withdraw(req, res) {
  const item = await Item.findOneAndUpdate(
    {
      _id: req.item._id,
      status: "Open",
      claims: { $elemMatch: { student: req.user._id, status: "Pending" } },
    },
    { $set: { "claims.$.status": "Withdrawn" }, $inc: { __v: 1 } },
    { new: true },
  );
  if (!item)
    throw problem(
      409,
      "Only your own pending claim on an open report can be withdrawn.",
    );
  res.json({ item: itemView(item, req.user) });
}
export async function claims(req, res) {
  const q = claimListInput.parse(req.query),
    admin = req.user.role === "admin",
    initial = {},
    match = {};
  if (!admin) {
    initial["claims.student"] = req.user._id;
    match["claims.student"] = req.user._id;
  }
  if (q.itemId) initial._id = new mongoose.Types.ObjectId(q.itemId);
  if (q.status) match["claims.status"] = q.status;
  const [result] = await Item.aggregate([
    { $match: initial },
    { $unwind: "$claims" },
    { $match: match },
    { $sort: { "claims.submittedAt": -1, "claims._id": -1 } },
    {
      $facet: {
        rows: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }],
        count: [{ $count: "total" }],
      },
    },
  ]);
  const total = result.count[0]?.total || 0,
    rows = result.rows;
  const [items, students] = await Promise.all([
    Item.find({ _id: { $in: rows.map((r) => r._id) } }).lean(),
    admin
      ? User.find({ _id: { $in: rows.map((r) => r.claims.student) } }).lean()
      : [],
  ]);
  const byItem = new Map(items.map((i) => [String(i._id), i])),
    byStudent = new Map(students.map((u) => [String(u._id), u]));
  res.json({
    items: rows.map((r) => ({
      item: itemView(byItem.get(String(r._id)), req.user),
      claim: claimView(
        r.claims,
        admin ? byStudent.get(String(r.claims.student)) : undefined,
      ),
    })),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
}
export async function review(req, res) {
  if (!mongoose.isValidObjectId(req.params.claimId))
    throw problem(404, "Claim not found.");
  const { decision, note } = z
      .object({
        decision: z.enum(["Approved", "Rejected"]),
        note: text(10, 500),
      })
      .strict()
      .parse(req.body),
    claimId = new mongoose.Types.ObjectId(req.params.claimId),
    now = new Date();
  const filter = {
    _id: req.item._id,
    kind: "Found",
    status: "Open",
    approvedClaim: null,
    claims: { $elemMatch: { _id: claimId, status: "Pending" } },
  };
  let item;
  if (decision === "Rejected")
    item = await Item.findOneAndUpdate(
      filter,
      {
        $set: {
          "claims.$.status": "Rejected",
          "claims.$.reviewedAt": now,
          "claims.$.reviewedBy": req.user._id,
          "claims.$.reviewNote": note,
        },
        $inc: { __v: 1 },
      },
      { new: true },
    );
  else
    item = await Item.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            status: "Claimed",
            approvedClaim: claimId,
            updatedAt: now,
            __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
            claims: {
              $map: {
                input: "$claims",
                as: "c",
                in: {
                  $cond: [
                    { $eq: ["$$c.status", "Pending"] },
                    {
                      $mergeObjects: [
                        "$$c",
                        {
                          status: {
                            $cond: [
                              { $eq: ["$$c._id", claimId] },
                              "Approved",
                              "Rejected",
                            ],
                          },
                          reviewedAt: now,
                          reviewedBy: req.user._id,
                          reviewNote: {
                            $cond: [
                              { $eq: ["$$c._id", claimId] },
                              { $literal: note },
                              "Another ownership claim was approved for this item.",
                            ],
                          },
                        },
                      ],
                    },
                    "$$c",
                  ],
                },
              },
            },
          },
        },
      ],
      { new: true },
    );
  if (!item)
    throw problem(
      409,
      "This claim has already been reviewed or the item is no longer available.",
    );
  res.json({ item: itemView(item, req.user) });
}
export async function stats(req, res) {
  const admin = req.user.role === "admin";
  const [lost, found, reunited, myReports, claimCounts] = await Promise.all([
    Item.countDocuments({ kind: "Lost", status: "Open" }),
    Item.countDocuments({ kind: "Found", status: "Open" }),
    Item.countDocuments({ status: "Returned" }),
    Item.countDocuments({ createdBy: req.user._id }),
    Item.aggregate([
      { $unwind: "$claims" },
      { $match: admin ? {} : { "claims.student": req.user._id } },
      { $group: { _id: "$claims.status", count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    lost,
    found,
    reunited,
    myReports,
    pendingClaims: claimCounts.find((c) => c._id === "Pending")?.count || 0,
    totalClaims: claimCounts.reduce((n, c) => n + c.count, 0),
  });
}
export async function exportSummary(req, res) {
  const rows = await Item.find().sort({ createdAt: -1 }).limit(5000).lean();
  const data = [
    [
      "Report ID",
      "Type",
      "Title",
      "Category",
      "Location",
      "Reported time",
      "Status",
      "Claim count",
    ],
    ...rows.map((i) => [
      String(i._id),
      i.kind,
      i.title,
      i.category,
      i.location,
      i.happenedAt.toISOString(),
      i.status,
      i.claims.length,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  res
    .set(
      "Content-Disposition",
      'attachment; filename="reunite-report-summary.csv"',
    )
    .type("text/csv")
    .send("\uFEFF" + data);
}
