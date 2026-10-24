import mongoose from "mongoose";
export const CATEGORIES = [
  "Electronics",
  "Books",
  "IDs & Cards",
  "Keys",
  "Clothing",
  "Other",
];
export const STATUSES = ["Open", "Claimed", "Returned", "Closed"];
export const CLAIM_STATUSES = ["Pending", "Approved", "Rejected", "Withdrawn"];
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "admin"], default: "student" },
  },
  { timestamps: true },
);
const claimSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ReuniteUser",
    required: true,
  },
  evidence: { type: String, required: true, maxlength: 1500 },
  status: { type: String, enum: CLAIM_STATUSES, default: "Pending" },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ReuniteUser",
    default: null,
  },
  reviewNote: { type: String, default: "", maxlength: 500 },
});
const itemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["Lost", "Found"], required: true },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    location: { type: String, required: true, maxlength: 100 },
    happenedAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: "Open" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReuniteUser",
      required: true,
    },
    claims: { type: [claimSchema], default: [] },
    approvedClaim: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
itemSchema.index({ status: 1, happenedAt: -1 });
itemSchema.index({ createdBy: 1, createdAt: -1 });
itemSchema.index({ "claims.student": 1, "claims.submittedAt": -1 });
export const User = mongoose.model("ReuniteUser", userSchema);
export const Item = mongoose.model("ReuniteItem", itemSchema);
