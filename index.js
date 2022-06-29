require('dotenv').config({ path: '.env' })
const path = require('path')
const fastify = require('fastify')({ logger: false })
const helmet = require('@fastify/helmet')
const compress = require('@fastify/compress')
const cors = require('@fastify/cors')
// const static = require('@fastify/static')

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const toBuffer = require('ethereumjs-util').toBuffer
const { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx')
const { Convo } = require('@theconvospace/sdk')

fastify.register(helmet, { global: true })
fastify.register(compress, { global: true })
fastify.register(cors, { global: true, origin: "*" })
// fastify.register(static, {
//     root: path.join(__dirname, 'public/'),
//     redirect: true
// })


const { RPC_URL, CONVO_API_KEY, ALCHEMY_API_KEY, CNVSEC_ID  } = process.env;

const convo = new Convo(CONVO_API_KEY);
const computeConfig = {
    alchemyApiKey: ALCHEMY_API_KEY,
    CNVSEC_ID: CNVSEC_ID,
};

function getMalRpcError(message, id=33){
    return {
        isMaclicious: true,
        rpcResp:{
            "id": id,
            "jsonrpc": "2.0",
            "error": {
                "code": -32003,
                "message": message
            }
        }
    }
}

async function checkAddress(address){
    try {
        let result = await convo.omnid.kits.isMalicious(address, computeConfig);
        console.log('omnid.kits.isMalicious', address, result);
        if (result?.alchemy && result.alchemy === true) return getMalRpcError(`Spam Contract Flagged by Alchemy`);
        else if (result?.cryptoscamdb && result.cryptoscamdb === true) return getMalRpcError(`Contract Flagged by CryptoscamDB`);
        else if (result?.etherscan && 'label' in result.etherscan) return getMalRpcError(`Address Flagged as ${result.etherscan.label} by Etherscan`);
        else if (result?.mew && 'comment' in result.mew) return getMalRpcError(`Address Flagged by MyEtherWallet`);
        else if (result?.sdn) return getMalRpcError(`Address Flagged by OFAC`);
        else if (result?.tokenblacklist) return getMalRpcError(`Address Blacklisted by Stablecoin`);
        else return {isMalicious: false}

    } catch (error) {
        return {isMalicious: false}
    }
}


async function passthroughRPC(req) {
    let data = await fetch(RPC_URL, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
            'Content-Type': 'application/json',
            "Accept": 'application/json',
            "infura-source": 'metamask/internal',
            "origin": 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        }
    }).then(e=>e.json());

    console.log('passthroughRPC/result', data);
    return data;
}

async function submitRawSignature(req) {
    let data = await fetch(RPC_URL, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
            'Content-Type': 'application/json',
            "Accept": 'application/json',
            "infura-source": 'metamask/internal',
            "origin": 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        }
    }).then(e=>e.json());

    console.log('submitRawSignature/result', data);
    return data;
}

async function processTxs(req) {

    var txData = toBuffer(req.body['params'][0])
    var deserializedTx = FeeMarketEIP1559Transaction.fromSerializedTx(txData);
    var deserializedTxParsed = deserializedTx.toJSON();

    console.log('deserializedTx', deserializedTxParsed);

    // Check `to`
    //      if malicious then revert
    // Simulate `txn`
    //      check for transfer, transferFrom, approve events
    //      if greater than tolerance for token then revert.

    if (Boolean(deserializedTxParsed?.to) === true){
        let { isMalicious, rpcResp } = await checkAddress(deserializedTxParsed?.to);
        if (isMalicious === true){
            rpcResp.id = req.body.id;
            return rpcResp;
        }
        else {
            return await submitRawSignature(req);
        }
    }
    else {
        return await submitRawSignature(req);
    }


}

fastify
    .get('/', async (req, reply) => {
        reply.type('text/html');
        reply.send(`
        <!DOCTYPE html>
        <html>

        <head>
          <meta charset="utf-8">
          <title></title>
          <meta name="author" content="">
          <meta name="description" content="">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>

        <body>

          <div>
            <pre>RPC: https://goerli-omnid-proxy.herokuapp.com/</pre>
            <pre>Chain ID: 0x5</pre>
          </div>

        </body>

        </html>

        `)
    })

fastify
    .post('/', async (req, reply) => {

        console.log('call', req.body);

        if (req.body['method'] == 'eth_sendRawTransaction') {
            let resp = await processTxs(req)
            reply.send(resp);
        }
        else if (req.body['method'] == 'eth_bypassSendRawTransaction') {
            let resp = await submitRawSignature(req);
            reply.send(resp);
        }
        else {
            let resp = await passthroughRPC(req);
            reply.send(resp)
        }

    })

fastify.listen({ port: process.env.PORT || 8545, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err
    console.log(`Server listening on ${address}`);
})

// checkAddress('').then(console.log)
