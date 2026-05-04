-- Default SuperTokens app/tenant rows (public/public) when 0039 applied DDL-only.
-- Core expects these for EmailPassword and session flows on a fresh database.

INSERT INTO supertokens.apps (app_id, created_at_time)
SELECT 'public', (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
WHERE NOT EXISTS (SELECT 1 FROM supertokens.apps WHERE app_id = 'public');

INSERT INTO supertokens.tenants (app_id, tenant_id, created_at_time)
SELECT 'public', 'public', (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
WHERE NOT EXISTS (
    SELECT 1 FROM supertokens.tenants WHERE app_id = 'public' AND tenant_id = 'public'
);

INSERT INTO supertokens.tenant_configs (
    connection_uri_domain,
    app_id,
    tenant_id,
    core_config,
    email_password_enabled,
    passwordless_enabled,
    third_party_enabled,
    is_first_factors_null
)
SELECT
    ''::varchar,
    'public',
    'public',
    '{}',
    true,
    true,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM supertokens.tenant_configs
    WHERE connection_uri_domain = ''::varchar
      AND app_id = 'public'
      AND tenant_id = 'public'
);
