-- Idempotent baseline for supertokens schema (DDL only, no data).
-- Derived from pg_dump; safe on repeated API boot.

CREATE SCHEMA IF NOT EXISTS supertokens;

CREATE TABLE IF NOT EXISTS supertokens.all_auth_recipe_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    primary_or_recipe_user_id character(36) NOT NULL,
    is_linked_or_is_a_primary_user boolean DEFAULT false NOT NULL,
    recipe_id character varying(128) NOT NULL,
    time_joined bigint NOT NULL,
    primary_or_recipe_user_time_joined bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.app_id_to_user_id (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    recipe_id character varying(128) NOT NULL,
    primary_or_recipe_user_id character(36) NOT NULL,
    is_linked_or_is_a_primary_user boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.apps (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    created_at_time bigint
);

CREATE TABLE IF NOT EXISTS supertokens.bulk_import_users (
    id character(36) NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    primary_user_id character varying(36),
    raw_data text NOT NULL,
    status character varying(128) DEFAULT 'NEW'::character varying,
    error_msg text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.dashboard_user_sessions (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    session_id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    time_created bigint NOT NULL,
    expiry bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.dashboard_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256) NOT NULL,
    password_hash character varying(256) NOT NULL,
    time_joined bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.emailpassword_pswd_reset_tokens (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    token character varying(128) NOT NULL,
    email character varying(256),
    token_expiry bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.emailpassword_user_to_tenant (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.emailpassword_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256) NOT NULL,
    password_hash character varying(256) NOT NULL,
    time_joined bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.emailverification_tokens (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    email character varying(256) NOT NULL,
    token character varying(128) NOT NULL,
    token_expiry bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.emailverification_verified_emails (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    email character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.jwt_signing_keys (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    key_id character varying(255) NOT NULL,
    key_string text NOT NULL,
    algorithm character varying(10) NOT NULL,
    created_at bigint
);

CREATE TABLE IF NOT EXISTS supertokens.key_value (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    name character varying(128) NOT NULL,
    value text,
    created_at_time bigint
);

CREATE TABLE IF NOT EXISTS supertokens.oauth_clients (
    app_id character varying(64) NOT NULL,
    client_id character varying(255) NOT NULL,
    client_secret text,
    enable_refresh_token_rotation boolean NOT NULL,
    is_client_credentials_only boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.oauth_logout_challenges (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    challenge character varying(128) NOT NULL,
    client_id character varying(255) NOT NULL,
    post_logout_redirect_uri character varying(1024),
    session_handle character varying(128),
    state character varying(128),
    time_created bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.oauth_m2m_tokens (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    client_id character varying(255) NOT NULL,
    iat bigint NOT NULL,
    exp bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.oauth_sessions (
    gid character varying(255) NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying,
    client_id character varying(255) NOT NULL,
    session_handle character varying(128),
    external_refresh_token character varying(255),
    internal_refresh_token character varying(255),
    jti text NOT NULL,
    exp bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.passwordless_codes (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    code_id character(36) NOT NULL,
    device_id_hash character(44) NOT NULL,
    link_code_hash character(44) NOT NULL,
    created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.passwordless_devices (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    device_id_hash character(44) NOT NULL,
    email character varying(256),
    phone_number character varying(256),
    link_code_salt character(44) NOT NULL,
    failed_attempts integer NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.passwordless_user_to_tenant (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256),
    phone_number character varying(256)
);

CREATE TABLE IF NOT EXISTS supertokens.passwordless_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256),
    phone_number character varying(256),
    time_joined bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.role_permissions (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    role character varying(255) NOT NULL,
    permission character varying(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.roles (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    role character varying(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.session_access_token_signing_keys (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    created_at_time bigint NOT NULL,
    value text
);

CREATE TABLE IF NOT EXISTS supertokens.session_info (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    session_handle character varying(255) NOT NULL,
    user_id character varying(128) NOT NULL,
    refresh_token_hash_2 character varying(128) NOT NULL,
    session_data text,
    expires_at bigint NOT NULL,
    created_at_time bigint NOT NULL,
    jwt_user_payload text,
    use_static_key boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.tenant_configs (
    connection_uri_domain character varying(256) DEFAULT ''::character varying NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    core_config text,
    email_password_enabled boolean,
    passwordless_enabled boolean,
    third_party_enabled boolean,
    is_first_factors_null boolean
);

CREATE TABLE IF NOT EXISTS supertokens.tenant_first_factors (
    connection_uri_domain character varying(256) DEFAULT ''::character varying NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    factor_id character varying(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.tenant_required_secondary_factors (
    connection_uri_domain character varying(256) DEFAULT ''::character varying NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    factor_id character varying(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.tenant_thirdparty_provider_clients (
    connection_uri_domain character varying(256) DEFAULT ''::character varying NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    third_party_id character varying(28) NOT NULL,
    client_type character varying(64) DEFAULT ''::character varying NOT NULL,
    client_id character varying(256) NOT NULL,
    client_secret text,
    scope character varying(128)[],
    force_pkce boolean,
    additional_config text
);

CREATE TABLE IF NOT EXISTS supertokens.tenant_thirdparty_providers (
    connection_uri_domain character varying(256) DEFAULT ''::character varying NOT NULL,
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    third_party_id character varying(28) NOT NULL,
    name character varying(64),
    authorization_endpoint text,
    authorization_endpoint_query_params text,
    token_endpoint text,
    token_endpoint_body_params text,
    user_info_endpoint text,
    user_info_endpoint_query_params text,
    user_info_endpoint_headers text,
    jwks_uri text,
    oidc_discovery_endpoint text,
    require_email boolean,
    user_info_map_from_id_token_payload_user_id character varying(64),
    user_info_map_from_id_token_payload_email character varying(64),
    user_info_map_from_id_token_payload_email_verified character varying(64),
    user_info_map_from_user_info_endpoint_user_id character varying(64),
    user_info_map_from_user_info_endpoint_email character varying(64),
    user_info_map_from_user_info_endpoint_email_verified character varying(64)
);

CREATE TABLE IF NOT EXISTS supertokens.tenants (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    created_at_time bigint
);

CREATE TABLE IF NOT EXISTS supertokens.thirdparty_user_to_tenant (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character(36) NOT NULL,
    third_party_id character varying(28) NOT NULL,
    third_party_user_id character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.thirdparty_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    third_party_id character varying(28) NOT NULL,
    third_party_user_id character varying(256) NOT NULL,
    user_id character(36) NOT NULL,
    email character varying(256) NOT NULL,
    time_joined bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.totp_used_codes (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    code character varying(8) NOT NULL,
    is_valid boolean NOT NULL,
    expiry_time_ms bigint NOT NULL,
    created_time_ms bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.totp_user_devices (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    device_name character varying(256) NOT NULL,
    secret_key character varying(256) NOT NULL,
    period integer NOT NULL,
    skew integer NOT NULL,
    verified boolean NOT NULL,
    created_at bigint
);

CREATE TABLE IF NOT EXISTS supertokens.totp_users (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.user_last_active (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    last_active_time bigint
);

CREATE TABLE IF NOT EXISTS supertokens.user_metadata (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    user_metadata text NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.user_roles (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    tenant_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    user_id character varying(128) NOT NULL,
    role character varying(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS supertokens.userid_mapping (
    app_id character varying(64) DEFAULT 'public'::character varying NOT NULL,
    supertokens_user_id character(36) NOT NULL,
    external_user_id character varying(128) NOT NULL,
    external_user_id_info text
);

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.all_auth_recipe_users
    ADD CONSTRAINT all_auth_recipe_users_pkey PRIMARY KEY (app_id, tenant_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.app_id_to_user_id
    ADD CONSTRAINT app_id_to_user_id_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.apps
    ADD CONSTRAINT apps_pkey PRIMARY KEY (app_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.bulk_import_users
    ADD CONSTRAINT bulk_import_users_pkey PRIMARY KEY (app_id, id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.dashboard_user_sessions
    ADD CONSTRAINT dashboard_user_sessions_pkey PRIMARY KEY (app_id, session_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.dashboard_users
    ADD CONSTRAINT dashboard_users_email_key UNIQUE (app_id, email);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.dashboard_users
    ADD CONSTRAINT dashboard_users_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_pswd_reset_tokens
    ADD CONSTRAINT emailpassword_pswd_reset_tokens_pkey PRIMARY KEY (app_id, user_id, token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_pswd_reset_tokens
    ADD CONSTRAINT emailpassword_pswd_reset_tokens_token_key UNIQUE (token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_user_to_tenant
    ADD CONSTRAINT emailpassword_user_to_tenant_email_key UNIQUE (app_id, tenant_id, email);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_user_to_tenant
    ADD CONSTRAINT emailpassword_user_to_tenant_pkey PRIMARY KEY (app_id, tenant_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_users
    ADD CONSTRAINT emailpassword_users_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailverification_tokens
    ADD CONSTRAINT emailverification_tokens_pkey PRIMARY KEY (app_id, tenant_id, user_id, email, token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailverification_tokens
    ADD CONSTRAINT emailverification_tokens_token_key UNIQUE (token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailverification_verified_emails
    ADD CONSTRAINT emailverification_verified_emails_pkey PRIMARY KEY (app_id, user_id, email);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.jwt_signing_keys
    ADD CONSTRAINT jwt_signing_keys_pkey PRIMARY KEY (app_id, key_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.key_value
    ADD CONSTRAINT key_value_pkey PRIMARY KEY (app_id, tenant_id, name);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (app_id, client_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_logout_challenges
    ADD CONSTRAINT oauth_logout_challenges_pkey PRIMARY KEY (app_id, challenge);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_m2m_tokens
    ADD CONSTRAINT oauth_m2m_tokens_pkey PRIMARY KEY (app_id, client_id, iat);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_sessions
    ADD CONSTRAINT oauth_sessions_external_refresh_token_key UNIQUE (external_refresh_token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_sessions
    ADD CONSTRAINT oauth_sessions_internal_refresh_token_key UNIQUE (internal_refresh_token);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_sessions
    ADD CONSTRAINT oauth_sessions_pkey PRIMARY KEY (gid);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_codes
    ADD CONSTRAINT passwordless_codes_link_code_hash_key UNIQUE (app_id, tenant_id, link_code_hash);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_codes
    ADD CONSTRAINT passwordless_codes_pkey PRIMARY KEY (app_id, tenant_id, code_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_devices
    ADD CONSTRAINT passwordless_devices_pkey PRIMARY KEY (app_id, tenant_id, device_id_hash);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_user_to_tenant
    ADD CONSTRAINT passwordless_user_to_tenant_email_key UNIQUE (app_id, tenant_id, email);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_user_to_tenant
    ADD CONSTRAINT passwordless_user_to_tenant_phone_number_key UNIQUE (app_id, tenant_id, phone_number);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_user_to_tenant
    ADD CONSTRAINT passwordless_user_to_tenant_pkey PRIMARY KEY (app_id, tenant_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_users
    ADD CONSTRAINT passwordless_users_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (app_id, role, permission);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (app_id, role);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.session_access_token_signing_keys
    ADD CONSTRAINT session_access_token_signing_keys_pkey PRIMARY KEY (app_id, created_at_time);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.session_info
    ADD CONSTRAINT session_info_pkey PRIMARY KEY (app_id, tenant_id, session_handle);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_configs
    ADD CONSTRAINT tenant_configs_pkey PRIMARY KEY (connection_uri_domain, app_id, tenant_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_first_factors
    ADD CONSTRAINT tenant_first_factors_pkey PRIMARY KEY (connection_uri_domain, app_id, tenant_id, factor_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_required_secondary_factors
    ADD CONSTRAINT tenant_required_secondary_factors_pkey PRIMARY KEY (connection_uri_domain, app_id, tenant_id, factor_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_thirdparty_provider_clients
    ADD CONSTRAINT tenant_thirdparty_provider_clients_pkey PRIMARY KEY (connection_uri_domain, app_id, tenant_id, third_party_id, client_type);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_thirdparty_providers
    ADD CONSTRAINT tenant_thirdparty_providers_pkey PRIMARY KEY (connection_uri_domain, app_id, tenant_id, third_party_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (app_id, tenant_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.thirdparty_user_to_tenant
    ADD CONSTRAINT thirdparty_user_to_tenant_pkey PRIMARY KEY (app_id, tenant_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.thirdparty_user_to_tenant
    ADD CONSTRAINT thirdparty_user_to_tenant_third_party_user_id_key UNIQUE (app_id, tenant_id, third_party_id, third_party_user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.thirdparty_users
    ADD CONSTRAINT thirdparty_users_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_used_codes
    ADD CONSTRAINT totp_used_codes_pkey PRIMARY KEY (app_id, tenant_id, user_id, created_time_ms);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_user_devices
    ADD CONSTRAINT totp_user_devices_pkey PRIMARY KEY (app_id, user_id, device_name);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_users
    ADD CONSTRAINT totp_users_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_last_active
    ADD CONSTRAINT user_last_active_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_metadata
    ADD CONSTRAINT user_metadata_pkey PRIMARY KEY (app_id, user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (app_id, tenant_id, user_id, role);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.userid_mapping
    ADD CONSTRAINT userid_mapping_external_user_id_key UNIQUE (app_id, external_user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.userid_mapping
    ADD CONSTRAINT userid_mapping_pkey PRIMARY KEY (app_id, supertokens_user_id, external_user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.userid_mapping
    ADD CONSTRAINT userid_mapping_supertokens_user_id_key UNIQUE (app_id, supertokens_user_id);$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS access_token_signing_keys_app_id_index ON supertokens.session_access_token_signing_keys USING btree (app_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_tenant_id_index ON supertokens.all_auth_recipe_users USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_user_app_id_index ON supertokens.all_auth_recipe_users USING btree (app_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_user_id_app_id_index ON supertokens.all_auth_recipe_users USING btree (app_id, user_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_user_id_index ON supertokens.all_auth_recipe_users USING btree (user_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_pagination_index1 ON supertokens.all_auth_recipe_users USING btree (app_id, tenant_id, primary_or_recipe_user_time_joined DESC, primary_or_recipe_user_id DESC);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_pagination_index2 ON supertokens.all_auth_recipe_users USING btree (app_id, tenant_id, primary_or_recipe_user_time_joined, primary_or_recipe_user_id DESC);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_pagination_index3 ON supertokens.all_auth_recipe_users USING btree (recipe_id, app_id, tenant_id, primary_or_recipe_user_time_joined DESC, primary_or_recipe_user_id DESC);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_pagination_index4 ON supertokens.all_auth_recipe_users USING btree (recipe_id, app_id, tenant_id, primary_or_recipe_user_time_joined, primary_or_recipe_user_id DESC);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_primary_user_id_index ON supertokens.all_auth_recipe_users USING btree (primary_or_recipe_user_id, app_id);

CREATE INDEX IF NOT EXISTS all_auth_recipe_users_recipe_id_index ON supertokens.all_auth_recipe_users USING btree (app_id, recipe_id, tenant_id);

CREATE INDEX IF NOT EXISTS app_id_to_user_id_app_id_index ON supertokens.app_id_to_user_id USING btree (app_id);

CREATE INDEX IF NOT EXISTS app_id_to_user_id_primary_user_id_index ON supertokens.app_id_to_user_id USING btree (primary_or_recipe_user_id, app_id);

CREATE INDEX IF NOT EXISTS app_id_to_user_id_user_id_index ON supertokens.app_id_to_user_id USING btree (user_id, app_id);

CREATE INDEX IF NOT EXISTS bulk_import_users_pagination_index1 ON supertokens.bulk_import_users USING btree (app_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS bulk_import_users_pagination_index2 ON supertokens.bulk_import_users USING btree (app_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS bulk_import_users_status_updated_at_index ON supertokens.bulk_import_users USING btree (app_id, status, updated_at);

CREATE INDEX IF NOT EXISTS dashboard_user_sessions_expiry_index ON supertokens.dashboard_user_sessions USING btree (expiry);

CREATE INDEX IF NOT EXISTS dashboard_user_sessions_user_id_index ON supertokens.dashboard_user_sessions USING btree (app_id, user_id);

CREATE INDEX IF NOT EXISTS dashboard_users_app_id_index ON supertokens.dashboard_users USING btree (app_id);

CREATE INDEX IF NOT EXISTS emailpassword_password_reset_token_expiry_index ON supertokens.emailpassword_pswd_reset_tokens USING btree (token_expiry);

CREATE INDEX IF NOT EXISTS emailpassword_pswd_reset_tokens_user_id_index ON supertokens.emailpassword_pswd_reset_tokens USING btree (app_id, user_id);

CREATE INDEX IF NOT EXISTS emailpassword_user_to_tenant_email_index ON supertokens.emailpassword_user_to_tenant USING btree (app_id, tenant_id, email);

CREATE INDEX IF NOT EXISTS emailpassword_users_email_index ON supertokens.emailpassword_users USING btree (app_id, email);

CREATE INDEX IF NOT EXISTS emailverification_tokens_index ON supertokens.emailverification_tokens USING btree (token_expiry);

CREATE INDEX IF NOT EXISTS emailverification_tokens_tenant_id_index ON supertokens.emailverification_tokens USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS emailverification_verified_emails_app_id_index ON supertokens.emailverification_verified_emails USING btree (app_id);

CREATE INDEX IF NOT EXISTS jwt_signing_keys_app_id_index ON supertokens.jwt_signing_keys USING btree (app_id);

CREATE INDEX IF NOT EXISTS key_value_tenant_id_index ON supertokens.key_value USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS oauth_logout_challenges_time_created_index ON supertokens.oauth_logout_challenges USING btree (time_created DESC);

CREATE INDEX IF NOT EXISTS oauth_m2m_token_exp_index ON supertokens.oauth_m2m_tokens USING btree (exp DESC);

CREATE INDEX IF NOT EXISTS oauth_m2m_token_iat_index ON supertokens.oauth_m2m_tokens USING btree (iat DESC, app_id DESC);

CREATE INDEX IF NOT EXISTS oauth_session_exp_index ON supertokens.oauth_sessions USING btree (exp DESC);

CREATE INDEX IF NOT EXISTS oauth_session_external_refresh_token_index ON supertokens.oauth_sessions USING btree (app_id, external_refresh_token DESC);

CREATE INDEX IF NOT EXISTS passwordless_codes_created_at_index ON supertokens.passwordless_codes USING btree (app_id, tenant_id, created_at);

CREATE INDEX IF NOT EXISTS passwordless_codes_device_id_hash_index ON supertokens.passwordless_codes USING btree (app_id, tenant_id, device_id_hash);

CREATE INDEX IF NOT EXISTS passwordless_devices_email_index ON supertokens.passwordless_devices USING btree (app_id, tenant_id, email);

CREATE INDEX IF NOT EXISTS passwordless_devices_phone_number_index ON supertokens.passwordless_devices USING btree (app_id, tenant_id, phone_number);

CREATE INDEX IF NOT EXISTS passwordless_devices_tenant_id_index ON supertokens.passwordless_devices USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS passwordless_user_to_tenant_email_index ON supertokens.passwordless_user_to_tenant USING btree (app_id, tenant_id, email);

CREATE INDEX IF NOT EXISTS passwordless_user_to_tenant_phone_number_index ON supertokens.passwordless_user_to_tenant USING btree (app_id, tenant_id, phone_number);

CREATE INDEX IF NOT EXISTS passwordless_users_email_index ON supertokens.passwordless_users USING btree (app_id, email);

CREATE INDEX IF NOT EXISTS passwordless_users_phone_number_index ON supertokens.passwordless_users USING btree (app_id, phone_number);

CREATE INDEX IF NOT EXISTS role_permissions_permission_index ON supertokens.role_permissions USING btree (app_id, permission);

CREATE INDEX IF NOT EXISTS role_permissions_role_index ON supertokens.role_permissions USING btree (app_id, role);

CREATE INDEX IF NOT EXISTS roles_app_id_index ON supertokens.roles USING btree (app_id);

CREATE INDEX IF NOT EXISTS session_expiry_index ON supertokens.session_info USING btree (expires_at);

CREATE INDEX IF NOT EXISTS session_info_tenant_id_index ON supertokens.session_info USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS session_info_user_id_app_id_index ON supertokens.session_info USING btree (user_id, app_id);

CREATE INDEX IF NOT EXISTS tenant_default_required_factor_ids_tenant_id_index ON supertokens.tenant_required_secondary_factors USING btree (connection_uri_domain, app_id, tenant_id);

CREATE INDEX IF NOT EXISTS tenant_first_factors_tenant_id_index ON supertokens.tenant_first_factors USING btree (connection_uri_domain, app_id, tenant_id);

CREATE INDEX IF NOT EXISTS tenant_thirdparty_provider_clients_third_party_id_index ON supertokens.tenant_thirdparty_provider_clients USING btree (connection_uri_domain, app_id, tenant_id, third_party_id);

CREATE INDEX IF NOT EXISTS tenant_thirdparty_providers_tenant_id_index ON supertokens.tenant_thirdparty_providers USING btree (connection_uri_domain, app_id, tenant_id);

CREATE INDEX IF NOT EXISTS tenants_app_id_index ON supertokens.tenants USING btree (app_id);

CREATE INDEX IF NOT EXISTS thirdparty_user_to_tenant_third_party_user_id_index ON supertokens.thirdparty_user_to_tenant USING btree (app_id, tenant_id, third_party_id, third_party_user_id);

CREATE INDEX IF NOT EXISTS thirdparty_users_email_index ON supertokens.thirdparty_users USING btree (app_id, email);

CREATE INDEX IF NOT EXISTS thirdparty_users_thirdparty_user_id_index ON supertokens.thirdparty_users USING btree (app_id, third_party_id, third_party_user_id);

CREATE INDEX IF NOT EXISTS totp_used_codes_expiry_time_ms_index ON supertokens.totp_used_codes USING btree (app_id, tenant_id, expiry_time_ms);

CREATE INDEX IF NOT EXISTS totp_used_codes_tenant_id_index ON supertokens.totp_used_codes USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS totp_used_codes_user_id_index ON supertokens.totp_used_codes USING btree (app_id, user_id);

CREATE INDEX IF NOT EXISTS totp_user_devices_user_id_index ON supertokens.totp_user_devices USING btree (app_id, user_id);

CREATE INDEX IF NOT EXISTS totp_users_app_id_index ON supertokens.totp_users USING btree (app_id);

CREATE INDEX IF NOT EXISTS user_last_active_app_id_index ON supertokens.user_last_active USING btree (app_id);

CREATE INDEX IF NOT EXISTS user_last_active_last_active_time_index ON supertokens.user_last_active USING btree (last_active_time DESC, app_id DESC);

CREATE INDEX IF NOT EXISTS user_metadata_app_id_index ON supertokens.user_metadata USING btree (app_id);

CREATE INDEX IF NOT EXISTS user_roles_app_id_role_index ON supertokens.user_roles USING btree (app_id, role);

CREATE INDEX IF NOT EXISTS user_roles_role_index ON supertokens.user_roles USING btree (app_id, tenant_id, role);

CREATE INDEX IF NOT EXISTS user_roles_tenant_id_index ON supertokens.user_roles USING btree (app_id, tenant_id);

CREATE INDEX IF NOT EXISTS userid_mapping_supertokens_user_id_index ON supertokens.userid_mapping USING btree (app_id, supertokens_user_id);

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.all_auth_recipe_users
    ADD CONSTRAINT all_auth_recipe_users_primary_or_recipe_user_id_fkey FOREIGN KEY (app_id, primary_or_recipe_user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.all_auth_recipe_users
    ADD CONSTRAINT all_auth_recipe_users_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.all_auth_recipe_users
    ADD CONSTRAINT all_auth_recipe_users_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.app_id_to_user_id
    ADD CONSTRAINT app_id_to_user_id_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.app_id_to_user_id
    ADD CONSTRAINT app_id_to_user_id_primary_or_recipe_user_id_fkey FOREIGN KEY (app_id, primary_or_recipe_user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.bulk_import_users
    ADD CONSTRAINT bulk_import_users_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.dashboard_user_sessions
    ADD CONSTRAINT dashboard_user_sessions_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.dashboard_users(app_id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.dashboard_users
    ADD CONSTRAINT dashboard_users_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_pswd_reset_tokens
    ADD CONSTRAINT emailpassword_pswd_reset_tokens_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_user_to_tenant
    ADD CONSTRAINT emailpassword_user_to_tenant_user_id_fkey FOREIGN KEY (app_id, tenant_id, user_id) REFERENCES supertokens.all_auth_recipe_users(app_id, tenant_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailpassword_users
    ADD CONSTRAINT emailpassword_users_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailverification_tokens
    ADD CONSTRAINT emailverification_tokens_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.emailverification_verified_emails
    ADD CONSTRAINT emailverification_verified_emails_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.jwt_signing_keys
    ADD CONSTRAINT jwt_signing_keys_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.key_value
    ADD CONSTRAINT key_value_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_clients
    ADD CONSTRAINT oauth_clients_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_logout_challenges
    ADD CONSTRAINT oauth_logout_challenges_client_id_fkey FOREIGN KEY (app_id, client_id) REFERENCES supertokens.oauth_clients(app_id, client_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_m2m_tokens
    ADD CONSTRAINT oauth_m2m_tokens_client_id_fkey FOREIGN KEY (app_id, client_id) REFERENCES supertokens.oauth_clients(app_id, client_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.oauth_sessions
    ADD CONSTRAINT oauth_sessions_client_id_fkey FOREIGN KEY (app_id, client_id) REFERENCES supertokens.oauth_clients(app_id, client_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_codes
    ADD CONSTRAINT passwordless_codes_device_id_hash_fkey FOREIGN KEY (app_id, tenant_id, device_id_hash) REFERENCES supertokens.passwordless_devices(app_id, tenant_id, device_id_hash) ON UPDATE CASCADE ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_devices
    ADD CONSTRAINT passwordless_devices_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_user_to_tenant
    ADD CONSTRAINT passwordless_user_to_tenant_user_id_fkey FOREIGN KEY (app_id, tenant_id, user_id) REFERENCES supertokens.all_auth_recipe_users(app_id, tenant_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.passwordless_users
    ADD CONSTRAINT passwordless_users_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.role_permissions
    ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (app_id, role) REFERENCES supertokens.roles(app_id, role) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.roles
    ADD CONSTRAINT roles_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.session_access_token_signing_keys
    ADD CONSTRAINT session_access_token_signing_keys_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.session_info
    ADD CONSTRAINT session_info_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_first_factors
    ADD CONSTRAINT tenant_first_factors_tenant_id_fkey FOREIGN KEY (connection_uri_domain, app_id, tenant_id) REFERENCES supertokens.tenant_configs(connection_uri_domain, app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_required_secondary_factors
    ADD CONSTRAINT tenant_required_secondary_factors_tenant_id_fkey FOREIGN KEY (connection_uri_domain, app_id, tenant_id) REFERENCES supertokens.tenant_configs(connection_uri_domain, app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_thirdparty_provider_clients
    ADD CONSTRAINT tenant_thirdparty_provider_clients_third_party_id_fkey FOREIGN KEY (connection_uri_domain, app_id, tenant_id, third_party_id) REFERENCES supertokens.tenant_thirdparty_providers(connection_uri_domain, app_id, tenant_id, third_party_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenant_thirdparty_providers
    ADD CONSTRAINT tenant_thirdparty_providers_tenant_id_fkey FOREIGN KEY (connection_uri_domain, app_id, tenant_id) REFERENCES supertokens.tenant_configs(connection_uri_domain, app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.tenants
    ADD CONSTRAINT tenants_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.thirdparty_user_to_tenant
    ADD CONSTRAINT thirdparty_user_to_tenant_user_id_fkey FOREIGN KEY (app_id, tenant_id, user_id) REFERENCES supertokens.all_auth_recipe_users(app_id, tenant_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.thirdparty_users
    ADD CONSTRAINT thirdparty_users_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_used_codes
    ADD CONSTRAINT totp_used_codes_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_used_codes
    ADD CONSTRAINT totp_used_codes_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.totp_users(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_user_devices
    ADD CONSTRAINT totp_user_devices_user_id_fkey FOREIGN KEY (app_id, user_id) REFERENCES supertokens.totp_users(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.totp_users
    ADD CONSTRAINT totp_users_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_last_active
    ADD CONSTRAINT user_last_active_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_metadata
    ADD CONSTRAINT user_metadata_app_id_fkey FOREIGN KEY (app_id) REFERENCES supertokens.apps(app_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.user_roles
    ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (app_id, tenant_id) REFERENCES supertokens.tenants(app_id, tenant_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $SUFT$ALTER TABLE ONLY supertokens.userid_mapping
    ADD CONSTRAINT userid_mapping_supertokens_user_id_fkey FOREIGN KEY (app_id, supertokens_user_id) REFERENCES supertokens.app_id_to_user_id(app_id, user_id) ON DELETE CASCADE;$SUFT$;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN SQLSTATE '42P16' THEN NULL;
END $$;

