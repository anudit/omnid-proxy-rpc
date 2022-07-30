import path from 'path'
import util from 'node:util';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
const exec = util.promisify(require('node:child_process').exec);

import { EtherscanVerificationResp, MythrilOutput, lifejacketSupportedNetwork, TestResult, MythrilIssues } from '../types';
import { getAddress } from '@ethersproject/address';
import fetch from 'cross-fetch';
import { networkIdToEtherscanEndpoint, setSolidityVersion } from './common';

interface ComputeResp {
    foundIssue: boolean;
    data: MythrilIssues;
}

async function storeAndRun(networkId: lifejacketSupportedNetwork, address: string, sourceCode: string): Promise<ComputeResp>{
    const contractsDir = path.join(__dirname, '../contracts');
    if (!existsSync(contractsDir)){
        mkdirSync(contractsDir);
    }
    const fn = networkId + '-' + getAddress(address);
    await writeFile(path.join(contractsDir, fn+'.sol'), sourceCode);

    const command = `myth analyze ${path.join(contractsDir, fn+'.sol')} -o json --execution-timeout 60 --max-depth 10 --parallel-solving --no-onchain-data > ${path.join(contractsDir, 'mythril-'+fn+'.json')}`;
    // console.warn('Running', command);
    try {
        const { stdout, stderr } = await exec(command);
    } catch (error) {

    }
    // console.log(stdout, stderr)
    let rawResults = await readFile(path.join(contractsDir, 'mythril-'+fn+'.json'), {encoding: 'utf8'});
    let results = JSON.parse(rawResults.toString()) as MythrilOutput;

    if (results?.issues != undefined && results.issues.length>0) {
        console.log('mythril/storeAndRun/foundIssue');
        return {foundIssue: true, data: results.issues}
    }
    else {
        console.log('mythril/storeAndRun/Nothing Found');
        return {foundIssue: false, data: []}
    }

}

export async function testUsingMythril(network: lifejacketSupportedNetwork, address: string): Promise<TestResult<MythrilIssues>> {

    const fn = network + '-' + getAddress(address);
    const reportAdd = path.join(__dirname, '../contracts', 'mythril-'+fn+'.json');
    if (existsSync(reportAdd)){
        let rawResults = await readFile(reportAdd, {encoding: 'utf8'});
        let results = JSON.parse(rawResults.toString()) as MythrilOutput;
        if (results?.issues != undefined && results.issues.length>0) {
            return {cached: true, success: true, results: results.issues, error: ""}
        }
        else {
            return {cached: true, success: true, results: [], error: ""}
        }
    }
    else {

        const req = await fetch(`${networkIdToEtherscanEndpoint.get(network)}&module=contract&action=getsourcecode&address=${address}`);
        if (req.ok === true){
            const resp = await req.json() as EtherscanVerificationResp;
            if (resp.status == '1' && resp.result.length > 0){
                if (resp.result[0].Proxy === '0'){

                    const sourceCode = resp.result[0].SourceCode;
                    const justVersion = resp.result[0].CompilerVersion.split('+')[0].slice(1);
                    let setVersionResp = await setSolidityVersion(justVersion);
                    console.log('setVersionResp', justVersion, setVersionResp);
                    if (setVersionResp === true){
                        let mythrilResp = await storeAndRun(network, address, sourceCode);
                        if (mythrilResp.foundIssue) {
                            return {success: true, results: mythrilResp.data, error: ''}
                        }
                        else {
                            return {success: true, results: [], error: ''}
                        }
                    }
                    else {
                        console.log('Failed to set Solidity Version.');
                        return {success: false, error: 'Failed to set Solidity Version.', results: []}
                    }
                }
                else {
                    // TODO: Deal With proxy.
                    return {success: false, error: 'Proxy', results: []}
                }
            }
            else {
                console.log('Source code not verified on EtherScan');
                return {success: false, error: 'Source code not verified on EtherScan', results: []}
            }
        }
        else {
            console.log('Error Fetching Source Code from EtherScan');
            return {success: false, error: 'Error Fetching Source Code from EtherScan', results: []}
        }
    }



}
export async function testrun(){
    // let resp = await testUsingMythril('mainnet', '0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf');
    let resp = await testUsingMythril('polygon-testnet', '0xe2fe619d0f3cf2a2cd3bf888d1ec79a16859988b');
    console.log('testrun', resp);
}
