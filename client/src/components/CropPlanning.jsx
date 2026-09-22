function CropPlanning() {
  return (
    <section className="card">
      <h2>Crop Planning</h2>

      <input type="number" placeholder="Soil pH" />
      <input type="number" placeholder="Nitrogen" />
      <input type="number" placeholder="Phosphorus" />
      <input type="number" placeholder="Potassium" />
      <input type="number" placeholder="Temperature" />
      <input type="number" placeholder="Rainfall" />

      <button>Get Crop Recommendation</button>
    </section>
  );
}

export default CropPlanning;