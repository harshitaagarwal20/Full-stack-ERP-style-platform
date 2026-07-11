-- The Enquiry.quantity column was left as INT while schema.prisma declares it
-- Float (to support fractional quantities like 2.5 kg). This silently rounded
-- fractional enquiry quantities on insert. Align the column with the schema.
ALTER TABLE `Enquiry`
MODIFY COLUMN `quantity` DOUBLE NOT NULL;
