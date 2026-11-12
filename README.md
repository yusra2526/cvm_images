# Ceph-FM

Ceph-FM is a responsive reviewer interface for classifying the cervical region of Aariz cephalograms as **clear** or **unclear**, with reviewer progress and an administrator overview. It has no external database or auth provider.

## Run locally

```bash
npm install
npm run dev
```

On first start an admin account is created from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` (defaults: `kingdomwise11@gmail.com` / `Password123!`). Change the password before real use. The admin creates reviewer accounts from the admin console.

## Aariz images

Images are read directly from the official Aariz release on Figshare (`https://doi.org/10.6084/m9.figshare.27986417.v1`, CC BY 4.0). The release is a single 2.1 GB zip, so the server reads the zip's directory and then fetches each cephalogram with an HTTP range request. Nothing has to be downloaded or uploaded up front.

- All 1,000 cephalograms are numbered 1–1000: train (700), then valid (150), then test (150), sorted by filename within each split.
- Reviewers pick one of four batches of 250 images.
- Each image is cached in `data/aariz-cache/` after its first view. The first view of an image takes a few seconds.

## Accounts and reviews

Users (scrypt-hashed passwords) and reviews are stored in Upstash Redis when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) are set. Otherwise they go in the local file `data/ceph-fm.json`. Sessions use signed, HTTP-only cookies.

## Deploying to Vercel

1. In the Vercel project, open **Storage → Create → Upstash for Redis** (free tier is enough) and connect it to the project. This adds the Redis environment variables.
2. Set `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` and `SESSION_SECRET` (any long random string) in **Settings → Environment Variables**.
3. Redeploy.

On Vercel, images are cached per instance in `/tmp`. Images over Vercel's 4.5 MB response limit are re-encoded as greyscale PNG. This is lossless because the cephalograms are greyscale.

## Self-hosting

Any host with a persistent disk works without Redis:

```bash
npm run build
npm start
```
