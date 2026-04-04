# Security Policy

## Supported Versions

At this time, security updates are provided for the latest version on the `main` branch.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Instead, report privately to:
- kevin@muscara.net

Include:
- A clear description of the issue
- Reproduction steps and prerequisites
- Potential impact
- Suggested remediation (if known)

You can expect:
- Acknowledgement within 3 business days
- Initial triage and severity assessment
- Updates on remediation status as fixes are prepared

## Disclosure Process

- Vulnerabilities are investigated privately.
- A fix is prepared and validated.
- Coordinated disclosure is published after a patch is available.

## Security Best Practices for Self-Hosting

- Run behind HTTPS and a trusted reverse proxy.
- Set a strong session secret and avoid defaults.
- Restrict access to admin routes.
- Keep Node.js and dependencies updated.
- Use least-privilege file permissions for database and upload directories.
