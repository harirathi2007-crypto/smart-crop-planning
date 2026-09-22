import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import CropPlanning from "./components/CropPlanning";
import CropRecommendation from "./components/CropRecommendation";
import WeatherCard from "./components/WeatherCard";
import MarketCard from "./components/MarketCard";

function App() {
  return (
    <>
      <Navbar />

      <main>
        <Dashboard />

        <div className="container">
          <CropPlanning />
          <CropRecommendation />
          <WeatherCard />
          <MarketCard />
        </div>
      </main>
    </>
  );
}

export default App;