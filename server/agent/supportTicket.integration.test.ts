import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../../drizzle/schema";
import { createSupportTicket, getDb, listSupportTicketsForUser, updateSupportTicketStatusByAdmin } from "../db";

describe("simulated support-ticket persistence", () => {
  it("stores the handoff record under the authenticated actor and returns only that actor's tickets", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证模拟工单");
    const owner = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const actor = owner[0];
    if (!actor) throw new Error("缺少演示管理员账户");

    const ticket = await createSupportTicket({
      userId: actor.id,
      category: "policy",
      sourceMessage: "星际旅行需要带什么？",
      summary: "知识库无足够依据，建议转人工支持。",
      workflowTrace: [
        { stage: "received", detail: "接收用户问题。" },
        { stage: "handoff_ready", detail: "知识库无足够依据。" },
      ],
    });
    const tickets = await listSupportTicketsForUser(actor.id);

    expect(ticket.userId).toBe(actor.id);
    expect(tickets.some(item => item.id === ticket.id)).toBe(true);
    expect(tickets.every(item => item.userId === actor.id)).toBe(true);

    const transition = await updateSupportTicketStatusByAdmin({ actorUserId: actor.id, ticketId: ticket.id, status: "in_review" });
    expect(transition.changed).toBe(true);
    expect(transition.ticket.status).toBe("in_review");
    expect(transition.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
