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

## Running the application

Build the React frontend and start the backend from the repository root:

```powershell
npm install
npm run build
npm start
```

Open `http://localhost:3000` for the frontend. The backend serves the built
React app and its API from the same origin. For frontend development with Vite,
run `npm run dev -- --host 0.0.0.0` from `client`; it uses the backend at
`http://localhost:3000` by default.

## Deploying on Render

The root [`render.yaml`](./render.yaml) defines a Node web service, builds the
React client, starts the Express server, and checks `/api/health`. To deploy:

1. Push this repository to GitHub and sign in to Render with the account you
   want to use.
2. In Render, choose **New + > Blueprint**, connect this GitHub repository,
   and apply the Blueprint.
3. Before creating the service, provide `MONGODB_URI` when prompted. Use a
   MongoDB Atlas connection string and ensure the Atlas network access rules
   allow connections from the Render service.
4. Wait for the build and deploy to finish. Open the Render service URL and
   check `/api/health`; it should return the API health message.

The build command is `npm ci && npm --prefix client ci && npm --prefix client
run build`; the start command is `npm start`. The Blueprint generates a
`JWT_SECRET` and sets `NODE_ENV=production`. The server refuses to start in
production if `JWT_SECRET` is missing. `CLIENT_URL` automatically uses
Render's external service URL, but it can be set explicitly if needed.

If Google sign-in is enabled, add `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` as Render environment
variables. Set the Google OAuth authorized redirect URI to
`https://<your-render-service>.onrender.com/api/auth/google/callback`.

Uploaded crop images are saved in the service's local `uploads` directory.
The free web service does not provide persistent disk storage, so those files
can be lost on redeploy or instance replacement. Use a Render plan with a
persistent disk mounted at the upload path or move uploads to persistent
object storage before relying on uploaded images in production.

## Deploying the frontend on Netlify

The root [`netlify.toml`](./netlify.toml) configures the Netlify build and
publishes the Vite frontend from `client/dist`. To deploy:

1. Deploy the backend to Render first and copy its public service URL.
2. In Netlify, choose **Add new site > Import an existing project**, connect
   this GitHub repository, and select the branch to deploy.
3. Set the `VITE_API_URL` environment variable to the Render service URL
   (for example, `https://your-service.onrender.com`, without a trailing
   slash). This is a public API URL, not a secret. Do not put credentials or
   tokens in `VITE_*` variables.
4. Deploy the site. Netlify uses the build command
   `npm ci && npm --prefix client ci && npm --prefix client run build` and the
   publish directory `client/dist`; these are also configured in
   `netlify.toml`.
5. Open the Netlify site URL and verify the frontend loads and can reach the
   Render API. If Google sign-in is enabled, set the Render `CLIENT_URL` to
   the Netlify site URL and ensure the Google OAuth callback URL remains the
   Render backend URL.

The Netlify redirect rule serves the React entry point for frontend routes.
If `VITE_API_URL` is changed in Netlify, trigger a new deploy so Vite can
include the updated value in the frontend build.

## Deployment video walkthrough

For each deployment recording, share the entire screen and keep the camera
on. Use Google Meet with the Kalvium community account if required, record at
least three minutes, and use clear audio without background noise. Show the
Netlify site configuration, successful build/deploy logs, live site URL, and
the app loading. Explain the build command, the `client/dist` publish
directory, and how the frontend's `VITE_API_URL` connects it to the Render
backend. Do not reveal environment variable secrets. Name the recording
`Your name_Squad name_File name` and share the recording so anyone with the
link can edit, as instructed.

For the backend deployment walkthrough, also show the Render Blueprint
settings (without exposing secret values), the live service URL, and
`/api/health`. Explain `npm start`, the MongoDB Atlas connection, generated
JWT secret, and the ephemeral upload storage limitation.

## Bruno API collection

The Bruno collection documenting the server's routes is in
[`bruno/smart-crop-planning-api`](./bruno/smart-crop-planning-api). Open that
folder in Bruno and select the `Local` environment to use
`http://localhost:3000`. See the collection README for authentication,
OAuth, and image-upload instructions.

The collection covers the application root and health check; password and
Google OAuth authentication; crop list, create, update, and delete; crop-image
retrieval; and recommendation list and create.

```powershell
$env:MONGODB_URI = "mongodb+srv://<username>:<password>@<cluster>/<database>"
$env:JWT_SECRET = "replace-with-a-long-random-secret"
$env:GOOGLE_CLIENT_ID = "your-google-client-id"
$env:GOOGLE_CLIENT_SECRET = "your-google-client-secret"
$env:GOOGLE_CALLBACK_URL = "http://localhost:3000/api/auth/google/callback"
$env:CLIENT_URL = "http://localhost:3000"
npm start
```

Authentication endpoints:

- `POST /api/auth/register` creates a user with a hashed password.
- `POST /api/auth/login` returns a one-day bearer token.
- `GET /api/auth/me` returns the authenticated user when sent an
	`Authorization: Bearer <token>` header.
- `GET /api/auth/google` starts Google OAuth and redirects back with the app JWT.
- `GET /api/auth/google/callback` is the OAuth callback. It should be reached
  through Google's redirect after starting the OAuth flow.
- `GET /api/health` returns the API health message.

Create a Google OAuth web application in Google Cloud Console and add the
callback URL above to its authorized redirect URIs before using the Google
button in the client.

Crop database operations:

- `GET /api/crops` reads all crops from MongoDB.
- `POST /api/crops` creates a crop from multipart form data with a required
  `name`, optional `season`, `soilType`, and `description`, and an optional
  `image` file field.
- `PUT /api/crops/:id` updates crop fields and optionally replaces the `image`
  file using multipart form data.
- `DELETE /api/crops/:id` removes an existing crop from MongoDB.
- `GET /uploads/:filename` returns an uploaded crop image to authenticated
  requests.
- Crop images are limited to JPEG, PNG, or WebP and 5 MB. Files are stored in
  the server's `uploads` directory and served from `/uploads` to authenticated
  requests; use persistent disk storage when deploying the server.
- `POST /api/recommendations` links a user and their farm to a crop recommendation.
- `GET /api/recommendations` reads recommendations with populated user and farm data.
- `GET /` redirects to the configured client URL.
