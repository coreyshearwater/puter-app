# GravityChat - Your Personal AI Workstation (v2.4.0 "Live Roster")

GravityChat is a powerful, modular AI workstation that runs entirely in your browser. Built with **Puter.js v2**, it provides a complete OS-like experience with zero backend setup required.

![GravityChat Preview](https://github.com/user-attachments/assets/placeholder)

## 🚀 Features

### 🤖 Multi-Model Intelligence

- **Free Access:** Use premium models like `gpt-4o-mini`, `claude-3-haiku`, and `gemini-1.5-flash` for free via Puter.js.
- **Smart Fallback:** Automatically switches models if one is unavailable or rate-limited.
- **Streaming:** Real-time typewriter responses with full Markdown & Code Highlighting.

### 🎤 Voice Interaction

- **Speech-to-Text:** Click the microphone to dictate your prompts.
- **Text-to-Speech:** AI reads responses aloud (Nova, Alloy, Echo voices).
- **Auto-Speak:** Toggle hands-free mode in Settings.

### 🎭 Custom Personas

- **Personality Engine:** Switch between "Coding God", "Research Demon", or create your own custom personas.
- **System Prompts:** Define exactly how you want the AI to behave.
- **Persistence:** Your personas and settings are saved automatically.

### 📁 Project Workspaces

- **Folder Selection:** Switch between different project folders in your Puter account using the top-right selector.
- **File Management:** Browse, create, and attach files from your selected workspace.
- **Cloud Sync:** All changes are saved to your Puter cloud drive automatically.

### 🎨 Mood Themes

- **Aesthetic Presets:** Choose between Void (Default), Toxic (Neon Green), or Overdrive (Cyberpunk) themes with smooth CSS transitions.
- **Persistence:** Your selected theme is saved to your Puter account.

### ⚡ The Executioner (Code Sandbox)

- **Live Execution:** Run Python and JavaScript code blocks directly within the chat interface.
- **Secure Sandbox:** Powered by Puter Workers for safe, isolated code execution.

### 🎭 Media Lab

- **Advanced Controls:** Fine-tune AI generation with aspect ratios (1:1, 16:9, 9:16), artistic styles, and negative prompts.
- **Prompt Engineering:** Automatically prepends styles to your prompts for superior output.

### 🧠 Neural Memory (Project Context)

- **Codebase Awareness:** Recursively indexes your project folder to provide the AI with structural context.
- **Better Answers:** The AI understands your project architecture even without files being explicitly attached.

### 🎙️ Semantic Voice & Intents

- **Natural Control:** Command the UI with your voice: *"Hey Gravity, switch to Toxic theme"* or *"Computer, open the src folder"*.
- **Voice Sessions:** Toggle continuous listening mode for hands-free workflow.

### 🗄️ OS Integration (Multi-Window)

- **Windowed Editor:** Open and edit any code/text file in a dedicated, draggable Puter window.
- **Full Sync:** Save changes directly back to your Puter cloud filesystem.

### 🔒 Privacy & Security (Hardened)

- **Client-Side:** Runs in your browser. No middleman servers (except Puter.js APIs).

- **XSS Protection:** All Markdown output is sanitized with DOMPurify to prevent malicious code execution.
- **Memory Safe:** Automatically manages chat history to prevent browser crashes during long sessions.

## 🛠️ Installation & Usage

There are two ways to use GravityChat:

### Option 1: Native App Mode (Recommended for Windows)

Run the included batch script to launch GravityChat as a standalone desktop app (requires Chrome):

```bash
start.bat
```

### Option 2: Run Locally (Dev Mode)

Since this uses modern browser APIs, it requires a local server context (not `file://`):

```bash
# Using Python
python -m http.server 8000
```

Open `http://localhost:8000/index.html` in your browser.

### Option 3: Run on Puter.com (Cloud)

1. Log in to your [Puter.com](https://puter.com) account.
2. Upload `index.html` to your file manager.
3. Double-click `index.html` to launch it instantly!

## 🔧 Technology Stack

- **Puter.js v2** - Cloud OS APIs (AI, FS, Auth, KV)
- **Tailwind CSS** - Utility-first styling
- **DaisyUI** - Cyberpunk theme components
- **Marked.js** - Markdown rendering
- **Highlight.js** - Syntax highlighting

## 🤝 Contributing

GravityChat is an open-source modular application. Feel free to fork and modify it!

---
> Built with ❤️ for the Puter Ecosystem
