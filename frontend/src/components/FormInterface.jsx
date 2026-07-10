import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logInteraction, listHcps } from "../hooks/api";
import { 
  fetchStart, logSuccess, fetchFailure, fetchHcpsSuccess 
} from "../redux/slices/interactionSlice";

function FormInterface() {
  const dispatch = useDispatch();
  const { hcps, loading, error, lastExtractedData } = useSelector((state) => state.interaction);

  const [formData, setFormData] = useState({
    hcp_id: "",
    hcp_name: "",
    interaction_type: "Meeting",
    interaction_date: new Date().toISOString().split("T")[0],
    interaction_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    attendees: "",
    topics_discussed: "",
    materials_shared: "",
    samples_distributed: "",
    sentiment: "Neutral",
    outcomes: "",
    followup_actions: "",
    raw_chat_input: "" // Used for visit notes
  });

  const [listening, setListening] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchHCPsList = async () => {
      try {
        const response = await listHcps();
        dispatch(fetchHcpsSuccess(response.data));
      } catch (err) {
        console.error("Failed to load HCPs: ", err);
      }
    };
    fetchHCPsList();
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-populate hcp_name if hcp_id is selected from dropdown
      if (name === "hcp_id") {
        const selected = hcps.find(h => String(h.id) === String(value));
        if (selected) {
          updated.hcp_name = selected.name;
        }
      }
      return updated;
    });
  };

  const handleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Speech Recognition not supported. Please write notes manually.");
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalTranscript = "";

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      setFormData((prev) => ({
        ...prev,
        raw_chat_input: (finalTranscript + interimTranscript).trim()
      }));
    };

    recognition.onerror = (err) => {
      console.error(err);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.hcp_name) {
      alert("Please select or specify a Healthcare Professional (HCP) name.");
      return;
    }
    dispatch(fetchStart());
    setSuccessMsg("");
    try {
      const response = await logInteraction(formData);
      dispatch(logSuccess(response.data));
      setSuccessMsg("Success! Interaction record logged.");
      // Reset form fields
      setFormData({
        hcp_id: "",
        hcp_name: "",
        interaction_type: "Meeting",
        interaction_date: new Date().toISOString().split("T")[0],
        interaction_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        attendees: "",
        topics_discussed: "",
        materials_shared: "",
        samples_distributed: "",
        sentiment: "Neutral",
        outcomes: "",
        followup_actions: "",
        raw_chat_input: ""
      });
    } catch (err) {
      dispatch(fetchFailure(err.response?.data?.detail || "Failed to log interaction."));
    }
  };

  return (
    <div className="form-layout card">
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px" }}>Structured Form Entry</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
          Enter structured fields or dictate meeting notes using the microphone button.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="form-grid two-cols">
          <label>
            Healthcare Professional (HCP)
            <select name="hcp_id" value={formData.hcp_id} onChange={handleChange}>
              <option value="">-- Select Provider --</option>
              {hcps.map((hcp) => (
                <option key={hcp.id} value={hcp.id}>
                  {hcp.name} ({hcp.specialty})
                </option>
              ))}
            </select>
          </label>

          <label>
            HCP Name (if not in directory)
            <input 
              type="text" 
              name="hcp_name" 
              value={formData.hcp_name} 
              onChange={handleChange} 
              placeholder="Dr. John Doe"
            />
          </label>
        </div>

        <div className="form-grid two-cols">
          <label>
            Interaction Type
            <select name="interaction_type" value={formData.interaction_type} onChange={handleChange}>
              <option value="Meeting">Meeting</option>
              <option value="Call">Call</option>
              <option value="Email">Email</option>
              <option value="Conference">Conference</option>
              <option value="Visit">Visit</option>
            </select>
          </label>

          <label>
            Sentiment
            <select name="sentiment" value={formData.sentiment} onChange={handleChange}>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </label>
        </div>

        <div className="form-grid two-cols">
          <label>
            Date
            <input 
              type="date" 
              name="interaction_date" 
              value={formData.interaction_date} 
              onChange={handleChange}
            />
          </label>

          <label>
            Time
            <input 
              type="time" 
              name="interaction_time" 
              value={formData.interaction_time} 
              onChange={handleChange}
            />
          </label>
        </div>

        <label>
          Attendees
          <input 
            type="text" 
            name="attendees" 
            value={formData.attendees} 
            onChange={handleChange} 
            placeholder="e.g. Dr. Rajesh Kumar, rep name"
          />
        </label>

        <div className="form-grid two-cols">
          <label>
            Products Discussed
            <input 
              type="text" 
              name="samples_distributed" 
              value={formData.samples_distributed} 
              onChange={handleChange} 
              placeholder="e.g. CardioMed-X, NeuroMax"
            />
          </label>

          <label>
            Materials Shared
            <input 
              type="text" 
              name="materials_shared" 
              value={formData.materials_shared} 
              onChange={handleChange} 
              placeholder="e.g. Brochures, Clinical Trail V2 PDF"
            />
          </label>
        </div>

        <div className="mic-textarea-wrapper">
          <label>
            Raw Meeting Notes (Processed by AI)
            <textarea 
              name="raw_chat_input" 
              value={formData.raw_chat_input} 
              onChange={handleChange}
              placeholder="Write raw visit notes here, or click the mic button to dictate..."
              style={{ minHeight: "120px" }}
            />
          </label>
          <button 
            type="button" 
            className={`speech-btn ${listening ? "listening" : ""}`}
            onClick={handleSpeech}
            title={listening ? "Listening..." : "Dictate Notes"}
          >
            🎤
          </button>
        </div>

        {error && <div style={{ color: "var(--danger-color)", fontSize: "14px", fontWeight: 600 }}>{error}</div>}
        {successMsg && <div style={{ color: "var(--success-color)", fontSize: "14px", fontWeight: 600 }}>{successMsg}</div>}

        <div className="submit-section">
          <button type="submit" disabled={loading}>
            {loading ? "Processing..." : "Submit Log"}
          </button>
        </div>
      </form>

      {/* AI summaries section */}
      {lastExtractedData && lastExtractedData.status === "success" && (
        <div className="ai-summary-panel">
          <div className="ai-summary-header">
            <span className="ai-summary-title">🤖 AI Assistant Analysis</span>
            <span className={`sentiment-badge ${(lastExtractedData.sentiment || "Neutral").toLowerCase()}`}>
              {lastExtractedData.sentiment || "Neutral"}
            </span>
          </div>

          <div className="summary-text">
            <strong>AI Summary:</strong> {lastExtractedData.ai_generated_summary}
          </div>

          <div className="insights-title">Key Insights Extracted:</div>
          <div className="insights-grid">
            {lastExtractedData.key_insights && lastExtractedData.key_insights.length > 0 ? (
              lastExtractedData.key_insights.map((insight, idx) => (
                <div key={idx} className="insight-card">
                  💡 {insight}
                </div>
              ))
            ) : (
              <div className="insight-card">Discussed products efficacy. Receptive behavior.</div>
            )}
          </div>

          <div className="insights-title">Suggested Action Items:</div>
          <div className="insights-grid">
            {lastExtractedData.suggested_action_items && lastExtractedData.suggested_action_items.length > 0 ? (
              lastExtractedData.suggested_action_items.map((action, idx) => (
                <div key={idx} className="insight-card" style={{ borderLeft: "3px solid var(--primary-color)" }}>
                  ✅ {action}
                </div>
              ))
            ) : (
              <div className="insight-card" style={{ borderLeft: "3px solid var(--primary-color)" }}>
                Follow-up with provider inside 1 week.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FormInterface;
