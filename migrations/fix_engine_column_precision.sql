-- Migration to fix engine column precision
-- The engine column was defined as decimal(3,1) which only allows values up to 99.9
-- Engine displacement values can be much larger (e.g., 2151cc = 2.151L)
-- Changing to decimal(5,1) to allow values up to 9999.9

ALTER TABLE `cars` MODIFY COLUMN `engine` decimal(5,1) DEFAULT NULL;
