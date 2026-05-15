# Auth

This layer will isolate authentication and authorization boundaries. Supabase Auth remains the current provider and must continue to work exactly as it does today.

Auth modules here should eventually wrap session validation, admin user operations, and user identity types so route handlers and services do not call Supabase Auth directly.

This prepares the codebase for future provider or database changes while preserving the existing Supabase Auth behavior until an explicit migration is approved.

