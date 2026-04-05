const http = require("http");
const fs = require("fs");
const path = require("path");
const { seedData } = require("./data/seed");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function daysBetween(from, to) {
  return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
}

function getOpsSummary() {
  const now = seedData.generatedAt;
  const openTasks = seedData.tasks.filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => task.status !== "waiting" && daysBetween(now, task.due_at) < 0);
  const atRiskPipeline = seedData.fundraising_pipeline.filter((pipeline) => {
    const stale = daysBetween(pipeline.last_touch_at, now) >= 7;
    const deadlineSoon = daysBetween(now, pipeline.next_internal_deadline_at) <= 1;
    return stale || deadlineSoon || (pipeline.risk_flags?.length || 0) >= 2;
  });
  const watchPortfolio = seedData.portfolio_companies.filter((company) => company.health !== "strong");

  return {
    generatedAt: now,
    fundraising: {
      active_pipeline_count: seedData.fundraising_pipeline.length,
      at_risk_count: atRiskPipeline.length,
      committed_total: seedData.funds[0].committed_total,
      soft_circled_total: seedData.funds[0].soft_circled_total,
    },
    tasks: {
      open_count: openTasks.length,
      overdue_count: overdueTasks.length,
    },
    portfolio: {
      support_queue_count: watchPortfolio.length,
      needs_help_count: watchPortfolio.filter((company) => company.health === "needs_help").length,
    },
    integrations: {
      total: seedData.integrations.providers.length,
      google: seedData.integrations.providers.filter((item) => item.category === "google").length,
      scaffolded: seedData.integrations.providers.filter((item) => item.status === "scaffolded").length,
    },
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function resolvePublicPath(requestUrl) {
  const urlPath = requestUrl === "/" ? "/index.html" : requestUrl;
  const normalized = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(publicDir, normalized);
}

function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.readFile(path.join(publicDir, "index.html"), (indexError, indexContent) => {
          if (indexError) {
            sendJson(res, 500, { error: "Unable to load app shell" });
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(indexContent);
        });
        return;
      }
      sendJson(res, 500, { error: "Unable to load requested file" });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function createAppServer() {
  return http.createServer((req, res) => {
    if (!req.url) {
      sendJson(res, 400, { error: "Missing request URL" });
      return;
    }

    if (req.url === "/api/data") {
      sendJson(res, 200, seedData);
      return;
    }

    if (req.url === "/api/integrations") {
      sendJson(res, 200, {
        generatedAt: seedData.generatedAt,
        providers: seedData.integrations.providers,
        routes: seedData.integrations.routes,
      });
      return;
    }

    if (req.url === "/api/ops-summary") {
      sendJson(res, 200, getOpsSummary());
      return;
    }

    if (req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStaticFile(resolvePublicPath(req.url), res);
  });
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(port, host, () => {
    console.log(`Spice HQ V2 running at http://${host}:${port}`);
  });
}

module.exports = { createAppServer, getOpsSummary };
