Changelog

All notable changes to LinkedIn Quick Connect will be documented in this file.
This project follows Semantic Versioning

[2.0] – 2025-08-31
Major Upgrade
Added

Template Management

Users can now create and save multiple templates in the options page.

Quick Connect button now includes a dropdown menu for selecting templates on the fly.

Templates support placeholders:

{firstName} → replaced with recipient’s first name.

{cmpny} → replaced with current company (or "**\_\_**" if unavailable).

Templates can be exported/imported as JSON for backup or sharing.

Option to star a default template (highlighted in LinkedIn brand blue).

Sample messages - as it is - for quick inspiration.

Connection History Logging

Every connection request with a note is automatically recorded.

History includes: date/time, recipient name, company, profile URL, and the full message sent.

Messages preserve line breaks (exactly what was sent).

View history in a new Connection History tab.

Export history to CSV or clear all records.

Changed

Options page fully redesigned:

Two-pane layout (template editor on left, template list on right).

Cleaner, modern styling.

Default greeting toggle (Hi {firstName},) now enabled by default.

[1.0] – Initial Release
Added

Injected Quick Connect button next to “More” / “Message” on LinkedIn profile pages.

Allowed saving a single custom message in options.

Supported {firstName} and {cmpny} placeholders.
