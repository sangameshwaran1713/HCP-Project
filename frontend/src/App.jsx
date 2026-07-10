import { Provider } from "react-redux";
import store from "./redux/store";
import Dashboard from "./pages/Dashboard";

// Import stylesheets
import "./styles/globals.css";
import "./styles/LogInteractionScreen.css";
import "./styles/FormInterface.css";
import "./styles/ChatInterface.css";
import "./styles/ToolsDemo.css";

function App() {
  return (
    <Provider store={store}>
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="brand-mark">HCP</span>
          <div>
            <span className="brand-title">HCP CRM</span>
            <span className="brand-subtitle">AI-First Healthcare Provider CRM Module</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => alert("HCP Selection Modal Placeholder")}>
            Dr. Rajesh Kumar (Cardiology)
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 }}>Active Rep: Sam</span>
        </div>
      </header>

      <Dashboard />
    </Provider>
  );
}

export default App;
