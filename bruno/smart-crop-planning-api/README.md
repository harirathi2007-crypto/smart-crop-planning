# Smart Crop Planning API

Open this folder as a Bruno collection and select the `Local` environment.
The default base URL is `http://localhost:3000`.

Register and log in with the sample credentials to get a token, then copy the
token into the environment's `token` variable. Use the returned user ID and a
farm ID belonging to that user for recommendation requests. Set `cropId` to an
existing crop ID before updating or deleting a crop.

The Google OAuth callback request is included for endpoint reference. Do not
call it directly: it is reached by Google after starting the OAuth flow.
Google OAuth requests require the server's Google credentials and callback URL
to be configured.

Crop create and update requests use multipart form data. To upload an image,
add an `image` file field to the request. The server accepts JPEG, PNG, and
WebP images up to 5 MB.

All crop, recommendation, current-user, and uploaded-image requests require a
bearer token. The application root redirects to the configured client URL.
