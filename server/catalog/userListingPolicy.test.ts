import { describe, expect, it } from "vitest";
import { parseUserListingImage } from "./userListingPolicy";

describe("user listing image policy", () => {
  it("accepts a bounded PNG data URL and derives a safe storage extension", () => {
    const image = parseUserListingImage({ name: "教材封面.png", dataUrl: `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}` });
    expect(image.mimeType).toBe("image/png");
    expect(image.extension).toBe("png");
    expect(image.content.toString()).toBe("image-bytes");
  });

  it("rejects unsupported or oversized image content before storage upload", () => {
    expect(() => parseUserListingImage({ name: "bad.gif", dataUrl: "data:image/gif;base64,R0lGODlh" })).toThrow("JPEG、PNG 或 WebP");
    const large = Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64");
    expect(() => parseUserListingImage({ name: "large.jpg", dataUrl: `data:image/jpeg;base64,${large}` })).toThrow("不能超过 2MB");
  });
});
