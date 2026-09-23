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
$env:GOOGLE_CLIENT_ID = "your-google-client-id"
$env:GOOGLE_CLIENT_SECRET = "your-google-client-secret"
$env:GOOGLE_CALLBACK_URL = "http://localhost:3000/api/auth/google/callback"
$env:CLIENT_URL = "http://localhost:5173"
npm start
```

Authentication endpoints:

- `POST /api/auth/register` creates a user with a hashed password.
- `POST /api/auth/login` returns a one-day bearer token.
- `GET /api/auth/me` returns the authenticated user when sent an
	`Authorization: Bearer <token>` header.
- `GET /api/auth/google` starts Google OAuth and redirects back with the app JWT.

Create a Google OAuth web application in Google Cloud Console and add the
callback URL above to its authorized redirect URIs before using the Google
button in the client.

Crop database operations:

- `GET /api/crops` reads all crops from MongoDB.
- `POST /api/crops` writes a crop to MongoDB. Send JSON with a required `name`
	and optional `season`, `soilType`, and `description` fields.
- `PUT /api/crops/:id` updates an existing crop using the same JSON fields.
- `DELETE /api/crops/:id` removes an existing crop from MongoDB.
- `POST /api/recommendations` links a user and their farm to a crop recommendation.
- `GET /api/recommendations` reads recommendations with populated user and farm data.
