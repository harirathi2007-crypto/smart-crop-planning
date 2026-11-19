import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { getAllStates, getDistricts } from "india-state-district";
import { recommendCrops } from "./cropPlanning.js";
import { LANGUAGES, localeFor, translate } from "./localization.js";
import "./styles.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const API = `${API_BASE}/api`;
const states = getAllStates();
const soils = [
  { value: "Alluvial", label: "Alluvial soil" },
  { value: "Black soil", label: "Black soil" },
  { value: "Clay", label: "Clay soil" },
  { value: "Desert", label: "Desert soil" },
  { value: "Laterite", label: "Laterite soil" },
  { value: "Loam", label: "Loamy soil" },
  { value: "Red", label: "Red soil" },
  { value: "Sandy", label: "Sandy soil" },
  { value: "Silty", label: "Silty soil" }
];

function getInitialSession() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    const session = { token };
    localStorage.setItem("cropSession", JSON.stringify(session));
    window.history.replaceState({}, document.title, window.location.pathname);
    return session;
  }
  try {
    return JSON.parse(localStorage.getItem("cropSession") || "null");
  } catch {
    localStorage.removeItem("cropSession");
    return null;
  }
}

async function request(path, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || `Request failed (${response.status})`);
  return result;
}

function districtOptions(stateName) {
  const state = states.find((item) => item.name === stateName);
  return state ? getDistricts(state.code) : [];
}

function AuthPanel({ onAuthenticated, language, onLanguageChange, t }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError) {
      setStatus(authError === "google_unconfigured"
        ? "Google sign-in is not configured. Use email and password."
        : "Google sign-in could not be completed. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setStatus(t("Loading") + "...");
    try {
      const response = await fetch(`${API}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Authentication failed");
      if (mode === "register") {
        setMode("login");
        setStatus("Account created. Sign in to continue.");
        return;
      }
      localStorage.setItem("cropSession", JSON.stringify(result));
      onAuthenticated(result);
    } catch (error) {
      setStatus(error instanceof TypeError
        ? t("Cannot reach the server. Start the backend or check the API URL.")
        : error.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">SMART CROP PLANNING</p>
        <h1>Plan with<br /><em>confidence.</em></h1>
        <p className="intro">Sign in to plan crops, check weather and save farm recommendations.</p>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">{t("Login")}</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">{t("Create account")}</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <input aria-label="Name" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />}
          <input aria-label={t("Email")} type="email" placeholder={t("Email")} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input aria-label={t("Password")} type="password" placeholder={t("Password")} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength="6" required />
          <button className="auth-submit" type="submit">{mode === "login" ? t("Login") : t("Create account")}</button>
        </form>
        {mode === "login" && <a className="google-submit" href={`${API}/auth/google`}>Continue with Google</a>}
        {status && <p className="status error" role="status">{status}</p>}
        <LanguagePicker language={language} onChange={onLanguageChange} t={t} />
      </section>
    </main>
  );
}

function LanguagePicker({ language, onChange, t }) {
  return (
    <label className="language-control">
      <span>{t("Language")}</span>
      <select value={language} onChange={(event) => onChange(event.target.value)} aria-label={t("Language")}>
        {LANGUAGES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
      </select>
    </label>
  );
}

function LocationFields({ state, district, onStateChange, onDistrictChange, t, prefix = "" }) {
  const districts = useMemo(() => districtOptions(state), [state]);
  return (
    <div className="form-grid location-grid">
      <label>{t("State")}
        <select value={state} onChange={(event) => onStateChange(event.target.value)} required>
          <option value="">{t("Choose a state")}</option>
          {states.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      <label>{t("District")}
        <select value={district} onChange={(event) => onDistrictChange(event.target.value)} disabled={!state} required>
          <option value="">{state ? t("Choose a district") : t("Choose a state first")}</option>
          {districts.map((name) => <option key={`${prefix}${name}`} value={name}>{name}</option>)}
        </select>
      </label>
    </div>
  );
}

function money(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function weatherLabel(code) {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather conditions";
}

function App() {
  const [session, setSession] = useState(getInitialSession);
  const [language, setLanguage] = useState(() => localStorage.getItem("cropLanguage") || "en");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [candidateCrops, setCandidateCrops] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [crops, setCrops] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [marketMessage, setMarketMessage] = useState("");
  const [marketCommodity, setMarketCommodity] = useState("");
  const [marketState, setMarketState] = useState("");
  const [marketDistrict, setMarketDistrict] = useState("");
  const [plan, setPlan] = useState({
    state: "", district: "", soilType: "", area: "2", areaUnit: "acres",
    soilPh: "", nitrogen: "", phosphorus: "", potassium: ""
  });
  const [cropForm, setCropForm] = useState({ name: "", season: "", soilType: "", description: "" });
  const [addingCrop, setAddingCrop] = useState(false);
  const locale = localeFor(language);
  const t = (text) => translate(text, language);
  const displayName = session?.user?.name?.split(" ")[0] || "Farmer";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");

  useEffect(() => {
    localStorage.setItem("cropLanguage", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([
      request("/recommendations", session.token),
      request("/crops", session.token)
    ]).then(([savedPlans, cropRecords]) => {
      if (active) {
        setRecommendations(savedPlans);
        setCrops(cropRecords);
      }
    }).catch((error) => {
      if (active) setStatus({ type: "error", message: t(error.message) });
    });
    return () => { active = false; };
  }, [session]);

  async function loadWeather(state = plan.state, district = plan.district) {
    if (!state || !district) {
      setStatus({ type: "error", message: t("Select a district to see weather.") });
      return null;
    }
    setWeatherLoading(true);
    try {
      const result = await request(
        `/weather?${new URLSearchParams({ state, district })}`,
        session.token
      );
      setWeather(result);
      setStatus({ type: "", message: "" });
      return result;
    } catch (error) {
      setStatus({ type: "error", message: t(error.message) });
      return null;
    } finally {
      setWeatherLoading(false);
    }
  }

  async function analyzeFarm(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const forecast = await request(
        `/weather?${new URLSearchParams({ state: plan.state, district: plan.district })}`,
        session.token
      );
      setWeather(forecast);
      const areaInHectares = Number(plan.area) * (plan.areaUnit === "acres" ? 0.404686 : 1);
      const candidates = recommendCrops({
        soilType: plan.soilType,
        soilPh: plan.soilPh === "" ? 6.5 : Number(plan.soilPh),
        state: plan.state,
        area: areaInHectares,
        weather: forecast
      });
      const savedFarm = await request("/farms", session.token, {
        method: "POST",
        body: {
          state: plan.state,
          district: plan.district,
          soilType: plan.soilType,
          area: Number(plan.area),
          areaUnit: plan.areaUnit,
          ...(plan.soilPh !== "" ? { soilPh: Number(plan.soilPh) } : {}),
          ...(plan.nitrogen !== "" ? { nitrogen: Number(plan.nitrogen) } : {}),
          ...(plan.phosphorus !== "" ? { phosphorus: Number(plan.phosphorus) } : {}),
          ...(plan.potassium !== "" ? { potassium: Number(plan.potassium) } : {})
        }
      });
      setFarmId(savedFarm._id);
      setCandidateCrops(candidates);
      setPage("recommendations");
    } catch (error) {
      setStatus({ type: "error", message: t(error.message) });
    } finally {
      setLoading(false);
    }
  }

  async function saveRecommendation(crop) {
    if (!farmId) {
      setStatus({ type: "error", message: "Analyze your farm before saving a crop plan." });
      return;
    }
    try {
      const saved = await request("/recommendations", session.token, {
        method: "POST",
        body: {
          farm: farmId,
          recommendedCrop: crop.name,
          suitability: crop.suitability,
          temperature: weather?.current?.temperature_2m,
          rainfall: weather?.daily?.precipitation_sum?.reduce((sum, amount) => sum + amount, 0),
          humidity: weather?.current?.relative_humidity_2m
        }
      });
      setRecommendations((current) => [saved, ...current.filter((item) => item._id !== saved._id)]);
      setStatus({ type: "success", message: "Crop plan saved to your history." });
    } catch (error) {
      setStatus({ type: "error", message: t(error.message) });
    }
  }

  async function loadMarketPrices() {
    if (!marketState && !marketDistrict) {
      setMarketMessage(t("Choose a state or district to load live prices."));
      return;
    }
    setMarketLoading(true);
    setMarketMessage("");
    try {
      const query = new URLSearchParams();
      if (marketState) query.set("state", marketState);
      if (marketDistrict) query.set("district", marketDistrict);
      const data = await request(`/market-prices?${query}`, session.token);
      setMarketData(data.records || []);
      if (!data.records?.length) setMarketMessage(t("No mandi quotes were reported for this location."));
    } catch (error) {
      setMarketData([]);
      setMarketMessage(t(error.message));
    } finally {
      setMarketLoading(false);
    }
  }

  async function addCrop(event) {
    event.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(cropForm).forEach(([key, value]) => formData.append(key, value));
      const crop = await request("/crops", session.token, { method: "POST", body: formData });
      setCrops((current) => [...current, crop].sort((a, b) => a.name.localeCompare(b.name)));
      setCropForm({ name: "", season: "", soilType: "", description: "" });
      setAddingCrop(false);
      setStatus({ type: "success", message: "Crop added successfully." });
    } catch (error) {
      setStatus({ type: "error", message: t(error.message) });
    }
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
    setStatus({ type: "", message: "" });
  }

  if (!session) {
    return <AuthPanel onAuthenticated={setSession} language={language} onLanguageChange={setLanguage} t={t} />;
  }

  const navItems = [
    ["dashboard", "⌂", "Dashboard"],
    ["planning", "＋", "Crop Planning"],
    ["recommendations", "✳", "Recommendations"],
    ["weather", "☼", "Weather"],
    ["market", "↗", "Market"],
    ["history", "◷", "History"],
    ["crops", "▤", "Crop register"]
  ];
  const filteredQuotes = marketData.filter((row) =>
    String(row.commodity || "").toLowerCase().includes(marketCommodity.toLowerCase())
  );
  const savedCount = recommendations.filter((item) => item.recommendedCrop).length;
  const logout = () => {
    localStorage.removeItem("cropSession");
    setSession(null);
  };

  return (
    <div className={`app-layout ${sidebarOpen ? "sidebar-open" : ""}`}>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand"><span className="brand-icon">✳</span><span>Cropwise<small>{t("Planning System")}</small></span></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {navItems.map(([id, icon, label]) => (
            <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <span className="nav-icon">{icon}</span>{t(label)}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LanguagePicker language={language} onChange={setLanguage} t={t} />
          <button className="nav-link" onClick={logout}><span className="nav-icon">↪</span>{t("Sign out")}</button>
          <div className="profile-chip"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Farm account</small></div></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={sidebarOpen}>☰</button>
          <div className="breadcrumb">Workspace <span>/</span> {t(navItems.find(([id]) => id === page)?.[2] || "Dashboard")}</div>
          <div className="topbar-right"><span className="today-date">{new Date().toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</span><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span></div>
        </header>

        <div className="page-content">
          {status.message && <p className={`status ${status.type}`} role="status">{status.message}</p>}

          {page === "dashboard" && (
            <>
              <div className="welcome-row">
                <div><p className="eyebrow">SMART CROP PLANNING</p><h1>{greeting}, {displayName}</h1><p className="muted">Make informed decisions for your next growing season.</p></div>
                <button className="primary-button" onClick={() => navigate("planning")}>＋ {t("Start Crop Planning")}</button>
              </div>
              <section className="dashboard-hero">
                <div><span className="hero-pill">YOUR FARM, YOUR NEXT MOVE</span><h2>{t("Plan Your Next Crop Season")}</h2><p>{t("Manage your crop register and keep your farm planning details organized.")}</p><button className="light-button" onClick={() => navigate("planning")}>{t("Start Now")} <span>→</span></button></div>
                <div className="hero-illustration" aria-hidden="true"><div className="sun-disc" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="crop-lines">♧　♧　♧</div></div>
              </section>
              <section className="stat-grid">
                <article className="stat-card"><span className="stat-icon">♧</span><small>REGISTERED CROPS</small><strong>{crops.length}</strong><span>In your crop register</span></article>
                <article className="stat-card"><span className="stat-icon blue">◷</span><small>SAVED PLANS</small><strong>{savedCount}</strong><span>Recommendations in history</span></article>
                <article className="stat-card"><span className="stat-icon orange">☼</span><small>MARKET REFERENCE</small><strong>Daily</strong><span>Agmarknet price reports</span></article>
              </section>
              <section className="panel recent-panel"><div className="section-title"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>{t("Recent Planning History")}</h2></div><button className="text-button" onClick={() => navigate("history")}>{t("View all")} →</button></div>
                {recommendations.length ? <div className="history-list">{recommendations.slice(0, 4).map((item) => <article className="history-row" key={item._id}><span className="crop-mark">{item.recommendedCrop?.slice(0, 1)}</span><div><strong>{item.recommendedCrop}</strong><small>{item.farm?.district}, {item.farm?.state}</small></div><span className="score-pill">{item.suitability}% fit</span></article>)}</div> : <p className="empty">{t("No saved crop plans yet.")}</p>}
              </section>
            </>
          )}

          {page === "planning" && (
            <section className="panel planner-panel">
              <div className="page-heading"><p className="eyebrow">PERSONALIZED FARM ANALYSIS</p><h1>{t("Crop Planning")}</h1><p className="muted">Tell us about your soil and location. We’ll compare crop suitability, forecast weather and indicative market demand.</p></div>
              <form onSubmit={analyzeFarm}>
                <div className="form-section"><div className="form-section-title"><span>01</span><div><h2>{t("Location & Area")}</h2><p>Choose your state first to see its districts.</p></div></div>
                  <LocationFields state={plan.state} district={plan.district} onStateChange={(state) => setPlan({ ...plan, state, district: "" })} onDistrictChange={(district) => setPlan({ ...plan, district })} t={t} />
                  <div className="form-grid"><label>{t("Farm area")}<div className="unit-input"><input type="number" min="0.01" step="any" value={plan.area} onChange={(event) => setPlan({ ...plan, area: event.target.value })} required /><select value={plan.areaUnit} onChange={(event) => setPlan({ ...plan, areaUnit: event.target.value })}><option value="acres">acres</option><option value="hectares">hectares</option></select></div></label></div>
                </div>
                <div className="form-section"><div className="form-section-title"><span>02</span><div><h2>{t("Soil Data")}</h2><p>Provide soil details to refine the match. Nutrient values are optional.</p></div></div>
                  <div className="form-grid"><label>{t("Soil type")}<select value={plan.soilType} onChange={(event) => setPlan({ ...plan, soilType: event.target.value })} required><option value="">{t("Choose a soil type")}</option>{soils.map((soil) => <option key={soil.value} value={soil.value}>{soil.label}</option>)}</select></label>
                    <label>{t("Soil pH")}<input type="number" min="0" max="14" step="0.1" placeholder="e.g. 6.5" value={plan.soilPh} onChange={(event) => setPlan({ ...plan, soilPh: event.target.value })} /></label>
                    <label>{t("Nitrogen")}<input type="number" min="0" step="any" placeholder="Optional" value={plan.nitrogen} onChange={(event) => setPlan({ ...plan, nitrogen: event.target.value })} /></label>
                    <label>{t("Phosphorus")}<input type="number" min="0" step="any" placeholder="Optional" value={plan.phosphorus} onChange={(event) => setPlan({ ...plan, phosphorus: event.target.value })} /></label>
                    <label>{t("Potassium")}<input type="number" min="0" step="any" placeholder="Optional" value={plan.potassium} onChange={(event) => setPlan({ ...plan, potassium: event.target.value })} /></label>
                  </div>
                </div>
                <div className="form-footer"><p>Weather is fetched for your district. Farm details are saved to your account when analysis succeeds.</p><button className="primary-button" disabled={loading} type="submit">{loading ? t("Loading") + "..." : t("Analyze my farm")} <span>→</span></button></div>
              </form>
            </section>
          )}

          {page === "recommendations" && (
            <section>
              <div className="page-heading"><p className="eyebrow">SOIL · LOCATION · WEATHER · DEMAND</p><h1>{t("Best crops for your farm")}</h1><p className="muted">{weather?.location?.district}, {weather?.location?.state} · {weather ? weatherLabel(weather.current.weather_code) : "Forecast-based analysis"}</p></div>
              <div className="estimate-note">{t("Forecast-based estimate")}: {t("Profit is an indicative seasonal estimate based on typical yield and cost. Actual results vary.")} Benchmarks are illustrative, not live mandi prices.</div>
              {candidateCrops.length ? <div className="recommendation-grid">{candidateCrops.slice(0, 8).map((crop, index) => <article className={`recommendation-card ${index === 0 ? "top-match" : ""}`} key={`${crop.name}-${index}`}>
                <div className="recommendation-top"><span className="crop-mark">{crop.name.slice(0, 1)}</span><span className="score-pill">{crop.suitability}% {index === 0 ? t("Best fit") : "match"}</span></div>
                <h2>{crop.name}</h2><p className="demand-label">{t("Market demand")}: <strong>{crop.demand}</strong></p>
                <div className="crop-estimates"><div><small>{t("Price estimate")}</small><strong>{money(crop.pricePerKg * 1000, locale)} / qtl</strong></div><div><small>{t("Estimated gross")}</small><strong>{money(crop.estimatedGross, locale)}</strong></div><div><small>{t("Cost estimate")}</small><strong>{money(crop.estimatedCost, locale)}</strong></div></div>
                <div className="profit-line"><span>{t("Estimated net")}</span><strong className={crop.estimatedProfit >= 0 ? "positive" : "negative"}>{money(crop.estimatedProfit, locale)}</strong></div>
                <button className="outline-button" onClick={() => saveRecommendation(crop)}>{t("Save crop plan")}</button>
              </article>)}</div> : <div className="panel"><p className="empty">Run a farm analysis to see crop recommendations.</p><button className="primary-button" onClick={() => navigate("planning")}>{t("Start Crop Planning")}</button></div>}
            </section>
          )}

          {page === "weather" && (
            <section>
              <div className="page-heading"><p className="eyebrow">DISTRICT WEATHER OUTLOOK</p><h1>{t("Weather")}</h1><p className="muted">Current conditions and a five-day forecast for your selected district.</p></div>
              <section className="panel weather-panel">
                <LocationFields state={plan.state} district={plan.district} onStateChange={(state) => setPlan({ ...plan, state, district: "" })} onDistrictChange={(district) => setPlan({ ...plan, district })} t={t} />
                <button className="primary-button" onClick={() => loadWeather()} disabled={weatherLoading}>{weatherLoading ? t("Loading") + "..." : t("Refresh")} ↻</button>
                {weather && <><div className="current-weather"><div><small>{t("Current conditions")} · {weather.location.district}, {weather.location.state}</small><h2>{Math.round(weather.current.temperature_2m)}°C</h2><p>{weatherLabel(weather.current.weather_code)}</p></div><div className="weather-metrics"><span><small>{t("Humidity")}</small><strong>{weather.current.relative_humidity_2m}%</strong></span><span><small>{t("Wind")}</small><strong>{weather.current.wind_speed_10m} km/h</strong></span><span><small>{t("Rain chance")}</small><strong>{weather.daily.precipitation_probability_max?.[0] ?? "—"}%</strong></span></div></div>
                  <h2 className="forecast-title">{t("5-Day Forecast")}</h2><div className="forecast-grid">{weather.daily.time.map((date, index) => <article className="forecast-card" key={date}><small>{new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}</small><strong>{weatherLabel(weather.daily.weather_code[index])}</strong><span>{Math.round(weather.daily.temperature_2m_max[index])}° / {Math.round(weather.daily.temperature_2m_min[index])}°C</span><small>{t("Daily rain")}: {weather.daily.precipitation_sum[index]} mm</small></article>)}</div><p className="source-note">{weather.attribution}</p>
                </>}
              </section>
            </section>
          )}

          {page === "market" && (
            <section>
              <div className="page-heading"><p className="eyebrow">AGMARKNET · DATA.GOV.IN</p><h1>{t("Market")}</h1><p className="muted">{t("Latest reported daily mandi quotes · modal price in Indian rupees per quintal")}</p></div>
              <div className="estimate-note">{t("These are the latest daily mandi prices reported by Agmarknet through data.gov.in, not live intraday trading quotes. Arrival dates can lag. Verify with the local mandi before selling.")}</div>
              <section className="panel market-panel">
                <div className="market-filters"><LocationFields state={marketState} district={marketDistrict} onStateChange={(state) => { setMarketState(state); setMarketDistrict(""); setMarketData([]); }} onDistrictChange={setMarketDistrict} t={t} /><label>{t("Search commodity")}<input value={marketCommodity} onChange={(event) => setMarketCommodity(event.target.value)} placeholder="Rice, wheat, tomato..." /></label><button className="primary-button" onClick={loadMarketPrices} disabled={marketLoading}>{marketLoading ? t("Loading") + "..." : t("Refresh quotes")} ↻</button></div>
                {marketMessage && <p className={`status ${marketMessage === t("Choose a state or district to load live prices.") || marketMessage === t("No mandi quotes were reported for this location.") ? "" : "error"}`} role="status">{marketMessage}</p>}
                {marketLoading && <p className="empty">{t("Loading latest mandi quotes...")}</p>}
                {!marketLoading && filteredQuotes.length > 0 && <div className="table-scroll"><table><thead><tr><th>{t("Arrival date")}</th><th>{t("Market name")}</th><th>{t("Commodity")}</th><th>{t("Variety / grade")}</th><th>{t("Min price")}</th><th>{t("Max price")}</th><th>{t("Modal price")}</th></tr></thead><tbody>{filteredQuotes.map((quote, index) => <tr key={`${quote.market}-${quote.commodity}-${quote.arrival_date}-${index}`}><td>{quote.arrival_date || "—"}</td><td>{quote.market || "—"}</td><td><strong>{quote.commodity || "—"}</strong></td><td>{quote.variety || quote.grade || "—"}</td><td>{quote.min_price ? money(quote.min_price, locale) : "—"}</td><td>{quote.max_price ? money(quote.max_price, locale) : "—"}</td><td className="modal-price">{quote.modal_price ? money(quote.modal_price, locale) : "—"}</td></tr>)}</tbody></table></div>}
                <div className="official-label"><span>✓</span> {t("Official daily market data")}</div>
              </section>
            </section>
          )}

          {page === "history" && (
            <section className="panel recent-panel"><div className="section-title"><div><p className="eyebrow">SAVED TO YOUR ACCOUNT</p><h1>{t("Saved Crop Plans")}</h1></div></div>
              {recommendations.filter((item) => item.recommendedCrop).length ? <div className="history-list">{recommendations.filter((item) => item.recommendedCrop).map((item) => <article className="history-row" key={item._id}><span className="crop-mark">{item.recommendedCrop.slice(0, 1)}</span><div><strong>{item.recommendedCrop}</strong><small>{item.farm?.district}, {item.farm?.state} · {item.farm?.soilType}</small></div><span className="score-pill">{item.suitability}% fit</span><time>{new Date(item.createdAt).toLocaleDateString(locale)}</time></article>)}</div> : <p className="empty">{t("No saved crop plans yet.")}</p>}
            </section>
          )}

          {page === "crops" && (
            <section className="panel recent-panel"><div className="section-title"><div><p className="eyebrow">YOUR FARM DATABASE</p><h1>Crop register</h1></div><button className="primary-button" onClick={() => setAddingCrop((value) => !value)}>＋ Add crop</button></div>
              {addingCrop && <form className="crop-add-form form-grid" onSubmit={addCrop}><label>Crop name<input value={cropForm.name} onChange={(event) => setCropForm({ ...cropForm, name: event.target.value })} required /></label><label>Season<input value={cropForm.season} onChange={(event) => setCropForm({ ...cropForm, season: event.target.value })} /></label><label>{t("Soil type")}<select value={cropForm.soilType} onChange={(event) => setCropForm({ ...cropForm, soilType: event.target.value })}><option value="">—</option>{soils.map((soil) => <option key={soil.value} value={soil.value}>{soil.label}</option>)}</select></label><label>Description<input value={cropForm.description} onChange={(event) => setCropForm({ ...cropForm, description: event.target.value })} /></label><button className="primary-button" type="submit">Save crop</button></form>}
              {crops.length ? <div className="history-list">{crops.map((crop) => <article className="history-row" key={crop._id}><span className="crop-mark">{crop.name.slice(0, 1)}</span><div><strong>{crop.name}</strong><small>{crop.season || "Season pending"} · {crop.soilType || "Soil not specified"}</small></div></article>)}</div> : <p className="empty">No crop records yet.</p>}
            </section>
          )}

          <footer className="app-footer">Smart Crop Planning <span>•</span> {t("Planning System")}</footer>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
