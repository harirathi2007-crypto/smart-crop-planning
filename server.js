const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Crop = require("./models/Crop");
const User = require("./models/User");
const Farm = require("./models/Farm");
const CropRecommendation = require("./models/CropRecommendation");

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

app.delete("/api/crops/:id", async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid crop id" });
    }

    try {
        const crop = await Crop.findByIdAndDelete(id);

        if (!crop) {
            return res.status(404).json({ message: "Crop not found" });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Unable to delete crop" });
    }
});

app.get("/api/recommendations", async (req, res) => {
    try {
        const recommendations = await CropRecommendation.find()
            .populate("user", "name email phone")
            .populate("farm", "location soilType area");

        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ message: "Unable to read recommendations" });
    }
});

app.post("/api/recommendations", async (req, res) => {
    const {
        user,
        farm,
        recommendedCrop,
        suitability,
        temperature,
        rainfall,
        humidity
    } = req.body;

    if (
        !mongoose.isValidObjectId(user) ||
        !mongoose.isValidObjectId(farm) ||
        typeof recommendedCrop !== "string" ||
        recommendedCrop.trim() === ""
    ) {
        return res.status(400).json({
            message: "User, farm, and recommended crop are required"
        });
    }

    try {
        const [existingUser, ownedFarm] = await Promise.all([
            User.findById(user),
            Farm.findOne({ _id: farm, user })
        ]);

        if (!existingUser || !ownedFarm) {
            return res.status(404).json({
                message: "User or farm relationship not found"
            });
        }

        const recommendation = await CropRecommendation.create({
            user,
            farm,
            recommendedCrop: recommendedCrop.trim(),
            suitability,
            temperature,
            rainfall,
            humidity
        });

        await recommendation.populate([
            { path: "user", select: "name email phone" },
            { path: "farm", select: "location soilType area" }
        ]);

        res.status(201).json(recommendation);
    } catch (error) {
        res.status(500).json({ message: "Unable to create recommendation" });
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