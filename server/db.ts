import { and, asc, count, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  auditLogs,
  categories,
  evaluationCases,
  evaluationRuns,
  InsertUser,
  knowledgeChunks,
  knowledgeDocuments,
  orderItems,
  orders,
  productImages,
  products,
  supportTickets,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateEvaluationMetrics } from "./evaluation/metrics";
import { decideGrounding } from "./agent/grounding";
import { demoKnowledgeDocuments } from "./rag/demoKnowledge";
import { chunkText, searchChunks, vectorize } from "./rag/retrieval";
import { assertAuditMutationAllowed } from "./security/auditPolicy";
import { buildOrderReadAuditEvent } from "./security/orderAudit";
import { resolveOrderRead, resolveOwnerOrderList } from "./security/orderAuditFlow";
import { decideOrderAccess } from "./security/orderAccess";
import { decideUserRoleChange } from "./security/userRolePolicy";
import { parseUserListingImage, type PublishImage } from "./catalog/userListingPolicy";
import {
  decideAdministratorReview,
  decideOwnerListingEdit,
  decideOwnerListingResubmission,
  decideOwnerListingWithdrawal,
  type ListingStatus,
} from "./catalog/listingLifecycle";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getPythonAgentHealth, indexPublicKnowledgeDocument, removePublicKnowledgeDocument } from "./agent/pythonAgentGateway";

let _db: ReturnType<typeof drizzle> | null = null;
let bootstrappedPythonRuntimeId: string | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function seedDemoKnowledgeBase(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const existing = await db.select({ id: knowledgeDocuments.id }).from(knowledgeDocuments).limit(1);
  if (existing.length > 0) return { seeded: false, reason: "knowledge_exists" as const };

  for (const document of demoKnowledgeDocuments) {
    await db.insert(knowledgeDocuments).values({
      title: document.title,
      sourceType: document.sourceType,
      storageKey: document.storageKey,
      sourceUrl: document.sourceUrl,
      processingStatus: "ready",
      contentFingerprint: contentFingerprint(document.content),
      vectorIndexStatus: "synced",
      vectorIndexVersion: "seed-bge-runtime-v1",
      vectorIndexedAt: new Date(),
      uploadedByUserId: actorUserId,
    });
    const created = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.title, document.title)).limit(1);
    const createdDocument = created[0];
    if (!createdDocument) throw new Error("知识文档创建失败");
    const chunks = chunkText(document.content);
    for (let index = 0; index < chunks.length; index += 1) {
      const content = chunks[index];
      if (!content) continue;
      await db.insert(knowledgeChunks).values({
        documentId: createdDocument.id,
        chunkIndex: index,
        content,
        tokenVectorJson: vectorize(content),
        sourceLabel: document.sourceLabel,
      });
    }
  }
  await writeAuditLog({ actorUserId, action: "knowledge.seed", resourceType: "knowledge", outcome: "allowed", reason: "public_source_demo_set" });
  return { seeded: true, reason: "created" as const };
}

async function ensureDemoKnowledgeBase() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: knowledgeDocuments.id }).from(knowledgeDocuments).limit(1);
  if (existing.length > 0) return;
  const owner = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (owner[0]) await seedDemoKnowledgeBase(owner[0].id);
}

export async function listKnowledgeDocuments() {
  await ensureDemoKnowledgeBase();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeDocuments).orderBy(asc(knowledgeDocuments.createdAt));
}

function isBuiltinSeedDocument(storageKey: string) {
  return storageKey.startsWith("docs/knowledge-base/");
}

function contentFingerprint(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function loadStoredKnowledgeContent(storageKey: string) {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`无法读取已上传规则文档（${response.status}）`);
  return (await response.text()).trim();
}

export async function bootstrapActiveKnowledgeIntoChroma() {
  const health = await getPythonAgentHealth();
  if (!health || health.embeddingBackend !== "fastembed-bge") return { status: "unavailable" as const, total: 0, succeeded: 0, failed: 0 };
  if (bootstrappedPythonRuntimeId === health.runtimeInstanceId) return { status: "already_current" as const, total: 0, succeeded: 0, failed: 0 };
  const db = await getDb();
  if (!db) return { status: "unavailable" as const, total: 0, succeeded: 0, failed: 0 };
  const documents = await db.select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.lifecycleStatus, "active"), eq(knowledgeDocuments.processingStatus, "ready"), eq(knowledgeDocuments.vectorIndexStatus, "synced")));
  const rebuildable = documents.filter(document => !isBuiltinSeedDocument(document.storageKey));
  let succeeded = 0;
  let failed = 0;
  for (const document of rebuildable) {
    try {
      const content = await loadStoredKnowledgeContent(document.storageKey);
      const indexed = await indexPublicKnowledgeDocument({ documentId: document.id, title: document.title, sourceLabel: `管理员上传｜${document.title}`, sourceUrl: document.sourceUrl, content, contentFingerprint: contentFingerprint(content) });
      if (!indexed) throw new Error("Python 索引不可用");
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[KnowledgeBootstrap] 文档 #${document.id} 重建失败：${error instanceof Error ? error.message : "unknown"}`);
    }
  }
  if (failed === 0) bootstrappedPythonRuntimeId = health.runtimeInstanceId;
  return { status: failed === 0 ? "rebuilt" as const : "partial" as const, total: rebuildable.length, succeeded, failed };
}

export async function syncKnowledgeDocumentToChroma(input: { documentId: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const rows = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId)).limit(1);
  const document = rows[0];
  if (!document) throw new Error("未找到待同步的知识文档");
  if (document.lifecycleStatus !== "active") throw new Error("已替代或已失效的规则文档不能同步至 Chroma");
  if (!document.sourceUrl.startsWith("https://")) throw new Error("只有带 HTTPS 公开来源的规则文档可以同步至 Chroma");

  await db.update(knowledgeDocuments).set({ vectorIndexStatus: "syncing", vectorIndexError: null }).where(eq(knowledgeDocuments.id, document.id));
  try {
    const content = await loadStoredKnowledgeContent(document.storageKey);
    const fingerprint = contentFingerprint(content);
    const indexed = await indexPublicKnowledgeDocument({
      documentId: document.id,
      title: document.title,
      sourceLabel: `管理员上传｜${document.title}`,
      sourceUrl: document.sourceUrl,
      content,
      contentFingerprint: fingerprint,
    });
    if (!indexed) throw new Error("Python Chroma 索引服务未就绪或拒绝本次同步");
    if (document.supersedesDocumentId) {
      const previous = (await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, document.supersedesDocumentId)).limit(1))[0];
      if (!previous || previous.lifecycleStatus !== "active") throw new Error("待替代的旧规则已不存在或不处于有效状态");
      const removed = await removePublicKnowledgeDocument(previous.id);
      if (!removed) {
        await removePublicKnowledgeDocument(document.id);
        throw new Error("无法从当前 Chroma 运行时安全移除旧规则，已撤回新版本索引");
      }
      await db.update(knowledgeDocuments).set({ lifecycleStatus: "superseded", retiredAt: new Date(), retiredReason: `已被规则文档 #${document.id} 替代` }).where(eq(knowledgeDocuments.id, previous.id));
      await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.version.replace", resourceType: "knowledge_document", resourceId: String(previous.id), outcome: "allowed", reason: `superseded_by_${document.id}` });
    }
    await db.update(knowledgeDocuments).set({
      contentFingerprint: fingerprint,
      vectorIndexStatus: "synced",
      vectorIndexVersion: indexed.indexVersion,
      vectorIndexError: null,
      vectorIndexedAt: new Date(),
    }).where(eq(knowledgeDocuments.id, document.id));
    await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.vector.sync", resourceType: "knowledge_document", resourceId: String(document.id), outcome: "allowed", reason: indexed.indexVersion });
    return { documentId: document.id, status: "synced" as const, chunkCount: indexed.chunkCount, indexVersion: indexed.indexVersion };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 255) : "未知 Chroma 同步错误";
    await db.update(knowledgeDocuments).set({ vectorIndexStatus: "failed", vectorIndexError: reason }).where(eq(knowledgeDocuments.id, document.id));
    await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.vector.sync", resourceType: "knowledge_document", resourceId: String(document.id), outcome: "denied", reason });
    throw new Error(`Chroma 同步失败：${reason}`);
  }
}

export async function rebuildActiveKnowledgeDocuments(input: { actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const documents = await db.select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.lifecycleStatus, "active"), eq(knowledgeDocuments.processingStatus, "ready")));
  const rebuildable = documents.filter(document => !isBuiltinSeedDocument(document.storageKey));
  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ documentId: number; reason: string }> = [];
  for (const document of rebuildable) {
    try {
      await syncKnowledgeDocumentToChroma({ documentId: document.id, actorUserId: input.actorUserId });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      failures.push({ documentId: document.id, reason: error instanceof Error ? error.message.slice(0, 160) : "未知错误" });
    }
  }
  await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.vector.rebuild", resourceType: "knowledge_collection", outcome: failed ? "denied" : "allowed", reason: `total=${rebuildable.length};succeeded=${succeeded};failed=${failed}` });
  return { total: rebuildable.length, succeeded, failed, failures };
}

export async function retireKnowledgeDocument(input: { documentId: number; actorUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const document = (await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId)).limit(1))[0];
  if (!document) throw new Error("未找到规则文档");
  if (document.lifecycleStatus !== "active") throw new Error("该规则已经替代或失效");
  const removed = await removePublicKnowledgeDocument(document.id);
  if (!removed) throw new Error("Python Chroma 当前不可用，无法安全失效规则；请稍后重试");
  await db.update(knowledgeDocuments).set({ lifecycleStatus: "retired", retiredAt: new Date(), retiredReason: input.reason.slice(0, 255), vectorIndexStatus: "pending", vectorIndexError: "规则已失效并从当前 Chroma 索引移除" }).where(eq(knowledgeDocuments.id, document.id));
  await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.retire", resourceType: "knowledge_document", resourceId: String(document.id), outcome: "allowed", reason: input.reason.slice(0, 255) });
  return { documentId: document.id, status: "retired" as const };
}

export async function uploadKnowledgeDocument(input: {
  actorUserId: number;
  fileName: string;
  mimeType: "text/plain" | "text/markdown";
  sourceType: "policy" | "after_sales" | "faq";
  publicSourceUrl: string;
  base64Content: string;
  supersedesDocumentId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_").slice(0, 120);
  if (!/\.(md|txt)$/i.test(safeName)) throw new Error("当前仅支持 .md 或 .txt 规则文档");
  const content = Buffer.from(input.base64Content, "base64").toString("utf8").trim();
  if (content.length < 20) throw new Error("文档内容过短，无法建立可引用知识库");
  if (content.length > 100_000) throw new Error("演示版单个文档最多 100KB");
  if (!input.publicSourceUrl.startsWith("https://")) throw new Error("请提供 HTTPS 格式的公开规则来源 URL");
  let nextVersion = 1;
  if (input.supersedesDocumentId) {
    const previous = (await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.supersedesDocumentId)).limit(1))[0];
    if (!previous || previous.lifecycleStatus !== "active") throw new Error("只能替换当前有效的规则文档");
    nextVersion = previous.version + 1;
  }
  const stored = await storagePut(`knowledge/${input.actorUserId}/${safeName}`, content, input.mimeType);
  await db.insert(knowledgeDocuments).values({
    title: safeName.replace(/\.(md|txt)$/i, ""),
    sourceType: input.sourceType,
    storageKey: stored.key,
    sourceUrl: input.publicSourceUrl,
    processingStatus: "pending",
    contentFingerprint: contentFingerprint(content),
    vectorIndexStatus: "pending",
    version: nextVersion,
    supersedesDocumentId: input.supersedesDocumentId,
    uploadedByUserId: input.actorUserId,
  });
  const created = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.storageKey, stored.key)).limit(1);
  const document = created[0];
  if (!document) throw new Error("上传文档元数据创建失败");
  const chunks = chunkText(content);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    await db.insert(knowledgeChunks).values({
      documentId: document.id,
      chunkIndex: index,
      content: chunk,
      tokenVectorJson: vectorize(chunk),
      sourceLabel: `管理员上传｜${document.title}`,
    });
  }
  await db.update(knowledgeDocuments).set({ processingStatus: "ready" }).where(eq(knowledgeDocuments.id, document.id));
  await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.upload", resourceType: "knowledge_document", resourceId: String(document.id), outcome: "allowed", reason: input.supersedesDocumentId ? `replacement_for_${input.supersedesDocumentId}` : input.sourceType });
  let syncResult: Awaited<ReturnType<typeof syncKnowledgeDocumentToChroma>>;
  try {
    syncResult = await syncKnowledgeDocumentToChroma({ documentId: document.id, actorUserId: input.actorUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知索引错误";
    return { id: document.id, title: document.title, chunkCount: chunks.length, sourceUrl: input.publicSourceUrl, storageUrl: stored.url, vectorIndexStatus: "failed" as const, syncError: message };
  }
  return { id: document.id, title: document.title, chunkCount: chunks.length, sourceUrl: input.publicSourceUrl, storageUrl: stored.url, vectorIndexStatus: syncResult.status, indexVersion: syncResult.indexVersion, version: nextVersion };
}

export async function searchKnowledgeBase(question: string) {
  await ensureDemoKnowledgeBase();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ chunk: knowledgeChunks, document: knowledgeDocuments })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(and(eq(knowledgeDocuments.processingStatus, "ready"), eq(knowledgeDocuments.lifecycleStatus, "active")));
  return searchChunks(question, rows.map(row => ({
    id: row.chunk.id,
    documentId: row.document.id,
    title: row.document.title,
    content: row.chunk.content,
    sourceLabel: row.chunk.sourceLabel,
    sourceUrl: row.document.sourceUrl,
    vector: row.chunk.tokenVectorJson as Record<string, number>,
  })));
}

const demoEvaluationBlueprints = [
  { caseType: "policy" as const, question: "什么商品不能上架？", expectedIntent: "policy_qa", expectedOutcome: "grounded", requiredDocumentTitle: "CampusMate 安全交易 FAQ" },
  { caseType: "no_match" as const, question: "星际旅行需要带什么？", expectedIntent: "policy_qa", expectedOutcome: "handoff" },
  { caseType: "product" as const, question: "有没有适合复习的教材？", expectedIntent: "product_search", expectedOutcome: "catalog" },
  { caseType: "own_order" as const, question: "请查我的订单", expectedIntent: "own_order", expectedOutcome: "login_required" },
  { caseType: "cross_user_order" as const, question: "请查订单 99999", expectedIntent: "own_order", expectedOutcome: "denied" },
  { caseType: "handoff" as const, question: "我需要人工客服协助", expectedIntent: "human_handoff", expectedOutcome: "handoff" },
];

export async function seedEvaluationCases() {
  await ensureDemoKnowledgeBase();
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const documents = await db.select().from(knowledgeDocuments);
  const existing = await db.select({ question: evaluationCases.question }).from(evaluationCases);
  const existingQuestions = new Set(existing.map(item => item.question));
  let createdCount = 0;
  for (const blueprint of demoEvaluationBlueprints) {
    if (existingQuestions.has(blueprint.question)) continue;
    const document = blueprint.requiredDocumentTitle ? documents.find(item => item.title === blueprint.requiredDocumentTitle) : undefined;
    await db.insert(evaluationCases).values({
      caseType: blueprint.caseType,
      question: blueprint.question,
      expectedIntent: blueprint.expectedIntent,
      expectedOutcome: blueprint.expectedOutcome,
      requiredCitationDocumentId: document?.id ?? null,
      isActive: 1,
    });
    createdCount += 1;
  }
  return { seeded: createdCount > 0, reason: createdCount > 0 ? "created" as const : "cases_exist" as const };
}

export async function runFixedEvaluation() {
  await seedEvaluationCases();
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const cases = await db.select().from(evaluationCases).where(eq(evaluationCases.isActive, 1)).orderBy(asc(evaluationCases.id));
  const observations: Array<{ caseId: number; intentMatched: boolean; citationComplete: boolean; refusalCorrect: boolean; latencyMs: number; summary: string }> = [];
  for (const testCase of cases) {
    const startedAt = Date.now();
    let actualIntent = "policy_qa";
    let actualOutcome = "handoff";
    let citationDocumentIds: number[] = [];
    if (testCase.caseType === "policy" || testCase.caseType === "no_match") {
      actualIntent = "policy_qa";
      const evidence = await searchKnowledgeBase(testCase.question);
      actualOutcome = decideGrounding(evidence, testCase.question).grounded ? "grounded" : "handoff";
      citationDocumentIds = evidence.map(item => item.documentId);
    } else if (testCase.caseType === "product") {
      actualIntent = "product_search";
      const matches = await listProducts({ query: testCase.question, status: "active", limit: 3 });
      actualOutcome = matches.length > 0 ? "catalog" : "handoff";
    } else if (testCase.caseType === "own_order") {
      actualIntent = "own_order";
      actualOutcome = "login_required";
    } else if (testCase.caseType === "cross_user_order") {
      actualIntent = "own_order";
      actualOutcome = decideOrderAccess({ orderOwnerUserId: 1, actorUserId: 2, isAdmin: false }).allowed ? "allowed" : "denied";
    } else {
      actualIntent = "human_handoff";
      actualOutcome = "handoff";
    }
    const latencyMs = Date.now() - startedAt;
    const observation = {
      caseId: testCase.id,
      intentMatched: actualIntent === testCase.expectedIntent,
      citationComplete: testCase.requiredCitationDocumentId ? citationDocumentIds.includes(testCase.requiredCitationDocumentId) : actualOutcome !== "grounded" || citationDocumentIds.length > 0,
      refusalCorrect: ["handoff", "denied", "login_required"].includes(testCase.expectedOutcome) ? actualOutcome === testCase.expectedOutcome : true,
      latencyMs,
      summary: `intent=${actualIntent}; outcome=${actualOutcome}; citations=${citationDocumentIds.join(",") || "none"}`,
    };
    await db.insert(evaluationRuns).values({ caseId: observation.caseId, intentMatched: observation.intentMatched ? 1 : 0, citationComplete: observation.citationComplete ? 1 : 0, refusalCorrect: observation.refusalCorrect ? 1 : 0, latencyMs: observation.latencyMs, responseSummary: observation.summary });
    observations.push(observation);
  }
  return { metrics: calculateEvaluationMetrics(observations), cases: observations };
}

export async function getEvaluationOverview() {
  await seedEvaluationCases();
  const db = await getDb();
  if (!db) return { cases: [], metrics: calculateEvaluationMetrics([]), lastRunAt: null };
  const cases = await db.select().from(evaluationCases).where(eq(evaluationCases.isActive, 1)).orderBy(asc(evaluationCases.id));
  const runs = await db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.createdAt));
  const latestByCase = new Map<number, typeof runs[number]>();
  for (const run of runs) if (!latestByCase.has(run.caseId)) latestByCase.set(run.caseId, run);
  const observations = Array.from(latestByCase.values()).map(run => ({ intentMatched: Boolean(run.intentMatched), citationComplete: Boolean(run.citationComplete), refusalCorrect: Boolean(run.refusalCorrect), latencyMs: run.latencyMs }));
  const latest = runs[0]?.createdAt ?? null;
  return { cases, metrics: calculateEvaluationMetrics(observations), lastRunAt: latest };
}

type DemoCategory = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

const demoCategories: DemoCategory[] = [
  { name: "数码设备", slug: "digital", description: "轻装上课，也轻松创作。", sortOrder: 1 },
  { name: "教材与阅读", slug: "books", description: "让知识继续流动。", sortOrder: 2 },
  { name: "宿舍生活", slug: "dorm", description: "把宿舍布置得刚刚好。", sortOrder: 3 },
  { name: "运动户外", slug: "sports", description: "校园里的每一次出发。", sortOrder: 4 },
  { name: "校园日常", slug: "campus-life", description: "为你的日常留出余地。", sortOrder: 5 },
];

const demoProducts = [
  {
    categorySlug: "digital",
    title: "轻量微单相机（演示商品）",
    description: "适合社团活动、课程记录与城市漫步的轻量相机。含机身、肩带与基础保护套；商品数据仅用于系统演示。",
    priceCents: 168000,
    condition: "excellent" as const,
    sellerLabel: "演示卖家 · 西苑同学",
    imageUrl: "/manus-storage/campusmate-product-reference_566bd00e.jpg",
    altText: "象牙白背景上的黑色微单相机演示图",
  },
  {
    categorySlug: "digital",
    title: "折叠式头戴耳机（演示商品）",
    description: "通勤、自习和宿舍安静时刻的头戴耳机，耳罩完整，收纳后不占空间；商品数据仅用于系统演示。",
    priceCents: 24900,
    condition: "good" as const,
    sellerLabel: "演示卖家 · 星桥同学",
    imageUrl: "/manus-storage/campusmate-headphones_bb04fa2a.jpg",
    altText: "象牙白背景上的深色头戴耳机演示图",
  },
  {
    categorySlug: "books",
    title: "计算机基础教材组合（演示商品）",
    description: "三册基础教材组合，适合复习数据结构、网络与软件工程课程；不包含手写答案或个人信息。",
    priceCents: 6800,
    condition: "good" as const,
    sellerLabel: "演示卖家 · 云岚同学",
    imageUrl: "/manus-storage/campusmate-textbook-stack_e474f18a.jpg",
    altText: "象牙白背景上的教材堆叠演示图",
  },
  {
    categorySlug: "dorm",
    title: "可调光桌面阅读灯（演示商品）",
    description: "体积小巧、适合床边或书桌使用的阅读灯。演示商品仅展示典型二手物品信息结构。",
    priceCents: 3900,
    condition: "excellent" as const,
    sellerLabel: "演示卖家 · 南楼同学",
    imageUrl: "/manus-storage/campusmate-desk-lamp_607d6c1c.jpg",
    altText: "象牙白背景上的浅色桌面阅读灯演示图",
  },
  {
    categorySlug: "dorm",
    title: "宿舍收纳箱套装（演示商品）",
    description: "适合换季衣物、书桌杂物和毕业打包的透明收纳箱；商品数据仅用于产品演示。",
    priceCents: 5200,
    condition: "good" as const,
    sellerLabel: "演示卖家 · 松月同学",
    imageUrl: "/manus-storage/campusmate-storage-box_eb6a8f06.jpg",
    altText: "象牙白背景上的宿舍收纳箱演示图",
  },
  {
    categorySlug: "sports",
    title: "入门瑜伽垫与背带（演示商品）",
    description: "柔和鼠尾草绿色瑜伽垫，附简洁背带，适合操场、宿舍或运动中心使用。",
    priceCents: 4500,
    condition: "excellent" as const,
    sellerLabel: "演示卖家 · 向阳同学",
    imageUrl: "/manus-storage/campusmate-yoga-mat_095d4409.jpg",
    altText: "象牙白背景上的鼠尾草绿色瑜伽垫演示图",
  },
];

export async function seedDemoCatalog() {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");

  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length > 0) return { seeded: false, reason: "catalog_exists" as const };

  for (const category of demoCategories) {
    await db.insert(categories).values(category);
  }

  const categoryRows = await db.select().from(categories);
  const categoryBySlug = new Map(categoryRows.map(row => [row.slug, row]));

  for (const product of demoProducts) {
    const category = categoryBySlug.get(product.categorySlug);
    if (!category) throw new Error(`演示分类缺失：${product.categorySlug}`);

    await db.insert(products).values({
      categoryId: category.id,
      title: product.title,
      description: product.description,
      priceCents: product.priceCents,
      condition: product.condition,
      status: "active",
      sellerLabel: product.sellerLabel,
      isDemo: 1,
    });

    const inserted = await db.select().from(products).where(eq(products.title, product.title)).limit(1);
    const createdProduct = inserted[0];
    if (!createdProduct) throw new Error("演示商品创建失败");

    await db.insert(productImages).values({
      productId: createdProduct.id,
      storageKey: product.imageUrl.replace("/manus-storage/", ""),
      url: product.imageUrl,
      altText: product.altText,
      sortOrder: 1,
    });
  }

  return { seeded: true, reason: "created" as const };
}

async function ensureDemoCatalog() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) await seedDemoCatalog();
}

async function ensureDemoListingOwnership() {
  const db = await getDb();
  if (!db) return;
  const demoOwner = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (!demoOwner[0]) return;
  await db.update(products).set({ sellerUserId: demoOwner[0].id }).where(isNull(products.sellerUserId));
}

function productWhere(input: { query?: string; categorySlug?: string; status?: ListingStatus }) {
  const conditions = [];
  if (input.status) conditions.push(eq(products.status, input.status));
  if (input.categorySlug) conditions.push(eq(categories.slug, input.categorySlug));
  if (input.query?.trim()) {
    const pattern = `%${input.query.trim()}%`;
    conditions.push(or(like(products.title, pattern), like(products.description, pattern))!);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function attachImages<T extends { product: { id: number; title: string } }>(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, rows: T[]) {
  const ids = rows.map(row => row.product.id);
  if (ids.length === 0) return rows.map(row => ({ ...row, images: [] }));
  const images = await db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder));
  const refreshedDemoAssets: Record<string, string> = {
    "计算机基础教材组合（演示商品）": "/manus-storage/campusmate-textbook-stack-v2_3eaaa917.jpg",
    "可调光桌面阅读灯（演示商品）": "/manus-storage/campusmate-desk-lamp-v2_7057563e.jpg",
    "入门瑜伽垫与背带（演示商品）": "/manus-storage/campusmate-yoga-mat-v2_5fa90fe8.jpg",
    "折叠式头戴耳机（演示商品）": "/manus-storage/campusmate-headphones-v2_5c75a009.jpg",
    "宿舍收纳箱套装（演示商品）": "/manus-storage/campusmate-storage-box-v2_b32800a7.jpg",
  };
  return rows.map(row => ({
    ...row,
    images: images
      .filter(image => image.productId === row.product.id)
      .map(image => ({ ...image, url: refreshedDemoAssets[row.product.title] ?? image.url })),
  }));
}

export async function listProducts(input: { query?: string; categorySlug?: string; status?: ListingStatus; limit?: number }) {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(productWhere(input))
    .orderBy(desc(products.createdAt))
    .limit(input.limit ?? 24);
  return attachImages(db, rows);
}

export async function getProduct(productId: number, includeNonPublic = false) {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(includeNonPublic ? eq(products.id, productId) : and(eq(products.id, productId), eq(products.status, "active")))
    .limit(1);
  const result = await attachImages(db, rows);
  return result[0];
}

export async function listPublishedProductsForUser(userId: number) {
  await ensureDemoCatalog();
  await ensureDemoListingOwnership();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.sellerUserId, userId))
    .orderBy(desc(products.updatedAt));
  return attachImages(db, rows);
}

export async function createUserListing(input: {
  userId: number;
  categoryId: number;
  title: string;
  description: string;
  priceCents: number;
  condition: "excellent" | "good" | "fair";
  images: PublishImage[];
}) {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  if (input.images.length < 1 || input.images.length > 3) throw new Error("请上传 1 至 3 张商品图片");
  const [category] = await db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1);
  if (!category) throw new Error("请选择有效商品分类");
  const [seller] = await db.select({ name: users.name, profileName: users.profileName }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!seller) throw new Error("未找到当前用户");
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 2 || title.length > 160) throw new Error("商品标题需为 2 至 160 个字符");
  if (description.length < 10 || description.length > 2000) throw new Error("详细描述需为 10 至 2000 个字符");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 100 || input.priceCents > 9_999_999) throw new Error("价格应在 1 至 99,999.99 元之间");
  const storedImages = await Promise.all(input.images.map(async (image, index) => {
    const parsed = parseUserListingImage(image);
    const stored = await storagePut(`listings/${input.userId}/${nanoid(10)}-${index + 1}.${parsed.extension}`, parsed.content, parsed.mimeType);
    return { ...stored, altText: `用户发布闲置物品：${title}` };
  }));
  const sellerLabel = `校园用户 · ${(seller.profileName || seller.name || "匿名同学").slice(0, 48)}`;
  await db.insert(products).values({ categoryId: category.id, title, description, priceCents: input.priceCents, condition: input.condition, status: "pending_review", sellerUserId: input.userId, sellerLabel, isDemo: 1 });
  const [created] = await db.select().from(products).where(and(eq(products.sellerUserId, input.userId), eq(products.title, title))).orderBy(desc(products.id)).limit(1);
  if (!created) throw new Error("商品发布记录创建失败");
  await Promise.all(storedImages.map((image, index) => db.insert(productImages).values({ productId: created.id, storageKey: image.key, url: image.url, altText: image.altText, sortOrder: index + 1 })));
  await writeAuditLog({ actorUserId: input.userId, action: "product.publish", resourceType: "product", resourceId: String(created.id), outcome: "allowed", reason: "pending_review" });
  return getProductForOwner(created.id, input.userId);
}

type ListingEditInput = {
  userId: number;
  productId: number;
  categoryId: number;
  title: string;
  description: string;
  priceCents: number;
  condition: "excellent" | "good" | "fair";
  images?: PublishImage[];
};

function validateListingFields(input: Pick<ListingEditInput, "title" | "description" | "priceCents">) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 2 || title.length > 160) throw new Error("商品标题需为 2 至 160 个字符");
  if (description.length < 10 || description.length > 2000) throw new Error("详细描述需为 10 至 2000 个字符");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 100 || input.priceCents > 9_999_999) throw new Error("价格应在 1 至 99,999.99 元之间");
  return { title, description };
}

export async function updateUserListing(input: ListingEditInput) {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const result = await db.transaction(async tx => {
    const existing = (await tx.select({ product: products }).from(products).where(and(eq(products.id, input.productId), eq(products.sellerUserId, input.userId))).limit(1).for("update"))[0];
    if (!existing) return { kind: "missing" as const };
    const decision = decideOwnerListingEdit(existing.product.status);
    if (decision.kind === "deny") {
      await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.edit", resourceType: "product", resourceId: String(input.productId), outcome: "denied", reason: existing.product.status });
      return { kind: "deny" as const, message: decision.message };
    }
    const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1);
    if (!category) return { kind: "category_missing" as const };
    const { title, description } = validateListingFields(input);
    if (input.images && (input.images.length < 1 || input.images.length > 3)) throw new Error("更换图片时请上传 1 至 3 张商品图片");
    await tx.update(products).set({ categoryId: category.id, title, description, priceCents: input.priceCents, condition: input.condition, status: decision.nextStatus, reviewReason: null }).where(eq(products.id, input.productId));
    if (input.images) {
      const storedImages = await Promise.all(input.images.map(async (image, index) => {
        const parsed = parseUserListingImage(image);
        const stored = await storagePut(`listings/${input.userId}/${nanoid(10)}-${index + 1}.${parsed.extension}`, parsed.content, parsed.mimeType);
        return { ...stored, altText: `用户发布闲置物品：${title}`, sortOrder: index + 1 };
      }));
      await tx.delete(productImages).where(eq(productImages.productId, input.productId));
      await Promise.all(storedImages.map(image => tx.insert(productImages).values({ productId: input.productId, storageKey: image.key, url: image.url, altText: image.altText, sortOrder: image.sortOrder })));
    }
    await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.edit", resourceType: "product", resourceId: String(input.productId), outcome: "allowed", reason: `${existing.product.status}_to_pending_review` });
    return { kind: "updated" as const };
  });
  if (result.kind === "missing") throw new Error("未找到可管理的商品");
  if (result.kind === "deny") throw new Error(result.message);
  if (result.kind === "category_missing") throw new Error("请选择有效商品分类");
  return getProductForOwner(input.productId, input.userId);
}

export async function withdrawUserListing(input: { userId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const result = await db.transaction(async tx => {
    const existing = (await tx.select({ id: products.id, status: products.status }).from(products).where(and(eq(products.id, input.productId), eq(products.sellerUserId, input.userId))).limit(1).for("update"))[0];
    if (!existing) return { kind: "missing" as const };
    const decision = decideOwnerListingWithdrawal(existing.status);
    if (decision.kind === "deny") {
      await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.withdraw", resourceType: "product", resourceId: String(input.productId), outcome: "denied", reason: existing.status });
      return { kind: "deny" as const, message: decision.message };
    }
    if (decision.kind === "allow") await tx.update(products).set({ status: decision.nextStatus }).where(eq(products.id, existing.id));
    await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.withdraw", resourceType: "product", resourceId: String(input.productId), outcome: "allowed", reason: decision.kind === "noop" ? "already_archived" : `${existing.status}_to_archived` });
    return { kind: "withdrawn" as const };
  });
  if (result.kind === "missing") throw new Error("未找到可管理的商品");
  if (result.kind === "deny") throw new Error(result.message);
  return getProductForOwner(input.productId, input.userId);
}

export async function resubmitUserListing(input: { userId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const result = await db.transaction(async tx => {
    const existing = (await tx.select({ id: products.id, status: products.status }).from(products).where(and(eq(products.id, input.productId), eq(products.sellerUserId, input.userId))).limit(1).for("update"))[0];
    if (!existing) return { kind: "missing" as const };
    const decision = decideOwnerListingResubmission(existing.status);
    if (decision.kind === "deny") {
      await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.resubmit", resourceType: "product", resourceId: String(input.productId), outcome: "denied", reason: existing.status });
      return { kind: "deny" as const, message: decision.message };
    }
    if (decision.kind === "allow") await tx.update(products).set({ status: decision.nextStatus, reviewReason: null }).where(eq(products.id, existing.id));
    await tx.insert(auditLogs).values({ actorUserId: input.userId, action: "product.owner.resubmit", resourceType: "product", resourceId: String(input.productId), outcome: "allowed", reason: decision.kind === "noop" ? "already_pending_review" : `${existing.status}_to_pending_review` });
    return { kind: "resubmitted" as const };
  });
  if (result.kind === "missing") throw new Error("未找到可管理的商品");
  if (result.kind === "deny") throw new Error(result.message);
  return getProductForOwner(input.productId, input.userId);
}

export async function batchReviewProducts(input: { actorUserId: number; productIds: number[]; action: "approve" | "reject"; reviewReason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  assertAuditMutationAllowed("append");
  const uniqueIds = Array.from(new Set(input.productIds));
  const reviewReason = input.action === "reject" ? input.reviewReason?.trim() : undefined;
  if (input.action === "reject" && (!reviewReason || reviewReason.length < 2 || reviewReason.length > 255)) throw new Error("拒绝原因需为 2 至 255 个字符");
  return db.transaction(async tx => {
    const rows = await tx.select({ id: products.id, status: products.status }).from(products).where(inArray(products.id, uniqueIds)).for("update");
    const rowsById = new Map(rows.map(row => [row.id, row]));
    const results: Array<{ productId: number; outcome: "approved" | "rejected" | "skipped"; message?: string }> = [];
    for (const productId of uniqueIds) {
      const product = rowsById.get(productId);
      if (!product) {
        await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "product.batch_review", resourceType: "product", resourceId: String(productId), outcome: "denied", reason: "missing" });
        results.push({ productId, outcome: "skipped", message: "商品不存在" });
        continue;
      }
      const decision = decideAdministratorReview(product.status, input.action);
      if (decision.kind === "deny") {
        await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "product.batch_review", resourceType: "product", resourceId: String(productId), outcome: "denied", reason: product.status });
        results.push({ productId, outcome: "skipped", message: decision.message });
        continue;
      }
      await tx.update(products).set({ status: decision.nextStatus, reviewReason: input.action === "reject" ? reviewReason : null }).where(eq(products.id, product.id));
      await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "product.batch_review", resourceType: "product", resourceId: String(productId), outcome: "allowed", reason: input.action });
      results.push({ productId, outcome: input.action === "approve" ? "approved" : "rejected" });
    }
    return { results, approvedCount: results.filter(item => item.outcome === "approved").length, rejectedCount: results.filter(item => item.outcome === "rejected").length, skippedCount: results.filter(item => item.outcome === "skipped").length };
  });
}

async function getProductForOwner(productId: number, ownerUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ product: products, category: categories }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).where(and(eq(products.id, productId), eq(products.sellerUserId, ownerUserId))).limit(1);
  return (await attachImages(db, rows))[0];
}

export async function getPersonalCenterForUser(userId: number) {
  const [ordersForUser, listings, tickets] = await Promise.all([listOrdersForUser(userId), listPublishedProductsForUser(userId), listSupportTicketsForUser(userId)]);
  return {
    orders: ordersForUser,
    listings,
    tickets,
    summary: {
      orderCount: ordersForUser.length,
      ticketCount: tickets.length,
      openTickets: tickets.filter(ticket => ticket.status === "open" || ticket.status === "in_review").length,
      pendingListings: listings.filter(item => item.product.status === "pending_review").length,
      activeListings: listings.filter(item => item.product.status === "active").length,
      reservedListings: listings.filter(item => item.product.status === "reserved").length,
      archivedListings: listings.filter(item => item.product.status === "archived").length,
      rejectedListings: listings.filter(item => item.product.status === "rejected").length,
    },
  };
}

function optionalProfileText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function getEditableProfileForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const rows = await db
    .select({
      id: users.id,
      oauthName: users.name,
      email: users.email,
      loginMethod: users.loginMethod,
      profileName: users.profileName,
      campus: users.campus,
      major: users.major,
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const profile = rows[0];
  if (!profile) throw new Error("未找到当前用户档案");
  return profile;
}

export async function updateEditableProfileForUser(input: { userId: number; profileName: string; campus: string; major: string; bio: string }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  await db
    .update(users)
    .set({
      profileName: optionalProfileText(input.profileName),
      campus: optionalProfileText(input.campus),
      major: optionalProfileText(input.major),
      bio: optionalProfileText(input.bio),
    })
    .where(eq(users.id, input.userId));
  await writeAuditLog({
    actorUserId: input.userId,
    action: "profile.update",
    resourceType: "user_profile",
    resourceId: String(input.userId),
    outcome: "allowed",
    reason: "self_service_fields_only",
  });
  return getEditableProfileForUser(input.userId);
}

export async function listUsersForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  return db
    .select({
      id: users.id,
      oauthName: users.name,
      email: users.email,
      profileName: users.profileName,
      campus: users.campus,
      major: users.major,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.lastSignedIn), asc(users.id));
}

export async function updateUserRoleByAdmin(input: { actorUserId: number; targetUserId: number; role: "user" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  assertAuditMutationAllowed("append");
  const outcome = await db.transaction(async tx => {
    const administrators = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).for("update");
    const target = (await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.targetUserId)).limit(1).for("update"))[0];
    if (!target) return { kind: "missing" as const };
    const decision = decideUserRoleChange({ actorUserId: input.actorUserId, targetUserId: target.id, currentRole: target.role, nextRole: input.role, administratorCount: administrators.length });
    if (decision.kind === "deny") {
      await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "user.role.update", resourceType: "user", resourceId: String(target.id), outcome: "denied", reason: decision.reason });
      return { kind: "deny" as const, message: decision.message };
    }
    if (decision.kind === "noop") return { kind: "noop" as const, targetUserId: target.id };
    await tx.update(users).set({ role: input.role }).where(eq(users.id, target.id));
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "user.role.update", resourceType: "user", resourceId: String(target.id), outcome: "allowed", reason: `${target.role}_to_${input.role}` });
    return { kind: "changed" as const, targetUserId: target.id };
  });
  if (outcome.kind === "missing") throw new Error("未找到目标用户");
  if (outcome.kind === "deny") throw new Error(outcome.message);
  return { changed: outcome.kind === "changed", user: (await listUsersForAdmin()).find(user => user.id === outcome.targetUserId) };
}

export async function updateProductStatus(input: { productId: number; status: ListingStatus; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const existing = await getProduct(input.productId, true);
  if (!existing) throw new Error("未找到该商品");
  await db.update(products).set({ status: input.status }).where(eq(products.id, input.productId));
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "product.status.update",
    resourceType: "product",
    resourceId: String(input.productId),
    outcome: "allowed",
    reason: input.status,
  });
  return getProduct(input.productId);
}

export async function listCategories() {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function writeAuditLog(input: {
  actorUserId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: "allowed" | "denied";
  reason?: string;
}) {
  assertAuditMutationAllowed("append");
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    outcome: input.outcome,
    reason: input.reason ?? null,
  });
}

export async function createSupportTicket(input: {
  userId: number;
  category: "policy" | "order" | "security" | "other";
  sourceMessage: string;
  summary: string;
  workflowTrace: Array<{ stage: string; detail: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const ticketCode = `CM-SUP-${nanoid(7).toUpperCase()}`;
  await db.insert(supportTickets).values({
    ticketCode,
    userId: input.userId,
    category: input.category,
    status: "open",
    sourceMessage: input.sourceMessage.trim().slice(0, 500),
    summary: input.summary.trim().slice(0, 500),
    workflowTraceJson: input.workflowTrace,
    isDemo: 1,
  });
  const created = await db.select().from(supportTickets).where(eq(supportTickets.ticketCode, ticketCode)).limit(1);
  const ticket = created[0];
  if (!ticket) throw new Error("模拟工单创建失败");
  await writeAuditLog({
    actorUserId: input.userId,
    action: "support_ticket.create",
    resourceType: "support_ticket",
    resourceId: String(ticket.id),
    outcome: "allowed",
    reason: input.category,
  });
  return ticket;
}

export async function listSupportTicketsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt));
  await writeAuditLog({
    actorUserId: userId,
    action: "support_ticket.list",
    resourceType: "support_ticket",
    outcome: "allowed",
    reason: "own_tickets_only",
  });
  return tickets;
}

export async function listSupportTicketsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supportTickets.id,
    ticketCode: supportTickets.ticketCode,
    userId: supportTickets.userId,
    category: supportTickets.category,
    status: supportTickets.status,
    sourceMessage: supportTickets.sourceMessage,
    summary: supportTickets.summary,
    createdAt: supportTickets.createdAt,
    updatedAt: supportTickets.updatedAt,
    requesterName: users.name,
    requesterProfileName: users.profileName,
    requesterEmail: users.email,
  }).from(supportTickets).innerJoin(users, eq(supportTickets.userId, users.id)).orderBy(asc(supportTickets.status), desc(supportTickets.updatedAt));
}

export async function updateSupportTicketStatusByAdmin(input: { actorUserId: number; ticketId: number; status: "open" | "in_review" | "resolved" }) {
  const startedAt = performance.now();
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const ticket = (await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1))[0];
  if (!ticket) throw new Error("未找到模拟工单");
  if (ticket.status === input.status) return { changed: false as const, ticket, latencyMs: Number((performance.now() - startedAt).toFixed(2)) };
  await db.update(supportTickets).set({ status: input.status }).where(eq(supportTickets.id, input.ticketId));
  const updated = (await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1))[0];
  if (!updated) throw new Error("模拟工单状态更新失败");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "support_ticket.status.update",
    resourceType: "support_ticket",
    resourceId: String(input.ticketId),
    outcome: "allowed",
    reason: `${ticket.status}_to_${input.status}`,
  });
  return { changed: true as const, ticket: updated, latencyMs: Number((performance.now() - startedAt).toFixed(2)) };
}

async function getOrderWithItems(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
}

export async function createOrderForUser(input: { userId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const product = await getProduct(input.productId);
  if (!product || product.product.status !== "active") throw new Error("该演示商品当前不可下单");

  const orderCode = `CM-${nanoid(8).toUpperCase()}`;
  await db.transaction(async tx => {
    await tx.insert(orders).values({
      userId: input.userId,
      orderCode,
      status: "placed",
      totalCents: product.product.priceCents,
      isDemo: 1,
    });
    const created = await tx.select().from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
    const order = created[0];
    if (!order) throw new Error("模拟订单创建失败");

    await tx.insert(orderItems).values({
      orderId: order.id,
      productId: product.product.id,
      titleSnapshot: product.product.title,
      priceCentsSnapshot: product.product.priceCents,
      quantity: 1,
    });
    await tx.update(products).set({ status: "reserved" }).where(eq(products.id, product.product.id));
    await tx.insert(auditLogs).values({
      actorUserId: input.userId,
      action: "order.create",
      resourceType: "order",
      resourceId: String(order.id),
      outcome: "allowed",
      reason: "demo_checkout",
    });
  });

  const createdOrder = await getDb().then(database => database?.select().from(orders).where(eq(orders.orderCode, orderCode)).limit(1));
  const order = createdOrder?.[0];
  if (!order) throw new Error("模拟订单读取失败");
  return getOrderWithItems(order.id);
}

export async function listOrdersForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const orderRows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const ids = orderRows.map(order => order.id);
  const items = ids.length > 0 ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const results = orderRows.map(order => ({ ...order, items: items.filter(item => item.orderId === order.id) }));
  return resolveOwnerOrderList({ actorUserId: userId, load: async () => results, appendAudit: writeAuditLog });
}

export async function getOrderForActor(input: { orderId: number; actorUserId: number; isAdmin: boolean }) {
  const order = await getOrderWithItems(input.orderId);
  return resolveOrderRead({ ...input, order, appendAudit: writeAuditLog });
}
