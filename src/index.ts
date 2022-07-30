'strict'

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
const server: FastifyInstance = fastify({ logger: false })

import helmet from '@fastify/helmet'
import compress from '@fastify/compress'
import cors from '@fastify/cors'

import { readFileSync } from 'fs';
import path from 'path'

import fetch from 'cross-fetch';
const toBuffer = require('ethereumjs-util').toBuffer
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Convo } from '@theconvospace/sdk'
import { getAddress, isAddress } from '@ethersproject/address'
const checkForPhishing = require('eth-phishing-detect');
import { AlchemySimulationReq, AlchemySimulationResp, Dictionary, IQuerystring, IRouteParams, JsonRpcReq, RpcResp, lifejacketSupportedNetwork, SourifyResp, supportedNetworkIds } from './types';
import { testrun, testUsingSlither } from "./lifejackets/slither";
import { getEnv } from "./utils";
import { testUsingMythril } from "./lifejackets/mythril";

server.register(helmet, { global: true })
server.register(compress, { global: true })
server.register(cors, { origin: "*" })


const SIMULATE_URL = `https://api.tenderly.co/api/v1/account/${getEnv('TENDERLY_USER')}/project/${getEnv('TENDERLY_PROJECT')}/simulate`

const convo = new Convo(getEnv('CONVO_API_KEY'));
const computeConfig = {
    alchemyApiKey: getEnv('ALCHEMY_API_KEY'),
    CNVSEC_ID: getEnv('CNVSEC_ID'),
    etherscanApiKey: getEnv('ETHERSCAN_API_KEY'),
    polygonscanApiKey: getEnv('POLYGONSCAN_API_KEY'),
    optimismscanApiKey: getEnv('OPTIMISMSCAN_API_KEY'),
    polygonMainnetRpc: '',
    etherumMainnetRpc: '',
    avalancheMainnetRpc: '',
    maticPriceInUsd: 0,
    etherumPriceInUsd: 0,
    deepdaoApiKey: '',
    zapperApiKey: '',
    DEBUG: false,
};
const networkToRpc: Dictionary<string> = {
    'mainnet': getEnv('MAINNET_RPC_URL'),
    'mainnet-flashbots': getEnv('MAINNET_FLASHBOTS_RPC_URL'),
    'mainnet-flashbots-fast': getEnv('MAINNET_FLASHBOTS_FAST_RPC_URL'),
    'ropsten': getEnv('ROPSTEN_RPC_URL'),
    'kovan': getEnv('KOVAN_RPC_URL'),
    'rinkeby': getEnv('RINKEBY_RPC_URL'),
    'goerli': getEnv('GOERLI_RPC_URL'),
    'sepolia': getEnv('SEPOLIA_RPC_URL'),
    'goerli-flashbots': getEnv('GOERLI_FLASHBOTS_RPC_URL'),
    'polygon': getEnv('POLYGON_RPC_URL'),
    'polygon-testnet': getEnv('POLYGON_TESTNET_RPC_URL'),
    'optimism': getEnv('OPTIMISM_RPC_URL'),
    'optimism-testnet': getEnv('OPTIMISM_TESTNET_RPC_URL'),
    'arbitrum': getEnv('ARBITRUM_RPC_URL'),
    'arbitrum-testnet': getEnv('ARBITRUM_TESTNET_RPC_URL'),
    'manual': '1',
}
Object.freeze(networkToRpc);

function getMalRpcError(message: string): RpcResp {
    return {
        isMalicious: true,
        rpcResp:{
            "id": 420,
            "jsonrpc": "2.0",
            "error": {
                "code": -32003, // https://eips.ethereum.org/EIPS/eip-1474#error-codes
                "message": message
            }
        }
    }
}

async function checkAddress(address: string): Promise<RpcResp> {
    try {
        if (isAddress(address)){
            let result = await convo.omnid.kits.isMalicious(getAddress(address), computeConfig);
            console.log('omnid.kits.isMalicious', getAddress(address), result);

            if (result?.alchemy && result.alchemy === true) return getMalRpcError(`Spam Contract Flagged by Alchemy`);
            else if (result?.chainabuse && result.chainabuse === true) return getMalRpcError(`Contract Flagged by ChainAbuse`);
            else if (result?.cryptoscamdb && result.cryptoscamdb === true) return getMalRpcError(`Contract Flagged by CryptoscamDB`);
            else if (result?.etherscan && 'label' in result.etherscan) return getMalRpcError(`Address Flagged as ${result.etherscan.label} by Etherscan`);
            else if (result?.mew && 'comment' in result.mew) return getMalRpcError(`Address Flagged by MyEtherWallet`);
            else if (result?.sdn) return getMalRpcError(`Address Flagged by OFAC`);
            else if (result?.tokenblacklist) return getMalRpcError(`Address Blacklisted by Stablecoin`);
            else if (result?.txn) return getMalRpcError(`Address/Contract Funded by Tornado Cash.`);
            else return {isMalicious: false}
        }
        else return {isMalicious: false}

    } catch (error) {
        return {isMalicious: false}
    }
}

async function alchemySimulate(simData: AlchemySimulationReq): Promise<AlchemySimulationResp | false> {
    try {

        let resp = await fetch(SIMULATE_URL, {
            method: "POST",
            body: JSON.stringify(simData),
            headers: {
                'X-Access-Key': getEnv('TENDERLY_ACCESS_KEY'),
            }
        }).then(r=>r.json());

        return resp as AlchemySimulationResp;

    } catch (error) {
        console.log('alchemySimulate', error);
        return false;
    }
}

async function sendToRpc(network: supportedNetworkIds, req: FastifyRequest) {
    let query = req.query as IQuerystring;
    try {
        let rpcUrl = network === 'manual' ? query.rpcUrl : networkToRpc[network];
        if (rpcUrl !== undefined){
            // console.log('using rpcurl', rpcUrl);
            let data = await fetch(rpcUrl, {
                method: "POST",
                body: JSON.stringify(req.body),
                headers: {
                    'Content-Type': 'application/json',
                    "Accept": 'application/json',
                    "infura-source": 'metamask/internal',                           // for infura based rpc urls.
                    "origin": 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn' // for infura based rpc urls.
                }
            }).then(e=>e.json());

            // console.log('sendToRpc/result', data);
            return data;

        }
        else {
            let {rpcResp} = getMalRpcError('Invalid RPC Url');
            return rpcResp;
        }

    } catch (error) {
        let {rpcResp} = getMalRpcError(error as string);
        return rpcResp;
    }
}

async function processTxs(network: supportedNetworkIds, req: FastifyRequest) {

    const body = req.body as JsonRpcReq;
    const query = req.query as IQuerystring;

    var txData = toBuffer(body['params'][0])
    var deserializedTx = FeeMarketEIP1559Transaction.fromSerializedTx(txData);
    var deserializedTxParsed = deserializedTx.toJSON();

    // console.log('deserializedTx', deserializedTxParsed);

    // Check `to`
    //      if malicious then revert txn
    if (Object.keys(deserializedTxParsed).includes('to') === true){
        let {isMalicious, rpcResp} = await checkAddress((deserializedTxParsed.to) as string);
        if (isMalicious == true && rpcResp){
            rpcResp.id = body.id;
            return rpcResp; // Return if Mal intent found.
        }
    }

    // Simulate Txn
    let simData: AlchemySimulationReq = {
        "network_id": parseInt(deserializedTx.chainId.toString(10)),
        "from": deserializedTx.getSenderAddress().toString(),
        "to":  deserializedTx.to ? deserializedTx.to.toString() : "",
        "input": deserializedTx.data.toString('hex'),
        "gas": parseInt(deserializedTx.gasLimit.toString(10)),
        "gas_price": deserializedTx.maxFeePerGas.add(deserializedTx.maxPriorityFeePerGas).toString(10),
        "value": parseInt(deserializedTx.value.toString(10)),
        "save_if_fails": true,
        "save": false,
        "simulation_type": "full"
    }
    let alResp = await alchemySimulate(simData);

    if (alResp != undefined && alResp != false && 'transaction_info' in alResp && alResp.transaction_info != undefined){
        console.log('Sim Successful')
        for (let index = 0; index < alResp.transaction_info.logs.length; index++) {
            const logData = alResp.transaction_info.logs[index];

            // Scan through the events emitted for malicious addresses.
            if (logData.name === 'Approval' || logData.name === 'Transfer'){
                let {isMalicious, rpcResp} = await checkAddress(logData.inputs[1].value);
                // console.log('logcheck', getAddress(deserializedTxParsed.to), isMalicious, rpcResp);
                if (isMalicious === true) return rpcResp;
            }
            // TODO: if token value greater than tolerance for token then revert.

        }
    }

    // test blockUnverifiedContracts
    if (network != 'manual' && 'blockUnverifiedContracts' in query && query.blockUnverifiedContracts === true){
        let verificationReq = await fetch(`https://sourcify.dev/server/check-all-by-addresses?addresses=${deserializedTxParsed?.to}&chainIds=1,4,11155111,137,80001,10,42161,421611`);
        let verificationResp;
        if (verificationReq.ok === true) {
            verificationResp = await verificationReq.json() as SourifyResp
            if (Object.keys(verificationResp).includes('status')){ // mean unverified.
                let {rpcResp} = getMalRpcError('The contract is unverified');
                return rpcResp;
            };
        }
        else {
            let {rpcResp} = getMalRpcError('Sourcify Request Failed');
            return rpcResp;
        }

    }

    // test enableScanners
    if (network in ['mainnet', 'polygon', 'polygon-testnet'] && query?.enableScanners !== undefined && deserializedTxParsed.to !== undefined){
        let networkId = network as lifejacketSupportedNetwork;
        let scanners = query.enableScanners.split(',');
        for (let index = 0; index < scanners.length; index++) {
            const scanner = scanners[index];
            if (scanner === 'slither'){
                let slTest = await testUsingSlither(networkId, deserializedTxParsed.to);
                if (slTest.results.length>0){
                    return getMalRpcError('Slither detected possible attack vectors');
                }
            }
            else if (scanner === 'mythril'){
                let slTest = await testUsingMythril(networkId, deserializedTxParsed.to);
                if (slTest.results.length>0){
                    return getMalRpcError('Slither detected possible attack vectors');
                }
            }
        }
    }

    // If nothing found, simply submit txn to network.
    return await sendToRpc(network, req);

}

server.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const stream = await readFileSync(path.join(__dirname, '../public/', 'index.html'))
        reply.header("Content-Security-Policy", "default-src *; style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline'; img-src data:;");
        reply.type('text/html').send(stream)
    })

server.post('/lifejacket/slither', async (req: FastifyRequest, reply: FastifyReply) => {
    const {network, address} = req.body as {network: string, address: string};
    if(network != undefined && address != undefined && isAddress(address)){
        let sr = await testUsingSlither(network as lifejacketSupportedNetwork, address);
        return reply.send(sr)
    }
    else return reply.send({success: false, error: "Invalid body params, network or address"})
});

server.post('/lifejacket/mythril', async (req: FastifyRequest, reply: FastifyReply) => {
    const {network, address} = req.body as {network: string, address: string};
    if(network != undefined && address != undefined && isAddress(address)){
        let sr = await testUsingMythril(network as lifejacketSupportedNetwork, address);
        return reply.send(sr)
    }
    else return reply.send({success: false, error: "Invalid body params, network or address"})
});

server.post('/:network', async (req: FastifyRequest, reply: FastifyReply) => {
    let { hostname } =  req;
    const body = req.body as JsonRpcReq;

    let isPhishing = checkForPhishing(hostname); // https://metamask.github.io/eth-phishing-detect/

    if (!isPhishing){
        const {network} = req.params as IRouteParams;

        if (network && Object.keys(networkToRpc).includes(network) === true){ // valid chain
            if (body['method'] == 'eth_sendRawTransaction') {
                let resp = await processTxs(network, req)
                reply.send(resp);
            }
            else {
                let resp = await sendToRpc(network, req);
                reply.send(resp)
            }
        }
        else {
            reply.send({error: `Invalid network '${network}', available networks are ${Object.keys(networkToRpc).join(', ')}`})
        }

    }
    else {
        let {rpcResp} = getMalRpcError(`🚨 Phishing detector for the site ${hostname} has been triggered.`)
        reply.send(rpcResp);
    }
})

server.listen({ port: parseInt(getEnv('PORT')) || 8545, host: "0.0.0.0" }, (err, address)=>{
    if (!err){
        console.log('🚀 Server is listening on', address);
    }
    else {
        throw err;
    }
});

// checkAddress('').then(console.log)
