-- Ensure the standard public schema exists before any public.* DDL.
-- Some database restores or minimal templates omit it, which breaks CREATE TABLE public.*.

CREATE SCHEMA IF NOT EXISTS public;
