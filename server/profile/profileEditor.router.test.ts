import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({
  getEditableProfileForUser: vi.fn(),
  getPersonalCenterForUser: vi.fn(),
  updateEditableProfileForUser: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import { profileRouter } from "../routers/profile";

const authenticatedContext: TrpcContext = {
  user: {
    id: 31,
    openId: "profile-owner",
    name: "资料所有者",
    email: "owner@example.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("profile editor ownership boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the authenticated account using server-owned userId", async () => {
    dbMocks.updateEditableProfileForUser.mockResolvedValue({ id: 31, profileName: "新昵称" });
    const caller = profileRouter.createCaller(authenticatedContext);
    await caller.updateMe({ profileName: "新昵称", campus: "浙江万里学院", major: "计算机科学与技术", bio: "校园交换演示资料" });
    expect(dbMocks.updateEditableProfileForUser).toHaveBeenCalledWith({
      userId: 31,
      profileName: "新昵称",
      campus: "浙江万里学院",
      major: "计算机科学与技术",
      bio: "校园交换演示资料",
    });
  });
});
