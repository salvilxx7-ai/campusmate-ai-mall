CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(96) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(64),
	`outcome` enum('allowed','denied') NOT NULL,
	`reason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `evaluationCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseType` enum('policy','no_match','product','own_order','cross_user_order') NOT NULL,
	`question` text NOT NULL,
	`expectedIntent` varchar(64) NOT NULL,
	`expectedOutcome` varchar(64) NOT NULL,
	`requiredCitationDocumentId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluationCases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluationRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`intentMatched` int NOT NULL,
	`citationComplete` int NOT NULL,
	`refusalCorrect` int NOT NULL,
	`latencyMs` int NOT NULL,
	`responseSummary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluationRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`tokenVectorJson` json NOT NULL,
	`sourceLabel` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`sourceType` enum('policy','after_sales','faq') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`sourceUrl` varchar(512) NOT NULL,
	`processingStatus` enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`titleSnapshot` varchar(160) NOT NULL,
	`priceCentsSnapshot` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderCode` varchar(32) NOT NULL,
	`status` enum('placed','confirmed','completed','cancelled') NOT NULL DEFAULT 'placed',
	`totalCents` int NOT NULL,
	`isDemo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderCode_unique` UNIQUE(`orderCode`)
);
--> statement-breakpoint
CREATE TABLE `productImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(512) NOT NULL,
	`altText` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `productImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`priceCents` int NOT NULL,
	`condition` enum('excellent','good','fair') NOT NULL,
	`status` enum('active','reserved','archived') NOT NULL DEFAULT 'active',
	`sellerLabel` varchar(80) NOT NULL,
	`isDemo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationCases` ADD CONSTRAINT `eval_cases_citation_doc_fk` FOREIGN KEY (`requiredCitationDocumentId`) REFERENCES `knowledgeDocuments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationRuns` ADD CONSTRAINT `evaluationRuns_caseId_evaluationCases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `evaluationCases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledgeChunks` ADD CONSTRAINT `knowledgeChunks_documentId_knowledgeDocuments_id_fk` FOREIGN KEY (`documentId`) REFERENCES `knowledgeDocuments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD CONSTRAINT `knowledgeDocuments_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productImages` ADD CONSTRAINT `productImages_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_actor_created_idx` ON `auditLogs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_created_idx` ON `auditLogs` (`resourceType`,`resourceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `categories_sort_order_idx` ON `categories` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `evaluation_cases_active_idx` ON `evaluationCases` (`isActive`,`caseType`);--> statement-breakpoint
CREATE INDEX `evaluation_runs_case_created_idx` ON `evaluationRuns` (`caseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `knowledge_chunks_document_idx` ON `knowledgeChunks` (`documentId`,`chunkIndex`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_status_idx` ON `knowledgeDocuments` (`processingStatus`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `product_images_product_sort_idx` ON `productImages` (`productId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `products_category_status_idx` ON `products` (`categoryId`,`status`);--> statement-breakpoint
CREATE INDEX `products_created_at_idx` ON `products` (`createdAt`);
