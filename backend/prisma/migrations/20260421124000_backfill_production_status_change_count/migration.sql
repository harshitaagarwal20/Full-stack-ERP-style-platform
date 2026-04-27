UPDATE `Production` AS p
LEFT JOIN (
  SELECT
    `entityId`,
    COUNT(*) AS `statusChangeCount`
  FROM `AuditLog`
  WHERE `action` = 'UPDATE_PRODUCTION'
    AND `entityType` = 'Production'
    AND JSON_UNQUOTE(JSON_EXTRACT(`oldValue`, '$.status')) <> JSON_UNQUOTE(JSON_EXTRACT(`newValue`, '$.status'))
  GROUP BY `entityId`
) AS a
  ON a.`entityId` = p.`id`
SET p.`statusChangeCount` = COALESCE(a.`statusChangeCount`, 0);
