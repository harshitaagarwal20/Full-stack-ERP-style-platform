SET @db = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'enquiryDate'
    ),
    'SELECT 1',
    'ALTER TABLE `Enquiry` ADD COLUMN `enquiryDate` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'enquiryReceivedBy'
    ),
    'SELECT 1',
    'ALTER TABLE `Enquiry` ADD COLUMN `enquiryReceivedBy` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'modeOfEnquiry'
    ),
    'SELECT 1',
    'ALTER TABLE `Enquiry` ADD COLUMN `modeOfEnquiry` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'notesForProduction'
    ),
    'SELECT 1',
    'ALTER TABLE `Enquiry` ADD COLUMN `notesForProduction` TEXT NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline_dt'
    ),
    'SELECT 1',
    'ALTER TABLE `Enquiry` ADD COLUMN `expectedTimeline_dt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_expectedTimeline = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline'
);
SET @has_expectedTimeline_dt = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline_dt'
);

SET @sql = IF(
  @has_expectedTimeline = 1 AND @has_expectedTimeline_dt = 1,
  'UPDATE `Enquiry`
   SET `expectedTimeline_dt` = CASE
     WHEN `expectedTimeline` REGEXP ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$''
       THEN STR_TO_DATE(`expectedTimeline`, ''%Y-%m-%d'')
     WHEN `expectedTimeline` REGEXP ''^[0-9]{2}-[0-9]{2}-[0-9]{4}$''
       THEN STR_TO_DATE(`expectedTimeline`, ''%d-%m-%Y'')
     ELSE NULL
   END
   WHERE `expectedTimeline_dt` IS NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `Enquiry`
SET
  `enquiryDate` = CASE
    WHEN `remarks` LIKE '%Enquiry Date:%' THEN COALESCE(
      STR_TO_DATE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`remarks`, 'Enquiry Date:', -1), '\n', 1)), '%Y-%m-%d'),
      STR_TO_DATE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`remarks`, 'Enquiry Date:', -1), '\n', 1)), '%d-%m-%Y')
    )
    ELSE `enquiryDate`
  END,
  `enquiryReceivedBy` = CASE
    WHEN `remarks` LIKE '%To Whom Enquiry Is Received:%'
      THEN NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`remarks`, 'To Whom Enquiry Is Received:', -1), '\n', 1)), '')
    ELSE `enquiryReceivedBy`
  END,
  `modeOfEnquiry` = CASE
    WHEN `remarks` LIKE '%Mode of Enquiry:%'
      THEN NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`remarks`, 'Mode of Enquiry:', -1), '\n', 1)), '')
    ELSE `modeOfEnquiry`
  END,
  `notesForProduction` = CASE
    WHEN `remarks` LIKE '%Notes for Production Team:%'
      THEN NULLIF(TRIM(SUBSTRING_INDEX(`remarks`, 'Notes for Production Team:', -1)), '')
    ELSE `notesForProduction`
  END;

SET @has_expectedTimeline = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline'
);
SET @has_expectedTimeline_dt = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline_dt'
);

SET @sql = IF(
  @has_expectedTimeline = 1 AND @has_expectedTimeline_dt = 1,
  'ALTER TABLE `Enquiry` DROP COLUMN `expectedTimeline`, CHANGE COLUMN `expectedTimeline_dt` `expectedTimeline` DATETIME(3) NULL',
  IF(
    @has_expectedTimeline = 0 AND @has_expectedTimeline_dt = 1,
    'ALTER TABLE `Enquiry` CHANGE COLUMN `expectedTimeline_dt` `expectedTimeline` DATETIME(3) NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
