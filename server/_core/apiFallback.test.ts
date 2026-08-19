import { describe, expect, it } from "vitest";
import { isApiRequestPath } from "./apiFallback";

describe("API fallback guard", () => {
  it("recognizes tRPC paths even when the page was opened with preview query parameters", () => {
    expect(isApiRequestPath("/api/trpc/admin.users?batch=1&from_webdev=1")).toBe(true);
    expect(isApiRequestPath("/api/trpc?batch=1&input=%7B%7D")).toBe(true);
  });

  it("keeps ordinary application routes eligible for the SPA fallback", () => {
    expect(isApiRequestPath("/admin?from_webdev=1")).toBe(false);
    expect(isApiRequestPath("/profile")).toBe(false);
  });
});
