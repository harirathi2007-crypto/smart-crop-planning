import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_ORIGIN = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
const API_URL = `${API_ORIGIN}/api/crops`;
const AUTH_URL = `${API_ORIGIN}/api/auth`;

function getInitialSession() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token) {
    const session = { token };
    localStorage.setItem("cropSession", JSON.stringify(session));
    window.history.replaceState({}, document.title, window.location.pathname);
    return session;
  }

  return JSON.parse(localStorage.getItem("cropSession") || "null");
}

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");

    if (!authError) return { type: "", message: "" };

    window.history.replaceState({}, document.title, window.location.pathname);
    return {
      type: "error",
      message: authError === "google_unconfigured"
        ? "Google sign-in is not configured. Use email and password or contact the administrator."
        : "Google sign-in could not be completed. Please try again."
    };
  });

  async function submit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Checking credentials..." });

    try {
      const response = await fetch(`${AUTH_URL}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Authentication failed");

      if (mode === "register") {
        setMode("login");
        setStatus({ type: "success", message: "Account created. Sign in to continue." });
        return;
      }

      localStorage.setItem("cropSession", JSON.stringify(result));
      onAuthenticated(result);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">FIELD REGISTER / PRIVATE ACCESS</p>
        <h1>Plan with<br /><em>confidence.</em></h1>
        <p className="intro">Sign in to manage the crop records for your farm.</p>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <input aria-label="Name" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />}
          <input aria-label="Email" type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input aria-label="Password" type="password" placeholder="Password (6+ characters)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength="6" required />
          <button className="auth-submit" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        {mode === "login" && <a className="google-submit" href={`${AUTH_URL}/google`}>Continue with Google</a>}
        {status.message && <p className={`status ${status.type}`} role="status">{status.message}</p>}
      </section>
    </main>
  );
}

function CropPhoto({ crop, token }) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let objectUrl;
    const controller = new AbortController();

    setSource("");
    fetch(`${API_ORIGIN}${crop.imageUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load crop image");
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setSource("");
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [crop.imageUrl, token]);

  return source
    ? <img className="crop-photo" src={source} alt={`${crop.name} crop`} loading="lazy" />
    : <div className="crop-mark" aria-label={`${crop.name} image loading`}>{crop.name.slice(0, 1).toUpperCase()}</div>;
}

function App() {
  const [session, setSession] = useState(getInitialSession);
  const [crops, setCrops] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", season: "", soilType: "", description: "" });
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);

  async function loadCrops() {
    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!response.ok) throw new Error("Unable to load crops");
      setCrops(await response.json());
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) loadCrops();
  }, [session]);

  if (!session) {
    return <AuthPanel onAuthenticated={setSession} />;
  }

  function startEditing(crop) {
    setEditingId(crop._id);
    setCreating(false);
    setImage(null);
    setForm({
      name: crop.name,
      season: crop.season || "",
      soilType: crop.soilType || "",
      description: crop.description || ""
    });
    setStatus({ type: "", message: "" });
  }

  function startCreating() {
    setEditingId(null);
    setCreating(true);
    setImage(null);
    setForm({ name: "", season: "", soilType: "", description: "" });
    setStatus({ type: "", message: "" });
  }

  function cancelEditing() {
    setEditingId(null);
    setCreating(false);
    setImage(null);
    setForm({ name: "", season: "", soilType: "", description: "" });
  }

  async function saveCrop(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Saving changes..." });

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (image) payload.append("image", image);

      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: payload
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save crop");

      setCrops((current) => {
        const updated = editingId
          ? current.map((crop) => (crop._id === result._id ? result : crop))
          : [...current, result];
        return updated.sort((left, right) => left.name.localeCompare(right.name));
      });
      setStatus({
        type: "success",
        message: editingId ? "Crop updated successfully." : "Crop added successfully."
      });
      cancelEditing();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function deleteCrop(id) {
    if (!window.confirm("Delete this crop from the register?")) return;
    setStatus({ type: "", message: "Deleting crop..." });

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.message || "Unable to delete crop");

      setCrops((current) => current.filter((crop) => crop._id !== id));
      setStatus({ type: "success", message: "Crop deleted successfully." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">FIELD REGISTER / 2026</p>
        <h1>Crop decisions,<br /><em>kept current.</em></h1>
        <p className="intro">Review the crops in your planning database and keep each record aligned with the season ahead.</p>
      </header>

      <section className="toolbar" aria-label="Crop register summary">
        <div><span className="label">ACTIVE RECORDS</span><strong>{crops.length}</strong></div>
        <div><span className="label">DATABASE</span><strong className="online">Connected</strong></div>
        <button className="sign-out" onClick={() => { localStorage.removeItem("cropSession"); setSession(null); }} type="button">Sign out</button>
      </section>

      {status.message && <p className={`status ${status.type}`} role="status">{status.message}</p>}

      <section className="register">
        <div className="register-heading">
          <div><p className="eyebrow">YOUR LIBRARY</p><h2>Crop register</h2></div>
          <div className="register-actions">
            <button className="add-crop" onClick={startCreating} type="button">Add crop</button>
            <button className="refresh" onClick={loadCrops} type="button">Refresh list</button>
          </div>
        </div>

        {loading ? <p className="empty">Loading your crops...</p> : crops.length === 0 && !creating ? <p className="empty">No crop records yet.</p> : (
          <div className="crop-list">
            {(creating || editingId) && (
              <form className="crop-row editing crop-form" onSubmit={saveCrop}>
                <div className="edit-fields">
                  <input aria-label="Crop name" placeholder="Crop name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                  <input aria-label="Season" placeholder="Season" value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} />
                  <input aria-label="Soil type" placeholder="Soil type" value={form.soilType} onChange={(event) => setForm({ ...form, soilType: event.target.value })} />
                  <input aria-label="Description" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                  <label className="upload-field">Crop image (JPEG, PNG, or WebP; max 5 MB)
                    <input aria-label="Crop image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="actions"><button className="save" type="submit">{creating ? "Add crop" : "Save"}</button><button className="cancel" onClick={cancelEditing} type="button">Cancel</button></div>
              </form>
            )}
            {crops.map((crop) => (
              <article className="crop-row" key={crop._id}>
                {crop.imageUrl
                  ? <CropPhoto crop={crop} token={session.token} />
                  : <div className="crop-mark">{crop.name.slice(0, 1).toUpperCase()}</div>}
                <div className="crop-main"><h3>{crop.name}</h3><p>{crop.description || "No description added"}</p></div>
                <div className="crop-meta"><span>{crop.season || "Season pending"}</span><span>{crop.soilType || "Soil pending"}</span></div>
                <div className="actions"><button className="edit" onClick={() => startEditing(crop)} type="button">Edit</button><button className="delete" onClick={() => deleteCrop(crop._id)} type="button">Delete</button></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
