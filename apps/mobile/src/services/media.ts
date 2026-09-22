import { supabase } from "./supabase";

const BUCKET = "hostel_images";

/**
 * Upload a local photo/video to Supabase Storage, returns the public URL.
 * Requires a public `hostel-images` bucket (Supabase dashboard > Storage).
 */
export async function uploadHostelMedia(localUri: string, folder: "photos" | "videos"): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = localUri.split(".").pop()?.split("?")[0] || (folder === "photos" ? "jpg" : "mp4");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}. Log in as an owner and ensure the '${BUCKET}' bucket exists in Supabase Storage.`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
