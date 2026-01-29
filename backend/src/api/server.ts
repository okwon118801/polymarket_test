import * as fs from "fs";
import * as path from "path";
import express from "express";
import { botConfig } from "../config/tradingConfig";
import { botEngine } from "../bot/botEngine";
import { botState, getTodayPnl, getEventSummary } from "../bot/stateStore";
import {
  getMarketDataMode,
  setMarketDataMode,
  getMarketDataFeed
} from "../market/feedFactory";
import { getReplayFeed } from "../market/replayMarketDataFeed";

const app = express();
const port = 4001;

app.use(express.json());

app.get("/api/status", (_req, res) => {
  const feed = getMarketDataFeed();
  const progress = feed.getProgress?.();
  res.json({
    botEnabled: botState.botEnabled,
    engineRunning: botEngine.isRunning(),
    marketDataMode: getMarketDataMode(),
    positions: botState.positions,
    todayPnlUsd: getTodayPnl(),
    prices: botState.prices,
    logs: botState.logs,
    phases: botState.eventPhases,
    eventSummary: getEventSummary(),
    replayProgress: progress
  });
});

app.post("/api/bot/toggle", (_req, res) => {
  botState.botEnabled = !botState.botEnabled;

  if (botState.botEnabled && !botEngine.isRunning()) {
    botEngine.start();
  }
  if (!botState.botEnabled && botEngine.isRunning()) {
    botEngine.stop();
  }

  res.json({
    botEnabled: botState.botEnabled
  });
});

app.post("/api/reset", (_req, res) => {
  botEngine.resetScenario();
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json(botConfig);
});

app.get("/api/report", (_req, res) => {
  res.json({ eventSummary: getEventSummary() });
});

app.get("/api/market-mode", (_req, res) => {
  res.json({ marketDataMode: getMarketDataMode() });
});

app.post("/api/market-mode", (req, res) => {
  const mode = req.body?.mode;
  if (mode !== "MOCK" && mode !== "REPLAY" && mode !== "LIVE") {
    return res.status(400).json({ error: "Invalid mode. Use MOCK or REPLAY." });
  }
  if (botEngine.isRunning()) botEngine.stop();
  setMarketDataMode(mode);
  res.json({ marketDataMode: getMarketDataMode() });
});

app.get("/api/replay/progress", (_req, res) => {
  const feed = getMarketDataFeed();
  const progress = feed.getProgress?.();
  res.json(progress ?? { index: 0, total: 0, percent: 0 });
});

app.post("/api/replay/start", (_req, res) => {
  getReplayFeed().start();
  res.json({ ok: true });
});

app.post("/api/replay/pause", (_req, res) => {
  getReplayFeed().pause();
  res.json({ ok: true });
});

app.post("/api/replay/resume", (_req, res) => {
  getReplayFeed().resume();
  res.json({ ok: true });
});

app.post("/api/replay/stop", (_req, res) => {
  getReplayFeed().stop();
  res.json({ ok: true });
});

app.post("/api/replay/load", (req, res) => {
  const filePath = req.body?.filePath;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "filePath required" });
  }
  getReplayFeed().loadFile(filePath);
  res.json({ ok: true });
});

app.post("/api/replay/speed", (req, res) => {
  const speed = Number(req.body?.speed);
  if (!Number.isFinite(speed) || speed <= 0) {
    return res.status(400).json({ error: "speed must be a positive number" });
  }
  getReplayFeed().setReplaySpeed(speed);
  res.json({ ok: true });
});

const REPLAYS_DIR = path.join(process.cwd(), "data", "replays");

app.get("/api/replay/files", (_req, res) => {
  if (!fs.existsSync(REPLAYS_DIR)) {
    return res.json({ files: [] });
  }
  const files = fs.readdirSync(REPLAYS_DIR)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({ name: f, path: `data/replays/${f}` }));
  res.json({ files });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  botEngine.start();
});

