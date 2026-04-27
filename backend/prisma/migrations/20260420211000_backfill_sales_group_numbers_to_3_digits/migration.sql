UPDATE `Order`
SET `salesGroupNumber` = CONCAT('SO_', LPAD(CAST(REPLACE(REPLACE(`salesGroupNumber`, 'SO_', ''), 'SO-', '') AS UNSIGNED), 3, '0'))
WHERE `salesGroupNumber` IS NOT NULL AND `salesGroupNumber` <> '';
