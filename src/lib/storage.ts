import {
  uploadRestaurantImage,
  removeRestaurantImage,
} from "@/integrations/firebase/storage.functions";

const MAX_DIMENSION = 1280;
export const RESTAURANT_ASSETS_BUCKET = "restaurant-assets" as const;
export const MENU_IMAGES_BUCKET = "menu-images" as const;

/** Compress + resize an image in the browser before upload. */
export async function compressImage(file: File): Promise<Blob> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function uploadImage(
  bucket: typeof RESTAURANT_ASSETS_BUCKET | typeof MENU_IMAGES_BUCKET,
  restaurantId: string,
  file: File,
  prefix = "img",
): Promise<string> {
  const blob = await compressImage(file);
  const path = `${restaurantId}/${prefix}-${crypto.randomUUID()}.webp`;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const result = await uploadRestaurantImage({
    data: {
      path: `${bucket}/${path}`,
      base64,
      contentType: blob.type as "image/webp" | "image/png" | "image/jpeg",
    },
  });
  return result.url;
}

/** Public restaurant media uses the same URLs in Consumer and Partners. */
export async function signedUrl(reference: string | null): Promise<string | null> {
  return reference?.startsWith("https://") || reference?.startsWith("http://127.0.0.1:")
    ? reference
    : null;
}
export async function deleteImage(reference: string) {
  await removeRestaurantImage({ data: { reference } });
}
