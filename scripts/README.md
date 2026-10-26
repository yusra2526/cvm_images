# Aariz dataset import

The official Aariz archive was downloaded from the repository’s Figshare link:
https://doi.org/10.6084/m9.figshare.27986417.v1

The archive is licensed CC BY 4.0. It contains 1,000 cephalograms split by the authors into train, validation, and test folders, plus annotations. The local copy is kept under `data/` and the 1,000 normalized review images are available as `public/dataset/0001.png` through `public/dataset/1000.png`.

The application uses the normalized files for the reviewer UI. The large archive and clinical image directory are ignored by Git because Vercel deployments should use private object storage (for example, a Supabase Storage bucket) instead of bundling the dataset.