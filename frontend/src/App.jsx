import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Database, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  RefreshCw, 
  Cloud, 
  Layers, 
  ChevronRight, 
  X,
  Settings,
  ShieldCheck
} from 'lucide-react';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`;




export default function App() {
  const [config, setConfig] = useState(null);
  const [authData, setAuthData] = useState(() => {
    const saved = localStorage.getItem('sf_auth');
    return saved ? JSON.parse(saved) : null;
  });

  // Manual/Fallback Config State
  const [customClientId, setCustomClientId] = useState(localStorage.getItem('sf_client_id') || '');
  const [customClientSecret, setCustomClientSecret] = useState(localStorage.getItem('sf_client_secret') || '');
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Selected Object & Fields
  const [selectedObject, setSelectedObject] = useState('Account');
  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals for CRUD
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view'
  const [activeRecord, setActiveRecord] = useState(null);
  const [formData, setFormData] = useState({});

  // Fetch initial config
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        if (!customClientId && data.client_id) {
          setCustomClientId(data.client_id);
        }
      })
      .catch(err => console.error("Failed to load backend config", err));
  }, []);

  // PKCE Helper utilities
  const generateRandomString = (length = 64) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  const base64urlencode = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };


  const [authExchanging, setAuthExchanging] = useState(false);

  // Handle OAuth Redirect Code
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !authData) {
      setAuthExchanging(true);
      setLoading(true);
      const codeVerifier = sessionStorage.getItem('sf_code_verifier');
      const payload = {
        code,
        redirect_uri: window.location.origin + window.location.pathname,
        client_id: customClientId || config?.client_id,
        client_secret: customClientSecret,
        code_verifier: codeVerifier || undefined
      };
      
      fetch(`${API_BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(async res => {
        const data = await res.json();
        if (res.ok && data.access_token) {
          setAuthData(data);
          localStorage.setItem('sf_auth', JSON.stringify(data));
          sessionStorage.removeItem('sf_code_verifier');
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          const msg = data.detail ? (typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail) : (data.error_description || 'OAuth Token Exchange Failed');
          setError(msg);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => {
        setLoading(false);
        setAuthExchanging(false);
      });
    }
  }, [config]);


  // Save Settings
  const handleSaveConfig = () => {
    localStorage.setItem('sf_client_id', customClientId);
    localStorage.setItem('sf_client_secret', customClientSecret);
    setShowConfigModal(false);
  };

  // Initiate Salesforce OAuth Login with PKCE
  const handleLogin = async () => {
    const clientId = customClientId || config?.client_id;
    if (!clientId) {
      setShowConfigModal(true);
      return;
    }
    
    // Generate PKCE Verifier & Challenge
    const codeVerifier = generateRandomString(64);
    sessionStorage.setItem('sf_code_verifier', codeVerifier);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const loginUrl = config?.login_url || 'https://login.salesforce.com';
    const authUrl = `${loginUrl}/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
  };


  const handleLogout = () => {
    setAuthData(null);
    localStorage.removeItem('sf_auth');
    setRecords([]);
  };

  // Fetch Records with Pagination
  const fetchRecords = useCallback((objName, currentOffset, reset = false) => {
    if (!authData) return;
    setLoading(true);
    setError(null);

    const queryParams = new URLSearchParams({
      instance_url: authData.instance_url,
      access_token: authData.access_token,
      object_name: objName,
      offset: currentOffset,
      limit: 20
    });

    fetch(`${API_BASE}/records?${queryParams}`)
      .then(res => res.json())
      .then(data => {
        if (data.records) {
          if (reset) {
            setRecords(data.records);
          } else {
            setRecords(prev => [...prev, ...data.records]);
          }
          setHasMore(data.records.length === 20);
        } else if (data.detail) {
          setError(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [authData]);

  // Fetch on Object selection or login
  useEffect(() => {
    if (authData) {
      setOffset(0);
      fetchRecords(selectedObject, 0, true);
    }
  }, [authData, selectedObject]);

  // Infinite Scroll Listener
  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && !loading && hasMore) {
      const nextOffset = offset + 20;
      setOffset(nextOffset);
      fetchRecords(selectedObject, nextOffset, false);
    }
  };

  // CRUD Operations
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetch(`${API_BASE}/records/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_url: authData.instance_url,
        access_token: authData.access_token,
        object_name: selectedObject,
        data: formData
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        setModalMode(null);
        setFormData({});
        fetchRecords(selectedObject, 0, true);
      } else {
        alert("Create Failed: " + JSON.stringify(data));
      }
    })
    .catch(err => alert("Error: " + err.message))
    .finally(() => setLoading(false));
  };

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetch(`${API_BASE}/records/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_url: authData.instance_url,
        access_token: authData.access_token,
        object_name: selectedObject,
        record_id: activeRecord.Id,
        data: formData
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setModalMode(null);
        setActiveRecord(null);
        setFormData({});
        fetchRecords(selectedObject, 0, true);
      } else {
        alert("Update Failed: " + JSON.stringify(data));
      }
    })
    .catch(err => alert("Error: " + err.message))
    .finally(() => setLoading(false));
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to delete this Salesforce record?")) return;
    setLoading(true);
    const queryParams = new URLSearchParams({
      instance_url: authData.instance_url,
      access_token: authData.access_token,
      object_name: selectedObject,
      record_id: id
    });

    fetch(`${API_BASE}/records/delete?${queryParams}`, {
      method: 'DELETE'
    })
    .then(async res => {
      const data = await res.json();
      if (res.ok && data.success) {
        setRecords(records.filter(r => r.Id !== id));
      } else {
        const msg = data.detail ? (typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail) : JSON.stringify(data);
        alert("Delete Failed: " + msg);
      }
    })
    .catch(err => alert("Error: " + err.message))
    .finally(() => setLoading(false));
  };


  const openCreateModal = () => {
    const fields = config?.object_fields?.[selectedObject] || [];

    const initData = {};
    fields.forEach(f => { if (f !== 'Id') initData[f] = ''; });
    setFormData(initData);
    setModalMode('create');
  };

  const openEditModal = (rec) => {
    setActiveRecord(rec);
    const fields = config?.object_fields?.[selectedObject] || [];

    const initData = {};
    fields.forEach(f => { if (f !== 'Id') initData[f] = rec[f] || ''; });
    setFormData(initData);
    setModalMode('edit');
  };

  const openViewModal = (rec) => {
    setActiveRecord(rec);
    setModalMode('view');
  };

  const currentFields = config?.object_fields?.[selectedObject] || [];


  return (
    <div className="app-container">
      {/* Header */}
      <nav className="navbar glass">
        <div className="brand">
          <div className="brand-icon">
            <Cloud size={20} />
          </div>
          <span>Salesforce Dynamic Portal</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setShowConfigModal(true)}>
            <Settings size={16} /> App Settings
          </button>
          {authData ? (
            <button className="btn btn-danger" onClick={handleLogout}>
              <LogOut size={16} /> Disconnect Org
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleLogin}>
              <ShieldCheck size={16} /> Log In with Salesforce
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      {authExchanging ? (
        <div className="auth-wrapper">
          <div className="auth-card glass" style={{ padding: '3rem 2rem' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto' }}></div>
            <h3 style={{ marginTop: '1rem', fontSize: '1.2rem' }}>Authenticating with Salesforce...</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Exchanging OAuth authorization token</p>
          </div>
        </div>
      ) : !authData ? (
        <div className="auth-wrapper">
          <div className="auth-card glass">
            <div style={{ margin: '0 auto', background: 'rgba(0,161,224,0.1)', padding: '1rem', borderRadius: '50%', width: 'fit-content' }}>
              <Layers size={48} color="#00a1e0" />
            </div>
            <h2 className="auth-title">Salesforce Data Bridge</h2>
            <p className="auth-subtitle">
              Authenticate via OAuth 2.0 External Client App to directly query, inspect, create, update, and manage standard Salesforce objects.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={handleLogin}>
                Log In to Salesforce Developer Org
              </button>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowConfigModal(true)}>
                Configure External Client App Keys
              </button>
            </div>
          </div>
        </div>
      ) : (

        <>
          {/* Controls Bar */}
          <div className="controls-bar glass">
            <div className="object-selector">
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Select Standard Object:</label>
              <select 
                className="select-custom" 
                value={selectedObject} 
                onChange={(e) => setSelectedObject(e.target.value)}
              >
                {config && Object.keys(config.object_fields).map(obj => (
                  <option key={obj} value={obj}>{obj}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => fetchRecords(selectedObject, 0, true)}>
                <RefreshCw size={16} className={loading ? 'loading-spinner' : ''} /> Refresh
              </button>
              <button className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Create {selectedObject}
              </button>
            </div>
          </div>

          {/* Record Data Table */}
          <div className="content-area">
            {error && (
              <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
                <strong>Error: </strong> {error}
              </div>
            )}

            <div className="table-container glass" style={{ maxHeight: '600px', overflowY: 'auto' }} onScroll={handleScroll}>
              <table className="data-table">
                <thead>
                  <tr>
                    {currentFields.map(field => (
                      <th key={field}>{field}</th>
                    ))}
                    <th style={{ textRight: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={currentFields.length + 1} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No {selectedObject} records found in Salesforce org.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => (
                      <tr key={rec.Id}>
                        {currentFields.map(field => (
                          <td key={field}>
                            {field === 'Id' ? (
                              <span className="badge">{rec[field]}</span>
                            ) : (
                              rec[field] !== null && rec[field] !== undefined ? String(rec[field]) : '—'
                            )}
                          </td>
                        ))}
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="View" onClick={() => openViewModal(rec)}>
                              <Eye size={14} />
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Edit" onClick={() => openEditModal(rec)}>
                              <Edit3 size={14} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }} title="Delete" onClick={() => handleDelete(rec.Id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {loading && (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div className="loading-spinner"></div>
                  <span style={{ marginLeft: '0.75rem', color: 'var(--text-secondary)' }}>Loading Salesforce records...</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal: Create & Edit */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>{modalMode === 'create' ? `Create New ${selectedObject}` : `Edit ${selectedObject}`}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={modalMode === 'create' ? handleCreateSubmit : handleUpdateSubmit}>
              {currentFields.filter(f => f !== 'Id').map(field => (
                <div className="form-group" key={field}>
                  <label>{field}</label>
                  <input 
                    type={field.toLowerCase().includes('date') ? 'date' : 'text'} 
                    className="form-control" 
                    value={formData[field] || ''} 
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} 
                  />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View */}
      {modalMode === 'view' && activeRecord && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>{selectedObject} Record Details</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {currentFields.map(field => (
                <div key={field} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{field}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, marginTop: '0.25rem' }}>
                    {activeRecord[field] !== null && activeRecord[field] !== undefined ? String(activeRecord[field]) : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setModalMode(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: App Settings / OAuth Client Config */}
      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>OAuth 2.0 Credentials</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setShowConfigModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enter your Salesforce External Client App Consumer Key and Consumer Secret if not using environment variables.
            </p>
            <div className="form-group">
              <label>Consumer Key (Client ID)</label>
              <input 
                type="text" 
                className="form-control" 
                value={customClientId} 
                onChange={(e) => setCustomClientId(e.target.value)} 
                placeholder="3MVG9..."
              />
            </div>
            <div className="form-group">
              <label>Consumer Secret (Client Secret)</label>
              <input 
                type="password" 
                className="form-control" 
                value={customClientSecret} 
                onChange={(e) => setCustomClientSecret(e.target.value)} 
                placeholder="••••••••••••••••"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConfigModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveConfig}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
