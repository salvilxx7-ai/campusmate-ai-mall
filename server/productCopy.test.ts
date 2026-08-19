import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const productUiFiles = [
  new URL("../client/src/components/SiteHeader.tsx", import.meta.url),
  new URL("../client/src/pages/Admin.tsx", import.meta.url),
  new URL("../client/src/pages/Evaluation.tsx", import.meta.url),
  new URL("../client/src/pages/ProjectGuide.tsx", import.meta.url),
  new URL("../client/src/pages/PublishItem.tsx", import.meta.url),
];

describe("product-facing copy", () => {
  it("keeps interview-oriented language out of delivered product pages", async () => {
    const source = (await Promise.all(productUiFiles.map(file => readFile(file, "utf8")))).join("\n");
    for (const forbidden of ["面试", "简历", "作品集", "答辩", "复盘", "评测"]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain("服务说明");
    expect(source).toContain("质量监控");
  });
});
