require('dotenv').config();
const Moralis = require("moralis/node");
const Web3 = require('web3');
const fs = require('fs');
const WebSocketServer = require('ws');
const ws = new WebSocketServer(process.env.ETH_NODE_WS);

// GLOBALS
const nftxVault = '';
const congrats = ["What a deal, congrats!", "Well done!", "Nice piece!", "Let's go!!!", "Keep it up!"];
const mint = 0.1;

// Twitter API config and authentication
const Twit = require('twit');
const T = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_SECRET
});

T.get('account/verify_credentials', {
    include_entities: false,
    skip_status: true,
    include_email: false
  }, onAuthenticated)

function onAuthenticated(err, res) {
  if (err) {
      throw err
  }

  console.log(`Twitter authentication successful. Connected to ${res.name} bot.`)
}

// Gets Random positive message and symbol from bot per trade
function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
    while (currentIndex != 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

// Generate Tweet, Error Check and Give Feedback
// Make sure your credentials have read/write permissions
postTweet = async (item, price, block, from, to, msg) => {
    var b64content = fs.readFileSync(`images/GEMMA ${item}.jpg`, { encoding: 'base64' })
    return new Promise((resolve, reject) =>{
        if(resolve){
            T.post('media/upload', { media_data: b64content }, function (err, data, response) {
                var mediaIdStr = data.media_id_string
                var altText = `GEMMA #${item}.jpg`
                var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
            T.post('media/metadata/create', meta_params, function (err, data, response) {
                if (!err) {
                    var params = { status: `#GEMMA #${item} SOLD for Ξ${price} ETH! Recorded on block #${block} from seller ${from} to ${to}. ${msg} View this #nft here: https://opensea.io/assets/0xc7d84b7d4a04abcb9ade97b8af212423f51d2aea/${item}`, media_ids: [mediaIdStr] }
                    T.post('statuses/update', params, function (err, data, response) {
                        console.log("Tweet data: " + data.text);
                    })
                }
            })
        })
        } else {
            console.log("Post tweet error: " + reject);
        }
    })

}

draftTweet = async (tx) => {
    let fromAddress;
    let toAddress;
    let from;
    let to;
    let msg;
    let price;
    
    let trade = tx;
    let ethStr = Web3.utils.fromWei(`${trade.value}`, 'ether');
    let ethNum = parseFloat(ethStr);
    console.log(trade);

    if (ethStr.length > 5){
        price = ethNum.toFixed(4); // Limit 4 decimals
    } else {
        price = ethStr;
    }

    fromAddress = trade.from_address;
    toAddress = trade.to_address;

    // Select message by condition
    if (fromAddress.substr(fromAddress.length - 5) === nftxVault) {
        from = "NFTxVault";
        to = toAddress.substr(toAddress.length - 5);
        shuffle(congrats);
        msg = congrats[0];
    } else if (toAddress.substr(toAddress.length - 5) === nftxVault) {
        from = fromAddress.substr(fromAddress.length - 5);
        to = "NFTxVault";
        msg = "Sale price may include staked ETH.";
    } else if (ethNum < mint) {
        from = fromAddress.substr(fromAddress.length - 5);
        to = toAddress.substr(toAddress.length - 5);
        msg = `${from} sold for less than mint! They ngmi.`;
    } else {
        from = fromAddress.substr(fromAddress.length - 5);
        to = toAddress.substr(toAddress.length - 5);
        shuffle(congrats);
        msg = congrats[2];
    }

    await postTweet(trade.token_id, price, trade.block_number, from, to, msg);
    console.log("Tweet sent for Block #" + trade.block_number);  
};

fillHopper = async (lastBlock, lastId) => {
    // Get Last Sales From Chain
    const options = { address: "0xc7d84b7d4a04abcb9ade97b8af212423f51d2aea", chain: "eth" };
    let nftTransfers = await Moralis.Web3API.token.getContractNFTTransfers(options);
    let tx;
    let hopper = [];
    let amount = 10;
    for(var i = 0; i < amount; i++) {
        let gap = amount - i;
        tx = nftTransfers.result[i];
        // console.log(tx);
        price = parseInt(tx.value);
        tradeBlock = parseInt(tx.block_number);
        if(tradeBlock === lastBlock && tx.token_id === lastId) {
            console.log("last tx hit");
            i += gap;
        } else if (price > 0 && tradeBlock > lastBlock){
            hopper.push(tx);
            console.log("Pushing... " + tx.token_id + " with value " + price)
        }
    }
    return Promise.resolve(hopper);
    // let data = await Promise.resolve(hopper);
    // console.log("HOPPER DATA: " + data);
    // return data;
};

checkForLatest = async () => {
    T.get('statuses/user_timeline', { screen_name: 'Bot_Gemma_NFT', count: 5 }, function(err, data, res){
        if(err){
            console.log("Error: " + err);
        } else {
            let tweet; 
            // Loop through previous posts to find last sale and avoid unrelated
            for (var i = 0; i < 5; i++){
                tweet = data[i].text;
                // console.log("Tweet " + tweet);
                if (tweet.includes("SOLD")){
                    break;
                }
            }
            // Get block number and ID from latest tweet
            let text = tweet.split(" ");
            let blockSplit = tweet.split("on block ");
            let blockStart = blockSplit[1];
            let blockEnd = blockStart.split(" ");
            let block;
            let blockNum;
            if(blockEnd[0].charAt(0) === "#"){
                block = blockEnd[0].substring(1);
                blockNum = parseInt(block);
            } else {
                block = blockEnd[0];
                blockNum = parseInt(block)
            }
            let idStr = text[1];
            let id = idStr.substring(1);
            let idNum = parseInt(id);
            console.log("Checking against block #" + blockNum + " and ID: " + idNum);
            
            fillHopper(blockNum, idNum).then((hopper) => {
                asyncForEach(hopper, (trade) => {
                    // console.log(trade);
                    let tradeBlock = parseInt(trade.block_number);
                    console.log("Previous BlockNum " + typeof blockNum + " " + blockNum);
                    console.log("Trade Block " + typeof tradeBlock + " " + tradeBlock);
                    if (tradeBlock > blockNum && trade.verified === 1){
                        // console.log("tradeblock is bigger");
                        // draftTweet(trade);
                        console.log("Draft triggered for tradeBlock " + tradeBlock + " and ID " + tradeId + ". Larger than previous block " + blockNum);
                        console.log(trade);
                    }
                }).catch((err) => {
                    console.log("Error: " + err);
                });        
            });
            return;
        }
    })
}

seed = async (start, range) => {
    // Get Last Sales From Chain
    const options = { address: "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e", chain: "eth" };
    let nftTransfers = await Moralis.Web3API.token.getContractNFTTransfers(options);

    let amount = start + range;
    for (i = start; i < amount; i++){
        let tx = nftTransfers.result[i];

        console.log(i + "TX= " + tx.value);

        if (tx.value !== "0") {
            draftTweet(tx);
            break;
        }
    }
}

ws.addEventListener("open", () =>{
    // connect to Moralis server
    const serverUrl = process.env.ETH_NODE_SERVER_URL;
    const appId = process.env.ETH_NODE_APP_ID;
    Moralis.start({ serverUrl, appId });
    console.log("Ethereum Node API connection successful. Initializing...");
    // seed(5, 10);
    checkForLatest();
    setInterval(checkForLatest, 30000);

    // fillHopper("14121107", "4205").then((hopper) => {
    //     asyncForEach(hopper, (trade) => {
    //         // console.log(trade);
    //         let tradeBlock = parseInt(trade.block_number);
    //         console.log("Trade Block " + typeof tradeBlock + " " + tradeBlock);
    //         if (trade.verified === 1){
    //             // console.log("tradeblock is bigger");
    //             // draftTweet(trade);
    //             console.log("Draft triggered for tradeBlock " + tradeBlock + " and ID " + trade.token_id );
    //             console.log(trade);
    //         }
    //     }).catch((err) => {
    //         console.log("Error: " + err);
    //     });        
    // });

})