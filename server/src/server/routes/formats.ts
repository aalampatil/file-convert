import { Router } from "express";
import { supportedFormats } from "../../services/supportedFormats.js";
export const formatsRouter = Router();
formatsRouter.get("/", async (_req, res, next) => {
  try { res.json(await supportedFormats()); } catch (err) { next(err); }
});
