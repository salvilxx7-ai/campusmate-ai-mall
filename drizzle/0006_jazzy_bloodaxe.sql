ALTER TABLE `knowledgeDocuments` ADD `contentFingerprint` varchar(64);--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `vectorIndexStatus` enum('pending','syncing','synced','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `vectorIndexVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `vectorIndexError` varchar(255);--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `vectorIndexedAt` timestamp;--> statement-breakpoint
CREATE INDEX `knowledge_documents_vector_status_idx` ON `knowledgeDocuments` (`vectorIndexStatus`,`updatedAt`);