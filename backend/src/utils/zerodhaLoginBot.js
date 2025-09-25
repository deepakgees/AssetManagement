const puppeteer = require("puppeteer");
const KiteConnect = require('kiteconnect').KiteConnect;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
function zerodhaLoginBot(ApiKey,SecretKey,UserId,Password,Pin) {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await puppeteer.launch({ headless: false });
            const page = await browser.newPage();
            await page.goto(
              `https://kite.trade/connect/login?api_key=${ApiKey}&v=3`
            );
            await sleep(2000);
            await page.type("input[type=text]", UserId);
            await page.type("input[type=password]", Password);
            await page.keyboard.press("Enter");
            await sleep(2000);
            await page.focus("input[type=number]").then((value) => console.log(value));
            await page.keyboard.type(Pin);
            await page.keyboard.press("Enter");
            await page.waitForNavigation();
            const reqUrl = page.url();
            console.log("Page URL:", page.url());
            const requestToken = new URL(reqUrl).searchParams.get('request_token');
            console.log("Request Token: ", requestToken);
            
            try{
              const kc = new KiteConnect({
                api_key: ApiKey,
              });
              const response = await kc.generateSession(requestToken, SecretKey);
              const accessToken = response.access_token;
              console.log("Access Token: ",accessToken);
              
              // Close browser and resolve with tokens
              await browser.close();
              resolve({
                requestToken,
                accessToken
              });
            }catch (e){
              console.error("Error generating session:", e);
              await browser.close();
              reject(e);
            }
        } catch (error) {
            console.error("Error in login bot:", error);
            reject(error);
        }
    });
}
module.exports = zerodhaLoginBot
