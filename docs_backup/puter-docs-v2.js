const docs = {
  "version": "v2",
  "source": "https://docs.puter.com/",
  "generated_at": new Date().toISOString(),
  "modules": {
    "AI": {
      "description": "AI capabilities powered by varied vendors including OpenAI, Anthropic, Google, and more.",
      "methods": [
        {
          "name": "chat",
          "signature": "puter.ai.chat(prompt, options?)",
          "path": "/AI/chat/",
          "full_url": "https://docs.puter.com/AI/chat/",
          "description": "Given a prompt, returns the completion. Supports text-only and multimodal (image/file) inputs.",
          "parameters": [
            { "name": "prompt", "type": "string", "required": true, "description": "The prompt to complete." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "model": "string (default: 'gpt-5-nano')",
                "stream": "boolean (default: false)",
                "max_tokens": "number",
                "temperature": "number (0-2)",
                "tools": "array (function definitions)",
                "testMode": "boolean (default: false)",
                "image": "string|File (context image)",
                "imageURLArray": "array (image URLs)"
              }
            }
          ],
          "returns": "Promise<ChatResponse | AsyncIterable<ChatResponseChunk>>",
          "examples": [
            "puter.ai.chat(`What is life?`, { model: \"gpt-5-nano\" }).then(puter.print);",
            "// Streaming example\nconst resp = await puter.ai.chat('Tell me...', {stream: true});\nfor await (const part of resp) document.write(part?.text);"
          ],
          "notes": [
            "Supports Function Calling via 'tools' option.",
            "Supports Web Search option for OpenAI models: tools: [{type: 'web_search'}]"
          ]
        },
        {
          "name": "txt2speech",
          "signature": "puter.ai.txt2speech(text, options?)",
          "path": "/AI/txt2speech/",
          "full_url": "https://docs.puter.com/AI/txt2speech/",
          "description": "Converts text to speech audio.",
          "parameters": [
            { "name": "text", "type": "string", "required": true, "description": "Text to convert (< 3000 chars)." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "provider": "string ('aws-polly'|'openai'|'elevenlabs')",
                "voice": "string",
                "language": "string",
                "model": "string",
                "engine": "string (aws-polly only)",
                "testMode": "boolean"
              }
            }
          ],
          "returns": "Promise<HTMLAudioElement>"
        },
        {
          "name": "speech2txt",
          "signature": "puter.ai.speech2txt(source, options?)",
          "path": "/AI/speech2txt/",
          "full_url": "https://docs.puter.com/AI/speech2txt/",
          "description": "Transcribes audio to text.",
          "parameters": [
            { "name": "source", "type": "string|File|Blob", "required": true, "description": "Audio source (Puter path, data URL, File/Blob, or HTTPS URL)." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "model": "string ('gpt-4o-mini-transcribe', 'whisper-1', etc.)",
                "translate": "boolean (force English)",
                "response_format": "string ('json', 'text', 'srt', 'vtt', etc.)",
                "language": "string (ISO code hint)",
                "prompt": "string (context)",
                "temperature": "number",
                "test_mode": "boolean"
              }
            }
          ],
          "returns": "Promise<string | Speech2TxtResult>"
        },
        {
          "name": "txt2img",
          "signature": "puter.ai.txt2img(prompt, options?)",
          "path": "/AI/txt2img/",
          "full_url": "https://docs.puter.com/AI/txt2img/",
          "description": "Generates an image from a text prompt.",
          "parameters": [
            { "name": "prompt", "type": "string", "required": true, "description": "Prompt to generate image from." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "provider": "string ('openai-image-generation'|'gemini'|'together'|'xai')",
                "model": "string",
                "size": "string (e.g. '1024x1024')",
                "quality": "string ('standard'|'hd')",
                "style": "string ('vivid'|'natural')",
                "testMode": "boolean"
              }
            }
          ],
          "returns": "Promise<HTMLImageElement>"
        },
        {
          "name": "listModels",
          "signature": "puter.ai.listModels(provider?)",
          "path": "/AI/listModels/",
          "full_url": "https://docs.puter.com/AI/listModels/",
          "description": "Lists available AI models.",
          "parameters": [
             { "name": "provider", "type": "string", "required": false, "description": "Filter by provider (e.g. 'openai')." }
          ],
          "returns": "Promise<Array<{id: string, provider: string, name: string, context: number, max_tokens: number, cost: object}>>"
        }
      ]
    },
    "FS": {
      "description": "Cloud Storage / File System operations.",
      "methods": [
        {
          "name": "write",
          "signature": "puter.fs.write(path, data, options?)",
          "path": "/FS/write/",
          "full_url": "https://docs.puter.com/FS/write/",
          "description": "Writes data to a file.",
          "parameters": [
            { "name": "path", "type": "string", "required": true, "description": "Path to write to." },
            { "name": "data", "type": "string|File|Blob", "required": true, "description": "Content to write." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "overwrite": "boolean (default: true)",
                "dedupeName": "boolean (default: false)",
                "createMissingParents": "boolean (default: false)"
              }
            }
          ],
          "returns": "Promise<FSItem>"
        },
        {
          "name": "read",
          "signature": "puter.fs.read(path, options?)",
          "path": "/FS/read/",
          "full_url": "https://docs.puter.com/FS/read/",
          "description": "Reads a file.",
          "parameters": [
            { "name": "path", "type": "string", "required": true, "description": "Path to read." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "offset": "number",
                "byte_count": "number"
              }
            }
          ],
          "returns": "Promise<Blob>"
        },
        {
          "name": "readdir",
          "signature": "puter.fs.readdir(path, options?)",
          "path": "/FS/readdir/",
          "full_url": "https://docs.puter.com/FS/readdir/",
          "description": "Reads a directory's contents.",
          "parameters": [
            { "name": "path", "type": "string", "required": true, "description": "Directory path." },
            { "name": "options", "type": "object", "required": false, "fields": { "uid": "string" } }
          ],
          "returns": "Promise<FSItem[]>"
        },
        {
          "name": "mkdir",
          "signature": "puter.fs.mkdir(path, options?)",
          "path": "/FS/mkdir/",
          "full_url": "https://docs.puter.com/FS/mkdir/",
          "description": "Creates a directory.",
          "parameters": [
            { "name": "path", "type": "string", "required": true, "description": "Directory path." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "overwrite": "boolean (default: false)",
                "dedupeName": "boolean (default: false)",
                "createMissingParents": "boolean (default: false)"
               }
            }
          ],
          "returns": "Promise<FSItem>"
        },
        {
          "name": "stat",
          "signature": "puter.fs.stat(path, options?)",
          "path": "/FS/stat/",
          "full_url": "https://docs.puter.com/FS/stat/",
          "description": "Gets information about a file or directory.",
          "parameters": [
            { "name": "path", "type": "string", "required": true, "description": "Path to item." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "uid": "string",
                "returnSubdomains": "boolean",
                "returnPermissions": "boolean",
                "returnVersions": "boolean",
                "returnSize": "boolean"
               }
            }
          ],
          "returns": "Promise<FSItem>"
        },
        {
          "name": "delete",
          "signature": "puter.fs.delete(paths, options?)",
          "path": "/FS/delete/",
          "full_url": "https://docs.puter.com/FS/delete/",
          "description": "Deletes file(s) or directory(ies).",
          "parameters": [
            { "name": "paths", "type": "string|string[]", "required": true, "description": "Path(s) to delete." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "recursive": "boolean (default: true)",
                "descendantsOnly": "boolean (default: false)"
               }
            }
          ],
          "returns": "Promise<void>"
        },
        {
          "name": "copy",
          "path": "/FS/copy/",
          "full_url": "https://docs.puter.com/FS/copy/",
          "description": "Copies a file or directory.",
          "signature": "puter.fs.copy(source, destination, options?)",
          "parameters": [],
          "returns": "Promise<FSItem>"
        },
        {
          "name": "move",
          "path": "/FS/move/",
          "full_url": "https://docs.puter.com/FS/move/",
          "description": "Moves a file or directory.",
          "signature": "puter.fs.move(source, destination, options?)",
          "parameters": [],
          "returns": "Promise<FSItem>"
        }
      ]
    },
    "KV": {
      "description": "Key-Value Store.",
      "methods": [
        {
          "name": "set",
          "signature": "puter.kv.set(key, value, expireAt?)",
          "path": "/KV/set/",
          "full_url": "https://docs.puter.com/KV/set/",
          "description": "Creates or updates a key-value pair.",
          "parameters": [
            { "name": "key", "type": "string", "required": true, "description": "Key name (max 1KB)." },
            { "name": "value", "type": "string|number|boolean|object|array", "required": true, "description": "Value (max 400KB)." },
            { "name": "expireAt", "type": "number", "required": false, "description": "Expiration timestamp (seconds)." }
          ],
          "returns": "Promise<boolean>"
        },
        {
          "name": "get",
          "signature": "puter.kv.get(key)",
          "path": "/KV/get/",
          "full_url": "https://docs.puter.com/KV/get/",
          "description": "Retrieves the value of a key.",
          "parameters": [
             { "name": "key", "type": "string", "required": true }
          ],
          "returns": "Promise<any|null>"
        },
        {
          "name": "del",
          "signature": "puter.kv.del(key)",
          "path": "/KV/del/",
          "full_url": "https://docs.puter.com/KV/del/",
          "description": "Removes a key-value pair.",
          "parameters": [
             { "name": "key", "type": "string", "required": true }
          ],
          "returns": "Promise<boolean>"
        },
        {
          "name": "list",
          "signature": "puter.kv.list(pattern?, returnValues?)",
          "path": "/KV/list/",
          "full_url": "https://docs.puter.com/KV/list/",
          "description": "Lists keys or key-value pairs.",
          "parameters": [
            { "name": "pattern", "type": "string", "required": false, "description": "Prefix pattern (ends with *)." },
            { "name": "returnValues", "type": "boolean", "required": false, "description": "Return values along with keys." },
            { "name": "options", "type": "object", "required": false, "fields": {
                "limit": "number",
                "cursor": "string"
            }}
          ],
          "returns": "Promise<string[] | KVPair[] | KVListPage>"
        },
        {
            "name": "incr",
            "path": "/KV/incr/",
             "full_url": "https://docs.puter.com/KV/incr/",
             "description": "Increments a numeric value.",
             "signature": "puter.kv.incr(key, amount?)",
             "parameters": [],
             "returns": "Promise<number>"
        },
         {
            "name": "decr",
            "path": "/KV/decr/",
             "full_url": "https://docs.puter.com/KV/decr/",
             "description": "Decrements a numeric value.",
             "signature": "puter.kv.decr(key, amount?)",
             "parameters": [],
             "returns": "Promise<number>"
        }
      ]
    },
    "Auth": {
      "description": "User authentication.",
      "methods": [
        {
          "name": "signIn",
          "signature": "puter.auth.signIn(options?)",
          "path": "/Auth/signIn/",
          "full_url": "https://docs.puter.com/Auth/signIn/",
          "description": "Signs in the user via popup.",
          "parameters": [
             { "name": "options", "type": "object", "required": false, "fields": { "attempt_temp_user_creation": "boolean" }}
          ],
          "returns": "Promise<SignInResult>"
        },
        {
          "name": "signOut",
          "signature": "puter.auth.signOut()",
          "path": "/Auth/signOut/",
          "full_url": "https://docs.puter.com/Auth/signOut/",
          "description": "Signs out the current user.",
          "parameters": [],
          "returns": "void"
        },
        {
          "name": "getUser",
          "signature": "puter.auth.getUser()",
          "path": "/Auth/getUser/",
          "full_url": "https://docs.puter.com/Auth/getUser/",
          "description": "Gets current user info.",
          "parameters": [],
          "returns": "Promise<User>"
        },
        {
          "name": "isSignedIn",
          "signature": "puter.auth.isSignedIn()",
          "path": "/Auth/isSignedIn/",
          "full_url": "https://docs.puter.com/Auth/isSignedIn/",
          "description": "Checks if a user is signed in.",
          "parameters": [],
          "returns": "boolean"
        }
      ]
    },
    "Workers": {
        "description": "Serverless Workers.",
        "methods": [
            {
                "name": "create",
                "signature": "puter.workers.create(workerName, filePath)",
                "path": "/Workers/create/",
                "full_url": "https://docs.puter.com/Workers/create/",
                "description": "Creates a new worker from a JS file.",
                "parameters": [
                    { "name": "workerName", "type": "string", "required": true },
                    { "name": "filePath", "type": "string", "required": true }
                ],
                "returns": "Promise<WorkerDeployment>"
            },
            {
                "name": "list",
                "signature": "puter.workers.list()",
                "path": "/Workers/list/",
                "full_url": "https://docs.puter.com/Workers/list/",
                "description": "Lists all workers.",
                "parameters": [],
                "returns": "Promise<WorkerInfo[]>"
            },
            {
                "name": "delete",
                "signature": "puter.workers.delete(workerName)",
                "path": "/Workers/delete/",
                "full_url": "https://docs.puter.com/Workers/delete/",
                "description": "Deletes a worker.",
                "parameters": [
                    { "name": "workerName", "type": "string", "required": true }
                ],
                "returns": "Promise<boolean>"
            }
        ]
    },
    "UI": {
      "description": "UI components and window management.",
      "methods": [
        {
            "name": "alert",
            "signature": "puter.ui.alert(message, buttons?)",
            "path": "/UI/alert/",
            "full_url": "https://docs.puter.com/UI/alert/",
            "description": "Displays an alert dialog.",
            "parameters": [
                { "name": "message", "type": "string", "required": false },
                { "name": "buttons", "type": "Array<{label: string, value?: string, type?: string}>", "required": false }
            ],
            "returns": "Promise<string> (value or label of clicked button)"
        },
        {
            "name": "prompt",
            "signature": "puter.ui.prompt(message, placeholder?)",
            "path": "/UI/prompt/",
            "full_url": "https://docs.puter.com/UI/prompt/",
            "description": "Displays a prompt dialog.",
            "parameters": [
                { "name": "message", "type": "string", "required": false },
                { "name": "placeholder", "type": "string", "required": false }
            ],
            "returns": "Promise<string|null>"
        },
        {
            "name": "createWindow",
            "signature": "puter.ui.createWindow(options?)",
            "path": "/UI/createWindow/",
            "full_url": "https://docs.puter.com/UI/createWindow/",
            "description": "Creates a new window.",
            "parameters": [
                { "name": "options", "type": "object", "required": false, "fields": {
                    "center": "boolean",
                    "content": "string",
                    "disable_parent_window": "boolean",
                    "has_head": "boolean",
                    "height": "number",
                    "is_resizable": "boolean",
                    "show_in_taskbar": "boolean",
                    "title": "string",
                    "width": "number"
                }}
            ],
            "returns": "Promise<any> (Window object equivalent)"
        }
      ]
    },
    "Networking": {
      "description": "Networking utilities.",
      "methods": [
        {
            "name": "fetch",
            "signature": "puter.net.fetch(url, options?)",
            "path": "/Networking/fetch/",
            "full_url": "https://docs.puter.com/Networking/fetch/",
            "description": "Proxied fetch to avoid CORS.",
            "parameters": [
                { "name": "url", "type": "string", "required": true },
                { "name": "options", "type": "RequestInit", "required": false }
            ],
            "returns": "Promise<Response>"
        }
      ]
    },
    "Apps": {
        "description": "App management.",
        "methods": [
            {
                "name": "create",
                "signature": "puter.apps.create(name, indexURL, title?)",
                "path": "/Apps/create/",
                "full_url": "https://docs.puter.com/Apps/create/",
                "description": "Creates a new Puter app.",
                "parameters": [
                    { "name": "name", "type": "string", "required": true },
                    { "name": "indexURL", "type": "string", "required": true },
                    { "name": "title", "type": "string", "required": false }
                ],
                "returns": "Promise<CreateAppResult>"
            }
        ]
    },
    "Utils": {
      "description": "General utilities.",
      "methods": [
        {
            "name": "randName",
            "signature": "puter.randName(separator?)",
            "path": "/Utils/randName/",
            "full_url": "https://docs.puter.com/Utils/randName/",
            "description": "Generates a random name.",
            "parameters": [
                { "name": "separator", "type": "string", "required": false, "default": "-" }
            ],
            "returns": "string"
        },
        {
            "name": "env",
            "signature": "puter.env",
            "path": "/Utils/env/",
            "full_url": "https://docs.puter.com/Utils/env/",
            "description": "Current environment ('app', 'web', 'gui').",
            "parameters": [],
            "returns": "string"
        }
      ]
    }
  },
  "general": {
    "script_tag": "<script src=\"https://js.puter.com/v2/\"></script>",
    "user_pays_model": "See https://docs.puter.com/user-pays-model/"
  }
};

await puter.fs.write('puter-docs-v2.json', JSON.stringify(docs, null, 2));
puter.print('Documentation file saved: puter-docs-v2.json');
