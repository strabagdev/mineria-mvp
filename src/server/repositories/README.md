# Repositories

This layer will contain persistence adapters for application domains such as planning, reports, users, profiles, access, organizations, and audit logs.

Repositories are responsible for database reads and writes only. Today, Supabase remains the active provider, so initial repositories should delegate to the current Supabase clients without changing behavior.

The goal is to keep pages, route handlers, and services from depending directly on Supabase query APIs. In a future migration, this layer can be reimplemented with managed PostgreSQL through AWS RDS, Neon, Drizzle, Prisma, or another PostgreSQL adapter.

