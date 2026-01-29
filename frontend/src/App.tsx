import React, { useEffect, useState } from "react";
import axios from "axios";

interface Position {
  id: string;
  eventId: string;
  side: "YES" | "NO";
  avgEntryPrice: number;
  size: number;
  openTimestamp: number;
  closed: boolean;
}

interface PriceSnapshot {
  eventId: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  secondsToResolution: number;
  timestamp: number;
}

interface LogEntry {
  id: number;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR";
  eventId?: string;
  message: string;
  decisionTrigger?: string;
  marketSnapshot?: { eventId: string; yesPrice: number; noPrice: number; volatility30m: number };
  payload?: Record<string, unknown>;
}

interface EventSummaryRow {
  eventId: string;
  eventTitle: string;
  entryPrice: number;
  exitPrice: number;
  isStopLoss: boolean;
  tradeCount: number;
  netPnlUsd: number;
  holdingTimeMs: number;
}

interface ReplayProgress {
  index: number;
  total: number;
  percent: number;
  currentTs?: string;
}

interface StatusResponse {
  botEnabled: boolean;
  engineRunning: boolean;
  marketDataMode?: "MOCK" | "REPLAY" | "LIVE";
  positions: Position[];
  todayPnlUsd: number;
  prices: PriceSnapshot[];
  logs: LogEntry[];
  eventSummary?: EventSummaryRow[];
  replayProgress?: ReplayProgress;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [replayFiles, setReplayFiles] = useState<{ name: string; path: string }[]>([]);
  const [replaySpeed, setReplaySpeed] = useState(60);

  const fetchStatus = async () => {
    const res = await axios.get<StatusResponse>("/api/status");
    setStatus(res.data);
  };

  const fetchReplayFiles = async () => {
    const res = await axios.get<{ files: { name: string; path: string }[] }>("/api/replay/files");
    setReplayFiles(res.data.files ?? []);
  };

  const toggleBot = async () => {
    setLoading(true);
    try {
      await axios.post("/api/bot/toggle");
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const resetScenario = async () => {
    setResetting(true);
    try {
      await axios.post("/api/reset");
      await fetchStatus();
    } finally {
      setResetting(false);
    }
  };

  const setMarketMode = async (mode: "MOCK" | "REPLAY") => {
    try {
      await axios.post("/api/market-mode", { mode });
      await fetchStatus();
      if (mode === "REPLAY") await fetchReplayFiles();
    } catch (e) {
      console.error(e);
    }
  };

  const replayLoad = async (filePath: string) => {
    try {
      await axios.post("/api/replay/load", { filePath });
      await fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const replaySetSpeed = async (speed: number) => {
    setReplaySpeed(speed);
    try {
      await axios.post("/api/replay/speed", { speed });
    } catch (e) {
      console.error(e);
    }
  };

  const replayStart = async () => {
    await axios.post("/api/replay/start");
    await fetchStatus();
  };
  const replayPause = async () => {
    await axios.post("/api/replay/pause");
    await fetchStatus();
  };
  const replayResume = async () => {
    await axios.post("/api/replay/resume");
    await fetchStatus();
  };
  const replayStop = async () => {
    await axios.post("/api/replay/stop");
    await fetchStatus();
  };

  useEffect(() => {
    fetchStatus();
    fetchReplayFiles();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  return (
    <div className="app">
      <header>
        <h1>Polymarket 0.9 근처 자동매매 봇 (Mock MVP)</h1>
      </header>

      <section className="status-card">
        <div>
          <span className="label">Data Mode:</span>
          <select
            value={status?.marketDataMode ?? "MOCK"}
            onChange={e => setMarketMode(e.target.value as "MOCK" | "REPLAY")}
            disabled={status?.engineRunning}
          >
            <option value="MOCK">MOCK</option>
            <option value="REPLAY">REPLAY</option>
          </select>
        </div>
        <div>
          <span className="label">봇 상태:</span>
          <span className={status?.botEnabled ? "pill pill-on" : "pill pill-off"}>
            {status?.botEnabled ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        <div>
          <span className="label">엔진 루프:</span>
          <span className={status?.engineRunning ? "pill pill-on" : "pill pill-off"}>
            {status?.engineRunning ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        <div>
          <span className="label">오늘 손익 (USD):</span>
          <span
            className={
              (status?.todayPnlUsd ?? 0) >= 0 ? "pnl-positive" : "pnl-negative"
            }
          >
            {(status?.todayPnlUsd ?? 0).toFixed(2)}
          </span>
        </div>
        <div className="button-row">
          <button onClick={toggleBot} disabled={loading}>
            {status?.botEnabled ? "봇 중지" : "봇 시작"}
          </button>
          <button onClick={resetScenario} disabled={resetting}>
            시나리오 리셋
          </button>
        </div>
      </section>

      {status?.marketDataMode === "REPLAY" && (
        <section className="replay-card">
          <h2>Replay 컨트롤</h2>
          <div className="replay-controls">
            <div>
              <span className="label">파일:</span>
              <select
                onChange={e => {
                  const path = e.target.value;
                  if (path) replayLoad(path);
                }}
              >
                <option value="">선택</option>
                {replayFiles.map(f => (
                  <option key={f.path} value={f.path}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">배속:</span>
              <select
                value={replaySpeed}
                onChange={e => replaySetSpeed(Number(e.target.value))}
              >
                <option value={1}>1x</option>
                <option value={10}>10x</option>
                <option value={60}>60x</option>
                <option value={120}>120x</option>
              </select>
            </div>
            <div className="button-row">
              <button onClick={replayStart}>재생</button>
              <button onClick={replayPause}>일시정지</button>
              <button onClick={replayResume}>재개</button>
              <button onClick={replayStop}>정지</button>
            </div>
            {status.replayProgress && (
              <div className="replay-progress">
                <span className="label">진행률:</span>
                <span>
                  {status.replayProgress.percent.toFixed(1)}% ({status.replayProgress.index} /{" "}
                  {status.replayProgress.total})
                </span>
                {status.replayProgress.currentTs && (
                  <span className="label">현재 tick: {status.replayProgress.currentTs}</span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2>현재 가격</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>YES</th>
              <th>NO</th>
              <th>남은 시간</th>
              <th>업데이트 시각</th>
            </tr>
          </thead>
          <tbody>
            {status?.prices.map(p => (
              <tr key={p.eventId}>
                <td>{p.title}</td>
                <td>{p.yesPrice.toFixed(3)}</td>
                <td>{p.noPrice.toFixed(3)}</td>
                <td>{Math.floor(p.secondsToResolution / 60)}분</td>
                <td>{formatTime(p.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>이벤트별 요약 리포트</h2>
        <table>
          <thead>
            <tr>
              <th>이벤트</th>
              <th>진입가</th>
              <th>청산가</th>
              <th>손절</th>
              <th>거래 횟수</th>
              <th>순손익 (USD)</th>
              <th>보유시간</th>
            </tr>
          </thead>
          <tbody>
            {status?.eventSummary?.map(row => (
              <tr key={row.eventId}>
                <td title={row.eventId}>{row.eventTitle}</td>
                <td>{row.entryPrice.toFixed(3)}</td>
                <td>{row.exitPrice.toFixed(3)}</td>
                <td>{row.isStopLoss ? "예" : "아니오"}</td>
                <td>{row.tradeCount}</td>
                <td className={row.netPnlUsd >= 0 ? "pnl-positive" : "pnl-negative"}>
                  {row.netPnlUsd.toFixed(2)}
                </td>
                <td>{Math.round(row.holdingTimeMs / 1000)}초</td>
              </tr>
            ))}
            {(!status?.eventSummary || status.eventSummary.length === 0) && (
              <tr>
                <td colSpan={7}>청산된 포지션이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>포지션 상태</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Event</th>
              <th>Side</th>
              <th>Avg Entry</th>
              <th>Size</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {status?.positions.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.eventId}</td>
                <td>{p.side}</td>
                <td>{p.avgEntryPrice.toFixed(3)}</td>
                <td>{p.size}</td>
                <td>{p.closed ? "Closed" : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>진입 / 청산 / 손절 로그</h2>
        <div className="log-list">
          {status?.logs
            .slice()
            .reverse()
            .map(log => (
              <div key={log.id} className={`log-item log-${log.level.toLowerCase()}`}>
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className="log-level">{log.level}</span>
                {log.eventId && <span className="log-event">[{log.eventId}]</span>}
                {log.decisionTrigger && (
                  <span className="log-trigger">{log.decisionTrigger}</span>
                )}
                <span className="log-message">{log.message}</span>
                {log.marketSnapshot && (
                  <span className="log-snapshot" title={JSON.stringify(log.marketSnapshot)}>
                    📊
                  </span>
                )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};

