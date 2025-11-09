-- Apply Performance Indexes to Project Schema
-- Schema: project_shoemaker_1762580517263
-- This file adds indexes to your Taxi Admin project for better performance

-- Set search path to your project schema
SET search_path TO project_shoemaker_1762580517263, public;

BEGIN;

-- ============================================================================
-- ASSOCIATIONS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_associations_user_id 
ON associations(user_id);

CREATE INDEX IF NOT EXISTS idx_associations_created_at 
ON associations(created_at DESC);

-- ============================================================================
-- DRIVERS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_drivers_association_id 
ON drivers(association_id);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id 
ON drivers(user_id);

CREATE INDEX IF NOT EXISTS idx_drivers_status 
ON drivers(status);

CREATE INDEX IF NOT EXISTS idx_drivers_created_at 
ON drivers(created_at DESC);

-- Composite index for common queries (association + status filtering)
CREATE INDEX IF NOT EXISTS idx_drivers_assoc_status 
ON drivers(association_id, status);

-- ============================================================================
-- VEHICLES TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_association_id 
ON vehicles(association_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id 
ON vehicles(driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status 
ON vehicles(status);

CREATE INDEX IF NOT EXISTS idx_vehicles_registration_number 
ON vehicles(registration_number);

CREATE INDEX IF NOT EXISTS idx_vehicles_created_at 
ON vehicles(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vehicles_assoc_status 
ON vehicles(association_id, status);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_status 
ON vehicles(driver_id, status);

-- ============================================================================
-- USERS TABLE INDEXES (if applicable)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC);

-- ============================================================================
-- OTHER COMMON INDEXES
-- ============================================================================

-- Add more based on your specific tables and query patterns
-- Examples:

-- CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
-- CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
-- CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
-- CREATE INDEX IF NOT EXISTS idx_payments_driver_id ON payments(driver_id);

COMMIT;

-- Update table statistics
ANALYZE associations;
ANALYZE drivers;
ANALYZE vehicles;
ANALYZE users;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Performance indexes added to project schema successfully';
  RAISE NOTICE 'ℹ️  Table statistics updated';
  RAISE NOTICE '📊 Query performance should be significantly improved';
END $$;

