import { useState, useEffect } from "react";
import { 
  getDoctorProfile, getDoctorInteractions, 
  doctorLogin, updateDoctorProfile, doctorAllList 
} from "../hooks/api";
import "../styles/DoctorPortal.css";

function DoctorPortal() {
  const [isDoctorLoggedIn, setIsDoctorLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Doctor session states
  const [profile, setProfile] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal states
  const [selectedInt, setSelectedInt] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    specialty: "",
    institution: "",
    email: "",
    phone: ""
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);



  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError("Both email and password are required.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);
    try {
      const response = await doctorLogin(email, password);
      if (response.data && response.data.token) {
        localStorage.setItem("hcp_doctor_token", response.data.token);
        setIsDoctorLoggedIn(true);
        // Load doctor details
        await fetchDoctorData();
      } else {
        setLoginError("Failed to obtain doctor session.");
      }
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Invalid credentials or access suspended.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hcp_doctor_token");
    setIsDoctorLoggedIn(false);
    setProfile(null);
    setInteractions([]);
    setEmail("");
    setPassword("");
  };

  const fetchDoctorData = async () => {
    setDataLoading(true);
    try {
      const profileRes = await getDoctorProfile();
      setProfile(profileRes.data);

      const interactionsRes = await getDoctorInteractions();
      setInteractions(interactionsRes.data);
    } catch (err) {
      console.error("Failed to load doctor portal data: ", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!profile) return;
    setEditFormData({
      name: profile.name,
      specialty: profile.specialty || "",
      institution: profile.institution || "",
      email: profile.email || "",
      phone: profile.phone || ""
    });
    setEditError("");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    setEditError("");
    setEditLoading(true);
    try {
      const res = await updateDoctorProfile(editFormData);
      if (res.data && res.data.status === "success") {
        setProfile(res.data.profile);
        setIsEditOpen(false);
      }
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to update profile details.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenDetail = (item) => {
    setSelectedInt(item);
  };

  const handleCloseModal = () => {
    setSelectedInt(null);
  };

  // Render Login Card
  if (!isDoctorLoggedIn) {
    return (
      <div className="doctor-login-card">
        <div className="doctor-login-header">
          <span className="doctor-login-icon">🩺</span>
          <h2 className="doctor-login-title">Doctor Engagement Portal</h2>
          <p className="doctor-login-subtitle">Provide your credentials to view patient/representative records.</p>
        </div>

        {loginError && <div className="doctor-error-message">⚠️ {loginError}</div>}

        <form onSubmit={handleLogin}>
          <div className="doctor-form-group">
            <label htmlFor="doctor-email-input">Medical Email Address</label>
            <input 
              id="doctor-email-input"
              type="email" 
              placeholder="doctor@hospital.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginLoading}
              required
            />
          </div>
          <div className="doctor-form-group">
            <label htmlFor="doctor-password-input">Portal Password</label>
            <input 
              id="doctor-password-input"
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginLoading}
              required
            />
          </div>
          <button type="submit" style={{ width: "100%", backgroundColor: "#0b7a6d", borderColor: "#0b7a6d" }} disabled={loginLoading}>
            {loginLoading ? "Authenticating Session..." : "Secure Login"}
          </button>
        </form>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="doctor-portal-container">
      {/* Profile banner header */}
      {profile && (
        <div className="doctor-profile-banner">
          <div className="doctor-profile-info">
            <h2>Welcome, {profile.name}</h2>
            <div className="doctor-profile-sub">
              {profile.specialty} — {profile.institution}
            </div>
            <div className="doctor-profile-meta">
              <span>📧 {profile.email}</span>
              <span>📞 {profile.phone || "No phone added"}</span>
              <span>🆔 Doctor ID: #{profile.id}</span>
            </div>
            <div>
              <button className="doctor-edit-profile-btn" onClick={handleOpenEdit}>
                ✏️ Modify Details
              </button>
            </div>
          </div>
          <div>
            <button className="doctor-logout-btn" onClick={handleLogout}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Interactions list */}
      <div>
        <h3 className="doctor-section-title">📬 Representative Interactions & Materials Shared</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "-12px", marginBottom: "16px" }}>
          Review notes, brochures, and clinical samples distributed to you by medical representatives.
        </p>

        {dataLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Retrieving interaction history...
          </div>
        ) : interactions.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)" }}>
            No interactions have been registered for your profile yet.
          </div>
        ) : (
          <div className="doctor-table-container">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Representative</th>
                  <th>Interaction Type</th>
                  <th>Topics Discussed</th>
                  <th>Materials Shared</th>
                  <th style={{ textAlign: "center" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.interaction_date).toLocaleDateString()}</td>
                    <td><strong>{item.rep_name}</strong></td>
                    <td>{item.interaction_type}</td>
                    <td>{item.topics_discussed || "None"}</td>
                    <td>{item.materials_shared || "None"}</td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        className="secondary-button action-btn-sm" 
                        style={{ color: "#0e9888", borderColor: "#0e9888" }}
                        onClick={() => handleOpenDetail(item)}
                      >
                        👁️ View Notes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interaction Detail Modal */}
      {selectedInt && (
        <div className="doctor-modal-overlay" onClick={handleCloseModal}>
          <div className="doctor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doctor-modal-header">
              <h3 className="doctor-modal-title">Interaction Record - {new Date(selectedInt.interaction_date).toLocaleDateString()}</h3>
              <button className="doctor-modal-close" onClick={handleCloseModal}>&times;</button>
            </div>
            <div className="doctor-modal-body">
              <div className="detail-row">
                <span className="detail-label">Representative:</span>
                <span className="detail-val"><strong>{selectedInt.rep_name}</strong></span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-val">{selectedInt.interaction_type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Time:</span>
                <span className="detail-val">{selectedInt.interaction_time || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Attendees:</span>
                <span className="detail-val">{selectedInt.attendees || "N/A"}</span>
              </div>
              <div className="detail-row" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                <span className="detail-label">Topics Discussed:</span>
                <span className="detail-val">{selectedInt.topics_discussed || "None"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Materials Shared:</span>
                <span className="detail-val">{selectedInt.materials_shared || "None"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Samples Shared:</span>
                <span className="detail-val">{selectedInt.samples_distributed || "None"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Outcomes:</span>
                <span className="detail-val">{selectedInt.outcomes || "None"}</span>
              </div>
              <div className="detail-row" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                <span className="detail-label">Follow-up Actions:</span>
                <span className="detail-val" style={{ color: "var(--warning-color)", fontWeight: "600" }}>
                  {selectedInt.followup_actions || "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Details Modal */}
      {isEditOpen && (
        <div className="doctor-modal-overlay" onClick={() => setIsEditOpen(false)}>
          <div className="doctor-modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="doctor-modal-header">
              <h3 className="doctor-modal-title">✏️ Modify Profile Details</h3>
              <button className="doctor-modal-close" onClick={() => setIsEditOpen(false)}>&times;</button>
            </div>
            <div className="doctor-modal-body">
              {editError && <div className="doctor-error-message">⚠️ {editError}</div>}
              
              <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label htmlFor="edit-doctor-name">Full Name *</label>
                  <input 
                    id="edit-doctor-name"
                    type="text" 
                    placeholder="e.g. Dr. Helen Jones"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label htmlFor="edit-doctor-specialty">Specialty</label>
                    <input 
                      id="edit-doctor-specialty"
                      type="text" 
                      placeholder="e.g. Oncology"
                      value={editFormData.specialty}
                      onChange={(e) => setEditFormData({ ...editFormData, specialty: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-doctor-institution">Institution</label>
                    <input 
                      id="edit-doctor-institution"
                      type="text" 
                      placeholder="e.g. Mayo Clinic"
                      value={editFormData.institution}
                      onChange={(e) => setEditFormData({ ...editFormData, institution: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-doctor-email">Contact Email</label>
                  <input 
                    id="edit-doctor-email"
                    type="email" 
                    placeholder="doctor@hospital.com"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="edit-doctor-phone">Phone Contact</label>
                  <input 
                    id="edit-doctor-phone"
                    type="text" 
                    placeholder="+1 555-0199"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    style={{ flex: 1 }}
                    onClick={() => setIsEditOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{ flex: 1, backgroundColor: "#0b7a6d", borderColor: "#0b7a6d" }}
                    disabled={editLoading}
                  >
                    {editLoading ? "Saving Changes..." : "Save Details"}
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

export default DoctorPortal;
