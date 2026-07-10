import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
  listInteractions, editInteraction, scheduleFollowup, extractActionItems 
} from "../hooks/api";
import { 
  fetchStart, fetchSuccess, fetchFailure, editSuccess 
} from "../redux/slices/interactionSlice";

function InteractionHistory() {
  const dispatch = useDispatch();
  const { interactions, loading, error } = useSelector((state) => state.interaction);
  const [selectedItem, setSelectedItem] = useState(null);

  // States for Tool 2 (Edit)
  const [editField, setEditField] = useState("sentiment");
  const [editValue, setEditValue] = useState("Positive");
  const [editLoading, setEditLoading] = useState(false);

  // States for Tool 4 (Schedule)
  const [followupPref, setFollowupPref] = useState("1-week");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleResult, setScheduleResult] = useState("");

  // States for Tool 5 (Extract Tasks)
  const [tasksList, setTasksList] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const loadHistory = async () => {
    dispatch(fetchStart());
    try {
      const response = await listInteractions();
      dispatch(fetchSuccess(response.data));
    } catch (err) {
      dispatch(fetchFailure("Failed to load interaction history."));
    }
  };

  useEffect(() => {
    loadHistory();
  }, [dispatch]);

  const handleRowSelect = (item) => {
    setSelectedItem(item);
    setScheduleResult("");
    setTasksList([]);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    setEditLoading(true);
    try {
      const response = await editInteraction(selectedItem.id, editField, editValue);
      if (response.data.status === "success") {
        alert(response.data.message);
        // Refresh local details and list
        const updatedItem = { ...selectedItem, [editField]: editValue };
        setSelectedItem(updatedItem);
        dispatch(editSuccess(updatedItem));
        loadHistory();
      } else {
        alert(response.data.message || "Failed to update field.");
      }
    } catch (err) {
      alert("Error editing interaction field.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedItem) return;
    setScheduleLoading(true);
    setScheduleResult("");
    try {
      const response = await scheduleFollowup(selectedItem.id, followupPref);
      if (response.data.status === "success") {
        setScheduleResult(response.data.message);
        loadHistory();
      } else {
        setScheduleResult("Error: " + response.data.message);
      }
    } catch (err) {
      setScheduleResult("Failed to schedule followup.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleExtractTasks = async () => {
    if (!selectedItem) return;
    setTasksLoading(true);
    setTasksList([]);
    try {
      const response = await extractActionItems(selectedItem.id);
      if (response.data.status === "success") {
        setTasksList(response.data.action_items || []);
      } else {
        alert(response.data.message || "Failed to extract tasks.");
      }
    } catch (err) {
      alert("Error extracting action items.");
    } finally {
      setTasksLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: selectedItem ? "1.2fr 0.8fr" : "1fr", gap: "24px" }}>
        
        {/* Table list */}
        <div className="card" style={{ overflowX: "auto" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>Logged Engagement History</h2>
          
          {loading && <p>Loading history logs...</p>}
          {error && <p style={{ color: "var(--danger-color)" }}>{error}</p>}
          
          {!loading && interactions.length === 0 && <p>No logged interactions found. Log a meeting to get started.</p>}
          
          {interactions.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px 8px" }}>ID</th>
                  <th style={{ padding: "10px 8px" }}>HCP Name</th>
                  <th style={{ padding: "10px 8px" }}>Type</th>
                  <th style={{ padding: "10px 8px" }}>Date</th>
                  <th style={{ padding: "10px 8px" }}>Sentiment</th>
                  <th style={{ padding: "10px 8px" }}>Topic</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => handleRowSelect(item)}
                    style={{ 
                      borderBottom: "1px solid var(--border-color)", 
                      cursor: "pointer",
                      backgroundColor: selectedItem && selectedItem.id === item.id ? "rgba(31, 95, 171, 0.08)" : "transparent"
                    }}
                    className="history-row"
                  >
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>#{item.id}</td>
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>{item.hcp_name}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ 
                        padding: "3px 6px", 
                        background: "#edf2f7", 
                        borderRadius: "4px", 
                        fontSize: "11px", 
                        textTransform: "uppercase" 
                      }}>
                        {item.interaction_type}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>{item.interaction_date}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span className={`sentiment-badge ${(item.sentiment || "Neutral").toLowerCase()}`}>
                        {item.sentiment}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.topics_discussed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected detail panel */}
        {selectedItem && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>
                Interaction Detail # {selectedItem.id}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                HCP Provider: <strong>{selectedItem.hcp_name}</strong>
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", padding: "12px", background: "#f8fafc", borderRadius: "6px" }}>
              <div><strong>Date & Time:</strong> {selectedItem.interaction_date} at {selectedItem.interaction_time}</div>
              <div><strong>Attendees:</strong> {selectedItem.attendees || "None specified"}</div>
              <div><strong>Products Discussed:</strong> {selectedItem.samples_distributed || "None"}</div>
              <div><strong>Materials Shared:</strong> {selectedItem.materials_shared || "None"}</div>
              <div><strong>Sentiment:</strong> <span className={`sentiment-badge ${(selectedItem.sentiment || "Neutral").toLowerCase()}`}>{selectedItem.sentiment}</span></div>
              <div style={{ marginTop: "6px" }}><strong>Outcomes Summary:</strong></div>
              <div style={{ fontStyle: "italic", background: "#ffffff", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                {selectedItem.outcomes || "No outcomes logged."}
              </div>
            </div>

            {/* Tool 2: Edit field */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-color)", marginBottom: "8px" }}>
                ✏️ Tool 2: Edit Field
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "flex-end" }}>
                <label style={{ fontSize: "11px" }}>
                  Select Field
                  <select value={editField} onChange={(e) => setEditField(e.target.value)}>
                    <option value="sentiment">Sentiment</option>
                    <option value="interaction_type">Type</option>
                    <option value="attendees">Attendees</option>
                    <option value="topics_discussed">Topic</option>
                    <option value="outcomes">Outcome</option>
                    <option value="followup_actions">Followup</option>
                  </select>
                </label>
                <label style={{ fontSize: "11px" }}>
                  New Value
                  <input 
                    type="text" 
                    value={editValue} 
                    onChange={(e) => setEditValue(e.target.value)} 
                    placeholder="Value..." 
                  />
                </label>
                <button 
                  onClick={handleEdit} 
                  disabled={editLoading} 
                  style={{ height: "42px" }}
                >
                  {editLoading ? "..." : "Save"}
                </button>
              </div>
            </div>

            {/* Tool 4: Schedule followup */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-color)", marginBottom: "8px" }}>
                📅 Tool 4: Schedule Follow-up
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "flex-end" }}>
                <label style={{ fontSize: "11px" }}>
                  Reminder Timing
                  <select value={followupPref} onChange={(e) => setFollowupPref(e.target.value)}>
                    <option value="immediate">Immediate (1 day)</option>
                    <option value="1-week">1 Week</option>
                    <option value="2-weeks">2 Weeks</option>
                    <option value="1-month">1 Month</option>
                  </select>
                </label>
                <button 
                  onClick={handleSchedule} 
                  disabled={scheduleLoading} 
                  className="secondary-button"
                  style={{ height: "42px" }}
                >
                  {scheduleLoading ? "..." : "Schedule"}
                </button>
              </div>
              {scheduleResult && (
                <div style={{ fontSize: "12px", color: "var(--success-color)", marginTop: "6px", fontWeight: 600 }}>
                  {scheduleResult}
                </div>
              )}
            </div>

            {/* Tool 5: Extract action items */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary-color)" }}>
                  ✅ Tool 5: Extract Action Items
                </span>
                <button 
                  onClick={handleExtractTasks} 
                  disabled={tasksLoading} 
                  className="secondary-button"
                  style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}
                >
                  {tasksLoading ? "Extracting..." : "Run"}
                </button>
              </div>

              {tasksList.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  {tasksList.map((task, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        fontSize: "12px", 
                        padding: "8px", 
                        border: "1px solid var(--border-color)", 
                        borderRadius: "4px", 
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px"
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{task.task_description}</div>
                      <div style={{ display: "flex", gap: "10px", color: "var(--text-secondary)", fontSize: "10px" }}>
                        <span>Priority: <strong>{task.priority_level}</strong></span>
                        <span>Owner: <strong>{task.assigned_owner}</strong></span>
                        <span>Due: <strong>{task.due_date}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default InteractionHistory;
