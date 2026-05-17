import { Router } from "express";

import { supportedFormats } from "../../services/supportedFormats.js";

export const formatsRouter = Router();

formatsRouter.get("/", (_req, res) => {
  res.json(supportedFormats());
});

