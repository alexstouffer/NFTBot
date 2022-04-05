// Twitter API config and authentication
require('dotenv').config();
const Settings = require('../settings');
const Twit = require('twit');
const fs = require('fs');

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

function toTitleCase(str) {
    return str.replace(
      /\w\S*/g,
      function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }
    );
}

const getTweet = async () => {
    try {
        return new Promise((resolve, reject) => {
            T.get('statuses/user_timeline', { screen_name: Settings.screen_name, count: 20 }, function(err, data, res){
                if(err){
                    console.log("Error: " + err);
                } else {
                    let tweet; 
                    // Loop through previous posts to find last sale and avoid unrelated
                    for (var i = 0; i < 5; i++){
                        tweet = data[i].text;
                        if (tweet.includes("SOLD", "MINTED", "BURNED")){
                            // console.log(tweet);
                            break;
                        }
                    }
                    
                    // Get block number and ID from latest tweet
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
        
                    let text = tweet.split(" ");
                    let idStr = text[1];
                    let id = idStr.substring(1);
                    let idNum = parseInt(id);
        
                    
                    result = {
                        block_number: blockNum,
                        token_id: idNum
                    }
                    
                    console.log("Checking against block #" + result.block_number + " and ID: " + result.token_id);
                    
                    if (err) { 
                        return reject(err);
                    } else {
                        return resolve(result);
                    }
                }
            });
        });
    } catch (err) {
        console.log("getTweet Try/Catch Error: ", err);
    }
}

// Generate Tweet, Error Check and Give Feedback
// Make sure your credentials have read/write permissions
postTweet = async (tx) => {
    var b64content = fs.readFileSync(`images/${toTitleCase(Settings.name)} ${tx.token_id}${Settings.img_ext}`, { encoding: 'base64' })
    try {
        return new Promise((resolve, reject) => {
            if(resolve){
                T.post('media/upload', { media_data: b64content }, function (err, data, response) {
                    var mediaIdStr = data.media_id_string
                    var altText = `${Settings.name} #${tx.token_id}${Settings.img_ext}`
                    var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
                T.post('media/metadata/create', meta_params, function (err, data, response) {
                    if (!err) {
                        var params = { status: `#${Settings.name.toUpperCase()} #${tx.token_id} SOLD for ${tx.price} ${tx.symbol} ($${tx.dollars} USD)! Recorded on block #${tx.block_number} from seller ${tx.from} to ${tx.to}. ${tx.msg} See this #nft at ${Settings.market}${tx.token_id}`, media_ids: [mediaIdStr] }
                        T.post('statuses/update', params, function (err, data, response) {
                            console.log("TWEET SENT: " + data.text);
                        })
                    }
                })
            })
            } else {
                console.log("Post tweet error: " + reject);
            }
        })
    } catch (err) {
        console.log("postTweet Try/Catch Error: ", err);
    }
}

const postTest = (tx) => {
    console.log(`TESTING: #${Settings.name.toUpperCase()} #${tx.token_id} SOLD for ${tx.price} $${tx.symbol} ($${tx.dollars} USD)! Recorded on block #${tx.block_number} from seller ${tx.from} to ${tx.to}. ${tx.msg}`);
}


const draftTweet = async (tx) => {

    if(!tx) {
        return;
    }

    let ethNum = parseFloat(tx.price);
    if (tx.price > 5){
        tx.price = ethNum.toFixed(4); // Limit 4 decimals
    } 

    let fromAddress = tx.from_address;
    let toAddress = tx.to_address;

    // Select message by condition
    if (fromAddress.substr(fromAddress.length - 5) === Settings.nftx_vault) {
        tx.from = "NFTxVault";
        tx.to = toAddress.substr(toAddress.length - 5);
        shuffle(congrats);
        tx.msg = congrats[2];
    } else if (toAddress.substr(toAddress.length - 5) === Settings.nftx_vault) {
        tx.from = fromAddress.substr(fromAddress.length - 5);
        tx.to = "NFTxVault";
        tx.msg = "Sale price may include staked ETH.";
    } else if (ethNum < Settings.mint) {
        tx.from = fromAddress.substr(fromAddress.length - 5);
        tx.to = toAddress.substr(toAddress.length - 5);
        tx.msg = `${tx.from} sold for less than mint! They ngmi.`;
    } else {
        tx.from = fromAddress.substr(fromAddress.length - 5);
        tx.to = toAddress.substr(toAddress.length - 5);
        shuffle(congrats);
        tx.msg = congrats[2];
    }

    await postTweet(tx);
    // await postTest(tx);
};

module.exports = { getTweet, draftTweet }