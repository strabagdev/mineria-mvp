# Services

This layer will contain business workflows and domain rules. Services should orchestrate validation, repository calls, audit writes, and response-shaping logic while avoiding direct Supabase calls.

Supabase remains the provider currently used underneath the repository layer. Services should depend on repository contracts so the application can later move to managed PostgreSQL without rewriting UI, route handlers, or business logic.

Future migrations may replace Supabase persistence with AWS RDS, Neon, Drizzle, Prisma, or another PostgreSQL-backed implementation behind the same service-facing contracts.

