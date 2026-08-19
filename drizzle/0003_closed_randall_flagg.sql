ALTER TABLE `products` ADD `sellerUserId` int;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_sellerUserId_users_id_fk` FOREIGN KEY (`sellerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `products_seller_status_idx` ON `products` (`sellerUserId`,`status`);
