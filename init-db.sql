-- Database initialization script for DAKS TOP-K-STOCKS
-- This script grants proper ownership and permissions to the daksuser

-- Create the tables if they don't exist (TypeORM will handle this, but we need proper ownership)
-- First, ensure the user has necessary privileges

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO daksuser;

-- If tables already exist and were created by postgres user, transfer ownership
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tableowner != 'daksuser'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO daksuser', tbl.tablename);
        RAISE NOTICE 'Changed ownership of table % to daksuser', tbl.tablename;
    END LOOP;
END $$;

-- Grant privileges on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO daksuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO daksuser;

-- Ensure future tables are also owned by daksuser
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO daksuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO daksuser;
