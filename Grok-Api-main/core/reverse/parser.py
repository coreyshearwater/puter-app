from re        import findall, search
from json      import load, dump, loads
from base64    import b64decode
from typing    import Optional
from curl_cffi import requests
from core      import Utils
from os        import path
import os

# Path normalization for mappings
CORE_DIR = path.dirname(path.dirname(path.abspath(__file__)))
GROK_MAPPING_PATH = path.join(CORE_DIR, 'mappings', 'grok.json')
TXID_MAPPING_PATH = path.join(CORE_DIR, 'mappings', 'txid.json')

class Parser:
    
    mapping: dict = {}
    _mapping_loaded: bool = False
    
    grok_mapping: list = []
    _grok_mapping_loaded: bool = False
    
    @classmethod
    def _load__xsid_mapping(cls):
        if not cls._mapping_loaded and path.exists(TXID_MAPPING_PATH):
            with open(TXID_MAPPING_PATH, 'r') as f:
                cls.mapping = load(f)
            cls._mapping_loaded = True
            
    @classmethod
    def _load_grok_mapping(cls):
        if not cls._grok_mapping_loaded and path.exists(GROK_MAPPING_PATH):
            with open(GROK_MAPPING_PATH, 'r') as f:
                cls.grok_mapping = load(f)
            cls._grok_mapping_loaded = True
    
    @staticmethod
    def parse_values(html: str, loading: int = 0, scriptId: str = "") -> tuple[str, Optional[str]]:

        Parser._load__xsid_mapping()
        
        matches = findall(r'\[\[{"color".*?}\]\]', html)
        if not matches:
            return "M 0,0 L 0,0" # Fallback SVG
            
        d_values = loads(matches[0])[loading]
        svg_data = "M 10,30 C" + " C".join(
            f" {item['color'][0]},{item['color'][1]} {item['color'][2]},{item['color'][3]} {item['color'][4]},{item['color'][5]}"
            f" h {item['deg']}"
            f" s {item['bezier'][0]},{item['bezier'][1]} {item['bezier'][2]},{item['bezier'][3]}"
            for item in d_values
        )
        
        if scriptId:
            if scriptId == "ondemand.s":
                script_link: str = 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.' + Utils.between(html, f'"{scriptId}":"', '"') + 'a.js'
            else:
                script_link: str = f'https://grok.com/_next/{scriptId}'

            if script_link in Parser.mapping:
                numbers: list = Parser.mapping[script_link]
            else:
                script_content: str = requests.get(script_link, impersonate="chrome136").text
                numbers: list = [int(x) for x in findall(r'x\[(\d+)\]\s*,\s*16', script_content)]
                Parser.mapping[script_link] = numbers
                with open(TXID_MAPPING_PATH, 'w') as f:
                    dump(Parser.mapping, f)

            return svg_data, numbers
        else:
            return svg_data

    @staticmethod
    def get_anim(html:  str, verification: str = "grok-site-verification") -> tuple[str, int]:
        verification_token: str = Utils.between(html, f'"name":"{verification}","content":"', '"')
        if not verification_token:
             return "", 0
             
        array: list = list(b64decode(verification_token))
        anim: int = int(array[5] % 4)
        return verification_token, anim
    
    @staticmethod
    def parse_grok(scripts: list) -> tuple[list, str]:
        Parser._load_grok_mapping()
        
        for index in Parser.grok_mapping:
            if index.get("action_script") in scripts:
                return index["actions"], index["xsid_script"]
            
        script_content1 = None
        script_content2 = None
        action_script = None

        for script in scripts:
            try:
                content: str = requests.get(f'https://grok.com{script}', impersonate="chrome136").text
                if "anonPrivateKey" in content:
                    script_content1 = content
                    action_script = script
                elif "880932)" in content:
                    script_content2 = content
            except:
                continue

        if script_content1 and script_content2:
            actions: list = findall(r'createServerReference\)\("([a-f0-9]+)"', script_content1)
            xsid_match = search(r'"(static/chunks/[^"]+\.js)"[^}]*?\(880932\)', script_content2)
            xsid_script = xsid_match.group(1) if xsid_match else None
            
            if actions and xsid_script:
                Parser.grok_mapping.append({
                    "xsid_script": xsid_script,
                    "action_script": action_script,
                    "actions": actions
                })
                
                with open(GROK_MAPPING_PATH, 'w') as f:
                    dump(Parser.grok_mapping, f, indent=2)
                    
                return actions, xsid_script
        
        raise Exception("Grok script harvest failed. Ensure you have valid cookies.")