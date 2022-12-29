/* eslint-disable no-await-in-loop */
import 'source-map-support/register';
import { exit } from 'process';
import PQueue from 'p-queue';
import { config, AccountConfig } from './common/config';
import logger from './common/logger';
import PuppetPurchase from './puppet/purchase';
import { testNotifiers } from './notify';
import { checkForUpdate, logVersionOnError } from './version';
import PuppetLogin from './puppet/login';
import { safeLaunchBrowser } from './common/puppeteer';
import PuppetFreeGames from './puppet/free-games';

export async function redeemAccount(account: AccountConfig): Promise<void> {
  const L = logger.child({ user: account.email });
  L.info(`Checking free games for ${account.email} `);
  try {
    // const requestClient = newCookieJar(account.email);
    const browser = await safeLaunchBrowser(L);
    const login = new PuppetLogin({
      email: account.email,
      browser,
      password: account.password,
      totp: account.totp,
    });
    const freeGames = new PuppetFreeGames({
      email: account.email,
      browser,
    });
    const purchasePuppeteer = new PuppetPurchase({
      email: account.email,
      browser,
    });
    await login.fullLogin(); // Login
    const offers = await freeGames.getAllFreeGames(); // Get purchasable offers
    for (let i = 0; i < offers.length; i += 1) {
      // Async for-loop as running purchases in parallel may break
      L.info(`Purchasing ${offers[i].productName}`);
      try {
        await purchasePuppeteer.purchaseShort(offers[i].offerNamespace, offers[i].offerId);
        L.info(`Done purchasing ${offers[i].productName}`);
      } catch (err) {
        L.error(err);
      }
    }
    L.debug('Closing browser');
    await browser.close();
    L.trace('Browser finished closing');
  } catch (e) {
    if (e.response) {
      if (e.response.body) L.error(e.response.body);
      else L.error(e.response);
    }
    L.error(e);
    logVersionOnError();
  }
}

export async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    await checkForUpdate();
    if (config.testNotifiers) {
      await testNotifiers();
    }
    const queue = new PQueue({
      concurrency: config.accountConcurrency,
      interval: config.intervalTime * 1000,
      intervalCap: 1,
    });
    const accountPromises = config.accounts.map(async (account) =>
      queue.add(() => redeemAccount(account))
    );
    await Promise.all(accountPromises);
    exit(0); // For some reason, puppeteer will keep a zombie promise alive and stop Node from exiting
  }
}

main().catch((err) => {
  logger.error(err);
  logVersionOnError();
  exit(1);
});
