import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = "http://localhost:3000/api/crops";

function App() {
  const [crops, setCrops] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", season: "", soilType: "", description: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);

  async function loadCrops() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Unable to load crops");
      setCrops(await response.json());
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCrops();
  }, []);

  function startEditing(crop) {
    setEditingId(crop._id);
    setForm({
      name: crop.name,
      season: crop.season || "",
      soilType: crop.soilType || "",
      description: crop.description || ""
    });
    setStatus({ type: "", message: "" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm({ name: "", season: "", soilType: "", description: "" });
  }

  async function saveCrop(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Saving changes..." });

    try {
      const response = await fetch(`${API_URL}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update crop");

      setCrops((current) => current.map((crop) => (crop._id === result._id ? result : crop)));
      setStatus({ type: "success", message: "Crop updated successfully." });
      cancelEditing();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function deleteCrop(id) {
    if (!window.confirm("Delete this crop from the register?")) return;
    setStatus({ type: "", message: "Deleting crop..." });

    try {
      const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
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
      </section>

      {status.message && <p className={`status ${status.type}`} role="status">{status.message}</p>}

      <section className="register">
        <div className="register-heading">
          <div><p className="eyebrow">YOUR LIBRARY</p><h2>Crop register</h2></div>
          <button className="refresh" onClick={loadCrops} type="button">Refresh list</button>
        </div>

        {loading ? <p className="empty">Loading your crops...</p> : crops.length === 0 ? <p className="empty">No crop records yet.</p> : (
          <div className="crop-list">
            {crops.map((crop) => editingId === crop._id ? (
              <form className="crop-row editing" key={crop._id} onSubmit={saveCrop}>
                <div className="edit-fields">
                  <input aria-label="Crop name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                  <input aria-label="Season" placeholder="Season" value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} />
                  <input aria-label="Soil type" placeholder="Soil type" value={form.soilType} onChange={(event) => setForm({ ...form, soilType: event.target.value })} />
                  <input aria-label="Description" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </div>
                <div className="actions"><button className="save" type="submit">Save</button><button className="cancel" onClick={cancelEditing} type="button">Cancel</button></div>
              </form>
            ) : (
              <article className="crop-row" key={crop._id}>
                <div className="crop-mark">{crop.name.slice(0, 1).toUpperCase()}</div>
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
