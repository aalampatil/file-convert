import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.mjs";

test("CSP allows React debugging eval only in development", async () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const mode of ["development", "production", "test"]) {
      process.env.NODE_ENV = mode;
      const routes = await config.headers();
      const policy = routes[0].headers.find(
        (header) => header.key === "Content-Security-Policy",
      ).value;
      const scripts = policy
        .split(";")
        .find((directive) => directive.trim().startsWith("script-src "));
      assert.equal(
        scripts.includes("'unsafe-eval'"),
        mode === "development",
        mode,
      );
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
