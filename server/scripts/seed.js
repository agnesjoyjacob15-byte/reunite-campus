import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, Item } from "../src/models.js";
export async function seedDemo() {
  const user = async (email, name, role) => {
    let u = await User.findOne({ email });
    if (!u)
      u = await User.create({
        email,
        name,
        role,
        passwordHash: await bcrypt.hash(
          role === "admin"
            ? process.env.ADMIN_PASSWORD
            : process.env.DEMO_PASSWORD,
          12,
        ),
      });
    return u;
  };
  const admin = await user(
    process.env.ADMIN_EMAIL || "admin@reunite.example",
    "Campus Help Desk",
    "admin",
  );
  const student = await user(
    "student@reunite.example",
    "Demo Student",
    "student",
  );
  const finder = await user("finder@reunite.example", "Demo Finder", "student");
  if (await Item.countDocuments()) return;
  const now = Date.now(),
    hour = 3600000,
    day = 24 * hour;
  const rows = [
    [
      "Found",
      "A pair of wireless headphones",
      "Electronics",
      "Library · second floor",
      "A pair of over-ear headphones was left on a reading desk. The campus desk is keeping it safe. Describe a distinguishing detail in a private claim.",
      now - 2 * hour,
      "Open",
    ],
    [
      "Lost",
      "Green water bottle",
      "Other",
      "Canteen",
      "I misplaced a reusable green bottle around the canteen seating area. If you have found one, please report it on the board or hand it to the campus desk.",
      now - 4 * hour,
      "Open",
    ],
    [
      "Found",
      "Keys on a canvas loop",
      "Keys",
      "Main block lobby",
      "A small set of keys with a fabric loop was handed in at the main block. The owner can describe the loop and the key arrangement privately.",
      now - 6 * hour,
      "Open",
    ],
    [
      "Found",
      "A well-loved chemistry notebook",
      "Books",
      "Academic Block B",
      "A handwritten chemistry notebook was found after a lecture. Claim it by describing something specific inside, without sharing personal identifiers.",
      now - day,
      "Open",
    ],
    [
      "Lost",
      "Student bus pass",
      "IDs & Cards",
      "Bus bay",
      "A student bus pass was misplaced near the boarding area. Please hand any found pass to the campus desk rather than publishing its personal details.",
      now - 5 * hour,
      "Open",
    ],
    [
      "Found",
      "Navy zip-up jacket",
      "Clothing",
      "Sports complex",
      "A navy jacket was left near the indoor courts. If it is yours, submit a private description of an identifying detail for staff to review.",
      now - 2 * day,
      "Open",
    ],
    [
      "Lost",
      "Calculator back with its owner",
      "Electronics",
      "Library",
      "This fictional example records a calculator that its reporter has already recovered. It demonstrates a completed lost-item report.",
      now - 4 * day,
      "Returned",
    ],
    [
      "Found",
      "Canvas pencil pouch",
      "Other",
      "Seminar hall",
      "This fictional example shows a completed handover after a private ownership claim was reviewed by the campus desk.",
      now - 3 * day,
      "Returned",
    ],
  ];
  const values = rows.map(
    ([kind, title, category, location, description, happenedAt, status]) => ({
      kind,
      title,
      category,
      location,
      description,
      happenedAt: new Date(happenedAt),
      status,
      createdBy: kind === "Found" ? finder._id : student._id,
      claims: [],
    }),
  );
  values[0].claims.push({
    student: student._id,
    evidence:
      "Fictional evidence: a tiny blue dot is drawn inside the left headband, and the carrying sleeve has a stitched star.",
    status: "Pending",
    submittedAt: new Date(now - hour),
  });
  const claimId = new mongoose.Types.ObjectId();
  values[7].approvedClaim = claimId;
  values[7].claims.push({
    _id: claimId,
    student: student._id,
    evidence:
      "Fictional evidence: the inner pocket has a sewn orange patch and a small green ruler was inside.",
    status: "Approved",
    submittedAt: new Date(now - 3 * day + hour),
    reviewedAt: new Date(now - 2 * day),
    reviewedBy: admin._id,
    reviewNote:
      "Demonstration ownership details matched; this fictional handover is complete.",
  });
  await Item.insertMany(values);
}
