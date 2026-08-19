ALTER TABLE `knowledgeDocuments` ADD `lifecycleStatus` enum('active','superseded','retired') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `supersedesDocumentId` int;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `retiredAt` timestamp;--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD `retiredReason` varchar(255);--> statement-breakpoint
ALTER TABLE `knowledgeDocuments` ADD CONSTRAINT `knowledge_documents_supersedes_fk` FOREIGN KEY (`supersedesDocumentId`) REFERENCES `knowledgeDocuments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `knowledge_documents_lifecycle_idx` ON `knowledgeDocuments` (`lifecycleStatus`,`processingStatus`,`updatedAt`);