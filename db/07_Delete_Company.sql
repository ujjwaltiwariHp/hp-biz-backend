-- Step 1: Remove package reference from companies
UPDATE companies
SET subscription_package_id = NULL;

-- Step 2: Remove package reference from invoices
UPDATE invoices
SET subscription_package_id = NULL;

-- Step 3: Delete all subscription packages
DELETE FROM subscription_packages;


ALTER SEQUENCE subscription_packages_id_seq RESTART WITH 1;
