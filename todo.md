- resources should be able to be added to multiple categories, need to fix this.

- When a resource status is checked, i'm not sure if it's pulling the correct mapped API field when checking an API resource. I create a resource and give it a certain field and it will check it with unknown status, but when I edit the resource and use the API explorer to map the same exact value mapped field, it will show operational on the first check of the resource, but then when the status check rate interval hits and it does a batch check of all resources, it sets the status back to unknown, i need the batch status check process verified that it's using the correct data for API mapping fields.

- Updating status check rate does not have it's own form button, it's just submitted with the update branding button

- I don't believe error logs are pulling/displaying at all, and the manual refresh button i don't think works right