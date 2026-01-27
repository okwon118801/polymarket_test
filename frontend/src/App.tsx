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
}

interface StatusResponse {
  botEnabled: boolean;
  engineRunning: boolean;
  positions: Position[];
  todayPnlUsd: number;
  prices: PriceSnapshot[];
  logs: LogEntry[];
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchStatus = async () => {
    const res = await axios.get<StatusResponse>("/api/status");
    setStatus(res.data);
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

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
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
            {status?.todayPnlUsd.toFixed(2)}
          </span>
        </div>
        <div className="button-row">
          <button onClick={toggleBot} disabled={loading}>
            {status?.botEnabled ? "봇 중지" : "봇 시작"}
          </button>
          <button onClick={resetScenario} disabled={resetting}>
            Mock 시나리오 리셋
          </button>
        </div>
      </section>

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
                <span className="log-message">{log.message}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};

