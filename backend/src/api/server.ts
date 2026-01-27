import express from "express";
import { botConfig } from "../config/tradingConfig";
import { botEngine } from "../bot/botEngine";
import { botState, getTodayPnl } from "../bot/stateStore";

const app = express();
const port = 4001;

app.use(express.json());

app.get("/api/status", (_req, res) => {
  res.json({
    botEnabled: botState.botEnabled,
    engineRunning: botEngine.isRunning(),
    positions: botState.positions,
    todayPnlUsd: getTodayPnl(),
    prices: botState.prices,
    logs: botState.logs,
    phases: botState.eventPhases
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

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  botEngine.start();
});

