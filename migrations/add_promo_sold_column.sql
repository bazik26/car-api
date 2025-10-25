-- Migration to add promoSold column
-- This column is for external services and not used in the frontend
-- Default value is false (0)

ALTER TABLE `cars` ADD COLUMN `promoSold` boolean DEFAULT 0;











