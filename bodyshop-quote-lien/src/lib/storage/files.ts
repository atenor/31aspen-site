import fs from "fs/promises";
import path from "path";

function getBaseDir() {
  return process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

export async function saveFileBuffer(relativePath: string, data: Buffer) {
  const full = path.join(getBaseDir(), relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return `/uploads/${relativePath}`;
}

export async function saveBase64Image(relativePath: string, base64Data: string) {
  const cleaned = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
  const buffer = Buffer.from(cleaned, "base64");
  return saveFileBuffer(relativePath, buffer);
}
