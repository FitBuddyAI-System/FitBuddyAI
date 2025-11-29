# Security Policy for FitBuddyAI

Thank you for caring about the security of FitBuddyAI. This document explains how to report security issues, what information to include when reporting, and how we handle disclosures.

## Scope
This policy covers security issues in the FitBuddyAI repository:
- Frontend web application built with React + TypeScript and Vite
- Local JSON data under `src/data/exercises/`
- Client-side utilities such as `src/utils/savedNames.ts` and `src/utils/savedLibrary.ts`
- Build and dev tooling (Vite, npm scripts)
- CI/CD configuration in `.github/` (Dependabot, workflows)

It does NOT cover third-party services that host or integrate with this project (e.g., Google Gemini API accounts, hosting infrastructure). If the issue involves a third-party service, please include details and we will coordinate appropriately.

## Reporting a Vulnerability
If you believe you've found a security vulnerability in this project, please report it privately to the maintainers by email.

Preferred reporting options (in order):
1. Email: fitbuddyaig@gmail.com 
2. Create a GitHub issue / disclosure to the repository owner

When reporting, please include:
- A short, clear summary of the issue
- Steps to reproduce (minimum reproducible example if possible)
- Expected behavior vs. actual behavior
- Severity and potential impact (e.g., remote code execution, data leakage, XSS)
- Any logs, screenshots, stack traces, or demo URLs
- Exact Git commit/branch and environment (Node version, OS, browser)

Do NOT include any sensitive data (API keys, credentials, personal data) in public reports. If you need to share sensitive artifacts, encrypt them with our PGP key (see below) or use a secure channel.

## PGP / Encryption
If you want to send sensitive files, please encrypt them with the project's PGP key. (Placeholder for PGP Key)

## Response and Disclosure Timeline
We aim to respond to vulnerability reports as follows:
- Acknowledge receipt within 72 hours
- Initial triage within 7 calendar days
- Provide status updates every 7 days while the issue is being investigated and fixed
- Coordinate a public disclosure timeline with the reporter; standard disclosure target is 90 days from the initial report if a fix is available sooner

We will follow coordinated disclosure practices and will not publish public details about the vulnerability until an agreed-upon fix or mitigation is available.

## Severity Classification
We use a simple classification to prioritize work:
- Critical: Remote code execution, complete data exfiltration, account compromise of many users
- High: Authentication bypass, major data leakage, privilege escalation
- Medium: Privilege-limited data leakage, SSRF, sensitive information exposure with user interaction
- Low: Information disclosure of non-sensitive data, UI issues, minor misconfigurations

## Triage and Fix Process
1. Confirm the issue and reproduce on a minimal environment
2. Create a private ticket and assign a maintainer
3. Determine whether a fix requires code changes, config changes, or a dependency update
4. Prepare a patch or mitigation in a branch, open a PR with the fix, and run tests
5. Coordinate disclosure and release a fix (and release notes) once a patch is merged and deployed

## Reproducing Locally
To help triage, please provide reproduction steps. Typical local setup for this repo:

```powershell
# from project root
npm install
npm run dev
# open http://localhost:5173 (vite default) or follow the dev server output
```

Include Node.js version and OS in your report (e.g., Windows 10, Node 18.x).

## Reporting Sensitive Data Leaks
If you believe credentials or sensitive data were exposed (for example, keys in the repo, logs with secrets, or a data leak), tell us immediately. Avoid posting secrets in public issue threads.

## Third-Party Dependencies
If the vulnerability involves a third-party library, include the vulnerable package name and version in your report. We'll evaluate whether a dependency upgrade or replacement is required.

## CVE and Public Disclosure
We will work with the reporter to determine whether the issue merits a CVE and can help with the submission if needed.

## Non-Security Bug Reports
For general bugs or UX issues, open a regular issue in the repository. This security policy is specifically for vulnerabilities and sensitive issues.

## Contact / Maintainers
- Repository: FitBuddyAI (owner/maintainers listed on GitHub)
- Preferred contact email: fitbuddyaig@gmail.com

## Thank You
Thank you for helping improve FitBuddyAI's security. We appreciate responsible disclosure and will work with reporters to ensure users remain protected.