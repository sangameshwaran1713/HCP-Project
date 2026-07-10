import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import FormInterface from "./FormInterface";
import ChatInterface from "./ChatInterface";
import InteractionHistory from "./InteractionHistory";
import ToolsDemo from "./ToolsDemo";
import AdminPanel from "./AdminPanel";
import DoctorPortal from "./DoctorPortal";
import { retrieveHcpData } from "../hooks/api";
import { setSelectedHcp } from "../redux/slices/interactionSlice";

function LogInteractionScreen() {
  const dispatch = useDispatch();
  const { selectedHcp } = useSelector((state) => state.interaction);
  const [activeTab, setActiveTab] = useState("form");
  const [hcpDetails, setHcpDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Hidden tabs display states
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [showDoctorTab, setShowDoctorTab] = useState(false);

  // Parse URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") {
      setShowAdminTab(true);
    }
    if (params.get("doctor") === "true") {
      setShowDoctorTab(true);
    }
  }, []);

  // We can default select a provider for demo ease if none is selected
  useEffect(() => {
    if (!selectedHcp) {
      dispatch(setSelectedHcp({ id: 1, name: "Dr. Rajesh Kumar", specialty: "Cardiology" }));
    }
  }, [selectedHcp, dispatch]);

  useEffect(() => {
    const loadHcpContext = async () => {
      if (!selectedHcp || !selectedHcp.id) return;
      setDetailsLoading(true);
      try {
        const response = await retrieveHcpData(selectedHcp.id);
        if (response.data && response.data.status === "success") {
          setHcpDetails(response.data);
        } else {
          setHcpDetails(null);
        }
      } catch (err) {
        console.error("Error retrieving HCP profile context: ", err);
      } finally {
        setDetailsLoading(false);
      }
    };
    loadHcpContext();
  }, [selectedHcp]);

  return (
    <div className="screen-shell">
      <div className="screen-header">
        <div className="screen-title">
          <h1>Log Interaction Workspace</h1>
          <p>Register engagements with Healthcare Professionals using Form or Conversational AI.</p>
        </div>
        <div className="tab-navigation">
          <button 
            onClick={() => setActiveTab("form")} 
            className={`tab-btn ${activeTab === "form" ? "active" : ""}`}
          >
            📋 Structured Form
          </button>
          <button 
            onClick={() => setActiveTab("chat")} 
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          >
            💬 Conversational Chat
          </button>
          <button 
            onClick={() => setActiveTab("history")} 
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          >
            📜 History Logs
          </button>
          <button 
            onClick={() => setActiveTab("demo")} 
            className={`tab-btn ${activeTab === "demo" ? "active" : ""}`}
          >
            🛠️ Tools Demo
          </button>
          {showAdminTab && (
            <button 
              onClick={() => setActiveTab("admin")} 
              className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
            >
              🔑 Admin Panel
            </button>
          )}
          {showDoctorTab && (
            <button 
              onClick={() => setActiveTab("doctor")} 
              className={`tab-btn ${activeTab === "doctor" ? "active" : ""}`}
              style={{ color: "#0b7a6d", borderColor: activeTab === "doctor" ? "#0b7a6d" : "var(--border-color)" }}
            >
              🩺 Doctor Portal
            </button>
          )}
        </div>
      </div>

      {(activeTab === "form" || activeTab === "chat") ? (
        <div className="split-layout">
          {/* Main Interface Tab Content */}
          <div className="main-panel">
            {activeTab === "form" && <FormInterface />}
            {activeTab === "chat" && <ChatInterface />}
          </div>

          {/* Context Sidebar (Tool 3) */}
          <div className="context-panel">
            <div className="card">
              <h3 className="context-section-title">👨‍⚕️ Provider Context (Tool 3)</h3>
              {detailsLoading && <p style={{ fontSize: "13px" }}>Loading provider context...</p>}
              {!detailsLoading && hcpDetails ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                      {hcpDetails.hcp_profile.name}
                    </strong>
                    <span style={{ display: "block", color: "var(--text-secondary)", fontStyle: "italic", marginTop: "2px" }}>
                      {hcpDetails.hcp_profile.specialty} — {hcpDetails.hcp_profile.institution}
                    </span>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
                    <strong>Stats:</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                      <div>Total Logs: <strong>{hcpDetails.interaction_statistics.total_logged_interactions}</strong></div>
                      <div>Last Log: <strong>{hcpDetails.interaction_statistics.last_interaction_date}</strong></div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
                    <strong>Suggested Topics:</strong>
                    <ul className="talking-points-list">
                      {hcpDetails.suggested_discussion_topics.map((topic, idx) => (
                        <li key={idx}>{topic}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px", color: "var(--primary-color)", fontWeight: 600 }}>
                    💡 Optimal Follow-up Period: {hcpDetails.interaction_statistics.optimal_followup_frequency}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Select or log an interaction to view the provider context.
                </p>
              )}
            </div>

            <div className="card" style={{ background: "linear-gradient(135deg, #1f5fab, #174b89)", color: "#ffffff" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "#ffffff" }}>🚀 AI Copilot Tips</h3>
              <p style={{ fontSize: "12px", lineHeight: "1.45", margin: 0, opacity: 0.9 }}>
                The Conversational Chat uses LangGraph agent state to extract database records. Just type what happened and let the AI structure it!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ width: "100%" }}>
          {activeTab === "history" && <InteractionHistory />}
          {activeTab === "demo" && <ToolsDemo />}
          {activeTab === "admin" && <AdminPanel />}
          {activeTab === "doctor" && <DoctorPortal />}
        </div>
      )}
    </div>
  );
}

export default LogInteractionScreen;
