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
If you believe you've found a security vulnerability in this project, please report it privately using one of the methods below. Please do not open public GitHub issues for security vulnerabilities.

Preferred reporting options (in order):
1. Use GitHub’s private vulnerability reporting feature (preferred).
2. Email: fitbuddyaig@gmail.com 

When reporting, please include:
- A short, clear summary of the issue
- Steps to reproduce (minimum reproducible example if possible)
- Expected behavior vs. actual behavior
- Severity and potential impact (e.g., remote code execution, data leakage, XSS)
- Any logs, screenshots, stack traces, or demo URLs
- Exact Git commit/branch and environment (Node version, OS, browser)

Do NOT include any sensitive data (API keys, credentials, personal data) in public reports. If you need to share sensitive artifacts, encrypt them with our PGP key (see below) or contact us to coordinate an alternative secure channel.

## PGP / Encryption

If you need to share sensitive information (proof-of-concept exploits, logs, private data),
please encrypt it using our PGP public key below.

**Key owner:** FitBuddyAI Security  
**Email:** fitbuddyaig@gmail.com  
**Fingerprint:** 5615 0E04 DF2D 492B FA5A  3D40 D1A3 BAC1 A45C 5FDC  

```text
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGk/VfsBEADSUXxz15qjVp4ektO7n4bSleLCQBd2+qrfZhx9d2msIX455D0X
9YsxHCKV2cQgDzW9GOtOR4L3e1/Pm0cWDXFF3oSwdSwdcRZqU9ZWShjPkOnnkIOO
gyL4XP2pEVq3m2RAoCbsZevxESI5oBEPzumnihfgw+EOJBuP4xOCEWECjj6v9Fmi
7J90ndx40Xxwb9PammZ6y5tZfu11AyZNTE8Qe4+mJLSAPUE5bIoU9HjhjQzrkqAP
/DAg8ebqrl0sXS8aPD/IXUdcVbPH0vEsiNUuiRtSLt36qgjrUkHOPV5t9uUt2JMl
hLDlqBz9mF9vTZCBmy0ZHNtKMXYj761PpAPkUm/VhGe/ac4D1d6QPP+VJJ88TomK
TfoYGQldzDK5PzWEieQ1JzcJ1+JZfZFwPh+243jkAU9No2+ys/Zf1vXU8xdn2lQg
vvgH1CFVnaG3oXPSAKsf3o/UTLVu/hxUv79FlSDzOzH/xnmps9ODmi2djRt2id6t
teXH8OZx5+LW8juEX0b2c9YkleFE1p1U4+v834R3r04qByFfvVHNuq2DjT+Blt2p
ywlagMA06i5wCjJKE0deADrV1mC1QEOOxtAxFBYuaXQ9MF+2Cyk3j/uJJz8IIjV6
OjGi5MfXR3LHdOD8X9qnCDyQCMZywQiZCcwdf1RIOoN1GEcOfZwLouaf+wARAQAB
tExGaXRCdWRkeUFJIFNlY3VyaXR5IChTZWN1cml0eSBWdWxuZXJhYmlsaXR5IFJl
cG9ydHMpIDxmaXRidWRkeWFpZ0BnbWFpbC5jb20+iQJRBBMBCAA7FiEEVhUOBN8t
SSv6Wj1A0aO6waRcX9wFAmk/VfsCGwMFCwkIBwICIgIGFQoJCAsCBBYCAwECHgcC
F4AACgkQ0aO6waRcX9zBpA//UQ5HOt6BPXENANJVVcKW11UGIZuIR2Ev/SmvDTBh
ZpInxAc4waqhRhCgGAzft1qcNoj18LLj2bYfMDNVkYXq8ghx4zztxRTuqQCLWV4M
BwZVzvOjpdmQG4dE4uLdeuR5t8b8vp4UqKfge3CYEKWsMXRl+TEoxgPx6Pi7mPAj
79NHpCn977iM6n6sXghHVl0pg31Gu7WrCHpwtU5McXP3ylUxbOO+p6OsXeuIQf6w
TsOrlxJwehNLGaRc5ixgFshsyJT741mrV7yRKgopI3r2HxvLVwnF58hTgGUfpBkw
Bmdj7AX3cWogl/rWNKJz9p3ILZyxQUwM0iPLwSLLZeIaW2prodmqTgbjv5WpqCde
Mbbw2++OeUPp7aphKeN+3CSUpNAz8Mq/uZb5s8FErn58A4N4Uuzf0x/KZMgXOYCy
iELi8KiclL52p9GYDBC0JTgEX55S5wEQ9V3HRGD5spxyMk4oWgYyBjSP7htDQKwT
4MDcLk4TMJu8MQrFGT+n5UfOoXOy1BIOOjByTJIR4GYmhtqDPWc6tdzGdhZbfGh4
v4KH3MdN55stX827dWZd/sX6cwjwahhPpStWey92r28ngEiYFkWPAywhtHuM7g7c
l9vIXUPmb4i/8bdhXepkCzg4a9wAnz1z1s0QIzaUv36hj+ELXKP6NCaqwq3izjVz
iJm5Ag0EaT9V+wEQANr4V1q/lunjm23YeYWPn5yQqQ0dqoFhx7whi/OnQwOyIWM7
7DR2N4nynqJpINd2gD0RYTVTJTgO2qQ0QRM7VCoZh/hk85tn1ZQ1HvO7VuOFyvkX
gy9mVLltOO1Ar+arvXzBa51GdZnoqpqEVAGFYbVqnJPsVRzOiCpFAG13php2V9Z6
NQ3i/D2FnxfVAZ999omV8rXEdGQHnR1KaGSQ3HMYjtDAfnO62Yyk1RwdPOyJw9c/
4hlu1nQGrTNCSk6dre/wKOn8NI8d6hAlN6o+ODt2fJ890ky+mGIXdGHspTx3FTGp
loqsUkbzwOg9lnLO24e8i+OW/YMaaBYCNyXxk57f25/4GygBb0aph96RcNlqgcNY
VeFWQPbp1OZ+5YmIhpO921CZnGz8AOKhwpQlG02zdWNVnYj86jl/UyJDXqI7E0B9
taN0MkGEPIkdKKp/ibEbgAGNs3Rrbz9bdX+XRXtOEP+QPDIRlo/oTnw6ehBeKTCh
x+xxmkb4E05A8NrKuqqU8W7vY9gNnGlOZYpZVivIldiWvAZZpGK3VGSRhzNhzCY9
2au2oMBh2K9VB1CE1Rosxu7LyxP6B7Y0yZ90mkbQiswCmlnBC8ijsY18IK+Y0ocC
74Gp+Csu5KYQGxLlD6TxVWmIUvOaU1a4pjLguLmTAM7qLAaQJ64USWOuym5jABEB
AAGJAjYEGAEIACAWIQRWFQ4E3y1JK/paPUDRo7rBpFxf3AUCaT9V+wIbDAAKCRDR
o7rBpFxf3G3+EADAUMHZ+PlRiLsBvmm7l7jS+PfeqZQtZrifw+MCU7S0KBGXSTcd
2uM4B8kloKUp3TW8fCSHwsG4MFZ5PStzMS7QXth/LpRKgpz8fDqpLlc2/ICgvEwA
1RmFGFjNe5GKlnORlBpA+UKxEQz2mGQclfhQjv0fMUtrmTYCRN37z2c5s7WToesy
7An0ql07xuxQXPUiwbaDNrsNTST8KNmvNlEHOuUdX32EIFSV3HeSbCIXCXSJd0aQ
4aYs+iMgXfvcD1PAMGO/Nkjb3PNGKWtFBAD8XJj6LuctWCxs81YqucIKMNlK0x67
N06TTHdYNXoCZf5eOKDf6nFk5kQd1jrD9SOX2NfEXklC7+NtFquxCSMuDfzFsiCR
lp84cCwwAepf89afCV6toMpS3NRau83sxswZ/UQ+8FIFrc4GttOI9jIwBleLbfmZ
yUkUkURYjq/raHA+wcpQTrSS6ne5E7KcVHflvLWrrPzIJ15+WLaPJUigiAOsAsLU
mZBDgBfr331BrnpPoqKq8sG7zDR+qUnmw8APCAgDdgNNFuvjE3Yi0QpFW8m3u3JB
8HaE+eMhCe6mjX/Sgv+r2IdQjgSsVVwDEpX3/oRCNGBNseM6z8Rr+IOuAx1exONa
oBUf6T35xzfhoACd9oAPotzgZWMz0RGwg/M38mp1taGQ/81rlMOw50PMUw==
=PYGm
-----END PGP PUBLIC KEY BLOCK-----
```

This key may be rotated periodically. The fingerprint above will always be kept up to date in this document.


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
