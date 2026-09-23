# Smart Crop Planning System

## Mock UX Design

Figma Link:
https://school-moss-22946873.figma.site/

This Mock UX demonstrates the application's primary screens,
navigation flow, and major farmer user journeys.

## Database API

The server uses MongoDB through Mongoose. Set `MONGODB_URI` before starting
the server, or use the local default at
`mongodb://127.0.0.1:27017/smart-crop-planning`.

```powershell
$env:MONGODB_URI = "mongodb+srv://<username>:<password>@<cluster>/<database>"
$env:JWT_SECRET = "replace-with-a-long-random-secret"
npm start
```

Authentication endpoints:

- `POST /api/auth/register` creates a user with a hashed password.
- `POST /api/auth/login` returns a one-day bearer token.
- `GET /api/auth/me` returns the authenticated user when sent an
	`Authorization: Bearer <token>` header.

Crop database operations:

- `GET /api/crops` reads all crops from MongoDB.
- `POST /api/crops` writes a crop to MongoDB. Send JSON with a required `name`
	and optional `season`, `soilType`, and `description` fields.
- `PUT /api/crops/:id` updates an existing crop using the same JSON fields.
- `DELETE /api/crops/:id` removes an existing crop from MongoDB.
- `POST /api/recommendations` links a user and their farm to a crop recommendation.
- `GET /api/recommendations` reads recommendations with populated user and farm data.
