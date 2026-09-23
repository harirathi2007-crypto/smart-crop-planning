const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Crop = require("./models/Crop");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-crop-planning";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Smart Crop Planning System API is running"
    });
});

app.get("/api/crops", async (req, res) => {
    try {
        const crops = await Crop.find().sort({ name: 1 });
        res.json(crops);
    } catch (error) {
        res.status(500).json({ message: "Unable to read crops" });
    }
});

app.post("/api/crops", async (req, res) => {
    const { name, season, soilType, description } = req.body;

    if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Crop name is required" });
    }

    try {
        const crop = await Crop.create({
            name: name.trim(),
            season,
            soilType,
            description
        });

        res.status(201).json(crop);
    } catch (error) {
        res.status(500).json({ message: "Unable to create crop" });
    }
});

app.put("/api/crops/:id", async (req, res) => {
    const { id } = req.params;
    const { name, season, soilType, description } = req.body;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid crop id" });
    }

    if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Crop name is required" });
    }

    try {
        const crop = await Crop.findByIdAndUpdate(
            id,
            {
                name: name.trim(),
                season,
                soilType,
                description
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!crop) {
            return res.status(404).json({ message: "Crop not found" });
        }

        res.json(crop);
    } catch (error) {
        res.status(500).json({ message: "Unable to update crop" });
    }
});

async function startServer() {
    await mongoose.connect(MONGODB_URI);

    return app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error("Unable to connect to MongoDB", error.message);
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };