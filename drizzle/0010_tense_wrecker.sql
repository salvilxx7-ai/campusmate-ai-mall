ALTER TABLE `products` MODIFY COLUMN `status` enum('pending_review','active','reserved','archived','rejected') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `status` ENUM('pending_review','active','reserved','archived','rejected') NOT NULL DEFAULT 'active';
ALTER TABLE `products` ADD `reviewReason` varchar(255);
