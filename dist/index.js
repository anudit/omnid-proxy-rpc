"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_fastify = __toESM(require("fastify"));
var import_helmet = __toESM(require("@fastify/helmet"));
var import_compress = __toESM(require("@fastify/compress"));
var import_cors = __toESM(require("@fastify/cors"));
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var import_cross_fetch = __toESM(require("cross-fetch"));
var import_tx = require("@ethereumjs/tx");
var import_sdk = require("@theconvospace/sdk");
var import_address = require("@ethersproject/address");
"strict";
require("dotenv").config({ path: ".env" });
var server = (0, import_fastify.default)({ logger: false });
var toBuffer = require("ethereumjs-util").toBuffer;
var checkForPhishing = require("eth-phishing-detect");
server.register(import_helmet.default, { global: true });
server.register(import_compress.default, { global: true });
server.register(import_cors.default, { origin: "*" });
var { ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, OPTIMISMSCAN_API_KEY, MAINNET_FLASHBOTS_RPC_URL, GOERLI_FLASHBOTS_RPC_URL, MAINNET_FLASHBOTS_FAST_RPC_URL, TENDERLY_USER, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY, SEPOLIA_RPC_URL, POLYGON_RPC_URL, POLYGON_MUMBAI_RPC_URL, OPTIMISM_RPC_URL, OPTIMISM_TESTNET_RPC_URL, ARBITRUM_RPC_URL, ARBITRUM_TESTNET_RPC_URL, MAINNET_RPC_URL, ROPSTEN_RPC_URL, KOVAN_RPC_URL, RINKEBY_RPC_URL, GOERLI_RPC_URL, CONVO_API_KEY, ALCHEMY_API_KEY, CNVSEC_ID } = process.env;
var SIMULATE_URL = `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`;
var convo = new import_sdk.Convo(CONVO_API_KEY);
var computeConfig = {
  alchemyApiKey: ALCHEMY_API_KEY,
  CNVSEC_ID,
  etherscanApiKey: ETHERSCAN_API_KEY,
  polygonscanApiKey: POLYGONSCAN_API_KEY,
  optimismscanApiKey: OPTIMISMSCAN_API_KEY,
  polygonMainnetRpc: "",
  etherumMainnetRpc: "",
  avalancheMainnetRpc: "",
  maticPriceInUsd: 0,
  etherumPriceInUsd: 0,
  deepdaoApiKey: "",
  zapperApiKey: "",
  DEBUG: false
};
var networkToRpc = {
  "mainnet": MAINNET_RPC_URL,
  "mainnet-flashbots": MAINNET_FLASHBOTS_RPC_URL,
  "mainnet-flashbots-fast": MAINNET_FLASHBOTS_FAST_RPC_URL,
  "ropsten": ROPSTEN_RPC_URL,
  "kovan": KOVAN_RPC_URL,
  "rinkeby": RINKEBY_RPC_URL,
  "goerli": GOERLI_RPC_URL,
  "sepolia": SEPOLIA_RPC_URL,
  "goerli-flashbots": GOERLI_FLASHBOTS_RPC_URL,
  "polygon": POLYGON_RPC_URL,
  "polygon-mumbai": POLYGON_MUMBAI_RPC_URL,
  "optimism": OPTIMISM_RPC_URL,
  "optimism-testnet": OPTIMISM_TESTNET_RPC_URL,
  "arbitrum": ARBITRUM_RPC_URL,
  "arbitrum-testnet": ARBITRUM_TESTNET_RPC_URL,
  "manual": "1"
};
Object.freeze(networkToRpc);
function getMalRpcError(message) {
  return {
    isMalicious: true,
    rpcResp: {
      "id": 420,
      "jsonrpc": "2.0",
      "error": {
        "code": -32003,
        "message": message
      }
    }
  };
}
__name(getMalRpcError, "getMalRpcError");
async function checkAddress(address) {
  try {
    if ((0, import_address.isAddress)(address)) {
      let result = await convo.omnid.kits.isMalicious((0, import_address.getAddress)(address), computeConfig);
      console.log("omnid.kits.isMalicious", (0, import_address.getAddress)(address), result);
      if ((result == null ? void 0 : result.alchemy) && result.alchemy === true)
        return getMalRpcError(`Spam Contract Flagged by Alchemy`);
      else if ((result == null ? void 0 : result.chainabuse) && result.chainabuse === true)
        return getMalRpcError(`Contract Flagged by ChainAbuse`);
      else if ((result == null ? void 0 : result.cryptoscamdb) && result.cryptoscamdb === true)
        return getMalRpcError(`Contract Flagged by CryptoscamDB`);
      else if ((result == null ? void 0 : result.etherscan) && "label" in result.etherscan)
        return getMalRpcError(`Address Flagged as ${result.etherscan.label} by Etherscan`);
      else if ((result == null ? void 0 : result.mew) && "comment" in result.mew)
        return getMalRpcError(`Address Flagged by MyEtherWallet`);
      else if (result == null ? void 0 : result.sdn)
        return getMalRpcError(`Address Flagged by OFAC`);
      else if (result == null ? void 0 : result.tokenblacklist)
        return getMalRpcError(`Address Blacklisted by Stablecoin`);
      else if (result == null ? void 0 : result.txn)
        return getMalRpcError(`Address/Contract Funded by Tornado Cash.`);
      else
        return { isMalicious: false };
    } else
      return { isMalicious: false };
  } catch (error) {
    return { isMalicious: false };
  }
}
__name(checkAddress, "checkAddress");
async function alchemySimulate(simData) {
  try {
    let resp = await (0, import_cross_fetch.default)(SIMULATE_URL, {
      method: "POST",
      body: JSON.stringify(simData),
      headers: {
        "X-Access-Key": TENDERLY_ACCESS_KEY
      }
    }).then((r) => r.json());
    return resp;
  } catch (error) {
    console.log("alchemySimulate", error);
    return false;
  }
}
__name(alchemySimulate, "alchemySimulate");
async function sendToRpc(network, req) {
  let query = req.query;
  try {
    let rpcUrl = network === "manual" ? query.rpcUrl : networkToRpc[network];
    if (rpcUrl !== void 0) {
      let data = await (0, import_cross_fetch.default)(rpcUrl, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "infura-source": "metamask/internal",
          "origin": "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn"
        }
      }).then((e) => e.json());
      return data;
    } else {
      let { rpcResp } = getMalRpcError("Invalid RPC Url");
      return rpcResp;
    }
  } catch (error) {
    let { rpcResp } = getMalRpcError(error);
    return rpcResp;
  }
}
__name(sendToRpc, "sendToRpc");
async function processTxs(network, req) {
  const body = req.body;
  const query = req.query;
  var txData = toBuffer(body["params"][0]);
  var deserializedTx = import_tx.FeeMarketEIP1559Transaction.fromSerializedTx(txData);
  var deserializedTxParsed = deserializedTx.toJSON();
  if (Object.keys(deserializedTxParsed).includes("to") === true) {
    let { isMalicious, rpcResp } = await checkAddress(deserializedTxParsed.to);
    if (isMalicious == true && rpcResp) {
      rpcResp.id = body.id;
      return rpcResp;
    }
  }
  let simData = {
    "network_id": parseInt(deserializedTx.chainId.toString(10)),
    "from": deserializedTx.getSenderAddress().toString(),
    "to": deserializedTx.to ? deserializedTx.to.toString() : "",
    "input": deserializedTx.data.toString("hex"),
    "gas": parseInt(deserializedTx.gasLimit.toString(10)),
    "gas_price": deserializedTx.maxFeePerGas.add(deserializedTx.maxPriorityFeePerGas).toString(10),
    "value": parseInt(deserializedTx.value.toString(10)),
    "save_if_fails": true,
    "save": false,
    "simulation_type": "full"
  };
  let alResp = await alchemySimulate(simData);
  if (alResp != void 0 && alResp != false && "transaction_info" in alResp && alResp.transaction_info != void 0) {
    console.log("Sim Successful");
    for (let index = 0; index < alResp.transaction_info.logs.length; index++) {
      const logData = alResp.transaction_info.logs[index];
      if (logData.name === "Approval" || logData.name === "Transfer") {
        let { isMalicious, rpcResp } = await checkAddress(logData.inputs[1].value);
        if (isMalicious === true)
          return rpcResp;
      }
    }
  }
  if (network != "manual" && "blockUnverifiedContracts" in query && query.blockUnverifiedContracts === true) {
    let verificationReq = await (0, import_cross_fetch.default)(`https://sourcify.dev/server/check-all-by-addresses?addresses=${deserializedTxParsed == null ? void 0 : deserializedTxParsed.to}&chainIds=1,4,11155111,137,80001,10,42161,421611`);
    let verificationResp;
    if (verificationReq.ok === true) {
      verificationResp = await verificationReq.json();
      if (Object.keys(verificationResp).includes("status")) {
        let { rpcResp } = getMalRpcError("The contract is unverified");
        return rpcResp;
      }
      ;
    } else {
      let { rpcResp } = getMalRpcError("Sourcify Request Failed");
      return rpcResp;
    }
  }
  return await sendToRpc(network, req);
}
__name(processTxs, "processTxs");
server.get("/", async (req, reply) => {
  const stream = await import_fs.default.readFileSync(import_path.default.join(__dirname, "../public/", "index.html"));
  reply.type("text/html").send(stream);
});
server.post("/:network", async (req, reply) => {
  let { hostname } = req;
  const body = req.body;
  let isPhishing = checkForPhishing(hostname);
  if (!isPhishing) {
    const { network } = req.params;
    if (network && Object.keys(networkToRpc).includes(network) === true) {
      if (body["method"] == "eth_sendRawTransaction") {
        let resp = await processTxs(network, req);
        reply.send(resp);
      } else {
        let resp = await sendToRpc(network, req);
        reply.send(resp);
      }
    } else {
      reply.send({ error: `Invalid network '${network}', available networks are ${Object.keys(networkToRpc).join(", ")}` });
    }
  } else {
    let { rpcResp } = getMalRpcError(`\u{1F6A8} Phishing detector for the site ${hostname} has been triggered.`);
    reply.send(rpcResp);
  }
});
server.listen({ port: parseInt(process.env.PORT) || 8545, host: "0.0.0.0" }, (err, address) => {
  if (!err) {
    console.log("\u{1F680} Server is listening on", address);
  } else {
    throw err;
  }
});
