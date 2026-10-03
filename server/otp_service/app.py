"""Internal Python OTP service; Gmail API uses HTTPS, never SMTP."""
import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import tempfile
import time
from contextlib import asynccontextmanager
from email.message import EmailMessage

import psycopg
import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def required(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(f'{name} is required')
    return value


def setting(name, default):
    value = int(os.environ.get(name, default))
    if value <= 0:
        raise RuntimeError(f'{name} must be positive')
    return value


def connect():
    kwargs = {'connect_timeout': 10, 'row_factory': dict_row}
    if os.environ.get('DB_SSL', 'true').lower() == 'true':
        kwargs['sslmode'] = 'verify-full'
        if os.environ.get('DB_SSL_REJECT_UNAUTHORIZED', 'true').lower() != 'true':
            kwargs['sslmode'] = 'require'
        if os.environ.get('DB_SSL_CA_BASE64'):
            kwargs['sslrootcert'] = CA_PATH
    if os.environ.get('DATABASE_URL'):
        return psycopg.connect(os.environ['DATABASE_URL'], **kwargs)
    return psycopg.connect(host=required('DB_HOST'), port=int(os.environ.get('DB_PORT', 5432)),
                           user=required('DB_USER'), password=required('DB_PASSWORD'),
                           dbname=required('DB_NAME'), **kwargs)


CA_PATH = None


@asynccontextmanager
async def lifespan(app):
    global CA_PATH
    if len(required('OTP_SERVICE_KEY')) < 32:
        raise RuntimeError('OTP_SERVICE_KEY must contain at least 32 characters')
    for name in ('GMAIL_API_CLIENT_ID', 'GMAIL_API_CLIENT_SECRET', 'GMAIL_API_REFRESH_TOKEN', 'GMAIL_API_SENDER'):
        required(name)
    if os.environ.get('DB_SSL_CA_BASE64'):
        with tempfile.NamedTemporaryFile(delete=False, suffix='.crt') as certificate:
            certificate.write(base64.b64decode(os.environ['DB_SSL_CA_BASE64'], validate=True))
            CA_PATH = certificate.name
    try:
        with connect() as db:
            db.execute('SELECT 1 FROM otps LIMIT 1')
        yield
    finally:
        if CA_PATH:
            os.unlink(CA_PATH)


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def authorize(authorization: str = Header(default='')):
    if not hmac.compare_digest(authorization, f"Bearer {required('OTP_SERVICE_KEY')}"):
        raise HTTPException(401, 'Unauthorized')


@app.exception_handler(HTTPException)
async def http_error(request, error):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=error.status_code, content={'message': error.detail})


@app.exception_handler(Exception)
async def unexpected_error(request, error):
    from fastapi.responses import JSONResponse
    logging.error('OTP operation failed (%s)', type(error).__name__)
    return JSONResponse(status_code=503, content={'message': 'OTP service unavailable. Please try again.'})


@app.exception_handler(RequestValidationError)
async def invalid_payload(request, error):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={'message': 'Invalid input'})


class Payload(BaseModel):
    email: str = Field(default='', max_length=320)
    challengeId: str = Field(default='', max_length=384)
    code: str = Field(default='', max_length=20)
    clientIp: str = Field(default='unknown', max_length=100)


def now_ms():
    return int(time.time() * 1000)


def digest(challenge_id, code):
    # 80-bit keyed digest fits the existing VARCHAR(20); no plaintext new codes.
    return hmac.new(required('OTP_SERVICE_KEY').encode(),
                    f'{challenge_id}:{code}'.encode(), hashlib.sha256).hexdigest()[:20]


def send_email(email, code, ttl):
    credentials = Credentials(None, refresh_token=required('GMAIL_API_REFRESH_TOKEN'),
                              token_uri='https://oauth2.googleapis.com/token',
                              client_id=required('GMAIL_API_CLIENT_ID'),
                              client_secret=required('GMAIL_API_CLIENT_SECRET'), scopes=SCOPES)
    session = requests.Session()
    google_request = Request(session=session)
    credentials.refresh(lambda *args, **kwargs: google_request(*args, **{**kwargs, 'timeout': 15}))
    message = EmailMessage()
    message['From'] = f"{os.environ.get('MAIL_FROM_NAME', 'Severino Shop')} <{required('GMAIL_API_SENDER')}>"
    message['To'] = email
    message['Subject'] = 'Verify your Severino account'
    message.set_content(f'Your Severino verification code is {code}. It expires in {ttl // 60000} minutes.')
    response = session.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                            headers={'Authorization': f'Bearer {credentials.token}'},
                            json={'raw': base64.urlsafe_b64encode(message.as_bytes()).decode()}, timeout=20)
    response.raise_for_status()


def issue(db, email, user_id=None):
    # Serialize requests for each mailbox across workers and service restarts.
    db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', (email,))
    recent = db.execute('SELECT * FROM otps WHERE email=%s ORDER BY created_at DESC LIMIT 1', (email,)).fetchone()
    if recent and now_ms() - int(recent['created_at'].timestamp() * 1000) < setting('OTP_RESEND_MS', 60000):
        raise HTTPException(429, 'Please wait before requesting another OTP.')
    count = db.execute("SELECT count(*) AS total FROM otps WHERE email=%s AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'", (email,)).fetchone()['total']
    if count >= 5:
        raise HTTPException(429, 'Too many requests. Try again later.')
    challenge_id = secrets.token_urlsafe(32)
    code = str(secrets.randbelow(900000) + 100000)
    ttl = setting('OTP_TTL_MS', 300000)
    db.execute('INSERT INTO otps (id, user_id, email, code, type, expires_at) VALUES (%s,%s,%s,%s,%s,%s)',
               (challenge_id, user_id, email, digest(challenge_id, code), 'email_verify' if user_id else 'register', now_ms() + ttl))
    try:
        send_email(email, code, ttl)
    except Exception as error:
        logging.error('Gmail delivery failed (%s)', type(error).__name__)
        raise HTTPException(502, 'Unable to send OTP email. Please try again.') from None
    # Invalidate earlier codes without removing their send history/cooldown.
    db.execute('UPDATE otps SET expires_at=0 WHERE email=%s AND id<>%s', (email, challenge_id))
    return {'challengeId': challenge_id, 'message': 'OTP sent to email'}


def get_entry(db, challenge_id):
    return db.execute('SELECT * FROM otps WHERE id=%s FOR UPDATE', (challenge_id,)).fetchone()


def check_code(db, entry, code):
    if not entry or now_ms() >= entry['expires_at']:
        return 'Invalid or expired OTP'
    if entry['attempts'] >= setting('OTP_MAX_ATTEMPTS', 5):
        return 'Too many attempts. Request a new OTP.'
    # Existing in-flight plaintext challenges can complete after deployment.
    expected = digest(entry['id'], code) if len(entry['code']) == 20 else code
    if not hmac.compare_digest(entry['code'], expected):
        db.execute('UPDATE otps SET attempts=attempts+1 WHERE id=%s', (entry['id'],))
        return 'Invalid email OTP'
    return None


@app.get('/health')
def health():
    with connect() as db:
        db.execute('SELECT 1')
    return {'status': 'ok'}


@app.post('/otp/send', dependencies=[Depends(authorize)])
def send(payload: Payload):
    email = payload.email.strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise HTTPException(400, 'Enter a valid email address')
    with connect() as db:
        if db.execute('SELECT id FROM users WHERE email=%s', (email,)).fetchone():
            raise HTTPException(409, 'Email already registered')
        return issue(db, email)


@app.post('/otp/verify', dependencies=[Depends(authorize)])
def verify(payload: Payload):
    if not re.fullmatch(r'\d{6}', payload.code):
        raise HTTPException(400, 'Enter the 6-digit OTP')
    with connect() as db:
        entry = get_entry(db, payload.challengeId)
        error = check_code(db, entry if entry and entry['type'] == 'register' else None, payload.code)
        if not error:
            db.execute('UPDATE otps SET verified_at=CURRENT_TIMESTAMP WHERE id=%s', (payload.challengeId,))
    # Raise after committing so failed attempts persist.
    if error:
        raise HTTPException(400, error)
    return {'verified': True, 'message': 'Email OTP verified'}


@app.post('/otp/inspection', dependencies=[Depends(authorize)])
def inspect(payload: Payload):
    with connect() as db:
        entry = get_entry(db, payload.challengeId)
        if not entry or not entry['verified_at'] or entry['expires_at'] <= now_ms():
            raise HTTPException(403, 'Verify OTP before creating account')
        return {'id': entry['id'], 'email': entry['email'], 'type': entry['type'],
                'verifiedAt': entry['verified_at'].isoformat(), 'expiresAt': entry['expires_at']}


@app.post('/otp/consume', dependencies=[Depends(authorize)])
def consume(payload: Payload):
    with connect() as db:
        db.execute('UPDATE otps SET expires_at=0, verified_at=NULL WHERE id=%s', (payload.challengeId,))
    return {'success': True}


@app.post('/verify', dependencies=[Depends(authorize)])
def verify_existing_user(payload: Payload):
    with connect() as db:
        entry = get_entry(db, payload.challengeId)
        error = check_code(db, entry if entry and entry['user_id'] else None, payload.code)
        if not error:
            db.execute('UPDATE users SET verified=true WHERE id=%s', (entry['user_id'],))
            db.execute('UPDATE otps SET expires_at=0 WHERE id=%s', (entry['id'],))
    if error:
        raise HTTPException(400, error)
    return {'success': True}


@app.post('/verify/resend', dependencies=[Depends(authorize)])
def resend(payload: Payload):
    with connect() as db:
        entry = db.execute('SELECT * FROM otps WHERE id=%s', (payload.challengeId,)).fetchone()
        if not entry or not entry['user_id']:
            raise HTTPException(400, 'Challenge not found. Register again.')
        user = db.execute('SELECT email, verified FROM users WHERE id=%s', (entry['user_id'],)).fetchone()
        if not user:
            raise HTTPException(404, 'User not found')
        if user['verified']:
            raise HTTPException(409, 'Email already verified')
        result = issue(db, user['email'], entry['user_id'])
        return {'challengeId': result['challengeId'], 'email': user['email']}
