import { useState, useEffect } from "react";
import { 
  adminLogin, getAdminUsers, getAdminUserActivity,
  adminListHcps, adminCreateHcp, adminUpdateHcp, adminToggleHcpApproval, adminToggleUserStatus
} from "../hooks/api";
import "../styles/AdminPanel.css";

function AdminPanel() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Rate limiting / Lockout states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Panel navigation sub-tab
  const [panelTab, setPanelTab] = useState("representatives"); // "representatives" | "doctors"

  // Representatives Dashboard states
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Representative Modal Details states
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState({ activities: [], interactions: [] });
  const [activityLoading, setActivityLoading] = useState(false);
  const [modalTab, setModalTab] = useState("activity"); // "activity" | "interactions"

  // Doctors Dashboard states
  const [hcps, setHcps] = useState([]);
  const [hcpsLoading, setHcpsLoading] = useState(false);
  const [hcpSearchQuery, setHcpSearchQuery] = useState("");

  // Doctor Creation Modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [hcpFormData, setHcpFormData] = useState({
    name: "",
    specialty: "",
    institution: "",
    email: "",
    phone: "",
    password: "doctor123"
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [editingHcp, setEditingHcp] = useState(null);



  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockoutTime > 0) return;
    if (!password.trim()) {
      setLoginError("Password is required.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);
    try {
      const response = await adminLogin(password);
      if (response.data && response.data.token) {
        localStorage.setItem("hcp_admin_token", response.data.token);
        setIsAdminLoggedIn(true);
        setFailedAttempts(0);
        fetchUsers();
        fetchHcps();
      } else {
        setLoginError("Failed to obtain admin session.");
      }
    } catch (err) {
      const attempts = failedAttempts + 1;
      if (attempts >= 3) {
        setLockoutTime(60);
        setFailedAttempts(0);
        setLoginError("Too many failed attempts. Access locked for 60 seconds.");
      } else {
        setFailedAttempts(attempts);
        setLoginError(`${err.response?.data?.detail || "Invalid admin credentials."} (${3 - attempts} attempts remaining)`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hcp_admin_token");
    setIsAdminLoggedIn(false);
    setUsers([]);
    setHcps([]);
    setPassword("");
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await getAdminUsers();
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to load admin users data: ", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchHcps = async () => {
    setHcpsLoading(true);
    try {
      const response = await adminListHcps();
      setHcps(response.data);
    } catch (err) {
      console.error("Failed to load doctors list: ", err);
    } finally {
      setHcpsLoading(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      const response = await adminToggleUserStatus(user.id);
      if (response.data && response.data.status === "success") {
        setUsers((prev) => 
          prev.map((u) => u.id === user.id ? { ...u, is_active: response.data.is_active } : u)
        );
      }
    } catch (err) {
      console.error("Failed to toggle representative status: ", err);
      alert("Failed to modify representative status permissions.");
    }
  };

  const handleToggleHcpApproval = async (hcp) => {
    try {
      const response = await adminToggleHcpApproval(hcp.id);
      if (response.data && response.data.status === "success") {
        setHcps((prev) => 
          prev.map((h) => h.id === hcp.id ? { ...h, approved: response.data.approved } : h)
        );
      }
    } catch (err) {
      console.error("Failed to toggle doctor approval status: ", err);
      alert("Failed to modify doctor access permissions.");
    }
  };

  const handleRegisterHcp = async (e) => {
    e.preventDefault();
    if (!hcpFormData.name.trim()) {
      setRegisterError("Doctor name is required.");
      return;
    }
    setRegisterError("");
    setRegisterLoading(true);
    try {
      let response;
      if (editingHcp) {
        response = await adminUpdateHcp(editingHcp.id, hcpFormData);
      } else {
        response = await adminCreateHcp(hcpFormData);
      }
      if (response.data && response.data.status === "success") {
        setIsRegisterModalOpen(false);
        setEditingHcp(null);
        setHcpFormData({ name: "", specialty: "", institution: "", email: "", phone: "", password: "doctor123" });
        fetchHcps();
      }
    } catch (err) {
      setRegisterError(err.response?.data?.detail || "Failed to save doctor details.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleOpenEditHcp = (hcp) => {
    setEditingHcp(hcp);
    setHcpFormData({
      name: hcp.name,
      specialty: hcp.specialty || "",
      institution: hcp.institution || "",
      email: hcp.email || "",
      phone: hcp.phone || "",
      password: hcp.password || "doctor123"
    });
    setRegisterError("");
    setIsRegisterModalOpen(true);
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
    setEditingHcp(null);
    setHcpFormData({ name: "", specialty: "", institution: "", email: "", phone: "", password: "doctor123" });
  };

  const handleOpenActivity = async (user) => {
    setSelectedUser(user);
    setActivityLoading(true);
    setModalTab("activity");
    try {
      const response = await getAdminUserActivity(user.id);
      setUserActivity(response.data);
    } catch (err) {
      console.error("Failed to fetch user activity context: ", err);
      alert("Failed to load user activity history.");
      setSelectedUser(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setUserActivity({ activities: [], interactions: [] });
  };

  // Filter representatives
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  // Filter doctors
  const filteredHcps = hcps.filter((h) => {
    const q = hcpSearchQuery.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      (h.specialty && h.specialty.toLowerCase().includes(q)) ||
      (h.institution && h.institution.toLowerCase().includes(q)) ||
      (h.email && h.email.toLowerCase().includes(q))
    );
  });

  // Render Login Card
  if (!isAdminLoggedIn) {
    return (
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span className="admin-login-icon">🔑</span>
          <h2 className="admin-login-title">Admin Dashboard</h2>
          <p className="admin-login-subtitle">Provide your supervisor passcode to view audit logs.</p>
        </div>
        
        {loginError && <div className="admin-error-message">⚠️ {loginError}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="admin-form-group">
            <label htmlFor="admin-passcode-input">Supervisor Passcode</label>
            <input 
              id="admin-passcode-input"
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginLoading || lockoutTime > 0}
            />
          </div>
          <button 
            type="submit" 
            style={{ width: "100%" }} 
            disabled={loginLoading || lockoutTime > 0}
          >
            {lockoutTime > 0 
              ? `Locked out (${lockoutTime}s)` 
              : loginLoading 
                ? "Verifying Passcode..." 
                : "Unlock Dashboard"
            }
          </button>
        </form>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="admin-container">
      {/* Header Actions */}
      <div className="admin-dashboard-header">
        <div>
          <h2 className="admin-dashboard-title">👑 Supervisor Administrative Panel</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Registry directory, portal permissions, and representatives log auditing.
          </p>
        </div>
        <div className="admin-header-actions">
          {panelTab === "representatives" ? (
            <input 
              type="text" 
              placeholder="Search representatives..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "240px", height: "40px" }}
            />
          ) : (
            <input 
              type="text" 
              placeholder="Search doctors..." 
              value={hcpSearchQuery}
              onChange={(e) => setHcpSearchQuery(e.target.value)}
              style={{ width: "240px", height: "40px" }}
            />
          )}
          <button 
            className="secondary-button" 
            onClick={panelTab === "representatives" ? fetchUsers : fetchHcps} 
            disabled={usersLoading || hcpsLoading}
          >
            🔄 Refresh
          </button>
          <button className="danger-button" onClick={handleLogout}>
            🔒 Logout Admin
          </button>
        </div>
      </div>

      {/* Sub Navigation tabs */}
      <div className="modal-tabs" style={{ marginBottom: "20px" }}>
        <button 
          className={`modal-tab-btn ${panelTab === "representatives" ? "active" : ""}`}
          onClick={() => setPanelTab("representatives")}
        >
          🚶 Representatives Registry ({users.length})
        </button>
        <button 
          className={`modal-tab-btn ${panelTab === "doctors" ? "active" : ""}`}
          onClick={() => setPanelTab("doctors")}
        >
          🩺 Manage Doctors ({hcps.length})
        </button>
      </div>

      {/* RENDER TAB 1: REPRESENTATIVES */}
      {panelTab === "representatives" && (
        <>
          {usersLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
              Loading representatives list...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="card admin-empty-state">
              No representatives found matching your search.
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email Address</th>
                    <th>Created At</th>
                    <th>Last Login</th>
                    <th style={{ textAlign: "center" }}>Account Status</th>
                    <th style={{ textAlign: "center" }}>Audit Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td><strong>#{user.id}</strong></td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{new Date(user.created_at).toLocaleString()}</td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}</td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          className={`action-btn-sm ${user.is_active !== 0 ? "secondary-button" : "danger-button"}`}
                          onClick={() => handleToggleUserStatus(user)}
                          style={{ minWidth: "100px" }}
                        >
                          {user.is_active !== 0 ? "🟢 Active" : "🔴 Suspended"}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          className="secondary-button action-btn-sm"
                          onClick={() => handleOpenActivity(user)}
                        >
                          👁️ View Activities
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* RENDER TAB 2: DOCTORS */}
      {panelTab === "doctors" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <button 
              onClick={() => setIsRegisterModalOpen(true)}
              style={{ backgroundColor: "#0b7a6d", borderColor: "#0b7a6d" }}
            >
              ➕ Register New Doctor
            </button>
          </div>

          {hcpsLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
              Loading doctors database...
            </div>
          ) : filteredHcps.length === 0 ? (
            <div className="card admin-empty-state">
              No doctors found matching your search.
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Doctor ID</th>
                    <th>Name</th>
                    <th>Specialty</th>
                    <th>Institution</th>
                    <th>Email Address</th>
                    <th>Phone</th>
                    <th>Password</th>
                    <th style={{ textAlign: "center" }}>Portal Access</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHcps.map((hcp) => (
                    <tr key={hcp.id}>
                      <td><strong>#{hcp.id}</strong></td>
                      <td><strong>{hcp.name}</strong></td>
                      <td>{hcp.specialty}</td>
                      <td>{hcp.institution}</td>
                      <td>{hcp.email}</td>
                      <td>{hcp.phone || "N/A"}</td>
                      <td style={{ fontFamily: "monospace", color: "var(--primary-color)", fontWeight: "600" }}>{hcp.password}</td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          className={`action-btn-sm ${hcp.approved !== 0 ? "secondary-button" : "danger-button"}`}
                          onClick={() => handleToggleHcpApproval(hcp)}
                          style={{ minWidth: "100px", color: hcp.approved !== 0 ? "#0b7a6d" : "#ffffff", borderColor: hcp.approved !== 0 ? "#0b7a6d" : "var(--danger-color)" }}
                        >
                          {hcp.approved !== 0 ? "🟢 Allowed" : "🔴 Blocked"}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          className="secondary-button action-btn-sm"
                          onClick={() => handleOpenEditHcp(hcp)}
                          style={{ color: "#0b7a6d", borderColor: "#0b7a6d" }}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Activity Details Modal (Representatives) */}
      {selectedUser && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Activity Profile for {selectedUser.name}</h3>
              <button className="admin-modal-close" onClick={handleCloseModal}>&times;</button>
            </div>
            
            <div className="admin-modal-body">
              <div className="user-info-banner">
                <div className="user-info-grid">
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  <div><strong>Member Since:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="modal-tabs">
                <button 
                  className={`modal-tab-btn ${modalTab === "activity" ? "active" : ""}`}
                  onClick={() => setModalTab("activity")}
                >
                  🚶 Action Log ({userActivity.activities.length})
                </button>
                <button 
                  className={`modal-tab-btn ${modalTab === "interactions" ? "active" : ""}`}
                  onClick={() => setModalTab("interactions")}
                >
                  📝 Interactions Logged ({userActivity.interactions.length})
                </button>
              </div>

              {/* Tab Contents */}
              {activityLoading ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-secondary)" }}>
                  Loading logs...
                </div>
              ) : modalTab === "activity" ? (
                userActivity.activities.length === 0 ? (
                  <p className="admin-empty-state">No recorded routes navigated yet.</p>
                ) : (
                  <div className="activity-list">
                    {userActivity.activities.map((act) => (
                      <div key={act.id} className="activity-item">
                        <span className="activity-time">
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                        <div className="activity-content">
                          <span className="activity-action">{act.action}</span>
                          <span className="activity-route">{act.route}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                userActivity.interactions.length === 0 ? (
                  <p className="admin-empty-state">No HCP interactions submitted by this representative yet.</p>
                ) : (
                  <div className="admin-table-container" style={{ maxHeight: "300px" }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>HCP Name</th>
                          <th>Type</th>
                          <th>Topic Discussed</th>
                          <th>Sentiment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userActivity.interactions.map((int) => (
                          <tr key={int.id}>
                            <td>{new Date(int.interaction_date).toLocaleDateString()}</td>
                            <td><strong>{int.hcp_name}</strong></td>
                            <td>{int.interaction_type}</td>
                            <td>{int.topics_discussed || "None"}</td>
                            <td>
                              <span style={{ 
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "600",
                                textTransform: "capitalize",
                                backgroundColor: int.sentiment?.toLowerCase() === "positive" 
                                  ? "var(--success-bg)" 
                                  : int.sentiment?.toLowerCase() === "negative" 
                                    ? "var(--danger-bg)" 
                                    : "var(--bg-color)",
                                color: int.sentiment?.toLowerCase() === "positive" 
                                  ? "var(--success-color)" 
                                  : int.sentiment?.toLowerCase() === "negative" 
                                    ? "var(--danger-color)" 
                                    : "var(--text-secondary)"
                              }}>
                                {int.sentiment || "Neutral"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Doctor Modal */}
      {isRegisterModalOpen && (
        <div className="admin-modal-overlay" onClick={handleCloseRegisterModal}>
          <div className="admin-modal" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {editingHcp ? "✏️ Edit Doctor Details" : "🏥 Register New Doctor (HCP)"}
              </h3>
              <button className="admin-modal-close" onClick={handleCloseRegisterModal}>&times;</button>
            </div>
            <div className="admin-modal-body">
              {registerError && <div className="admin-error-message">⚠️ {registerError}</div>}
              
              <form onSubmit={handleRegisterHcp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label htmlFor="hcp-name-input">Full Name *</label>
                  <input 
                    id="hcp-name-input"
                    type="text" 
                    placeholder="e.g. Dr. Helen Jones"
                    value={hcpFormData.name}
                    onChange={(e) => setHcpFormData({ ...hcpFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label htmlFor="hcp-specialty-input">Specialty</label>
                    <input 
                      id="hcp-specialty-input"
                      type="text" 
                      placeholder="e.g. Oncology"
                      value={hcpFormData.specialty}
                      onChange={(e) => setHcpFormData({ ...hcpFormData, specialty: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="hcp-inst-input">Institution</label>
                    <input 
                      id="hcp-inst-input"
                      type="text" 
                      placeholder="e.g. Mayo Clinic"
                      value={hcpFormData.institution}
                      onChange={(e) => setHcpFormData({ ...hcpFormData, institution: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="hcp-email-input">Registered Email</label>
                  <input 
                    id="hcp-email-input"
                    type="email" 
                    placeholder="doctor@hospital.com"
                    value={hcpFormData.email}
                    onChange={(e) => setHcpFormData({ ...hcpFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="hcp-phone-input">Phone Contact</label>
                  <input 
                    id="hcp-phone-input"
                    type="text" 
                    placeholder="+1 555-0199"
                    value={hcpFormData.phone}
                    onChange={(e) => setHcpFormData({ ...hcpFormData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="hcp-reg-password">Portal Password *</label>
                  <input 
                    id="hcp-reg-password"
                    type="text" 
                    placeholder="doctor123"
                    value={hcpFormData.password}
                    onChange={(e) => setHcpFormData({ ...hcpFormData, password: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    style={{ flex: 1 }}
                    onClick={handleCloseRegisterModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{ flex: 1, backgroundColor: "#0b7a6d", borderColor: "#0b7a6d" }}
                    disabled={registerLoading}
                  >
                    {registerLoading ? "Saving..." : editingHcp ? "Save Changes" : "Register"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
