# Export Providers

Reporting and document export providers should live here when external delivery
is introduced.

Examples:

- CSV or Excel file generation.
- Power BI dataset refresh or push APIs.
- SharePoint or document repository upload.
- ERP/API handoff for production, shift or activity data.

Export providers should receive stable DTOs from domain modules and return
provider-neutral `IntegrationResult` values.
