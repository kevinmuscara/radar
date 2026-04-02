# API and Integrations

Radar provides integration points for status consumers and automation.

## RSS Feed

Radar exposes an RSS feed at:

- /api/rss

Use this for public status widgets, team subscriptions, or external dashboards.

## API Explorer Workflow

Use API Explorer when setting up API-based checks to inspect JSON structures.

![API explorer](admin/04_api_explorer.png)

Recommended process:

1. Enter API endpoint URL.
2. Inspect discovered fields.
3. Select a status field path.
4. Save field path in resource API config.
5. Test and validate resulting status.

## Bulk Data Integration

Use CSV import for initial migration or recurring sync workflows.

![Bulk import](admin/10_bulk_import.png)