require('dotenv').config({ path: '.env' })
const fastify = require('fastify')({ logger: false })
const helmet = require('@fastify/helmet')
const compress = require('@fastify/compress')
const cors = require('@fastify/cors')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const toBuffer = require('ethereumjs-util').toBuffer
const { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx')
const { Convo } = require('@theconvospace/sdk')

fastify.register(helmet, { global: true })
fastify.register(compress, { global: true })
fastify.register(cors, { global: true, origin: "*" })

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
        console.log('omnid.kits.isMalicious', result);
        if (result?.alchemy && result.alchemy === true) return getMalRpcError(`Spam Contract Flagged by Alchemy`);
        else if (result?.cryptoscamdb && result.cryptoscamdb === true) return getMalRpcError(`Contract Flagged by CryptoscamDB`);
        else if (result?.etherscan && result.etherscan === true) return getMalRpcError(`Address Flagged by Etherscan`);
        else if (result?.mew) return getMalRpcError(`Address Flagged by MyEtherWallet`);
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
            'Content-Type': 'application/json'
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
        reply
        .send({ hello: 'world' })
    })

fastify
    .post('/', async (req, reply) => {

        console.log('call',  req.hostname ,req.body);
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

fastify.listen({ port: process.env.PORT || 8545, hostname: '0.0.0.0' }, (err, address) => {
    if (err) throw err
})

// checkAddress('0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C').then(console.log)
