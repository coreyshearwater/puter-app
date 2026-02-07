# Changelog

All notable changes to the "GravityChat" project will be documented in this file.

## [v1.1.0] - 2026-02-07

### Added
- **Project Folder Selection**: Ability to switch working directories via the top bar.
- **Native App Mode**: `start.bat` script launches the app in a standalone Chrome window.
- **DOMPurify Integration**: Added sanitization for all Markdown output to prevent XSS attacks.
- **Message Truncation**: Chat history in DOM is limited to 50 items to prevent memory leaks and lag.
- **Storage Quota Handling**: Added error handling and user alerts when local storage/KV is full.
- **Professional UI**: Disabled text selection on UI elements while keeping chat content copyable.
- **Sleek Buttons**: Redesigned functional buttons (Export, Clear) to match purely text-based premium aesthetic.

### Fixed
- **Tab Content Visibility**: Resolved layout bug where sidebar content was hidden due to CSS Flexbox issues.
- **File Attachment**: Wired up the "Attach File" button which was previously a placeholder.
- **Startup Errors**: Fixed "Failed to access files" error by defaulting to root path (`/`) instead of home (`~/`).

### Changed
- **Performance**: Optimized rendering logic for large chat histories.
- **Validation**: Added stricter validation for file/folder names.

## [v1.0.0] - 2026-02-07

### Initial Release
- Core Chat Interface with Streaming
- Multi-Model Support (Free & Premium tiers)
- Custom Personas with Perception System
- Voice Chat (STT/TTS)
- File Management (Create, Read, Delete)
- Local Persistence via Puter.KV
