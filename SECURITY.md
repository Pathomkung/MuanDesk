# Security

Use the latest release and keep Electron dependencies updated. Releases are currently
unsigned Windows installers and do not update automatically.

Do not post passwords, cookies, tokens, browser profiles or account screenshots in public
issues. If the repository has GitHub Private Vulnerability Reporting enabled, use its
Security tab to report a vulnerability privately. Otherwise, open an issue requesting a
private contact channel without including exploit details or sensitive data.

The remote website runs in a sandboxed WebContentsView without Node.js or a preload bridge.
Application controls run in separate local renderers with constrained preload methods and
IPC sender/frame/URL checks. External navigation is restricted and site permissions are
denied by default. This does not guarantee the absence of vulnerabilities in the application,
Electron, Chromium, or third-party content.

Before release, run `npm audit`, the tests in `docs/RELEASING.md`, and the release privacy check.
