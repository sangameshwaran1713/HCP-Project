import { useDispatch, useSelector } from "react-redux";
import { runToolsDemo } from "../hooks/api";
import { 
  runDemoStart, runDemoSuccess, runDemoFailure 
} from "../redux/slices/toolsSlice";

function ToolsDemo() {
  const dispatch = useDispatch();
  const { isRunning, demoLog, demoSuccess, error } = useSelector((state) => state.tools);

  const handleStartDemo = async () => {
    dispatch(runDemoStart());
    try {
      const response = await runToolsDemo();
      dispatch(runDemoSuccess(response.data));
    } catch (err) {
      dispatch(runDemoFailure(err.response?.data?.detail || "Failed to execute tools demo."));
    }
  };

  return (
    <div className="demo-panel card">
      <div className="demo-header">
        <div>
          <h2 className="demo-title">🛠️ LangGraph Tools Automated Demonstration</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Executes and documents all 5 specialized tools in sequence. Shows live responses from the API.
          </p>
        </div>
        <div className="demo-actions">
          <button onClick={handleStartDemo} disabled={isRunning}>
            {isRunning ? "Running Tools Demo..." : "Run All Tools Demo"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--danger-color)", fontWeight: 700, padding: "12px", background: "var(--danger-bg)", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
          ❌ {error}
        </div>
      )}

      {demoLog.length > 0 && (
        <div className="demo-grid">
          {demoLog.map((logItem, index) => (
            <div key={index} className="tool-card">
              <div className="tool-card-header">
                <span className="tool-name">{logItem.tool}</span>
                <span className={`tool-status-tag ${logItem.result?.status === "success" || !logItem.result?.error ? "success" : "pending"}`}>
                  {logItem.result?.status || (logItem.result?.error ? "Error" : "Completed")}
                </span>
              </div>
              <div className="tool-card-body">
                <p className="tool-description">
                  {logItem.result?.message || "Tool execution response payload."}
                </p>
                <div className="json-block">
                  <pre>
                    {JSON.stringify(logItem.result, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isRunning && demoLog.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)", border: "2px dashed var(--border-color)", borderRadius: "8px" }}>
          <p style={{ fontSize: "15px", margin: "0 0 12px" }}>No demo logs loaded. Click "Run All Tools Demo" above to start the test suite.</p>
          <p style={{ fontSize: "12px", margin: 0 }}>This test suite will call the live backend and execute the 5 agentic tools using SQLite storage.</p>
        </div>
      )}
    </div>
  );
}

export default ToolsDemo;
