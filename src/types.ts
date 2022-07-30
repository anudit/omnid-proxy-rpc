export interface RpcResp {
    isMalicious: boolean,
    rpcResp?: {
        "id": number,
        "jsonrpc": string,
        "error": {
            "code": number,
            "message": string
        }
    }
}

export type supportedNetworkIds = "mainnet"
| "mainnet-flashbots"
| "mainnet-flashbots-fast"
| "ropsten"
| "kovan"
| "rinkeby"
| "goerli"
| "sepolia"
| "goerli-flashbots"
| "polygon"
| "polygon-testnet"
| "optimism"
| "optimism-testnet"
| "arbitrum"
| "arbitrum-testnet"
| "manual" ;

export interface Dictionary<T> {
    [Key: string]: T;
}

export interface IQuerystring {
    rpcUrl?: string;
    blockUnverifiedContracts?: boolean;
    enableScanners?: string;
}

export interface IRouteParams {
    network: supportedNetworkIds;
}

export type SourifyResp = Array<{
    address: string;
    status: 'perfect' | 'partial' | 'false';
    chainIds: Array<string>;
  }>;

export interface AlchemySimulationReq {
    "network_id": number,
    "from": string,
    "to":  string,
    "input": string,
    "gas": number,
    "gas_price": string,
    "value": number,
    "save_if_fails": boolean,
    "save": boolean,
    "simulation_type": "full"
}

export interface AlchemySimulationResp {
    transaction_info?: {
        logs: Array<{
            name: string;
            inputs: Array<{value: string}>
        }>
    }
}

export interface JsonRpcReq {
    id: number;
    jsonrpc: string;
    method: string;
    params: Array<any>
}

export interface EtherscanVerificationResp {
    status: string;
    message: string;
    result: Array<{
        SourceCode: string;
        ABI: string;
        ContractName: string;
        CompilerVersion: string;
        Implementation: string;
        Proxy: "0" | "1";
    }>
}

type Detectors = Array<{
    impact: string;
    confidence: string;
    check: string;
}>

export interface SlitherResult {
    success: boolean,
    error: string,
    results: {
        detectors?: Detectors
    }
}

export interface SlitherTestResult {
    success: boolean,
    error: string,
    cached?: boolean,
    results:  Detectors
}
export type slitherSupported = 'mainnet' | 'polygon' | 'polygon-testnet';

export type supportedEnvVars = "MAINNET_RPC_URL"
| "SEPOLIA_RPC_URL"
| "ROPSTEN_RPC_URL"
| "KOVAN_RPC_URL"
| "RINKEBY_RPC_URL"
| "GOERLI_RPC_URL"
| "MAINNET_FLASHBOTS_RPC_URL"
| "MAINNET_FLASHBOTS_FAST_RPC_URL"
| "GOERLI_FLASHBOTS_RPC_URL"
| "POLYGON_RPC_URL"
| "POLYGON_TESTNET_RPC_URL"
| "OPTIMISM_RPC_URL"
| "OPTIMISM_TESTNET_RPC_URL"
| "ARBITRUM_RPC_URL"
| "ARBITRUM_TESTNET_RPC_URL"
| "TENDERLY_USER"
| "TENDERLY_PROJECT"
| "TENDERLY_ACCESS_KEY"
| "CONVO_API_KEY"
| "ALCHEMY_API_KEY"
| "CNVSEC_ID"
| "ETHERSCAN_API_KEY"
| "POLYGONSCAN_API_KEY"
| "OPTIMISMSCAN_API_KEY"
| "PORT"
