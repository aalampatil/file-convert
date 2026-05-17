import mongoose from "mongoose";
import type { JobRecord } from "../jobTypes.js";

const JobSchema = new mongoose.Schema<JobRecord>(
  {
    id: { type: String, required: true, unique: true, index: true },
    createdAt: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadPath: { type: String, required: true },
    targetFormat: { type: String, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    message: { type: String, required: false },
    result: { type: Object, required: false }
  },
  { versionKey: false }
);

export const JobModel =
  (mongoose.models.Job as mongoose.Model<JobRecord>) || mongoose.model<JobRecord>("Job", JobSchema);

