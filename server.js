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
const CLIENT_URL =
    process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
const UPLOAD_DIRECTORY = path.join(__dirname, "uploads");
const CLIENT_BUILD_DIRECTORY = path.join(__dirname, "client", "dist");
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
    if (fs.existsSync(path.join(CLIENT_BUILD_DIRECTORY, "index.html"))) {
        return res.sendFile(path.join(CLIENT_BUILD_DIRECTORY, "index.html"));
    }

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
        const recommendations = await CropRecommendation.find()
            .populate("user", "name email phone")
            .populate("farm", "location soilType area");

        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ message: "Unable to read recommendations" });
    }
});

app.post("/api/recommendations", requireAuth, async (req, res) => {
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

app.use(express.static(CLIENT_BUILD_DIRECTORY));

async function startServer() {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be set in production");
    }

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