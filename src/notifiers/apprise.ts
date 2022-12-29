import got from 'got';
import logger from '../common/logger';
import { NotifierService } from './notifier-service';
import { AppriseConfig } from '../common/config';
import { NotificationReason } from '../interfaces/notification-reason';

export class AppriseNotifier extends NotifierService {
  private config: AppriseConfig;

  constructor(config: AppriseConfig) {
    super();

    this.config = config;
  }

  /**
   * @ignore
   */
  async sendNotification(url: string, account: string, reason: NotificationReason): Promise<void> {
    const L = logger.child({ user: account, reason });
    L.trace('Sending Apprise notification');

    const encodedUrl = encodeURI(url);
    const jsonPayload = {
      urls: this.config.urls,
      title: 'epicgames-freegames-node',
      body: `epicgames-freegames-node needs a captcha solved.
reason: ${reason}
account: ${account}
url: ${encodedUrl}`,
      format: 'text', // The text format is ugly, but all the platforms support it.
      type: 'info',
    };

    L.trace({ apiUrl: this.config.apiUrl, jsonPayload }, 'Sending json payload');

    try {
      await got.post(`${this.config.apiUrl}/notify`, {
        json: jsonPayload,
        responseType: 'text',
      });
    } catch (err) {
      L.error(err);
      L.error({ urls: this.config.urls }, `Failed to send message`);
      throw err;
    }
  }
}
