import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdmin } from "./admin.server";
import type { createRepository } from "./repository.server";
type Repository = ReturnType<typeof createRepository>;
async function assertManager(repository: Repository, path: string) {
  if (!/^(restaurant-assets|menu-images)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path))
    throw new Error("Invalid image path.");
  const id = path.split("/")[1]!;
  const result = await repository.from("restaurants").eq("id", id).single();
  if (result.error || !result.data) throw new Error("Forbidden");
  await repository.assertManager(id);
}
export async function storeImage(
  repository: Repository,
  data: { path: string; base64: string; contentType: string },
) {
  await assertManager(repository, data.path);
  const bytes = Buffer.from(data.base64, "base64");
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Choose an image smaller than 2MB.");
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(
    (data.contentType === "image/webp" && webp) ||
    (data.contentType === "image/png" && png) ||
    (data.contentType === "image/jpeg" && jpeg)
  ))
    throw new Error("Upload a valid JPEG, PNG or WebP image.");
  const file = getStorage(getFirebaseAdmin().app).bucket().file(data.path);
  const token = randomUUID();
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: data.contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  // Restaurant/menu photos are public catalogue media, matching the Consumer app.
  const endpoint = process.env["FIREBASE_STORAGE_EMULATOR_HOST"]
    ? `http://${process.env["FIREBASE_STORAGE_EMULATOR_HOST"]}`
    : "https://firebasestorage.googleapis.com";
  return {
    url: `${endpoint}/v0/b/${file.bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`,
  };
}
export async function removeImage(repository: Repository, reference: string) {
  const bucket = getStorage(getFirebaseAdmin().app).bucket();
  let path = reference;
  if (reference.startsWith("https://") || reference.startsWith("http://")) {
    const url = new URL(reference);
    const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (!match || match[1] !== bucket.name) throw new Error("Invalid image reference.");
    path = decodeURIComponent(match[2]!);
  }
  await assertManager(repository, path);
  await bucket.file(path).delete({ ignoreNotFound: true });
}
