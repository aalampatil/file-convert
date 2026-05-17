import mongoose from "mongoose";
import { mongoState } from "./mongoState.js";

export async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return { enabled: false };

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  mongoState.enabled = true;
  // eslint-disable-next-line no-console
  console.log("MongoDB connected");
  return { enabled: true };
}

