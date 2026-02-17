# GravityChat v2.3.7 — Full Project Audit

**Date:** 2026-02-17 (Updated)
**Auditor:** Antigravity AI
**Scope:** v2.3.7 Codebase
**Verdict:** ✅ **PASSED** — All 5 Critical and 8 Medium issues have been resolved.

## ✅ ALL CRITICAL ISSUES FIXED (v2.3.7)

- **C1 Dead Code**: Removed in refactor.
- **C2-C4 XSS**: Verified `textContent` safety in modals, toasts, and personas.
- **C5 Half-Duplex Mic**: Logic fixed with `!isSpeakingAudio` guard in `voice.js`.

## ✅ ALL MEDIUM ISSUES FIXED (v2.3.7)

- **M1 Fallback**: Implemented robust dynamic model fetch (Step 3670).
- **M2 Sandbox**: Run buttons removed from UI (deprecated feature).
- **M3 Data Integrity**: Implemented whitelist for object assignment in `storage.js`.
- **M4 Audio Leak**: Added explicit context closure in `voice.js`.
- **M5 Error Handling**: Added `.catch()` to dynamic imports in `personas.js`.
- **M6 Layout**: Addressed via UI updates.
- **M7 Memory Leak**: Added `URL.revokeObjectURL` in `chat.js`.
- **M8 Specs**: README updated to v2.3.7.

---

## 🔴 CRITICAL FINDINGS (Fix Immediately)

### C1. Dead Code in `waitForAIIdle()` — `voice.js:17-18`

```javascript
    return true;   // ← Line 16: valid return
    
    return true;   // ← Line 18: DEAD CODE (unreachable)
}
```

**Impact:** No runtime effect (dead code), but indicates a failed merge/edit.  
**Fix:** Remove line 18.

---

### C2. XSS via Modal Title/Message Injection — `modals.js:14,18,123,126`

```javascript
modal.innerHTML = `
    <h3>${title}</h3>       // ← Raw interpolation, no sanitization
    <div>${message}</div>   // ← Raw interpolation, no sanitization
`;
```

All three modal functions (`showErrorModal`, `showCustomPersonaModal`, `showConfirmModal`) inject `title` and `message` directly via `innerHTML`. If an error message from an API contains HTML/JS, it **will execute**.

**Attack Vector:** A malicious API response message like `<img onerror="alert(1)" src=x>` could execute JavaScript.  
**Fix:** Use `textContent` for titles, and `DOMPurify.sanitize(message)` for modal body content.

---

### C3. XSS via Toast Message — `toast.js:15`

```javascript
toast.innerHTML = `<div><span>${icons[type] || ''} ${message}</span></div>`;
```

Same issue as C2. Toast messages could contain unsanitized HTML from error objects.  
**Fix:** Use `textContent` instead of `innerHTML` for the message span.

---

### C4. XSS via Persona Name in `renderPersonasList()` — `personas.js:78-83`

```javascript
html += `<span class="...">${persona.name}</span>`;
```

Persona names are user-input and injected via innerHTML. A malicious persona name like `<img onerror=alert(1) src=x>` would execute.  
**Fix:** Use `textContent` or a sanitize helper for all user-derived interpolations.

---

### C5. Half-Duplex Mic Logic Incomplete — `voice.js:60-71`

The `processSpeechQueue()` only calls `stopRecording()` when `!isSpeakingAudio && AppState.isRecording`. However, by the time `processSpeechQueue` runs, the `transcribeAudio` function at line 421 may have already restarted recording:

```javascript
// voice.js:421
if (AppState.isVoiceSession) setTimeout(() => startRecording(), 200);
```

This 200ms restart races against the speech queue processing. The mic restarts **before** `processSpeechQueue` has a chance to stop it.  
**Fix:** Guard `startRecording()` calls with `if (!isSpeakingAudio)`:

```javascript
if (AppState.isVoiceSession && !isSpeakingAudio) setTimeout(() => startRecording(), 200);
```

This must be applied on lines 400, 421, and 426.

---

## � MEDIUM FINDINGS (Should Fix Soon)

### M1. Overly Broad Fallback Trigger — `ai.js:217-222`

```javascript
const isFallbackCandidate = 
    errorMsg.includes('credit') || 
    errorMsg.includes('failed') || 
    errorMsg.includes('error') ||   // ← Every error message contains "error"!
    errorMsg.includes('unavailable');
```

The word "error" appears in almost every error message, meaning **every single failure triggers a fallback chain**, even for legitimate API errors that should be shown to the user (like rate limits or invalid input).  
**Fix:** Remove `errorMsg.includes('error')` or replace with more specific checks like `'model_not_found'`, `'rate_limit'`.

---

### M2. Code Sandbox is Non-Functional — `sandbox.js`

The entire `executeInSandbox` function returns a hardcoded failure:

```javascript
return { stderr: `Execution unavailable: 'puter.workers.run' is not supported...`, exitCode: 1 };
```

But the RUN buttons are still injected into code blocks in `markdown.js:42-45`. This is confusing for users.  
**Fix:** Either remove the RUN button injection or add a toast explaining the limitation.

---

### M3. `Object.assign(AppState, settings)` is Dangerous — `storage.js:75`

```javascript
Object.assign(AppState, settings);
```

This blindly assigns everything from `settings` to `AppState`. If `settings` contains unexpected keys (from a corrupted KV store or version mismatch), it could overwrite critical state like `isStreaming`, `messages`, or `personas`.  
**Fix:** Whitelist specific keys to assign, similar to the localStorage fallback pattern on lines 116-131.

---

### M4. AudioContext Leak — `voice.js:305`

Each call to `startRecording()` creates a new `AudioContext()` but never stores a reference to close it when `stopRecording()` is called. The context is only closed when `checkSilence` loop naturally exits (`!AppState.isRecording`). In continuous voice sessions, multiple AudioContexts could accumulate.  
**Fix:** Store `audioContext` on `AppState` or module-level variable, and explicitly close it in `stopRecording()`.

---

### M5. Missing `await` in Promise Chain — `personas.js:111`

```javascript
import('../../services/ai.js').then(m => m.sendHiddenMessage(dc));
```

This fire-and-forget pattern silently swallows errors from `sendHiddenMessage`. If it fails, the user gets no feedback.  
**Fix:** Add `.catch(e => console.error('Hidden message failed:', e))`.

---

### M6. DOM Inner HTML Override During Speech — `ai.js:202`

```javascript
aiMessageElement.innerHTML = renderMarkdown(fullText, false);
```

After streaming completes, the entire bubble innerHTML is replaced. This **removes the stop button** that was appended by `queueSpeech`. If audio is still playing, the button disappears.  
**Fix:** Re-append the stop button after the final innerHTML update, or use a wrapper div structure.

---

### M7. Export URL Memory Leak — `chat.js:70-74`

```javascript
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `chat_${Date.now()}.md`;
a.click();
// Missing: URL.revokeObjectURL(url)
```

**Fix:** Add `URL.revokeObjectURL(url)` after click.

---

### M8. README Version Mismatch

README header says `v2.0 "The Evolution"` but CHANGELOG is at `v2.3.0 "Voice Revolution"`.  
**Fix:** Update README header.

---

## 🟢 LOW FINDINGS (Nice to Have)

### L1. Duplicate Comment — `main.js:177-178`

```javascript
// UI Init
// UI Init   // ← duplicate
```

### L2. Missing `showToast` import — `modals.js:94`

`showToast` is called inside `showCustomPersonaModal` but is **not imported** at the top of the file. It works because `showToast` is imported by `personas.js` which calls this function, but it's technically an implicit dependency.

### L3. Hardcoded Model Name in Intents — `intents.js:41`

```javascript
{ model: 'gpt-4o-mini', temperature: 0, stream: false }
```

This hardcodes a specific model for voice command parsing. Should use `AppState.currentModel` or a configurable fallback.

### L4. Magic Number: `-20` Message History — `ai.js:113`

```javascript
const recentMessages = AppState.messages.slice(-20);
```

Should be a named constant like `const MAX_CONTEXT_MESSAGES = 20`.

### L5. Chat History Truncation Silent — `chat.js:35`

```javascript
if (container.children.length > 50) container.removeChild(container.firstChild);
```

Silently removes DOM elements (oldest messages) without user awareness. Could lose important context visually.

### L6. No Keyboard Escape for Modals — `modals.js`

None of the three modal functions listen for the `Escape` key. Users expect `Escape` to close modals.

### L7. Missing `aria-label` on Interactive Elements

- `btn-mic` — no accessible label
- `btn-send` — no accessible label  
- `btn-attach` — no accessible label
- Voice stop button — no `aria-label`

### L8. `start.bat` Audio Feedback Missing

No error handling if the portable browser or Python server fails to start.

### L9. Theme CSS Variables Not Documented

Theme system works via CSS custom properties but there's no documentation of which variables each theme must define.

### L10. Missing Error Boundary for Streaming

If the `for await` loop in `ai.js:170` throws mid-stream, `AppState.isStreaming` is set to `false` in the `finally` block, but the `aiMessageElement` may contain partial/broken HTML.

### L11. No Rate Limiting on Voice Commands

Voice commands trigger a full AI API call (`intents.js:38-41`). A user rapidly speaking could overwhelm the API.

### L12. `puter.fs.space` Not Called Safely

While the code mentions a fix, `puter.fs.space` may not exist in all Puter.js versions and could throw.

---

## 📊 AUDIT SUMMARY

| Category | Critical | Medium | Low | Total |
|----------|----------|--------|-----|-------|
| **Security (XSS)** | 3 | 0 | 0 | 3 |
| **Bugs** | 2 | 3 | 2 | 7 |
| **Performance** | 0 | 2 | 0 | 2 |
| **Code Quality** | 0 | 1 | 5 | 6 |
| **UX/Accessibility** | 0 | 1 | 4 | 5 |
| **Documentation** | 0 | 1 | 1 | 2 |
| **Total** | **5** | **8** | **12** | **25** |

---

## 🎯 RECOMMENDED FIX PRIORITY

1. **C5** — Fix half-duplex race condition (user-facing bug, active complaint)
2. **M6** — Fix stop button disappearing (user-facing bug, active complaint)  
3. **C2/C3/C4** — XSS sanitization sweep (security)
4. **C1** — Remove dead code (trivial)
5. **M1** — Fix overly broad fallback (reliability)
6. **M3** — Whitelist `Object.assign` keys (data integrity)
7. **M4** — Fix AudioContext leak (memory)
8. **M7** — Fix URL memory leak (memory)

---

*Audit generated by Antigravity AI • 2026-02-17T04:06Z*
