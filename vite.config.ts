/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs/promises";

const skillDesignWriterPlugin = {
  name: "artdle-skill-design-writer",
  configureServer(server: any) {
    server.middlewares.use(
      "/api/skill-design",
      async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(body);
          if (parsed.version !== 1) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Bad version" }));
            return;
          }
          const target = path.resolve(
            __dirname,
            "src/config/skillTreeDesign.json",
          );
          await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf-8");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      },
    );
  },
};

const schoolDesignWriterPlugin = {
  name: "artdle-school-design-writer",
  configureServer(server: any) {
    server.middlewares.use(
      "/api/school-design",
      async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Expected array" }));
            return;
          }
          const target = path.resolve(
            __dirname,
            "src/config/schoolResearches.json",
          );
          await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf-8");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      },
    );
  },
};

const achievementDesignWriterPlugin = {
  name: "artdle-achievement-design-writer",
  configureServer(server: any) {
    server.middlewares.use(
      "/api/achievement-design",
      async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Expected array" }));
            return;
          }
          const target = path.resolve(__dirname, "src/config/achievementsDesign.json");
          await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf-8");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      },
    );
  },
};

export default defineConfig({
  plugins: [react(), skillDesignWriterPlugin, schoolDesignWriterPlugin, achievementDesignWriterPlugin],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    allowedHosts: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
