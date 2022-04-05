# How to run your own NFTBot

1. clone the repo to your local directory and `npm install` to download node_modules. 
2. Fill the .env file credentials using .env.example template for reference. We use Moralis.io as a node service.
3. Use `python/scraper.py` script to download a collection to the `/images` folder.
4. Use `python/verify.py` script to confirm all files have been downloaded for the target collection.
5. Update the settings.js file with your public collection info, the screen_name for your twitter handle, etc.
6. Find/Use the function `postTest` instead of `postTweet` to test posting first locally.
7. Use command `node main.js` to start the application.

More Information here: https://stoubord.com/project/niftybot/
