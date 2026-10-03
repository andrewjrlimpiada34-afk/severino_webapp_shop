"""Run locally once. Writes private OAuth settings, never prints credentials."""
import json
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

from app import SCOPES

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('credentials', help='Downloaded Desktop OAuth client JSON')
    parser.add_argument('--sender', required=True, help='Gmail account being authorized')
    args = parser.parse_args()
    flow = InstalledAppFlow.from_client_secrets_file(args.credentials, SCOPES)
    credentials = flow.run_local_server(port=0, access_type='offline', prompt='consent')
    if not credentials.refresh_token:
        raise SystemExit('No refresh token received. Authorize again with consent.')
    config = json.loads(Path(args.credentials).read_text())['installed']
    target = Path('.env.gmail-api')
    target.write_text('\n'.join([
        f"GMAIL_API_CLIENT_ID={config['client_id']}",
        f"GMAIL_API_CLIENT_SECRET={config['client_secret']}",
        f'GMAIL_API_REFRESH_TOKEN={credentials.refresh_token}',
        f'GMAIL_API_SENDER={args.sender}',
    ]) + '\n')
    print(f'Saved private settings to {target.resolve()}. Copy them into Render environment settings.')
