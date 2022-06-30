'strict'

require('dotenv').config({ path: '.env' })
const fastify = require('fastify')({ logger: false })
const helmet = require('@fastify/helmet')
const compress = require('@fastify/compress')
const cors = require('@fastify/cors')

const path = require('path')
const fs = require('fs')

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const toBuffer = require('ethereumjs-util').toBuffer
const { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx')
const { Convo } = require('@theconvospace/sdk')
const { getAddress, isAddress } = require('@ethersproject/address')

fastify.register(helmet, { global: true })
fastify.register(compress, { global: true })
fastify.register(cors, { global: true, origin: "*" })

const { TENDERLY_USER, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY, POLYGON_RPC_URL, POLYGON_MUMBAI_RPC_URL, OPTIMISM_RPC_URL, OPTIMISM_TESTNET_RPC_URL, ARBITRUM_RPC_URL, ARBITRUM_TESTNET_RPC_URL, ARBITRUM_DEVNET_RPC_URL, MAINNET_RPC_URL, ROPSTEN_RPC_URL, KOVAN_RPC_URL, RINKEBY_RPC_URL, GOERLI_RPC_URL, CONVO_API_KEY, ALCHEMY_API_KEY, CNVSEC_ID  } = process.env;
const SIMULATE_URL = `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`

const convo = new Convo(CONVO_API_KEY);
const computeConfig = {
    alchemyApiKey: ALCHEMY_API_KEY,
    CNVSEC_ID: CNVSEC_ID,
};
const networkToRpc = {
    'mainnet': MAINNET_RPC_URL,
    'ropsten': ROPSTEN_RPC_URL,
    'kovan': KOVAN_RPC_URL,
    'rinkeby': RINKEBY_RPC_URL,
    'goerli': GOERLI_RPC_URL,
    'polygon': POLYGON_RPC_URL,
    'polygon-mumbai': POLYGON_MUMBAI_RPC_URL,
    'optimism': OPTIMISM_RPC_URL,
    'optimism-testnet': OPTIMISM_TESTNET_RPC_URL,
    'arbitrum': ARBITRUM_RPC_URL,
    'arbitrum-testnet': ARBITRUM_TESTNET_RPC_URL,
    'arbitrum-devnet': ARBITRUM_DEVNET_RPC_URL,
}
Object.freeze(networkToRpc);

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
        if (isAddress(address)){
            let result = await convo.omnid.kits.isMalicious(getAddress(address), computeConfig);
            console.log('omnid.kits.isMalicious', getAddress(address), result);
            if (result?.alchemy && result.alchemy === true) return getMalRpcError(`Spam Contract Flagged by Alchemy`);
            else if (result?.cryptoscamdb && result.cryptoscamdb === true) return getMalRpcError(`Contract Flagged by CryptoscamDB`);
            else if (result?.etherscan && 'label' in result.etherscan) return getMalRpcError(`Address Flagged as ${result.etherscan.label} by Etherscan`);
            else if (result?.mew && 'comment' in result.mew) return getMalRpcError(`Address Flagged by MyEtherWallet`);
            else if (result?.sdn) return getMalRpcError(`Address Flagged by OFAC`);
            else if (result?.tokenblacklist) return getMalRpcError(`Address Blacklisted by Stablecoin`);
            else return {isMalicious: false}
        }
        else return {isMalicious: false}

    } catch (error) {
        return {isMalicious: false}
    }
}

async function alchemySimulate(simData){
    try {

        let resp = await fetch(SIMULATE_URL, {
            method: "POST",
            body: JSON.stringify(simData),
            headers: {
                'X-Access-Key': TENDERLY_ACCESS_KEY,
            }
        }).then(r=>r.json());

        return resp;

    } catch (error) {
        return error
    }
}


async function passthroughRPC(network, req) {
    let data = await fetch(networkToRpc[network], {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
            'Content-Type': 'application/json',
            "Accept": 'application/json',
            "infura-source": 'metamask/internal',
            "origin": 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        }
    }).then(e=>e.json());

    // console.log('passthroughRPC/result', data);
    return data;
}

async function submitRawSignature(network, req) {
    let data = await fetch(networkToRpc[network], {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
            'Content-Type': 'application/json',
            "Accept": 'application/json',
            "infura-source": 'metamask/internal',
            "origin": 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        }
    }).then(e=>e.json());

    // console.log('submitRawSignature/result', data);
    return data;
}

async function processTxs(network, req) {

    var txData = toBuffer(req.body['params'][0])
    var deserializedTx = FeeMarketEIP1559Transaction.fromSerializedTx(txData);
    var deserializedTxParsed = deserializedTx.toJSON();

    // console.log('deserializedTx', deserializedTxParsed);

    // Check `to`
    //      if malicious then revert txn
    if (Boolean(deserializedTxParsed?.to) === true){
        let { isMalicious, rpcResp } = await checkAddress(deserializedTxParsed?.to);
        if (isMalicious === true){
            rpcResp.id = req.body.id;
            return rpcResp; // Return if Mal intent found.
        }
    }

    // Simulate `txn`
    //      check for transfer, transferFrom, approve events
    //          if addresses involved flagged by omnid, revert.
    //          TODO: if token value greater than tolerance for token then revert.

    let simData = {
        "network_id": parseInt(deserializedTx.chainId.toString(10)),
        "from": deserializedTx.getSenderAddress().toString('hex'),
        "to":  deserializedTx.to.toString('hex'),
        "input": deserializedTx.data.toString('hex'),
        "gas": parseInt(deserializedTx.gasLimit.toString(10)),
        "gas_price": deserializedTx.maxFeePerGas.add(deserializedTx.maxPriorityFeePerGas).toString(10),
        "value": parseInt(deserializedTx.value.toString(10)),
        "save_if_fails": true,
        "save": false,
        "simulation_type": "full"
    }
    let alResp = await alchemySimulate(simData);

    if ('transaction_info' in alResp){
        console.log('Sim Successful')
        for (let index = 0; index < alResp.transaction_info.logs.length; index++) {
            const logData = alResp.transaction_info.logs[index];

            // Scan through the events emitted for malicious addresses.
            if (logData.name === 'Approval' || logData.name === 'Transfer'){
                let {isMaclicious, rpcResp} = await checkAddress(logData.inputs[1].value);
                if (isMaclicious === true){
                    return rpcResp;
                }
            }

        }
    }

    // If nothing found, simply txn submit to main network.
    return await submitRawSignature(network, req);

}

fastify
    .get('/', async (req, reply) => {
        const stream = await fs.readFileSync(path.join(__dirname, 'public', 'index.html'))
        reply.type('text/html').send(stream)
    })

fastify
    .post('/:network', async (req, reply) => {

        let network = req.params?.network;
        if (Object.keys(networkToRpc).includes(network) === true){ // valid chain

            if (req.body['method'] == 'eth_sendRawTransaction') {
                let resp = await processTxs(network, req)
                reply.send(resp);
            }
            else if (req.body['method'] == 'eth_bypassSendRawTransaction') {
                let resp = await submitRawSignature(network, req);
                reply.send(resp);
            }
            else {
                let resp = await passthroughRPC(network, req);
                reply.send(resp)
            }
        }
        else {
            reply.send({error: `Invalid network '${network}', available ${Object.keys(networkToRpc).toString()}`})
        }


    })

fastify.listen({ port: process.env.PORT || 8545, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err
    console.log(`Server listening on ${address}`);
})

// checkAddress('').then(console.log)
