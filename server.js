require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
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
const MARKET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const providerCache = new Map();
const UPLOAD_DIRECTORY = path.join(__dirname, "uploads");
const imageExtensions = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"]
]);
const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
);

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
app.use("/uploads", requireAuth, express.static(UPLOAD_DIRECTORY, {
    dotfiles: "deny",
    index: false,
    setHeaders(response) {
        response.setHeader("X-Content-Type-Options", "nosniff");
    }
}));

const uploadCropImage = multer({
    storage: multer.diskStorage({
        destination: UPLOAD_DIRECTORY,
        filename(req, file, callback) {
            callback(null, `${randomUUID()}${imageExtensions.get(file.mimetype)}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, callback) {
        if (!imageExtensions.has(file.mimetype)) {
            return callback(new Error("Only JPEG, PNG, or WebP images are allowed"));
        }

        callback(null, true);
    }
});

function parseCropImage(req, res, next) {
    uploadCropImage.single("image")(req, res, (error) => {
        if (!error) return next();

        const statusCode = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? 413
            : 400;
        res.status(statusCode).json({ message: error.message });
    });
}

async function removeUploadedImage(filename) {
    if (!filename) return;

    await fs.promises.unlink(path.join(UPLOAD_DIRECTORY, path.basename(filename))).catch((error) => {
        if (error.code !== "ENOENT") throw error;
    });
}

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

app.post("/api/ai/crop-suggestions", requireAuth, async (req, res) => {
    const { query, season, soilType } = req.body;

    if (
        typeof query !== "string" ||
        query.trim().length < 2 ||
        query.trim().length > 80 ||
        (season !== undefined && typeof season !== "string") ||
        (soilType !== undefined && typeof soilType !== "string")
    ) {
        return res.status(400).json({
            message: "A crop name query of 2 to 80 characters is required"
        });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
            message: "AI crop suggestions are not configured on this server"
        });
    }

    try {
        const providerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: "Suggest up to five real crop names that autocomplete the user's partial crop name. Return only a JSON object with a suggestions array of short crop names. Do not include explanations or markdown."
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            partialName: query.trim(),
                            season: typeof season === "string" ? season.trim().slice(0, 80) : "",
                            soilType: typeof soilType === "string" ? soilType.trim().slice(0, 80) : ""
                        })
                    }
                ]
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!providerResponse.ok) {
            throw new Error(`OpenAI returned HTTP ${providerResponse.status}`);
        }

        const providerResult = await providerResponse.json();
        const content = providerResult.choices?.[0]?.message?.content;
        const parsedContent = typeof content === "string" ? JSON.parse(content) : null;

        if (!Array.isArray(parsedContent?.suggestions)) {
            throw new Error("OpenAI returned an invalid crop suggestions response");
        }

        const suggestionsByName = new Map();
        parsedContent.suggestions
            .filter((name) => typeof name === "string")
            .map((name) => name.trim().slice(0, 60))
            .filter(Boolean)
            .forEach((name) => {
                const normalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                const key = normalizedName.toLowerCase();
                if (!suggestionsByName.has(key)) {
                    suggestionsByName.set(key, normalizedName);
                }
            });
        const suggestions = [...suggestionsByName.values()].slice(0, 5);

        return res.json({ suggestions });
    } catch (error) {
        console.error("Unable to generate crop suggestions", error.message);
        return res.status(502).json({
            message: "AI crop suggestions are temporarily unavailable"
        });
    }
});

function cacheGet(key) {
    const entry = providerCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
        providerCache.delete(key);
        return null;
    }

    return entry.value;
}

function cacheSet(key, value) {
    providerCache.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
}

async function fetchProviderJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
        throw new Error(`Provider returned HTTP ${response.status}`);
    }
    return response.json();
}

app.get("/api/weather", requireAuth, async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const district = typeof req.query.district === "string" ? req.query.district.trim() : "";
    if (!state || !district || state.length > 100 || district.length > 100) {
        return res.status(400).json({ message: "A valid state and district are required" });
    }

    const cacheKey = `weather:${state.toLowerCase()}:${district.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
        const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
        geocodingUrl.search = new URLSearchParams({
            name: district,
            count: "20",
            language: "en",
            format: "json"
        }).toString();
        const geocoding = await fetchProviderJson(geocodingUrl);
        const candidates = geocoding.results?.filter((result) => result.country_code === "IN") || [];
        const place = candidates.find((result) =>
            result.admin1?.toLowerCase() === state.toLowerCase()
        ) || (candidates.length === 1 ? candidates[0] : null);

        if (!place) {
            return res.status(404).json({ message: "Weather location was not found for this district" });
        }

        const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
        forecastUrl.search = new URLSearchParams({
            latitude: String(place.latitude),
            longitude: String(place.longitude),
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
            daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
            forecast_days: "5",
            timezone: "auto"
        }).toString();
        const weather = await fetchProviderJson(forecastUrl);
        const result = {
            location: { name: place.name, state: place.admin1 || state, district },
            ...weather,
            attribution: "Weather forecast by Open-Meteo"
        };
        cacheSet(cacheKey, result);
        return res.json(result);
    } catch (error) {
        console.error("Weather provider request failed", error.message);
        return res.status(502).json({ message: "Weather data is temporarily unavailable" });
    }
});

app.get("/api/market-prices", requireAuth, async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const district = typeof req.query.district === "string" ? req.query.district.trim() : "";
    const commodity = typeof req.query.commodity === "string" ? req.query.commodity.trim() : "";
    if (state.length > 100 || district.length > 100 || commodity.length > 80) {
        return res.status(400).json({ message: "Market filters are too long" });
    }
    if (!process.env.DATA_GOV_IN_API_KEY) {
        return res.status(503).json({
            message: "Live mandi prices are not configured. Set DATA_GOV_IN_API_KEY on the backend."
        });
    }

    const cacheKey = `market:${state.toLowerCase()}:${district.toLowerCase()}:${commodity.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
        const marketUrl = new URL(`https://api.data.gov.in/resource/${MARKET_RESOURCE_ID}`);
        const params = new URLSearchParams({
            "api-key": process.env.DATA_GOV_IN_API_KEY,
            format: "json",
            limit: "100"
        });
        if (state) params.set("filters[state]", state);
        if (district) params.set("filters[district]", district);
        if (commodity) params.set("filters[commodity]", commodity);
        marketUrl.search = params.toString();
        const data = await fetchProviderJson(marketUrl);
        const result = {
            records: Array.isArray(data.records) ? data.records : [],
            total: Number(data.total ?? data.count ?? data.records?.length ?? 0),
            source: "Agmarknet via data.gov.in",
            note: "Latest reported daily mandi prices; these are not intraday trading quotes."
        };
        cacheSet(cacheKey, result);
        return res.json(result);
    } catch (error) {
        console.error("Market data provider request failed", error.message);
        return res.status(502).json({ message: "Live mandi prices are temporarily unavailable" });
    }
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

app.get("/api/farms", requireAuth, async (req, res) => {
    try {
        const farms = await Farm.find({ user: req.auth.userId }).sort({ createdAt: -1 });
        return res.json(farms);
    } catch (error) {
        return res.status(500).json({ message: "Unable to load saved farms" });
    }
});

app.post("/api/farms", requireAuth, async (req, res) => {
    const {
        state,
        district,
        soilType,
        area,
        areaUnit = "acres",
        soilPh,
        nitrogen,
        phosphorus,
        potassium
    } = req.body;
    const optionalNumbers = { soilPh, nitrogen, phosphorus, potassium };
    if (
        typeof state !== "string" || !state.trim() || state.trim().length > 100 ||
        typeof district !== "string" || !district.trim() || district.trim().length > 100 ||
        typeof soilType !== "string" || !soilType.trim() || soilType.trim().length > 80 ||
        typeof area !== "number" || !Number.isFinite(area) || area <= 0 ||
        !["acres", "hectares"].includes(areaUnit) ||
        (soilPh !== undefined && (!Number.isFinite(soilPh) || soilPh < 0 || soilPh > 14)) ||
        Object.entries(optionalNumbers).some(([key, value]) =>
            key !== "soilPh" && value !== undefined && (!Number.isFinite(value) || value < 0)
        )
    ) {
        return res.status(400).json({ message: "Provide valid farm location, soil type, and area" });
    }

    try {
        const farm = await Farm.create({
            user: req.auth.userId,
            state: state.trim(),
            district: district.trim(),
            location: `${district.trim()}, ${state.trim()}`,
            soilType: soilType.trim(),
            area,
            areaUnit,
            soilPh,
            nitrogen,
            phosphorus,
            potassium
        });
        return res.status(201).json(farm);
    } catch (error) {
        return res.status(500).json({ message: "Unable to save farm details" });
    }
});

app.get("/api/auth/google", (req, res, next) => {
    if (!googleOAuthConfigured) {
        return res.redirect(`${CLIENT_URL}/?authError=google_unconfigured`);
    }

    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
        if (!googleOAuthConfigured) {
            return res.redirect(`${CLIENT_URL}/?authError=google_unconfigured`);
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

app.get("/api/crops", requireAuth, async (req, res) => {
    try {
        const crops = await Crop.find().sort({ name: 1 });
        res.json(crops);
    } catch (error) {
        res.status(500).json({ message: "Unable to read crops" });
    }
});

app.post("/api/crops", requireAuth, parseCropImage, async (req, res) => {
    const { name, season, soilType, description } = req.body;

    if (typeof name !== "string" || name.trim() === "") {
        await removeUploadedImage(req.file?.filename);
        return res.status(400).json({ message: "Crop name is required" });
    }

    try {
        const crop = await Crop.create({
            name: name.trim(),
            season,
            soilType,
            description,
            imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
        });

        res.status(201).json(crop);
    } catch (error) {
        await removeUploadedImage(req.file?.filename).catch(console.error);
        res.status(500).json({ message: "Unable to create crop" });
    }
});

app.put("/api/crops/:id", requireAuth, parseCropImage, async (req, res) => {
    const { id } = req.params;
    const { name, season, soilType, description } = req.body;

    if (!mongoose.isValidObjectId(id)) {
        await removeUploadedImage(req.file?.filename);
        return res.status(400).json({ message: "Invalid crop id" });
    }

    if (typeof name !== "string" || name.trim() === "") {
        await removeUploadedImage(req.file?.filename);
        return res.status(400).json({ message: "Crop name is required" });
    }

    let crop;
    let previousImageUrl;
    try {
        crop = await Crop.findById(id);

        if (!crop) {
            await removeUploadedImage(req.file?.filename);
            return res.status(404).json({ message: "Crop not found" });
        }

        previousImageUrl = crop.imageUrl;
        crop.name = name.trim();
        crop.season = season;
        crop.soilType = soilType;
        crop.description = description;
        if (req.file) crop.imageUrl = `/uploads/${req.file.filename}`;
        await crop.save();
    } catch (error) {
        await removeUploadedImage(req.file?.filename).catch(console.error);
        res.status(500).json({ message: "Unable to update crop" });
        return;
    }

    if (req.file && previousImageUrl) {
        await removeUploadedImage(previousImageUrl).catch(console.error);
    }
    res.json(crop);
});

app.delete("/api/crops/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid crop id" });
    }

    try {
        const crop = await Crop.findByIdAndDelete(id);

        if (!crop) {
            return res.status(404).json({ message: "Crop not found" });
        }

        await removeUploadedImage(crop.imageUrl).catch(console.error);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Unable to delete crop" });
    }
});

app.get("/api/recommendations", requireAuth, async (req, res) => {
    try {
        const recommendations = await CropRecommendation.find({ user: req.auth.userId })
            .populate("farm", "location state district soilType area");

        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ message: "Unable to read recommendations" });
    }
});

app.post("/api/recommendations", requireAuth, async (req, res) => {
    const {
        farm,
        recommendedCrop,
        suitability,
        temperature,
        rainfall,
        humidity
    } = req.body;

    if (
        !mongoose.isValidObjectId(farm) ||
        typeof recommendedCrop !== "string" ||
        recommendedCrop.trim() === "" ||
        (suitability !== undefined && (!Number.isFinite(Number(suitability)) ||
            Number(suitability) < 0 || Number(suitability) > 100))
    ) {
        return res.status(400).json({
            message: "Farm and recommended crop are required, with a valid suitability score"
        });
    }

    try {
        const ownedFarm = await Farm.findOne({ _id: farm, user: req.auth.userId });

        if (!ownedFarm) {
            return res.status(404).json({ message: "Farm not found" });
        }

        const recommendation = await CropRecommendation.create({
            user: req.auth.userId,
            farm,
            recommendedCrop: recommendedCrop.trim(),
            suitability,
            temperature,
            rainfall,
            humidity
        });

        await recommendation.populate([
            { path: "farm", select: "location state district soilType area" }
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