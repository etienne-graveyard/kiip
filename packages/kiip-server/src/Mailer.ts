import fetch from 'node-fetch';

interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  sendMail(msg: Message): Promise<void>;
}

export class Mailer {
  private readonly mailgunUrl: string;
  private readonly mailgunApiPass: string;
  private readonly testMode: boolean;

  constructor(mailgunUrl: string, mailgunApiPass: string, testMode: boolean) {
    this.mailgunApiPass = mailgunApiPass;
    this.mailgunUrl = mailgunUrl;
    this.testMode = testMode;
  }

  async sendMail(msg: Message): Promise<void> {
    if (this.testMode) {
      console.info(`<====== Mail Test Mode is ON =====>`);
      console.info(`>> To: ${msg.to}`);
      console.info(`-----------------------------------`);
      console.info(msg.text);
      console.info(`<=================================>`);
      return;
    }

    const body = {
      from: 'Alerion <alerion@mail.etienne.tech>',
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    };

    const auth = 'Basic ' + Buffer.from('api:' + this.mailgunApiPass).toString('base64');

    // const response = await got.post('https://api.eu.mailgun.net/v3/mail.etienne.tech/messages', {
    const response = await fetch(this.mailgunUrl, {
      method: 'post',
      body: JSON.stringify(body),
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });

    if (response.status !== 200) {
      throw new Error(`Cannot send mail ! (not 200 status ${response.status})`);
    }
    if (response.headers.get('content-type') !== 'application/json') {
      throw new Error(`Cannot send mail (non-json response) !`);
    }
    return;
  }
}
