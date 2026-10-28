const request = require("supertest");
const { app } = require("../server");

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
