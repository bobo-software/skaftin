-- public.sms_providers: used by communications + workflows.
-- Keep startup-safe and idempotent for API boot.

CREATE TABLE IF NOT EXISTS public.sms_providers (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    post_url TEXT,
    messaging_service_sid VARCHAR(255),
    phone_number VARCHAR(50),
    whatsapp_from VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_providers_project_id
    ON public.sms_providers(project_id);

CREATE INDEX IF NOT EXISTS idx_sms_providers_active
    ON public.sms_providers(project_id, is_active);
