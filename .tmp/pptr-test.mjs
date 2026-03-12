import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--proxy-server=direct://','--proxy-bypass-list=*']});
const page = await browser.newPage();
for (const url of ['http://127.0.0.1:3000','http://localhost:3000']) {
  try {
    const res = await page.goto(url, {waitUntil:'domcontentloaded', timeout:15000});
    console.log('ok', url, res?.status(), page.url());
  } catch (e) {
    console.log('fail', url, String(e));
  }
}
await browser.close();
