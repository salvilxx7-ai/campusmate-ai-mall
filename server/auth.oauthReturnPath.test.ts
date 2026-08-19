import { describe, expect, it } from "vitest";
import { encodeOAuthState } from "../shared/const";
import { getSafeOAuthReturnPath } from "./_core/oauth";

describe("OAuth return path", () => {
  it("accepts only the two explicit in-app post-login destinations", () => {
    expect(getSafeOAuthReturnPath(encodeOAuthState({ redirectUri: "https://campusmate.example/api/oauth/callback", nonce: "nonce", returnTo: "/profile" }))).toBe("/profile");
    expect(getSafeOAuthReturnPath(encodeOAuthState({ redirectUri: "https://campusmate.example/api/oauth/callback", nonce: "nonce", returnTo: "/admin" }))).toBe("/admin");
  });

  it("falls back to the home page for an omitted or untrusted return target", () => {
    expect(getSafeOAuthReturnPath(encodeOAuthState({ redirectUri: "https://campusmate.example/api/oauth/callback", nonce: "nonce" }))).toBe("/");
    const externalState = Buffer.from(JSON.stringify({ redirectUri: "https://campusmate.example/api/oauth/callback", nonce: "nonce", returnTo: "https://attacker.example" })).toString("base64");
    expect(getSafeOAuthReturnPath(externalState)).toBe("/");
  });
});
