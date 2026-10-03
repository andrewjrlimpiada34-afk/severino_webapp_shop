import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

os.environ['OTP_SERVICE_KEY'] = 'test-service-key-with-at-least-32-characters'
import app


class OtpTests(unittest.TestCase):
    def entry(self, **changes):
        entry = {'id': 'challenge-123', 'email': 'test@example.com', 'user_id': None,
                 'type': 'register', 'expires_at': app.now_ms() + 300000,
                 'attempts': 0, 'verified_at': None}
        entry['code'] = app.digest(entry['id'], '123456')
        return {**entry, **changes}

    def test_digest_bound_to_challenge(self):
        self.assertNotEqual(app.digest('a', '123456'), app.digest('b', '123456'))
        self.assertEqual(len(app.digest('a', '123456')), 20)

    def test_attempts_commit_before_error(self):
        db = MagicMock()
        with patch.object(app, 'connect') as connection, patch.object(app, 'get_entry', return_value=self.entry()):
            connection.return_value.__enter__.return_value = db
            with self.assertRaises(app.HTTPException) as error:
                app.verify(app.Payload(challengeId='challenge-123', code='654321'))
            self.assertEqual(error.exception.status_code, 400)
            db.execute.assert_called_once()
            self.assertIn('attempts=attempts+1', db.execute.call_args.args[0])
            # No exception inside the DB context: psycopg commits the attempt.
            self.assertEqual(connection.return_value.__exit__.call_args.args, (None, None, None))

    def test_expiry_and_attempt_limit(self):
        db = MagicMock()
        self.assertEqual(app.check_code(db, self.entry(expires_at=0), '123456'), 'Invalid or expired OTP')
        self.assertIn('Too many attempts', app.check_code(db, self.entry(attempts=5), '123456'))
        db.execute.assert_not_called()

    def test_verify_marks_verified(self):
        db = MagicMock()
        with patch.object(app, 'connect') as connection, patch.object(app, 'get_entry', return_value=self.entry()):
            connection.return_value.__enter__.return_value = db
            result = app.verify(app.Payload(challengeId='challenge-123', code='123456'))
            self.assertTrue(result['verified'])
            self.assertIn('verified_at=CURRENT_TIMESTAMP', db.execute.call_args.args[0])

    def test_inspection_never_returns_code(self):
        with patch.object(app, 'connect'), patch.object(app, 'get_entry', return_value=self.entry(verified_at=datetime.now(timezone.utc))):
            result = app.inspect(app.Payload(challengeId='challenge-123'))
            self.assertNotIn('code', result)

    def issue_db(self, recent=None, count=0):
        db = MagicMock()
        db.execute.return_value.fetchone.side_effect = [recent, {'total': count}]
        return db

    def test_cooldown_prevents_email(self):
        db = self.issue_db({'created_at': datetime.now(timezone.utc)})
        with patch.object(app, 'send_email') as mail:
            with self.assertRaises(app.HTTPException) as error:
                app.issue(db, 'test@example.com')
            self.assertEqual(error.exception.status_code, 429)
            mail.assert_not_called()

    def test_send_limit_prevents_email(self):
        with patch.object(app, 'send_email') as mail:
            with self.assertRaises(app.HTTPException) as error:
                app.issue(self.issue_db(count=5), 'test@example.com')
            self.assertEqual(error.exception.status_code, 429)
            mail.assert_not_called()

    def test_delivery_failure_does_not_invalidate_previous_code(self):
        db = self.issue_db()
        with patch.object(app, 'send_email', side_effect=RuntimeError('failed')):
            with self.assertRaises(app.HTTPException) as error:
                app.issue(db, 'test@example.com')
            self.assertEqual(error.exception.status_code, 502)
            self.assertFalse(any('SET expires_at=0' in call.args[0] for call in db.execute.call_args_list))

    def test_resend_stores_digest_and_invalidates_old_codes(self):
        db = self.issue_db()
        with patch.object(app, 'send_email') as mail:
            result = app.issue(db, 'test@example.com')
            sent_code = mail.call_args.args[1]
            insert = next(call for call in db.execute.call_args_list if call.args[0].startswith('INSERT'))
            self.assertEqual(insert.args[1][3], app.digest(result['challengeId'], sent_code))
            self.assertNotEqual(insert.args[1][3], sent_code)
            self.assertIn('SET expires_at=0', db.execute.call_args.args[0])

    def test_internal_auth_required(self):
        with self.assertRaises(app.HTTPException):
            app.authorize('Bearer wrong')
        app.authorize('Bearer ' + os.environ['OTP_SERVICE_KEY'])

    def test_gmail_uses_https_and_encodes_message(self):
        import base64
        from email import message_from_bytes
        settings = {'GMAIL_API_CLIENT_ID': 'client', 'GMAIL_API_CLIENT_SECRET': 'secret',
                    'GMAIL_API_REFRESH_TOKEN': 'refresh', 'GMAIL_API_SENDER': 'sender@gmail.com'}
        with patch.dict(os.environ, settings), patch.object(app, 'Credentials') as credentials, patch.object(app.requests, 'Session') as session:
            credentials.return_value.token = 'access-token'
            app.send_email('test@example.com', '123456', 300000)
            call = session.return_value.post.call_args
            self.assertEqual(call.args[0], 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
            message = message_from_bytes(base64.urlsafe_b64decode(call.kwargs['json']['raw']))
            self.assertEqual(message['To'], 'test@example.com')
            self.assertIn('123456', message.get_payload())
            session.return_value.post.return_value.raise_for_status.assert_called_once()


if __name__ == '__main__':
    unittest.main()
