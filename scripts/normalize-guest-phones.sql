-- One-time: canonical +375XXXXXXXXX phones (demo data had +375-29-... dashes)
UPDATE network_guests
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^375[0-9]{9}$';

UPDATE users
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^375[0-9]{9}$';

UPDATE users
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^7[0-9]{10}$';
