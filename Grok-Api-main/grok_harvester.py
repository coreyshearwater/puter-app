import os
import json
import base64
import sqlite3
import shutil
import re
from core.browser_utils import (
    get_encryption_key, decrypt_cookie, clean_decrypted_value, 
    is_logged_in_token, get_chromium_profiles, get_gecko_profiles
)

def get_jwt_payload_brief(value):

def get_jwt_payload_brief(value):
    """Return a brief summary of the JWT payload for diagnostics."""
    try:
        if "eyJ" not in value: return "Not a JWT"
        parts = value.split('.')
        if len(parts) >= 2:
            padding = '=' * (4 - len(parts[1]) % 4)
            payload_json = base64.urlsafe_b64decode(parts[1] + padding).decode('utf-8')
            payload = json.loads(payload_json)
            return f"Keys: {list(payload.keys())}"
    except:
        pass
    return "Invalid/Unpadded JWT"

def harvest_from_chromium(label, user_data_dir):
    local_state = os.path.join(user_data_dir, "Local State")
    if not os.path.exists(local_state): return []
    
    profiles = get_chromium_profiles(user_data_dir)
    if not profiles: return []

    try:
        key = get_encryption_key(local_state)
    except Exception as e:
        print(f"    [!] Error getting key for {label}: {e}")
        return []

    results = []
    for p in profiles:
        for rel in ["Network/Cookies", "Cookies"]:
            cookies_path = os.path.join(user_data_dir, p, rel)
            if not os.path.exists(cookies_path): continue
            
            print(f"[*] Scanning {label}_{p}...")
            temp_db = f"temp_{label}_{p}.db".replace(" ", "_")
            try:
                # Chromium often locks the DB exclusively.
                shutil.copyfile(cookies_path, temp_db)
            except Exception as e:
                print(f"    [!] LOCKED: {label}_{p} is busy (Close the browser).")
                continue
            
            try:
                db = sqlite3.connect(temp_db)
                cursor = db.cursor()
                cursor.execute("SELECT host_key, name, encrypted_value FROM cookies")
                matched = 0
                for host, name, enc_val in cursor.fetchall():
                    raw = decrypt_cookie(enc_val, key)
                    if raw.startswith(b"Error:"):
                        continue
                        
                    val = clean_decrypted_value(raw)
                    name_l = name.lower()
                    
                    is_target_name = any(k in name_l for k in ["auth_token", "twid", "sso", "session_id", "xsid", "kdt"])
                    is_target_domain = any(d in host.lower() for d in ["grok.com", "x.ai", "twitter.com", "x.com", "xai.com", "google.com"])
                    
                    if is_target_name or is_target_domain:
                        results.append({
                            "host": host, "name": name, "val": val, 
                            "logged_in": is_logged_in_token(name, val), "browser": label
                        })
                        matched += 1
                
                db.close()
                if matched > 0:
                    print(f"    [+] Matched {matched} cookies in {label}_{p}")
            except Exception as e:
                print(f"    [!] Error reading {label}_{p}: {e}")
            finally:
                if os.path.exists(temp_db): os.remove(temp_db)
                
    return results

def harvest_from_gecko(label, app_data_dir):
    """Harvest from Firefox-based browsers (Floorp, Firefox)."""
    profile_paths = get_gecko_profiles(app_data_dir)
    if not profile_paths: return []
                
    results = []
    for p_path in profile_paths:
        cookies_sqlite = os.path.join(p_path, "cookies.sqlite")
        if not os.path.exists(cookies_sqlite): continue
        
        print(f"[*] Scanning {label} profile: {os.path.basename(p_path)}...")
        temp_db = f"temp_{label}_gecko.db"
        for suffix in ["", "-wal", "-shm"]:
            src = cookies_sqlite + suffix
            if os.path.exists(src):
                try: shutil.copyfile(src, temp_db + suffix)
                except: pass
            
        try:
            db = sqlite3.connect(temp_db)
            cursor = db.cursor()
            
            # Check if originAttributes column exists (Firefox Containers)
            try:
                cursor.execute("SELECT host, name, value, originAttributes FROM moz_cookies")
                rows = cursor.fetchall()
                has_containers = True
            except:
                cursor.execute("SELECT host, name, value FROM moz_cookies")
                rows = cursor.fetchall()
                has_containers = False
                
            matched = 0
            for row in rows:
                if has_containers:
                    host, name, value, origin_attr = row
                    container = f"[{origin_attr}]" if origin_attr else ""
                else:
                    host, name, value = row
                    container = ""
                
                name_l = name.lower()
                
                # Search for sso and auth-related cookies on ANY domain
                is_target_name = any(k in name_l for k in ["auth_token", "twid", "sso", "session_id", "xsid", "kdt", "clearance", "bm"])
                is_target_domain = any(d in host.lower() for d in ["grok.com", "x.ai", "twitter.com", "x.com", "xai.com", "google.com"])
                
                clean_val = clean_decrypted_value(value)
                
                if is_target_name or is_target_domain:
                    # print(f"    [d] Gecko | {host} | {name} | Len: {len(clean_val)}")

                    results.append({
                         "host": host, "name": name, "val": clean_val,
                         "logged_in": is_logged_in_token(name, clean_val), 
                         "browser": f"{label}{container}"
                    })
                    matched += 1
            db.close()
            if matched > 0:
                print(f"    [+] Matched {matched} cookies in {label}")
        except Exception as e:
            print(f"    [!] Error reading {label}: {e}")
        finally:
            for suffix in ["", "-wal", "-shm"]:
                if os.path.exists(temp_db + suffix): 
                    try: os.remove(temp_db + suffix)
                    except: pass
            
    return results

def clean_decrypted_value(raw):
    """Aggressively strip binary prefixes from decrypted Chrome cookies."""
    if isinstance(raw, str): return raw.strip()
    
    # 1. Anchor Search: JWT (sso, sso-rw)
    jwt_match = re.search(b'(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)', raw)
    if jwt_match:
        return jwt_match.group(1).decode('utf-8')

    # 2. Anchor Search: JSON (Mixpanel, etc.)
    json_match = re.search(b'({.*})|(%7B.*%7D)', raw)
    if json_match:
        try:
            val = json_match.group(0).decode('utf-8', errors='ignore').split('\x00')[0].strip()
            if len(val) > 10: return val
        except:
            pass

    # 3. Robust Sequence Search
    match = re.search(b'[a-zA-Z0-9]{5,}[ -~]{10,}', raw)
    if match:
        return match.group(0).decode('utf-8', errors='ignore').split('\x00')[0].strip()
                    
    return raw.decode('utf-8', errors='ignore').split('\x00')[0].strip()

def harvest():
    all_results = []
    local_app_data = os.environ.get("LOCALAPPDATA")
    app_data = os.environ.get("APPDATA")
    
    # 1. Chromium Browsers & Apps (WebView2)
    chromium_configs = [
        ("Bundled", os.path.join("..", "chrome_data")),
        ("Chrome", os.path.join(local_app_data, "Google/Chrome/User Data")),
        ("Edge", os.path.join(local_app_data, "Microsoft/Edge/User Data")),
        ("Brave", os.path.join(local_app_data, "BraveSoftware/Brave-Browser/User Data")),
        ("Chromium", os.path.join(local_app_data, "Chromium/User Data")),
        # Add WebView2 app-specific paths found on system
        ("NexusChat", os.path.join(local_app_data, "com.localnexus.chat/EBWebView")),
        ("NexusApp", os.path.join(local_app_data, "com.localnexus.app/EBWebView")),
        ("Layendan", os.path.join(local_app_data, "com.layendan.dev/EBWebView"))
    ]
    for label, path in chromium_configs:
        if path and os.path.exists(path):
            all_results.extend(harvest_from_chromium(label, path))
            
    # 2. Gecko Browsers (Firefox/Floorp)
    gecko_configs = [
        ("Floorp", os.path.join(app_data, "Floorp") if app_data else ""),
        ("Firefox", os.path.join(app_data, "Mozilla/Firefox") if app_data else "")
    ]
    for label, path in gecko_configs:
        if path and os.path.exists(path):
            all_results.extend(harvest_from_gecko(label, path))

    if all_results:
        # Whitelist
        WHITELIST = ["sso", "sso-rw", "cf_clearance", "__cf_bm", "x-anon-p-id", "x-xsid", "_ga", "auth_token", "twid", "personalization_id", "oauth"]
        # Sort: 1. Logged In, 2. Length
        all_results.sort(key=lambda x: (x.get("logged_in", False), len(x["val"])), reverse=True)
        
        # Diagnostics: Show exactly what we found for 'sso' and 'auth' and 'oauth'
        print("[*] Session Diagnostics:")
        for r in all_results:
            name_lower = r["name"].lower()
            if any(k in name_lower for k in ["sso", "auth", "oauth"]):
                status = " (LOGGED-IN)" if r.get("logged_in") else " (ANON)"
                payload_info = ""
                if "eyJ" in r["val"]:
                    payload_info = f" | Payload: {get_jwt_payload_brief(r['val'])}"
                print(f"    - Found {r['name']} | Len: {len(r['val'])}{status}{payload_info} | Host: {r['host']} | Browser: {r['browser']}")

        final_cookies = {}
        for r in all_results:
            if r["name"] not in final_cookies and r["name"] in WHITELIST:
                final_cookies[r["name"]] = r["val"]

        if final_cookies:
            with open("grok_session.json", "w") as f:
                json.dump(final_cookies, f, indent=4)
            print(f"[OK] Harvest Success: {len(final_cookies)} tokens saved.")
            
            has_login = any(is_logged_in_token(k, v) for k,v in final_cookies.items())
            if not has_login:
                print("[!] WARNING: All captured 'sso' tokens appear to be ANONYMOUS.")
                print("[!] Action Required: Open Grok in your browser, perform a search, and then re-run this harvester.")
            return final_cookies
            
    print("[!] No tokens found.")
    return None

if __name__ == "__main__":
    harvest()
