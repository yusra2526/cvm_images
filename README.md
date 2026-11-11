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

Users (scrypt-hashed passwords) and reviews are stored in `data/ceph-fm.json`. Sessions use signed, HTTP-only cookies. Back up that file to keep reviewer progress.

## Deployment

Run it anywhere with a persistent disk (a VM, a container with a volume, or a local machine):

```bash
npm run build
npm start
```

Serverless hosts such as Vercel do not keep files between requests, so accounts and reviews would be lost there.
