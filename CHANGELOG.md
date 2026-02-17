# Changelog

All notable changes to the "GravityChat" project will be documented in this file.

## [v2.3.1] - "Hardened" - 2026-02-17

### Security (Critical)

- **Fixed**: XSS via modal title/message injection — all 3 modal functions now use `textContent` instead of raw `innerHTML`.
- **Fixed**: XSS via toast messages — toast content now uses safe text injection.
- **Fixed**: XSS via persona names — added HTML entity escaping in persona list rendering.

### Bugs

- **Fixed**: Dead code in `waitForAIIdle()` — removed unreachable duplicate `return true`.
- **Fixed**: Half-duplex mic race condition — guarded all `startRecording()` calls with `!isSpeakingAudio` check.
- **Fixed**: Voice stop button vanishing after streaming ends — button is re-injected after final `innerHTML` update.
- **Fixed**: Overly broad fallback trigger — removed `errorMsg.includes('error')` which caught everything.
- **Fixed**: Partial streaming recovery — mid-stream failures now preserve partial content instead of losing it.

### Performance

- **Fixed**: AudioContext memory leak — contexts are now tracked and explicitly closed on stop.
- **Fixed**: ObjectURL memory leak in chat export — `URL.revokeObjectURL()` now called after download.

### Code Quality

- **Improved**: Replaced unsafe `Object.assign(AppState, settings)` with whitelist-only key assignment.
- **Improved**: Extracted `MAX_CONTEXT_MESSAGES` constant (was magic number `-20`).
- **Improved**: Extracted `INTENT_MODEL` constant for voice command parsing model.
- **Improved**: Added `.catch()` to fire-and-forget `sendHiddenMessage` promises.
- **Improved**: Disabled non-functional RUN buttons in code blocks (Puter V2 sandbox unavailable).
- **Removed**: Duplicate comment in `completeInit`.
- **Added**: Missing `showToast` import in `modals.js`.

### UX/Accessibility

- **Added**: Escape key support for all 3 modal types.
- **Added**: `aria-label` on dynamically-created voice stop button.
- **Added**: 2-second cooldown on voice commands to prevent API spam.
- **Added**: Console log when DOM prunes old messages (>50 visible).
- **Added**: Theme CSS variable documentation block in `main.css`.

### Infrastructure

- **Improved**: `start.bat` — added existence checks for Grok venv, api_server.py, and debug_server.py with warnings instead of silent failures. Fixed version display and step numbering.

## [v2.3.0] - "Voice Revolution" - 2026-02-17

- **Added**: **Streaming TTS** — AI now speaks sentences in real-time as they are generated, drastically reducing perceived latency.
- **Added**: **Half-Duplex Voice Mode** — Microphone automatically stops listening during AI speech playback to prevent feedback loops.
- **Added**: **Intelligent Voice Queuing** — Voice messages now wait for background tasks (like persona switching) to complete before auto-sending.
- **Added**: **Hands-Free AI** — Voice inputs are automatically sent after transcription without manual confirmation.
- **Improved**: **Voice Latency** — Reduced silence detection time from 1.5s to 0.7s for snappier conversation flow.
- **Improved**: **Stop Button UX** — Voice stop button now appears instantly when speech begins and persists on the correct message bubble.
- **Fixed**: **GPT-5 Temperature Compatibility** — GPT-5 models now correctly use temperature=1 (required by the model).
- **Fixed**: **Oracular Persona Switching** — Consolidated reset commands to prevent instruction bleed-over when switching personas.
- **Fixed**: **Session Deletion UI Sync** — Deleting the last chat session now correctly updates the sidebar.
- **UI Polish**: Moved voice stop button to top-right corner of message bubbles for better visibility.

## [v2.2.2] - "Persona Pro Max" - 2026-02-17

- **Added**: **Unlimited Personas** — Completely refactored the persona system to support unlimited user-defined personalities.
- **Added**: **Management UI** — Added "Edit" and "Delete" controls that manifest on hover for all persona cards.
- **Added**: **Dynamic Coloring** — New personas automatically receive unique high-contrast colors and neon glow effects.
- **Added**: **Oracular Auto-Bridge** — Switching to the Oracular persona now triggers an automatic hidden "Engage Oracle Mode" command.
- **UI Cleanup**: Removed the "Welcome to GravityChat" splash screen for a cleaner, more focused workspace.
- **Improved UX**: The application window now starts **Maximized** by default for a smoother desktop experience.
- **Security & Safety**: Unified all destructive actions (Chat, Session, Persona deletion, and Reset) to use custom **Neon Confirm Modals** for a premium, consistent aesthetic.
- **Theme Overhaul**: Added premium dark themes: **Midnight (Sleek Onyx)**, **Cyberpunk**, and **Deep Sea**, ensuring perfect color harmony and professional dark-mode UI.
- **UI/UX Fix**: Added a constrained **max-height and scrollbar** to sidebar panels (Settings, Models, Personas) to ensure all options are accessible even in smaller windows.
- **Changed**: **UI Nomenclature** — Refined "Default" state naming (Sidebar: "No persona" / Header: "DEFAULT") for better UX clarity.

## [v2.2.1] - "Hygiene & Accessibility" - 2026-02-17

- **Added**: **Storage Meter Silence** — Implemented automatic muting for storage metrics on 401 Unauthorized errors to prevent runtime log spam.
- **Fixed**: **Sidebar Accessibility** — Refactored the navigation system from a broken "tablist" pattern to a standard Accordion/Navigation pattern using `aria-expanded`.
- **Fixed**: **Documentation Linting** — Conducted a project-wide audit of Markdown files (`README.md`, `audit_report.md`, `walkthrough.md`), standardizing list markers and spacing.
- **Fixed**: **Puter.js v2 Compliance** — Standardized `puter.ai.txt2img` return types and added defensive checks for `puter.fs.space`.
- **Fixed**: **UI Hygiene** — Removed inline `style` attributes and legacy browser-incompatible `meta` tags to achieve a zero-warning state in modern IDEs.

## [v2.2.0] - "The Oracular Phase" - 2026-02-17

- **Added**: **Oracular Persona** — Introduced the high-fidelity "Oracular Function" framework with a specialized, symbolic system prompt and mystic purple theme.
- **Added**: **Interactive Mode Toggles** — Dedicated controls in the top bar for Oracle, Soul Tether, Ancestral Tether, Divination, Astrological, and Magic modes.
- **Added**: **Hidden Signal Protocol** — Implemented a custom non-rendered message passing system for mode toggles, preserving immersion while keeping the AI contextually aligned.
- **Added**: **Sub-State Persistence** — Mode selections are now specifically synced to Puter KV memory, ensuring your ritual configuration persists across reloads.
- **Fixed**: **State Sync Hygiene** — Fixed potential syntax errors and object structure mismatches in global storage persistence logic.
- **Fixed**: **UI Contextualization** — Ensured mode controls only manifest when the Oracular persona is active, keeping the header clean for standard operations.

## [v2.1.0] - "The Obsidian Phase" - 2026-02-08

- **Added**: **Emoji Toggle** — New setting in sidebar to enable/disable AI emojis/icons (default: OFF).
- **Added**: **Error Modals** — Sleek, glassmorphic modal system for "Heavy Usage" or provider service errors.
- **Added**: **Nested Model Menu** — Grouped Grok models into an expandable category for a cleaner sidebar.
- **Fixed**: **Total Icon Purge** — Completed the 100% removal of all decorative emojis (Themes, OCR, Toasts, Welcome Screen).
- **Fixed**: **Sidebar UX** — Click-to-deselect implemented for all tabs and personas.
- **Fixed**: **Resilient AI** — Empty message bubbles are now automatically cleaned up on service failure.
- **Fixed**: **Grok Bridge** — Fixed Pydantic validation errors and improved error message extraction.
- **Fixed**: **Startup Logic** — App now starts with all tabs deselected for a clean "Blank Slate" experience.

## [v2.0.2] - "Grok Logic" - 2026-02-08

- **Added**: **Grok API Integration** — Automated bridge to local `Grok-Api-main` Python server.
- **Added**: **Persistent Conversions** — Grok session state is now managed for back-and-forth continuity.
- **Added**: **Auto-Launch** — `start.bat` updated to automatically start the Grok API bridge.
- **Fixed**: **UI Overflow** — Optimized model dropdown layout to eliminate horizontal scrolling.
- **Fixed**: **Connection Issues** — Standardized bridge communication to `127.0.0.1` for Windows stability.
- **Fixed**: **UI Aesthetics** — Removed decorative icons from error messages, toasts, and logs for a cleaner look.

## [v2.0.1] - "Hygiene Audit" - 2026-02-07

- **Fixed**: **Critical Startup Bug** — Resolved a `SyntaxError` due to a duplicate declaration of `aiMessage` in `ai.js`.
- **Fixed**: **Broken Module Imports** — Restored missing Media Lab and Markdown imports in `main.js`.
- **Fixed**: **CSS Variable Hygiene** — Fixed "ghost" variables in `main.css` causing failed neon glow effects.
- **Changed**: **Code Refactor** — Streamlined the file management path logic and simplified directory normalization.
- **Changed**: **Resource Management** — Optimized `AudioContext` lifecycle in `voice.js` to prevent memory leaks.
- **Changed**: **UI Performance** — Refactored tab-switching logic to use CSS classes instead of inline style injection.

## [v2.0.0] - "The Evolution" - 2026-02-07

- **Added**: **Mood Themes** — Introduced "Void", "Toxic", and "Overdrive" themes with smooth CSS transitions.
- **Added**: **The Executioner** — Secure code sandbox for running Python/JS code blocks via Puter Workers.
- **Added**: **Media Lab** — Advanced UI for precise AI generation (Aspect Ratio, Artistic Styles, Negative Prompts).
- **Added**: **Neural Memory** — Project-wide recursive indexing for intelligent codebase context awareness.
- **Added**: **OS Integration** — Native multi-window file editing with save capabilities using Puter's UI system.
- **Added**: **Semantic Voice** — Intelligent command processing for hands-free workstation control.
- **Added**: **Modular Core** — Completely refactored codebase into a maintainable modular architecture.

## [v1.4.0] - 2026-02-07

- **Added**: **AI Video Generation** — Added `/video [prompt]` command for cinematic clip creation via `puter.ai.txt2vid`.
- **Added**: **Scan to Text (OCR)** — Integrated `puter.ai.img2txt` for high-accuracy text extraction from local images.
- **Added**: **Shortcut Buttons** — Sleek UI bar for one-click access to Image, Video, and OCR tools.
- **Added**: **Storage Dashboard** — Live storage meter in the Files tab showing usage vs. capacity via `puter.fs.space`.
- **Added**: **Native UI Integration** — Upgraded folder selection and persona color selection to use Puter's native `DirectoryPicker` and `ColorPicker`.

## [v1.3.1] - 2026-02-07

- **Added**: **Clickable Breadcrumbs** — Every segment of the file path is now a clickable link for rapid navigation.
- **Added**: **Resilient Path Loading** — Improved `loadFiles` to automatically handle fallback between `~/` and `/` depending on environment availability.
- **Added**: **Cross-Browser Styling** — Added `-webkit` prefixes to ensure premium aesthetics (glassmorphism, text selection) work correctly in Safari/iOS.
- **Added**: **Sleek Input UI** — Replaced standard emojis with custom SVG icons for the Attach and Mic buttons, featuring neon glow hover effects.
- **Added**: **Speed Optimization** — Reduced layout thrashing by buffering AI stream chunks and lowering default creativity (Temperature) for faster, more focused output.
- **Fixed**: **Breadcrumb Navigation** — Resolved issue where only the home segment was clickable.
- **Fixed**: **Path Construction Errors** — Fixed potential double-slash issues in calculated file system paths.

## [v1.3.0] - 2026-02-07

- **Added**: **Architectural Refactor** — Migrated from a single 2000-line index.html to a modular, specialized ES module structure.
- **Added**: **Improved Maintainability** — Logic split into `services/`, `ui/`, and `utils/`.
- **Added**: **CSS Extraction** — Moved global design system to `styles/main.css`.
- **Added**: **Global Namespace** — Introduced `window.gravityChat` to facilitate modular communication without breaking legacy HTML templates.

## [v1.2.0] - 2026-02-07

- **Added**: **Professional Attachment UI** — Added a sleek "File Tray" with chips for managing attachments before sending.
- **Added**: **Multimodal Vision Support** — Images are now sent directly as file objects to AI for analysis.
- **Added**: **Text Context Injection** — Content of attached text files is automatically read and provided as context during chat.
- **Added**: **Improved Free Tier** — Default model set to `z-ai/glm-4.5-air:free` (currently the best zero-cost model on Puter).
- **Added**: **Compatible Cloud TTS** — Updated TTS voices to use standard AWS Polly IDs (Joanna, Matthew, etc.) for better reliability.
- **Added**: **Streaming Performance Optimization** — Refactored markdown rendering to skip expensive syntax highlighting during active streaming.
- **Added**: **Keyboard Navigation (A11y)** — Added full keyboard support for sidebar tabs.
- **Added**: **Usability Focus** — Enabled global text selection while maintaining the "native app" look.
- **Fixed**: **Critical SyntaxError** — Resolved an "Uncaught SyntaxError" in `index.html` caused by a missing catch block in `speakText`.
- **Fixed**: **TTS Failure** — Fixed Puter Cloud TTS errors caused by incompatible voice names.
- **Fixed**: **Initialization Hang** — Fixed an issue where the app would hang at loading due to a malformed `try-catch` block.
- **Fixed**: **Duplicate Scripts** — Removed redundant DOMPurify script tags.
- **Fixed**: **AudioContext Leak** — Ensured audio context cleanup in voice session loops.
- **Changed**: **Default Experience** — Re-tuned initial state to prioritize free high-quality options.

## [v1.1.0] - 2026-02-07

- **Added**: **Project Folder Selection** — Ability to switch working directories via the top bar.
- **Added**: **Native App Mode** — `start.bat` script launches the app in a standalone Chrome window.
- **Added**: **DOMPurify Integration** — Added sanitization for all Markdown output to prevent XSS attacks.
- **Added**: **Message Truncation** — Chat history in DOM is limited to 50 items to prevent memory leaks and lag.
- **Added**: **Storage Quota Handling** — Added error handling and user alerts when local storage/KV is full.
- **Added**: **Professional UI** — Disabled text selection on UI elements while keeping chat content copyable.
- **Added**: **Sleek Buttons** — Redesigned functional buttons (Export, Clear) to match purely text-based premium aesthetic.
- **Fixed**: **Tab Content Visibility** — Resolved layout bug where sidebar content was hidden due to CSS Flexbox issues.
- **Fixed**: **File Attachment** — Wired up the "Attach File" button which was previously a placeholder.
- **Fixed**: **Startup Errors** — Fixed "Failed to access files" error by defaulting to root path (`/`) instead of home (`~/`).
- **Changed**: **Performance** — Optimized rendering logic for large chat histories.
- **Changed**: **Validation** — Added stricter validation for file/folder names.

## [v1.0.0] - 2026-02-07

- **Initial Release**: Core Chat Interface with Streaming, Multi-Model Support, Custom Personas, Voice Chat (STT/TTS), File Management, and Local Persistence.
