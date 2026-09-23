const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Crop = require("./models/Crop");
const User = require("./models/User");
const Farm = require("./models/Farm");
const CropRecommendation = require("./models/CropRecommendation");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-crop-planning";
const JWT_SECRET = process.env.JWT_SECRET || "smart-crop-planning-development-secret";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
);

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

if (googleOAuthConfigured) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL
            },
            (accessToken, refreshToken, profile, done) => done(null, profile)
        )
    );
}

app.get("/", (req, res) => {
    res.redirect(CLIENT_URL);
});

app.get("/api/health", (req, res) => {
    res.json({
        message: "Smart Crop Planning System API is running"
    });
});

function publicUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
    };
}

function requireAuth(req, res, next) {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        req.auth = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (
        typeof name !== "string" ||
        name.trim() === "" ||
        typeof email !== "string" ||
        email.trim() === "" ||
        typeof password !== "string" ||
        password.length < 6
    ) {
        return res.status(400).json({
            message: "Name, email, and a password of at least 6 characters are required"
        });
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({ message: "Email is already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone
        });

        res.status(201).json({ user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ message: "Unable to register user" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
            "+password"
        );
        const passwordMatches = user && (await bcrypt.compare(password, user.password));

        if (!passwordMatches) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, {
            expiresIn: "1d"
        });

        res.json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ message: "Unable to log in" });
    }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.auth.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ message: "Unable to load user" });
    }
});

app.get("/api/auth/google", (req, res, next) => {
    if (!googleOAuthConfigured) {
        return res.status(503).json({
            message: "Google authentication is not configured"
        });
    }

    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
        if (!googleOAuthConfigured) {
            return res.status(503).json({
                message: "Google authentication is not configured"
            });
        }

        passport.authenticate("google", { session: false }, (error, profile) => {
            if (error || !profile) {
                return res.redirect(`${CLIENT_URL}/?authError=google`);
            }

            req.googleProfile = profile;
            next();
        })(req, res, next);
    },
    async (req, res) => {
        try {
            const googleEmail = profileEmail(req.googleProfile);
            let user = await User.findOne({ googleId: req.googleProfile.id });

            if (!user && googleEmail) {
                user = await User.findOne({ email: googleEmail });
            }

            if (!user) {
                user = await User.create({
                    name: req.googleProfile.displayName || "Google user",
                    email: googleEmail || `${req.googleProfile.id}@google.local`,
                    googleId: req.googleProfile.id,
                    authProvider: "google"
                });
            } else if (!user.googleId) {
                user.googleId = req.googleProfile.id;
                user.authProvider = "google";
                await user.save();
            }

            const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, {
                expiresIn: "1d"
            });
            res.redirect(`${CLIENT_URL}/?token=${encodeURIComponent(token)}`);
        } catch (error) {
            res.redirect(`${CLIENT_URL}/?authError=google`);
        }
    }
);

function profileEmail(profile) {
    return profile.emails?.[0]?.value?.trim().toLowerCase();
}

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