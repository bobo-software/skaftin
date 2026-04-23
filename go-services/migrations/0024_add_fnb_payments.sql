-- Migration: Add FNB Payments table
-- Description: Platform-level table for FNB 3D Secure payments (user-centric, not project-based)

CREATE TABLE IF NOT EXISTS public.fnb_payments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  reference VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'Busy', 'paid', 'failed')),
  price DECIMAL(12,2) NOT NULL,
  gateway VARCHAR(50) DEFAULT 'fnb_pay',
  signature TEXT,
  payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for duplicate checks and lookups
CREATE INDEX IF NOT EXISTS idx_fnb_payments_user_id ON public.fnb_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_fnb_payments_reference ON public.fnb_payments(reference);
CREATE INDEX IF NOT EXISTS idx_fnb_payments_status ON public.fnb_payments(status);
CREATE INDEX IF NOT EXISTS idx_fnb_payments_created_at ON public.fnb_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fnb_payments_user_created ON public.fnb_payments(user_id, created_at DESC);

COMMENT ON TABLE public.fnb_payments IS 'Platform-level FNB 3D Secure payment records (user-centric flow)';
