-- Use placeholder service with labeled text — clearly indicates "rai for real upload"
-- placehold.co generates colored placeholder images with custom text

UPDATE properties SET
  master_plan_url = 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+Baan+Issara%0A(upload+real+site+plan+here)'
WHERE name = 'Baan Issara';

UPDATE properties SET
  master_plan_url = 'https://placehold.co/1600x900/fef3c7/92400e?text=Master+Plan+%E2%80%94+Sasara+Hua+Hin%0A(upload+real+site+plan+here)'
WHERE name = 'Sasara Hua Hin';

UPDATE properties SET
  master_plan_url = 'https://placehold.co/1600x900/dcfce7/166534?text=Master+Plan+%E2%80%94+The+Issara+Chiang+Mai%0A(upload+real+site+plan+here)'
WHERE name = 'The Issara Chiang Mai';
