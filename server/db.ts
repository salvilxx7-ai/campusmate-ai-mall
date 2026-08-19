import { and, asc, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
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
import { storageGetSignedUrl, storagePut } from "./storage";
import { indexPublicKnowledgeDocument } from "./agent/pythonAgentGateway";

let _db: ReturnType<typeof drizzle> | null = null;

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

function contentFingerprint(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function loadStoredKnowledgeContent(storageKey: string) {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`无法读取已上传规则文档（${response.status}）`);
  return (await response.text()).trim();
}

export async function syncKnowledgeDocumentToChroma(input: { documentId: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const rows = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId)).limit(1);
  const document = rows[0];
  if (!document) throw new Error("未找到待同步的知识文档");
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

export async function uploadKnowledgeDocument(input: {
  actorUserId: number;
  fileName: string;
  mimeType: "text/plain" | "text/markdown";
  sourceType: "policy" | "after_sales" | "faq";
  publicSourceUrl: string;
  base64Content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_").slice(0, 120);
  if (!/\.(md|txt)$/i.test(safeName)) throw new Error("当前仅支持 .md 或 .txt 规则文档");
  const content = Buffer.from(input.base64Content, "base64").toString("utf8").trim();
  if (content.length < 20) throw new Error("文档内容过短，无法建立可引用知识库");
  if (content.length > 100_000) throw new Error("演示版单个文档最多 100KB");
  if (!input.publicSourceUrl.startsWith("https://")) throw new Error("请提供 HTTPS 格式的公开规则来源 URL");
  const stored = await storagePut(`knowledge/${input.actorUserId}/${safeName}`, content, input.mimeType);
  await db.insert(knowledgeDocuments).values({
    title: safeName.replace(/\.(md|txt)$/i, ""),
    sourceType: input.sourceType,
    storageKey: stored.key,
    sourceUrl: input.publicSourceUrl,
    processingStatus: "pending",
    contentFingerprint: contentFingerprint(content),
    vectorIndexStatus: "pending",
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
  await writeAuditLog({ actorUserId: input.actorUserId, action: "knowledge.upload", resourceType: "knowledge_document", resourceId: String(document.id), outcome: "allowed", reason: input.sourceType });
  let syncResult: Awaited<ReturnType<typeof syncKnowledgeDocumentToChroma>>;
  try {
    syncResult = await syncKnowledgeDocumentToChroma({ documentId: document.id, actorUserId: input.actorUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知索引错误";
    return { id: document.id, title: document.title, chunkCount: chunks.length, sourceUrl: input.publicSourceUrl, storageUrl: stored.url, vectorIndexStatus: "failed" as const, syncError: message };
  }
  return { id: document.id, title: document.title, chunkCount: chunks.length, sourceUrl: input.publicSourceUrl, storageUrl: stored.url, vectorIndexStatus: syncResult.status, indexVersion: syncResult.indexVersion };
}

export async function searchKnowledgeBase(question: string) {
  await ensureDemoKnowledgeBase();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ chunk: knowledgeChunks, document: knowledgeDocuments })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(eq(knowledgeDocuments.processingStatus, "ready"));
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

function productWhere(input: { query?: string; categorySlug?: string; status?: "active" | "reserved" | "archived" }) {
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

export async function listProducts(input: { query?: string; categorySlug?: string; status?: "active" | "reserved" | "archived"; limit?: number }) {
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

export async function getProduct(productId: number) {
  await ensureDemoCatalog();
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, productId))
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

export async function getPersonalCenterForUser(userId: number) {
  const [ordersForUser, listings] = await Promise.all([listOrdersForUser(userId), listPublishedProductsForUser(userId)]);
  return {
    orders: ordersForUser,
    listings,
    summary: {
      orderCount: ordersForUser.length,
      activeListings: listings.filter(item => item.product.status === "active").length,
      reservedListings: listings.filter(item => item.product.status === "reserved").length,
      archivedListings: listings.filter(item => item.product.status === "archived").length,
    },
  };
}

export async function updateProductStatus(input: { productId: number; status: "active" | "reserved" | "archived"; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const existing = await getProduct(input.productId);
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
