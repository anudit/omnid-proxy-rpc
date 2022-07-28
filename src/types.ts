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

