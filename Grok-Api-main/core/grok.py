from core        import Log, Run, Utils, Parser, Signature, Anon, Headers
from curl_cffi   import requests, CurlMime
from dataclasses import dataclass, field
from bs4         import BeautifulSoup
from json        import dumps, loads
from secrets     import token_hex
from uuid        import uuid4
import re

# Regex to strip xAI tool usage card metadata from streamed tokens
_XAI_TOOL_RE = re.compile(
    r'xai:tool_usage_card(?:_id[a-f0-9\-]+)?'
    r'|xai:tool_name\w*'
    r'|xai:tool_args',
    re.IGNORECASE
)

def _clean_xai_metadata(text: str) -> str:
    """Strip xAI tool usage card metadata from token text."""
    cleaned = _XAI_TOOL_RE.sub('', text)
    # Collapse multiple spaces/newlines left by removal
    cleaned = re.sub(r' {2,}', ' ', cleaned)
    return cleaned

@dataclass
class Models:
    models: dict[str, list[str]] = field(default_factory=lambda: {
        "grok-3-auto": ["MODEL_MODE_AUTO", "auto"],
        "grok-3-fast": ["MODEL_MODE_FAST", "fast"],
        "grok-4": ["MODEL_MODE_EXPERT", "expert"],
        "grok-4-mini-thinking-tahoe": ["MODEL_MODE_GROK_4_MINI_THINKING", "grok-4-mini-thinking"],
        "grok-4-20": ["MODEL_MODE_GROK_4_20", "grok-4-20"]
    })

    def get_model_mode(self, model: str, index: int) -> str:
        return self.models.get(model, ["MODEL_MODE_AUTO", "auto"])[index]

_Models = Models()

class Grok:
    
    def __init__(self, model: str = "grok-3-auto", proxy: str = None, cookies: dict = None) -> None:
        # Use a consistent browser impersonation
        self.session: requests.session.Session = requests.Session(impersonate="chrome131", default_headers=False)
        self.headers: Headers = Headers()
        
        self.model_mode: str = _Models.get_model_mode(model, 0)
        self.model: str = model
        self.mode: str = _Models.get_model_mode(model, 1)
        self.c_run: int = 0
        self.keys: dict = Anon.generate_keys()
        
        if cookies:
            self.session.cookies.update(cookies)
            
        if proxy:
            self.session.proxies = {
                "all": proxy
            }
        
        # Ensure auth_token is prioritized if present 
        # Ensure auth_token is prioritized if present 
        if cookies and "auth_token" in cookies:
             # Set auth_token for both domains
             self.session.cookies.set("auth_token", cookies["auth_token"], domain=".x.com")
             self.session.cookies.set("auth_token", cookies["auth_token"], domain=".grok.com")
             self.session.cookies.set("auth_token", cookies["auth_token"], domain=".twitter.com")
             
             # CRITICAL: Remove anonymous SSO cookies
             if "sso" in self.session.cookies and len(self.session.cookies["sso"]) < 200:
                 self.session.cookies.pop("sso", None)
                 self.session.cookies.pop("sso-rw", None)
                 Log.Success("Cleared anonymous SSO cookies")
                 
             # Pre-flight to X to refresh session?
             # No, simply setting the cookie should work if the domain matches.
    
    def _load(self, extra_data: dict = None) -> None:
        if not extra_data:
            self.session.headers = self.headers.LOAD
            
            # If we have an auth_token, ensure it's in the cookies for the main request
            # so the server sees us as logged in to X.
            if "auth_token" in self.session.cookies:
                 # Force referer to x.com to mimic login flow
                 self.session.headers["referer"] = "https://x.com/"
                 self.session.headers["origin"] = "https://x.com"
                 self.session.headers["sec-fetch-site"] = "same-site"
                 Log.Success("Using auth_token for X.com fallback authentication")
                 
            load_site: requests.models.Response = self.session.get('https://grok.com/c')
            
            if load_site.status_code != 200:
                Log.Error(f"Site Load Failed: {load_site.status_code}")
                # Try to continue but it might fail
                
            self.session.cookies.update(load_site.cookies)
            
            scripts: list = [s['src'] for s in BeautifulSoup(load_site.text, 'html.parser').find_all('script', src=True) if s['src'].startswith('/_next/static/chunks/')]

            if not scripts:
                 Log.Error("No scripts found in site load. Check cookies/proxy.")

            self.actions, self.xsid_script = Parser.parse_grok(scripts)
            
            self.baggage: str = Utils.between(load_site.text, '<meta name="baggage" content="', '"')
            self.sentry_trace: str = Utils.between(load_site.text, '<meta name="sentry-trace" content="', '-')
            Log.Success(f"Site Loaded. Actions: {len(self.actions)}")
        else:
            self.session.cookies.update(extra_data["cookies"])

            self.actions: list = extra_data["actions"]
            self.xsid_script: list =  extra_data["xsid_script"]
            self.baggage: str = extra_data["baggage"]
            self.sentry_trace: str = extra_data["sentry_trace"]
            
    
    def c_request(self, next_action: str) -> None:
        self.session.headers = self.headers.C_REQUEST
        self.session.headers.update({
            'baggage': self.baggage,
            'next-action': next_action,
            'sentry-trace': f'{self.sentry_trace}-{str(uuid4()).replace("-", "")[:16]}-0',
        })
        self.session.headers = Headers.fix_order(self.session.headers, self.headers.C_REQUEST)
        
        if self.c_run == 0:
            self.session.headers.pop("content-type")
            
            mime = CurlMime()
            mime.addpart(name="1", data=bytes(self.keys["userPublicKey"]), filename="blob", content_type="application/octet-stream")
            mime.addpart(name="0", filename=None, data='[{"userPublicKey":"$o1"}]')
            
            c_request: requests.models.Response = self.session.post("https://grok.com/c", multipart=mime)
            
            if c_request.status_code != 200:
                 Log.Error(f"C_Request 0 (Keys) Failed: {c_request.status_code}")

            self.session.cookies.update(c_request.cookies)
            
            self.anon_user: str = Utils.between(c_request.text, '{"anonUserId":"', '"')
            self.c_run += 1
            Log.Success(f"Keys Registered. AnonID: {self.anon_user[:8]}...")
            
        else:
            match self.c_run:
                case 1:
                    data: str = dumps([{"anonUserId":self.anon_user}])
                case 2:
                    data: str = dumps([{"anonUserId":self.anon_user,**self.challenge_dict}])
            
            c_request: requests.models.Response = self.session.post('https://grok.com/c', data=data)
            
            if c_request.status_code != 200:
                 Log.Error(f"C_Request {self.c_run} Failed: {c_request.status_code}")

            self.session.cookies.update(c_request.cookies)

            match self.c_run:
                case 1:
                    start_idx = c_request.content.hex().find("3a6f38362c")
                    if start_idx != -1:
                        start_idx += len("3a6f38362c")
                        end_idx = c_request.content.hex().find("313a", start_idx)
                        if end_idx != -1:
                            challenge_hex = c_request.content.hex()[start_idx:end_idx]
                            challenge_bytes = bytes.fromhex(challenge_hex)

                    self.challenge_dict: dict = Anon.sign_challenge(challenge_bytes, self.keys["privateKey"])
                    Log.Success(f"Solved Challenge.")
                case 2:
                    self.verification_token, self.anim = Parser.get_anim(c_request.text, "grok-site-verification")
                    self.svg_data, self.numbers = Parser.parse_values(c_request.text, self.anim, self.xsid_script)
                    Log.Success("Verification parsed. Ready for convo.")
                    
            self.c_run += 1
    
    def _stream_response(self, response_stream, extra_data, conversation_id=None, parent_response=None):
        """Helper to yield stream chunks and final metadata"""
        response_text = ""
        stream_tokens = []
        image_urls = None
        
        if response_stream.status_code != 200:
            error_msg = f"Grok API Error {response_stream.status_code}: {response_stream.text[:200]}"
            if response_stream.status_code == 403:
                error_msg += " (Anti-bot block. Please provide valid cookies [sso/sso-rw] in the request)"
            yield {"error": error_msg}
            return

        # Use existing parsing logic but per-line
        for line in response_stream.iter_lines():
            if not line: continue
            try:
                line_str = line.decode('utf-8')
                data: dict = loads(line_str)
                
                # Extract token from multiple possible paths (new, reply, reasoning)
                token = (
                    data.get('result', {}).get('token') or
                    data.get('result', {}).get('response', {}).get('token') or
                    data.get('result', {}).get('response', {}).get('modelResponse', {}).get('token')
                )
                
                if token:
                    token = _clean_xai_metadata(token)
                    if token.strip():  # Only yield non-empty tokens after cleaning
                        stream_tokens.append(token)
                        response_text += token
                        yield {"type": "token", "content": token}
                
                # Extract Metadata if present
                if not conversation_id and data.get('result', {}).get('conversation', {}).get('conversationId'):
                    conversation_id = data['result']['conversation']['conversationId']

                if not parent_response and data.get('result', {}).get('response', {}).get('modelResponse', {}).get('responseId'):
                    parent_response = data['result']['response']['modelResponse']['responseId']
                
            except Exception as e:
                # Log parsing errors to terminal for diagnostics
                print(f"DEBUG: Grok stream parse error on line: {line[:50]}... Error: {e}")
                pass
        
        # Final Metadata yield
        final_extra = {
            "anon_user": self.anon_user,
            "cookies": self.session.cookies.get_dict(),
            "actions": self.actions,
            "xsid_script": self.xsid_script,
            "baggage": self.baggage,
            "sentry_trace": self.sentry_trace,
            "conversationId": conversation_id or (extra_data.get("conversationId") if extra_data else None),
            "parentResponseId": parent_response,
            "privateKey": self.keys["privateKey"]
        }
        yield {"type": "final", "extra_data": final_extra}

    def start_convo(self, message: str, extra_data: dict = None, stream: bool = False):
        
        if not extra_data:
            self._load()
            self.c_request(self.actions[0])
            self.c_request(self.actions[1])
            self.c_request(self.actions[2])
            xsid: str = Signature.generate_sign('/rest/app-chat/conversations/new', 'POST', self.verification_token, self.svg_data, self.numbers)
        else:
            self._load(extra_data)
            self.c_run: int = 1
            self.anon_user: str = extra_data["anon_user"]
            self.keys["privateKey"] = extra_data["privateKey"]
            self.c_request(self.actions[1])
            self.c_request(self.actions[2])
            xsid: str = Signature.generate_sign(f'/rest/app-chat/conversations/{extra_data["conversationId"]}/responses', 'POST', self.verification_token, self.svg_data, self.numbers)

        self.session.headers = self.headers.CONVERSATION
        if "auth_token" in self.session.cookies:
            # We are "coming from" x.com if we are using auth_token login flow
            self.session.headers['origin'] = "https://grok.com"
            self.session.headers['referer'] = "https://grok.com/"
            
            # Send an OPTIONS pre-flight to maybe help set cookies?
            try:
                self.session.options(f'https://grok.com/rest/app-chat/conversations/new', headers=self.session.headers)
            except: pass
            
        self.session.headers.update({
            'baggage': self.baggage,
            'sentry-trace': f'{self.sentry_trace}-{str(uuid4()).replace("-", "")[:16]}-0',
            'x-statsig-id': xsid,
            'x-xai-request-id': str(uuid4()),
            'traceparent': f"00-{token_hex(16)}-{token_hex(8)}-00"
        })
        self.session.headers = Headers.fix_order(self.session.headers, self.headers.CONVERSATION)
        
        if not extra_data:
            conversation_data = {
                'temporary': False,
                'modelName': self.model,
                'message': message,
                'fileAttachments': [],
                'imageAttachments': [],
                'disableSearch': False,
                'enableImageGeneration': True,
                'returnImageBytes': False,
                'returnRawGrokInXaiRequest': False,
                'enableImageStreaming': True,
                'imageGenerationCount': 2,
                'forceConcise': False,
                'toolOverrides': {},
                'enableSideBySide': True,
                'sendFinalMetadata': True,
                'isReasoning': False,
                'webpageUrls': [],
                'disableTextFollowUps': False,
                'responseMetadata': {'requestModelDetails': {'modelId': self.model}},
                'disableMemory': False,
                'modelMode': self.model_mode,
                'isAsyncChat': False
            }
            
            convo_request = self.session.post('https://grok.com/rest/app-chat/conversations/new', json=conversation_data, timeout=9999, stream=True)
            
            if stream:
                return self._stream_response(convo_request, extra_data)

            # --- Legacy Non-Streaming Logic ---
            if "modelResponse" in convo_request.text:
                # ... Previous Parsing Logic ...
                # Re-implement using the text we just read (if we didn't stream)
                # But wait, .text might consume stream?
                # If stream=True was passed to post(), then .text works? 
                # Yes, in Requests it does. In curl_cffi?
                # Probably.
                
                # To be safe, I'm duplicating logic.
                response = conversation_id = parent_response = image_urls = None
                stream_response = []
                
                for response_dict in convo_request.text.strip().split('\n'):  
                    try:
                        data = loads(response_dict)
                        token = data.get('result', {}).get('response', {}).get('token')
                        if token:
                            token = _clean_xai_metadata(token)
                            if token.strip(): stream_response.append(token)
                            
                        if not response and data.get('result', {}).get('response', {}).get('modelResponse', {}).get('message'):
                            response = _clean_xai_metadata(data['result']['response']['modelResponse']['message'])

                        if not conversation_id and data.get('result', {}).get('conversation', {}).get('conversationId'):
                            conversation_id = data['result']['conversation']['conversationId']

                        if not parent_response and data.get('result', {}).get('response', {}).get('modelResponse', {}).get('responseId'):
                            parent_response = data['result']['response']['modelResponse']['responseId']
                        
                        if not image_urls and data.get('result', {}).get('response', {}).get('modelResponse', {}).get('generatedImageUrls', {}):
                            image_urls = data['result']['response']['modelResponse']['generatedImageUrls']
                    except Exception: pass
                
                return {
                    "response": response,
                    "stream_response": stream_response,
                    "images": image_urls,
                    "extra_data": {
                        "anon_user": self.anon_user,
                        "cookies": self.session.cookies.get_dict(),
                        "actions": self.actions,
                        "xsid_script": self.xsid_script,
                        "baggage": self.baggage,
                        "sentry_trace": self.sentry_trace,
                        "conversationId": conversation_id,
                        "parentResponseId": parent_response,
                        "privateKey": self.keys["privateKey"]
                    }
                }
            else:
                 # Error handling
                 if 'rejected by anti-bot rules' in convo_request.text or convo_request.status_code == 403:
                     return {"error": f"Grok 403: Anti-bot block. Try manual cookies injection."}
                 elif "Grok is under heavy usage" in convo_request.text:
                     Log.Error("Grok usage limit")
                     return {"error": "Grok usage limit"}
                 return {"error": convo_request.text}

        else:
            # REPLY logic
            conversation_data = {
                'message': message,
                'modelName': self.model,
                'parentResponseId': extra_data["parentResponseId"],
                'disableSearch': False,
                'enableImageGeneration': True,
                'imageAttachments': [],
                'returnImageBytes': False,
                'returnRawGrokInXaiRequest': False,
                'fileAttachments': [],
                'enableImageStreaming': True,
                'imageGenerationCount': 2,
                'forceConcise': False,
                'toolOverrides': {},
                'enableSideBySide': True,
                'sendFinalMetadata': True,
                'customPersonality': '',
                'isReasoning': False,
                'webpageUrls': [],
                'metadata': {
                    'requestModelDetails': {'modelId': self.model},
                    'request_metadata': {'model': self.model, 'mode': self.mode},
                },
                'disableTextFollowUps': False,
                'disableArtifact': False,
                'isFromGrokFiles': False,
                'disableMemory': False,
                'forceSideBySide': False,
                'modelMode': self.model_mode,
                'isAsyncChat': False,
                'skipCancelCurrentInflightRequests': False,
                'isRegenRequest': False,
            }

            convo_request = self.session.post(f'https://grok.com/rest/app-chat/conversations/{extra_data["conversationId"]}/responses', json=conversation_data, timeout=9999, stream=True)

            if stream:
                return self._stream_response(convo_request, extra_data, conversation_id=extra_data["conversationId"])
            
            # Non-streaming
            if "modelResponse" in convo_request.text:
                response = conversation_id = parent_response = image_urls = None
                stream_response = []
                
                for response_dict in convo_request.text.strip().split('\n'):
                    try:
                        data = loads(response_dict)
                        token = data.get('result', {}).get('token')
                        if token:
                            token = _clean_xai_metadata(token)
                            if token.strip(): stream_response.append(token)
                            
                        if not response and data.get('result', {}).get('modelResponse', {}).get('message'):
                            response = _clean_xai_metadata(data['result']['modelResponse']['message'])

                        if not parent_response and data.get('result', {}).get('modelResponse', {}).get('responseId'):
                            parent_response = data['result']['modelResponse']['responseId']
                            
                        if not image_urls and data.get('result', {}).get('modelResponse', {}).get('generatedImageUrls', {}):
                            image_urls = data['result']['modelResponse']['generatedImageUrls']
                    except Exception: pass
                
                return {
                    "response": response,
                    "stream_response": stream_response,
                    "images": image_urls,
                    "extra_data": {
                        "anon_user": self.anon_user,
                        "cookies": self.session.cookies.get_dict(),
                        "actions": self.actions,
                        "xsid_script": self.xsid_script,
                        "baggage": self.baggage,
                        "sentry_trace": self.sentry_trace,
                        "conversationId": extra_data["conversationId"],
                        "parentResponseId": parent_response,
                        "privateKey": self.keys["privateKey"]
                    }
                }
            else:
                error_body = convo_request.text[:200]
                if convo_request.status_code == 403:
                    return {"error": f"Grok API 403: Forbidden. {error_body}. Session likely flagged; inject cookies."}
                return {"error": error_body}
