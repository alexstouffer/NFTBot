require('dotenv').config();
const WebSocketServer = require('ws');
const ws = new WebSocketServer(process.env.ETH_NODE_WS);
const Moralis = require("moralis/node");
const { seed, getLatest } = require("./requests");

ws.addEventListener("open", () =>{
    // connect to Moralis server
    const serverUrl = process.env.ETH_NODE_SERVER_URL;
    const appId = process.env.ETH_NODE_APP_ID;
    Moralis.start({ serverUrl, appId });
    console.log("Ethereum Node API connection successful. Initializing...");


    
    // Uncomment & run seed function first if no prior tweets to reference. Then getLatest periodically by 30 seconds default 
    
    getLatest();
    setInterval(getLatest, 30000);
    // seed(0, 10);
})