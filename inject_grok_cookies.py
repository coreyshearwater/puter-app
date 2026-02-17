import json
import os
import sys

def main():
    print("==========================================")
    print("   Grok Session Cookie Injector (Auto)    ")
    print("==========================================")
    print("\nPaste your cookie string (from F12 Network tab) or header below:")
    print("(Example: sso=...; sso-rw=...)")
    
    try:
        raw_input = input("\n> ").strip()
    except EOFError:
        return

    sso = None
    sso_rw = None
    auth_token = None

    # Simple parsing
    if "sso=" in raw_input or "auth_token=" in raw_input:
        parts = raw_input.split(';')
        for part in parts:
            part = part.strip()
            if part.startswith('sso='):
                sso = part.replace('sso=', '')
            if part.startswith('sso-rw='):
                sso_rw = part.replace('sso-rw=', '')
            if part.startswith('auth_token='):
                auth_token = part.replace('auth_token=', '')
    elif len(raw_input) > 20 and not "=" in raw_input:
        # Assume it's a single raw cookie value the user pasted
        # We'll guess it's sso or auth_token based on format
        if len(raw_input) < 200:
             # Likely Anon SSO
             sso = raw_input
             sso_rw = raw_input
        elif len(raw_input) == 40 and raw_input.isalnum():
             auth_token = raw_input
        else:
             # Likely a long JWT SSO
             sso = raw_input
             sso_rw = raw_input

    if not sso and not sso_rw and not auth_token:
        print("\n[!] Error: No valid cookies found. Please paste the full 'Cookie:' header or individual values.")
        sys.exit(1)
        
    # Validation Warning
    if sso and len(sso) < 160:
        print("\n[!] WARNING: The 'sso' cookie you provided appears to be an ANONYMOUS session (len < 160).")
        print("    Anonymous sessions often trigger 403 Forbidden errors.")
        print("    Please ensure you are LOGGED IN at https://grok.com or https://x.com")
        print("    and provide the cookies again.")
        confirm = input("    Proceed anyway? (y/n) > ")
        if confirm.lower() != 'y':
            sys.exit(0)

    cookies = {
        "sso": sso or "",
        "sso-rw": sso_rw or "",
        "auth_token": auth_token or ""
    }
    
    # Prune empty keys
    cookies = {k: v for k, v in cookies.items() if v}

    # Save to a local file that the bridge can read as fallback
    # or just show the user how to paste it in the UI
    target_path = "grok_session.json"
    
    with open(target_path, "w") as f:
        json.dump(cookies, f, indent=4)

    print(f"\n[OK] Cookies saved to {target_path}")
    print("[TIP] Restart the bridge if it's running to apply these changes.")

if __name__ == "__main__":
    main()
