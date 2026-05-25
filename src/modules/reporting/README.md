# Reporting Module

Reporting is being encapsulated here as an internal domain module. Existing
routes and imports keep working through compatibility exports in `src/lib/*`.

## Current Inventory

- UI routes: `src/app/(app)/reports/page.tsx` and `src/app/(app)/dashboard/page.tsx`.
- API route: `src/app/api/reports/route.ts`.
- Server service/repository: `src/server/services/reports.service.ts` and
  `src/server/repositories/reports.repository.ts`.
- Compatibility facades: `src/lib/reports.ts` and
  `src/lib/reportsOfflineSnapshot.ts`.
- Offline snapshots: reports catalog, report responses by filter and the
  current admin users snapshot fallback.
- Offline rendering fallback: `src/components/offline-route-content.tsx`.

## Ownership

- `contracts/`: DTOs and response shapes shared by reporting clients and UI.
- `presentation/`: pure formatting, labels and query helpers for report views.
- `offline/`: report snapshot keys and IndexedDB read/write helpers.
- `application/`: reserved for future client orchestration and use cases.

## Compatibility Notes

- Endpoints, response shapes, filters and export behavior are unchanged.
- Legacy imports from `@/lib/reports` and `@/lib/reportsOfflineSnapshot` are
  intentionally preserved.
- Snapshot keys remain unchanged:
  - `reports-catalog-v1`
  - `reports-data-v1-*`
  - `admin-users-v1`

## Pending Work

- Move report page fetch orchestration into `application/` once it can be done
  without changing behavior.
- Align the server `ReportRow` DTO with `contracts/` after validating there is
  no server-only shape drift.
- Extract the `admin-users-v1` snapshot into an admin/users boundary when that
  module exists.
- Add TTL and future scope namespacing at the offline store layer, preserving
  current keys until a formal migration is available.
