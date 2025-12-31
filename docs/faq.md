# Frequently Asked Questions

## How can I bulk import my resources?
Create a `template.csv` file with the following header:

```csv
category,resource_name,status_page,check_type,scrape_keywords
```

To add your resources, follow the csv structure above. Reference the table below for the different check types.

| check_type | description |
|---|---|
| api | Query JSON endpoints and validate responses |
| scrape | Extract status from HTML with keyword search |
| heartbeat | Simple monitoring via HTTP response codes |

### Example csv
```csv
category,resource_name,status_page,check_type,scrape_keywords
K-12,Service Name,https://status.example.com/api/v2/summary.json,api,
6-8,Another Service,https://status.another.com,scrape,Operational
K-5,Last Service,https://service.com/,heartbeat,
```

## Services show "Unknown" status

- **Cause**: URL is incorrect, or status check failed from unknown status value.
- **Solution**: Verify the status page URL is correct and accessible, or add web scrape case for custom status value.
- **Check logs**: Review error logs in the admin panel for more clarification.

## Server is slow or unresponsive

- **Cause**: Too many concurrent requests or resource checks taking too long.
- **Solution**: Check rate limiting in logs, increase cache duration, or reduce concurrent requests.
- **Monitor**: Use browser DevTools Network tab to see request patterns.

## Performance Optimizations
For questions related to cache duration, request throttling, auto refresh intervals, or server rate limits, please refer to the [Performance Optimizations Guide](/docs/performance.md). 