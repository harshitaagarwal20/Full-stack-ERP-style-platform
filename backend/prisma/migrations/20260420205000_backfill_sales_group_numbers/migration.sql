UPDATE `Order` o
LEFT JOIN `Enquiry` e ON e.id = o.enquiryId
JOIN (
  SELECT group_key, ROW_NUMBER() OVER (ORDER BY first_created_at, first_id) AS sales_seq
  FROM (
    SELECT
      COALESCE(e2.enquiryNumber, CONCAT('ORDER_', o2.id)) AS group_key,
      MIN(o2.createdAt) AS first_created_at,
      MIN(o2.id) AS first_id
    FROM `Order` o2
    LEFT JOIN `Enquiry` e2 ON e2.id = o2.enquiryId
    GROUP BY COALESCE(e2.enquiryNumber, CONCAT('ORDER_', o2.id))
  ) grouped
) ranked ON ranked.group_key = COALESCE(e.enquiryNumber, CONCAT('ORDER_', o.id))
SET o.salesGroupNumber = CONCAT('SO_', LPAD(ranked.sales_seq, 4, '0'));
