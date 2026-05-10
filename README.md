# Radar

> [!IMPORTANT]
> For anyone who attended BrainStorm 2026 and want to have the prefab resource list to start from, you can access it [here](./West%20Clermont%20Resource%20Export.csv). Keep in mind, by importing this, it will automatically categorize all resources by our category names, you may want to re-organize the categories before bulk importing.
>
> If you wish to support continuous development, please consider [sponsoring](https://buymeacoffee.com/muscara)

![Radar cover](cover.png)

[![BuyMeACoffee](https://raw.githubusercontent.com/pachadotdev/buymeacoffee-badges/main/bmc-donate-yellow.svg)](https://www.buymeacoffee.com/muscara)

Radar is a teacher friendly focused status dashboard for tracking the health of digital resources and infrastructure in one place.

It provides:

- A live dashboard for service status visibility
- Role based administration for super admins and resource managers
- Multiple status check methods (API, scrape, heartbeat, ICMP)
- CSV import/export for bulk management
- Issue reporting and announcement workflows
- RSS feed output for integrations

## Installation & Usage

To deploy Radar for your district, please follow our [Installation](https://github.com/kevinmuscara/radar/wiki/Installation) and [Usage](https://github.com/kevinmuscara/radar/wiki/Getting-Started) guide on the [Wiki](https://github.com/kevinmuscara/radar/wiki)

Docker specific directions [Docker Setup](./docs/docker-setup.md)

## Security Notes

- Change default credentials during setup (or immediately after migration).
- Configure secure session settings and HTTPS before internet exposure.
- Restrict access to admin routes behind your organization network when possible.
- Review [SECURITY.md](SECURITY.md) before deploying publicly.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
