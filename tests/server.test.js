const request = require("supertest");
const jwt = require("jsonwebtoken");
const testJwtSecret = "unit-test-secret-that-is-not-for-production";
process.env.JWT_SECRET = testJwtSecret;
const { app } = require("../server");
const authHeader = `Bearer ${jwt.sign(
    { userId: "test" },
    testJwtSecret
)}`;

describe("API health", () => {
    test("returns the API health message", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            message: "Smart Crop Planning System API is running"
        });
    });
});

describe("authentication", () => {
    test("requires authentication for the current-user endpoint", async () => {
        const response = await request(app).get("/api/auth/me");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
    });

    test("rejects an invalid bearer token", async () => {
        const response = await request(app)
            .get("/api/auth/me")
            .set("Authorization", "Bearer invalid-token");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid or expired token");
    });

    test("rejects registration with missing required fields", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Name, email, and a password of at least 6 characters are required"
        );
    });

    test("rejects registration with a password shorter than six characters", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({ name: "Test Farmer", email: "farmer@example.com", password: "12345" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Name, email, and a password of at least 6 characters are required"
        );
    });

    test("rejects login when email or password is missing", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "farmer@example.com" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email and password are required");
    });
});

describe("AI crop-name suggestions", () => {
    const originalApiKey = process.env.OPENAI_API_KEY;

    afterEach(() => {
        if (originalApiKey === undefined) {
            delete process.env.OPENAI_API_KEY;
        } else {
            process.env.OPENAI_API_KEY = originalApiKey;
        }

        jest.restoreAllMocks();
    });

    test("requires authentication", async () => {
        const response = await request(app)
            .post("/api/ai/crop-suggestions")
            .send({ query: "ma" });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
    });

    test("validates the crop-name prefix", async () => {
        const response = await request(app)
            .post("/api/ai/crop-suggestions")
            .set("Authorization", authHeader)
            .send({ query: "m" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "A crop name query of 2 to 80 characters is required"
        );
    });

    test("reports when the server has no OpenAI API key configured", async () => {
        delete process.env.OPENAI_API_KEY;

        const response = await request(app)
            .post("/api/ai/crop-suggestions")
            .set("Authorization", authHeader)
            .send({ query: "ma" });

        expect(response.status).toBe(503);
        expect(response.body.message).toBe(
            "AI crop suggestions are not configured on this server"
        );
    });

    test("returns normalized suggestions from the OpenAI response", async () => {
        process.env.OPENAI_API_KEY = "test-api-key";
        const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            suggestions: [" maize ", "Maize", "Mango", "Millet", "Manioc", "More"]
                        })
                    }
                }]
            })
        });

        const response = await request(app)
            .post("/api/ai/crop-suggestions")
            .set("Authorization", authHeader)
            .send({ query: "ma", season: "summer", soilType: "loam" });

        expect(response.status).toBe(200);
        expect(response.body.suggestions).toEqual([
            "Maize", "Mango", "Millet", "Manioc", "More"
        ]);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.openai.com/v1/chat/completions",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer test-api-key"
                })
            })
        );
    });

    test("returns an explicit error when the AI provider fails", async () => {
        process.env.OPENAI_API_KEY = "test-api-key";
        jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 429 });
        jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await request(app)
            .post("/api/ai/crop-suggestions")
            .set("Authorization", authHeader)
            .send({ query: "ma" });

        expect(response.status).toBe(502);
        expect(response.body.message).toBe(
            "AI crop suggestions are temporarily unavailable"
        );
    });
});

describe("protected data endpoints", () => {
    test.each([
        ["crop list", "/api/crops"],
        ["recommendation list", "/api/recommendations"]
    ])("requires authentication for the %s endpoint", async (_label, endpoint) => {
        const response = await request(app).get(endpoint);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
    });
});
