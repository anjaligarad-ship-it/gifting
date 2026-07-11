import twilio from 'twilio';

let client = null;

export function getTwilioVerify() {
  if (!client) {
    client = twilio(
      import.meta.env.TWILIO_ACCOUNT_SID,
      import.meta.env.TWILIO_AUTH_TOKEN,
    );
  }
  return client.verify.v2.services(import.meta.env.TWILIO_VERIFY_SERVICE_SID);
}
