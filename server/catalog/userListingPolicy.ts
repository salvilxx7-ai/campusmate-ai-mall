const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PublishImage = { name: string; dataUrl: string };

export function parseUserListingImage(image: PublishImage) {
  const match = image.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("图片仅支持 JPEG、PNG 或 WebP 格式");
  const mimeType = match[1] as keyof typeof imageTypes;
  const content = Buffer.from(match[2]!, "base64");
  if (content.length === 0) throw new Error("图片内容不能为空");
  if (content.length > 2 * 1024 * 1024) throw new Error("单张图片不能超过 2MB");
  const safeName = image.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_").slice(0, 100) || "listing";
  return { content, mimeType, extension: imageTypes[mimeType], safeName };
}
