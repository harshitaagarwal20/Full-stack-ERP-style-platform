-- Lets a JWT be invalidated the moment its holder's password is changed,
-- instead of staying valid for up to 30 more days after a reset meant to
-- cut off a compromised session.
ALTER TABLE `User`
ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;
