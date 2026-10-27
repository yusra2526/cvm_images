import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

try {
  const envFile = await fs.readFile(path.resolve(".env.local"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // Environment variables may be provided directly by the shell or CI.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or the shell first.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const datasetDir = path.resolve("public", "dataset");
const files = (await fs.readdir(datasetDir)).filter((file) => /^\d{4}\.png$/.test(file)).sort();
if (files.length !== 1000) throw new Error(`Expected 1000 normalized images, found ${files.length}.`);

for (const [index, file] of files.entries()) {
  const body = await fs.readFile(path.join(datasetDir, file));
  const { error: uploadError } = await supabase.storage.from("cephalograms").upload(file, body, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;
  const { error: rowError } = await supabase.from("cephalograms").upsert({ id: index + 1, title: `Aariz cephalogram ${file.slice(0, 4)}`, storage_path: file }, { onConflict: "id" });
  if (rowError) throw rowError;
  if ((index + 1) % 25 === 0) console.log(`Seeded ${index + 1}/1000 images`);
}
console.log("Aariz dataset upload complete.");
