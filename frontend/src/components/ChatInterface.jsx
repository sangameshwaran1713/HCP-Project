import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "../hooks/api";

function ChatInterface() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your AI CRM Assistant. You can tell me about a doctor visit, call, or meeting (e.g., 'I met with Dr. Rajesh Kumar today. He loved CardioMed-X and wants a demo next week.') and I will log it for you."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [suggestions, setSuggestions] = useState([
    "Log a call with Dr. Rajesh Kumar",
    "Met with Dr. Smith, positive efficacy sentiment",
    "Help me schedule a follow-up"
  ]);

  const historyEndRef = useRef(null);

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText) => {
    if (!messageText.trim()) return;
    
    // Add user message
    const userMsg = { role: "user", content: messageText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);
    setExtractedData(null);
    
    try {
      const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(messageText, historyPayload);
      
      const botMsg = { 
        role: "assistant", 
        content: response.data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setMessages((prev) => [...prev, botMsg]);
      
      if (response.data.extracted_data && Object.keys(response.data.extracted_data).length > 0) {
        setExtractedData(response.data.extracted_data);
      }
      
      if (response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
      } else {
        setSuggestions([
          "Log a call with Dr. Rajesh Kumar",
          "Met with Dr. Smith, positive efficacy sentiment",
          "Help me schedule a follow-up"
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev, 
        { role: "assistant", content: "Sorry, I couldn't reach the CRM AI Agent server. Please make sure the backend is running." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend(inputValue);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-history">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <span className="chat-sender">{msg.role === "user" ? "You" : "AI CRM Assistant"}</span>
            <div>{msg.content}</div>
            {msg.time && <span className="chat-time">{msg.time}</span>}
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant" style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>
            Assistant is thinking...
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {extractedData && (
        <div className="chat-status-bubble" style={{ margin: "12px" }}>
          <div>
            <strong>📢 CRM Entry Extracted:</strong> Logged {extractedData.interaction_type || "Meeting"} with{" "}
            <strong>{extractedData.hcp_name}</strong> on {extractedData.interaction_date}.
            {extractedData.sentiment && (
              <span 
                className={`sentiment-badge ${extractedData.sentiment.toLowerCase()}`}
                style={{ marginLeft: "8px", verticalAlign: "middle" }}
              >
                {extractedData.sentiment}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="chat-suggestions">
        {suggestions.map((suggestion, idx) => (
          <span 
            key={idx} 
            className="suggestion-chip" 
            onClick={() => handleSend(suggestion)}
          >
            {suggestion}
          </span>
        ))}
      </div>

      <div className="chat-input-bar">
        <input 
          type="text" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)} 
          onKeyDown={handleKeyPress}
          placeholder="Ask AI assistant to log meetings, fetch profiles, etc..."
          disabled={loading}
        />
        <button 
          className="chat-send-btn" 
          onClick={() => handleSend(inputValue)}
          disabled={loading}
        >
          ➔
        </button>
      </div>
    </div>
  );
}

export default ChatInterface;
