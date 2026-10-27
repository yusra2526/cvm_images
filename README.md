# Ceph-FM

Ceph-FM is a responsive reviewer interface for classifying the cervical region of Aariz cephalograms as **clear** or **unclear**, with reviewer progress and an administrator overview.

## Run locally

```bash
npm install
npm run dev
```

The UI includes a working local demo mode. Reviewer progress and accounts are stored in the browser until Supabase is connected. Admin login uses `kingdomwise11@gmail.com` / `Password123!` as requested; change this before production use.

## Aariz dataset

The official Aariz dataset was downloaded from the upstream repository’s Figshare release, `https://doi.org/10.6084/m9.figshare.27986417.v1`, and verified against the published MD5 checksum. The workspace now contains all 1,000 normalized review images at `public/dataset/0001.png` through `public/dataset/1000.png`, with the original archive and annotations under `data/`.

The dataset is licensed CC BY 4.0. The archive and images are excluded from Git by `.gitignore`; use private Supabase Storage for a production Vercel deployment.

## Vercel

Import the repository into Vercel, set the variables in `.env.example`, and configure Supabase using `supabase/schema.sql`. Vercel should not bundle the 2.1 GB archive or the clinical image directory; upload the normalized images to a private storage bucket and update the app’s image URLs for production.
## Production deployment

The production app uses Supabase for authentication, reviewer progress, admin actions, statistics, and private image storage.

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. In Supabase Authentication, create the initial admin user with `kingdomwise11@gmail.com` and a new strong password.
3. Add that user to `profiles` with role `admin` and active `true` using its Auth user ID.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
5. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment and never expose it to browser code.
6. Upload the local dataset and create image rows with `npm run seed:dataset` after setting the same variables and service key locally.
7. Push the project to GitHub, import it into Vercel, and add the three Supabase variables to Production, Preview, and Development as needed.
8. Redeploy after changing environment variables.

The seed command uploads `public/dataset/0001.png` through `1000.png` to the private `cephalograms` bucket and inserts the corresponding `cephalograms` rows. The admin API uses the service role only on the server to create reviewer accounts, reset passwords, reset reviews, and calculate shared statistics.