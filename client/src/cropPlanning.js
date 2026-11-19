export const CROP_MARKET_DATA = [
  { name: "Rice", pricePerKg: 23, demand: "High", demandScore: 92, yieldKgPerHa: 4800, costPerHa: 65000, soils: ["Clay", "Loam", "Silty"], ph: [5, 7], temp: [22, 35], rain: 90, states: ["South India", "East India", "North India"] },
  { name: "Wheat", pricePerKg: 27, demand: "High", demandScore: 92, yieldKgPerHa: 3800, costPerHa: 56000, soils: ["Loam", "Clay", "Silty"], ph: [6, 7.5], temp: [10, 25], rain: 45, states: ["North India", "Central India", "West India"] },
  { name: "Maize", pricePerKg: 22, demand: "High", demandScore: 90, yieldKgPerHa: 4500, costPerHa: 48000, soils: ["Loam", "Sandy", "Silty"], ph: [5.5, 7.5], temp: [18, 32], rain: 60, states: ["South India", "Central India", "West India", "North India", "East India"] },
  { name: "Soybean", pricePerKg: 46, demand: "Steady", demandScore: 78, yieldKgPerHa: 1700, costPerHa: 42000, soils: ["Loam", "Clay", "Black soil"], ph: [6, 7.5], temp: [20, 32], rain: 60, states: ["Central India", "West India"] },
  { name: "Groundnut", pricePerKg: 58, demand: "Steady", demandScore: 78, yieldKgPerHa: 2200, costPerHa: 65000, soils: ["Sandy", "Loam", "Laterite"], ph: [5.5, 7], temp: [20, 32], rain: 45, states: ["South India", "West India"] },
  { name: "Cotton", pricePerKg: 72, demand: "Steady", demandScore: 76, yieldKgPerHa: 1800, costPerHa: 85000, soils: ["Black soil", "Loam", "Clay"], ph: [5.5, 8], temp: [21, 35], rain: 55, states: ["Central India", "West India", "South India"] },
  { name: "Sugarcane", pricePerKg: 3.5, demand: "High", demandScore: 90, yieldKgPerHa: 70000, costPerHa: 145000, soils: ["Loam", "Clay", "Silty"], ph: [6, 7.5], temp: [20, 35], rain: 85, states: ["South India", "North India", "West India"] },
  { name: "Millet", pricePerKg: 32, demand: "Growing", demandScore: 86, yieldKgPerHa: 1800, costPerHa: 30000, soils: ["Sandy", "Loam", "Laterite"], ph: [5.5, 7.5], temp: [22, 35], rain: 35, states: ["South India", "West India", "North India"] },
  { name: "Chickpea", pricePerKg: 70, demand: "High", demandScore: 89, yieldKgPerHa: 1400, costPerHa: 40000, soils: ["Loam", "Sandy", "Black soil"], ph: [6, 8], temp: [15, 30], rain: 35, states: ["Central India", "North India", "West India"] },
  { name: "Pigeon Pea", pricePerKg: 95, demand: "High", demandScore: 90, yieldKgPerHa: 1100, costPerHa: 38000, soils: ["Loam", "Sandy", "Laterite"], ph: [5.5, 7.5], temp: [20, 35], rain: 50, states: ["Central India", "South India", "West India"] },
  { name: "Potato", pricePerKg: 18, demand: "High", demandScore: 90, yieldKgPerHa: 22000, costPerHa: 125000, soils: ["Loam", "Sandy", "Silty"], ph: [5, 6.5], temp: [12, 25], rain: 35, states: ["North India", "Central India", "East India"] },
  { name: "Onion", pricePerKg: 25, demand: "Variable", demandScore: 68, yieldKgPerHa: 18000, costPerHa: 100000, soils: ["Loam", "Sandy", "Silty"], ph: [6, 7.5], temp: [13, 30], rain: 35, states: ["West India", "South India", "Central India"] },
  { name: "Tomato", pricePerKg: 22, demand: "Variable", demandScore: 70, yieldKgPerHa: 25000, costPerHa: 130000, soils: ["Loam", "Sandy", "Silty"], ph: [5.5, 7], temp: [18, 30], rain: 40, states: ["South India", "West India", "North India"] },
  { name: "Chili", pricePerKg: 80, demand: "Variable", demandScore: 72, yieldKgPerHa: 1800, costPerHa: 95000, soils: ["Loam", "Sandy", "Black soil"], ph: [5.5, 7.5], temp: [20, 32], rain: 40, states: ["South India", "Central India", "West India"] },
  { name: "Banana", pricePerKg: 18, demand: "Steady", demandScore: 79, yieldKgPerHa: 30000, costPerHa: 160000, soils: ["Loam", "Silty", "Clay"], ph: [5.5, 7.5], temp: [20, 35], rain: 70, states: ["South India", "East India", "West India"] },
  { name: "Cassava", pricePerKg: 12, demand: "Steady", demandScore: 75, yieldKgPerHa: 25000, costPerHa: 95000, soils: ["Sandy", "Loam", "Laterite"], ph: [5, 7], temp: [22, 35], rain: 50, states: ["South India", "East India"] }
];

const STATE_REGIONS = {
  "South India": ["Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry", "Lakshadweep", "Andaman and Nicobar Islands"],
  "North India": ["Delhi", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Ladakh", "Punjab", "Rajasthan", "Uttar Pradesh", "Uttarakhand", "Chandigarh"],
  "Central India": ["Chhattisgarh", "Madhya Pradesh", "Maharashtra"],
  "West India": ["Goa", "Gujarat", "Maharashtra", "Rajasthan"],
  "East India": ["Bihar", "Jharkhand", "Odisha", "West Bengal", "Assam", "Arunachal Pradesh", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"]
};

function boundedScore(value, lower, upper) {
  if (value >= lower && value <= upper) return 100;
  return Math.max(30, 100 - Math.min(Math.abs(value - lower), Math.abs(value - upper)) * 8);
}

export function getStateRegion(state) {
  return Object.entries(STATE_REGIONS).find(([, states]) => states.includes(state))?.[0] || "";
}

export function recommendCrops({ soilType, soilPh, state, area, weather }) {
  const temperature = weather.current.temperature_2m;
  const rainfall = weather.daily.precipitation_sum.reduce((sum, amount) => sum + amount, 0);
  const region = getStateRegion(state);

  return CROP_MARKET_DATA.map((crop) => {
    const soilScore = (crop.soils.includes(soilType) ? 75 : 40) +
      (soilPh >= crop.ph[0] && soilPh <= crop.ph[1] ? 25 : 0);
    const weatherScore = boundedScore(temperature, ...crop.temp) * 0.7 +
      (rainfall <= crop.rain ? 30 : Math.max(0, 30 - (rainfall - crop.rain) / 5));
    const regionScore = crop.states.includes(region) ? 100 : 55;
    const grossPerHa = crop.yieldKgPerHa * crop.pricePerKg;
    const estimatedProfitPerHa = grossPerHa - crop.costPerHa;
    const profitScore = Math.max(0, Math.min(100, Math.round(estimatedProfitPerHa / grossPerHa * 100)));
    const suitability = Math.round(
      soilScore * 0.3 + weatherScore * 0.25 + regionScore * 0.15 +
      crop.demandScore * 0.15 + profitScore * 0.15
    );

    return {
      ...crop,
      suitability,
      factors: {
        soil: Math.round(soilScore),
        weather: Math.round(weatherScore),
        region: regionScore,
        demand: crop.demandScore,
        profit: profitScore
      },
      estimatedGross: grossPerHa * area,
      estimatedCost: crop.costPerHa * area,
      estimatedProfit: estimatedProfitPerHa * area
    };
  }).sort((left, right) => right.suitability - left.suitability || right.estimatedProfit - left.estimatedProfit);
}
