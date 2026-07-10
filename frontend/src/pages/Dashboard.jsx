import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import LogInteractionScreen from "../components/LogInteractionScreen";

function Dashboard() {
  const { interactions } = useSelector((state) => state.interaction);
  const [stats, setStats] = useState({
    total: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    scheduledFollowups: 0
  });

  useEffect(() => {
    const total = interactions.length;
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let scheduledFollowups = 0;

    interactions.forEach((item) => {
      const sentiment = (item.sentiment || "Neutral").toLowerCase();
      if (sentiment === "positive") positive++;
      else if (sentiment === "negative") negative++;
      else neutral++;

      if (item.followup_actions && item.followup_actions.includes("scheduled")) {
        scheduledFollowups++;
      }
    });

    setStats({ total, positive, neutral, negative, scheduledFollowups });
  }, [interactions]);

  return (
    <main className="container" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        
        <div className="card" style={{ borderLeft: "4px solid var(--primary-color)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Total Interactions
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 0" }}>
            {stats.total}
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--success-color)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Positive Sentiment
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 0", color: "var(--success-color)" }}>
            {stats.positive}
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--warning-color)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Follow-ups Scheduled
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 0", color: "var(--warning-color)" }}>
            {stats.scheduledFollowups}
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--secondary-color)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Unresolved Actions
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 0" }}>
            {stats.total - stats.scheduledFollowups}
          </div>
        </div>

      </div>

      {/* Main Workspace Workspace */}
      <LogInteractionScreen />
    </main>
  );
}

export default Dashboard;
