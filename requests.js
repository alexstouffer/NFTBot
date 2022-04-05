const Web3 = require('web3');
const Settings = require('./settings');
const Moralis = require("moralis/node");
const Twitter = require("./outputs/twitter");

const seed = async (start, range) => {
    const options = { address: Settings.nft_collection, chain: "eth", limit: Settings.limit };
    let nftTransfers = await Moralis.Web3API.token.getContractNFTTransfers(options);
    let seedTicker = [];

    let amount = start + range;
    for (i = start; i < amount; i++){
        let tx = nftTransfers.result[i];
        console.log(tx);

        if (tx.value !== "0" && tx.verified === 1) {
            Twitter.draftTweet(tx);
            seedTicker.push(tx.token_id);
            break;
        }
    }
    console.log("Seed ticker, newest to oldest: ", seedTicker);
}

getSymbol = async (address) => {
    // GET token type 
    let tokenOptions = {
        addresses: address,
        limit: Settings.limit
    }
    let tokenMetadata = await Moralis.Web3API.token.getTokenMetadata(tokenOptions);

    return tokenMetadata[0].symbol;
}

getDollars = async (tokenValue, tokenContract) => {
    const options = {
        // records, not just the weth contract
        address: tokenContract,
        chain: "eth",
        exchange: "uniswap-v3",
        limit: Settings.limit
    };
    const result = await Moralis.Web3API.token.getTokenPrice(options);

    if (typeof tokenValue == "string") {
        tokenValue = parseFloat(tokenValue);
    }
    
    let usd = result.usdPrice;
    let cost = Math.round(usd * tokenValue);
    return cost;
}

// Get Specific tx by hash
const tokenInspect = async (hash) => {
    const txOptions = {
        chain: "eth",
        transaction_hash: hash
    };
    let result = {};
    let wethValue = 0;
    let address;
    let isTx = false;
    
    const transaction = await Moralis.Web3API.native.getTransaction(txOptions);

    const logs = transaction.logs;

    logs.forEach((log) => {
        let data = log.data;
        // 66 characters represents only 1 hex value, amount transferred
        if (data.length === 66) {
            // GET token values
            isTx = true;
            let wethStr = Web3.utils.fromWei(data , 'ether');
            let wethNum = parseFloat(wethStr);
            let wethWholeNumber = wethNum * 100000; // Javascript sucks at decimal math, make whole integers
            let bigWeth = Math.round(wethWholeNumber); // remove possible decimals
            wethValue += bigWeth;
            address = log.address;
        }
    });

    if (isTx){
        wethValue /= 100000; // Convert total back to decimal result
        result.address = address;
        result.price = wethValue.toString();
        return result;
    } else {
        result.price = '0';
        return result;
    }

}

const evaluateTransaction = async (tx) => {

    let symbol, dollars, token;
    
    if (tx.value !== "0"){
        
        tx.symbol = "ETH";
        tx.price = Web3.utils.fromWei(tx.value , 'ether');
        dollars = await getDollars(tx.price, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        tx.dollars = dollars.toString();
        return tx;

    } else if (tx.value === "0") {

        token = await tokenInspect(tx.transaction_hash);
        if (token !== undefined && token.price !== '0'){
            console.log("tokenInspect Response: ", token);
            tx.erc_20_used = token.address;
            tx.price = token.price;
            symbol = await getSymbol(token.address);
            
            if (symbol) {
                tx.symbol = symbol;
                dollars = await getDollars(tx.price, tx.erc_20_used);
            }
            
            if (dollars) {
                tx.dollars = dollars.toString();
            }
            return tx;

        } else { 

            return;

        }
    }
}

const getTransfers = async (lastBlock, lastId) => {
    // Get Last Sales From Chain
    const options = { address: Settings.nft_collection, chain: "eth", limit: Settings.limit };
    let nftTransfers = await Moralis.Web3API.token.getContractNFTTransfers(options);
    let tx;
    let transfers = [];
    let consoleTicker = [];
    
    for(var i = 0; i < Settings.limit; i++) {
        tx = nftTransfers.result[i];
        tradeBlock = parseInt(tx.block_number);
        tokenId = parseInt(tx.token_id)
        
        if (tradeBlock > lastBlock && tokenId !== lastId && tx.verified === 1) {

            transfers.push(tx);
            consoleTicker.push(tx.token_id);

        } else if (tradeBlock === lastBlock && tokenId === lastId) {
            break;
        }
    }
    console.log("Tokens transfered, newest to oldest: ", consoleTicker);
    return transfers;
};

let getSales = async (sales) => {                      
    let collection = [];
    let ticker = [];
    for (const sale of sales) {
        await evaluateTransaction(sale).then((results) => {
            if (results !== undefined && results.price !== '0') {
                collection.push(results);
                ticker.push(results.token_id);
            }
        });
    }
    console.log("All Sales, newest to oldest: ", ticker);
    return collection;
}

// Sequential Chain of Promised Requests
const getLatest = async () => {
    
    try {
        Twitter.getTweet().then((tweet) => {
            return getTransfers(tweet.block_number, tweet.token_id)
        }).catch((err) => { console.log(err) }).then((transfers) => {
            return getSales(transfers);
        }).catch((err) => { console.log(err) }).then((sales) => {
            if (sales.length !== 0) {
                return sales.pop();
            }
        }).catch((err) => { console.log(err) }).then((sale) => {
            
            if (sale !== undefined && sale.price !== '0') {
                Twitter.draftTweet(sale);
            } else {
                console.log("No new/pending trades to report");
            }

        }).catch((err) => {
            console.log("End Chain Catch: ", err);
        });
        
    } catch (err) {
        console.log("Try/Catch Error: ", err);
    }

}

module.exports = { seed, getLatest }