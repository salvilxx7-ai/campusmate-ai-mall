CREATE TABLE `supportTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketCode` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`category` enum('policy','order','security','other') NOT NULL,
	`status` enum('open','in_review','resolved') NOT NULL DEFAULT 'open',
	`sourceMessage` text NOT NULL,
	`summary` varchar(500) NOT NULL,
	`workflowTraceJson` json NOT NULL,
	`isDemo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportTickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `supportTickets_ticketCode_unique` UNIQUE(`ticketCode`)
);
--> statement-breakpoint
ALTER TABLE `supportTickets` ADD CONSTRAINT `supportTickets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `support_tickets_user_created_idx` ON `supportTickets` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_created_idx` ON `supportTickets` (`status`,`createdAt`);