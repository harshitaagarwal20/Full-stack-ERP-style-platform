ALTER TABLE `Enquiry`
  ADD COLUMN `products` JSON NULL AFTER `product`;

UPDATE `Enquiry`
SET `products` = JSON_ARRAY(`product`)
WHERE `products` IS NULL AND `product` IS NOT NULL AND `product` <> '';
