import {
  index,
  int,
  json,
  foreignKey,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow. The owner is promoted to admin
 * by the auth layer; all business authorization still happens server-side.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    description: varchar("description", { length: 255 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("categories_sort_order_idx").on(table.sortOrder)]
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").notNull().references(() => categories.id),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    priceCents: int("priceCents").notNull(),
    condition: mysqlEnum("condition", ["excellent", "good", "fair"]).notNull(),
    status: mysqlEnum("status", ["active", "reserved", "archived"]).default("active").notNull(),
    sellerLabel: varchar("sellerLabel", { length: 80 }).notNull(),
    isDemo: int("isDemo").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("products_category_status_idx").on(table.categoryId, table.status),
    index("products_created_at_idx").on(table.createdAt),
  ]
);

export const productImages = mysqlTable(
  "productImages",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    url: varchar("url", { length: 512 }).notNull(),
    altText: varchar("altText", { length: 255 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
  },
  table => [index("product_images_product_sort_idx").on(table.productId, table.sortOrder)]
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    orderCode: varchar("orderCode", { length: 32 }).notNull().unique(),
    status: mysqlEnum("status", ["placed", "confirmed", "completed", "cancelled"]).default("placed").notNull(),
    totalCents: int("totalCents").notNull(),
    isDemo: int("isDemo").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("orders_user_created_idx").on(table.userId, table.createdAt)]
);

export const orderItems = mysqlTable(
  "orderItems",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id),
    titleSnapshot: varchar("titleSnapshot", { length: 160 }).notNull(),
    priceCentsSnapshot: int("priceCentsSnapshot").notNull(),
    quantity: int("quantity").default(1).notNull(),
  },
  table => [index("order_items_order_idx").on(table.orderId)]
);

export const knowledgeDocuments = mysqlTable(
  "knowledgeDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["policy", "after_sales", "faq"]).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    sourceUrl: varchar("sourceUrl", { length: 512 }).notNull(),
    processingStatus: mysqlEnum("processingStatus", ["pending", "ready", "failed"]).default("pending").notNull(),
    uploadedByUserId: int("uploadedByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("knowledge_documents_status_idx").on(table.processingStatus)]
);

export const knowledgeChunks = mysqlTable(
  "knowledgeChunks",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("documentId").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: int("chunkIndex").notNull(),
    content: text("content").notNull(),
    tokenVectorJson: json("tokenVectorJson").notNull(),
    sourceLabel: varchar("sourceLabel", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("knowledge_chunks_document_idx").on(table.documentId, table.chunkIndex)]
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id),
    action: varchar("action", { length: 96 }).notNull(),
    resourceType: varchar("resourceType", { length: 64 }).notNull(),
    resourceId: varchar("resourceId", { length: 64 }),
    outcome: mysqlEnum("outcome", ["allowed", "denied"]).notNull(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_resource_created_idx").on(table.resourceType, table.resourceId, table.createdAt),
  ]
);

export const evaluationCases = mysqlTable(
  "evaluationCases",
  {
    id: int("id").autoincrement().primaryKey(),
    caseType: mysqlEnum("caseType", ["policy", "no_match", "product", "own_order", "cross_user_order"]).notNull(),
    question: text("question").notNull(),
    expectedIntent: varchar("expectedIntent", { length: 64 }).notNull(),
    expectedOutcome: varchar("expectedOutcome", { length: 64 }).notNull(),
    requiredCitationDocumentId: int("requiredCitationDocumentId"),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("evaluation_cases_active_idx").on(table.isActive, table.caseType),
    foreignKey({
      columns: [table.requiredCitationDocumentId],
      foreignColumns: [knowledgeDocuments.id],
      name: "eval_cases_citation_doc_fk",
    }),
  ]
);

export const evaluationRuns = mysqlTable(
  "evaluationRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId").notNull().references(() => evaluationCases.id, { onDelete: "cascade" }),
    intentMatched: int("intentMatched").notNull(),
    citationComplete: int("citationComplete").notNull(),
    refusalCorrect: int("refusalCorrect").notNull(),
    latencyMs: int("latencyMs").notNull(),
    responseSummary: text("responseSummary").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("evaluation_runs_case_created_idx").on(table.caseId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
