import path from 'path'
import util from 'node:util';
const exec = util.promisify(require('node:child_process').exec);
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

import { EtherscanVerificationResp, SlitherOutput, lifejacketSupportedNetwork, TestResult, SlitherDetectors } from '../types';
import { getAddress } from '@ethersproject/address';
import fetch from 'cross-fetch';

import { networkIdToEtherscanEndpoint, setSolidityVersion } from './common';

interface ComputeResp {
    foundIssue: boolean;
    data: Array<{
        impact: string;
        confidence: string;
        check: string;
    }>;
}

async function storeAndRun(networkId: lifejacketSupportedNetwork, address: string, sourceCode: string): Promise<ComputeResp>{
    const contractsDir = path.join(__dirname, '../contracts');
    if (!existsSync(contractsDir)){
        mkdirSync(contractsDir);
    }
    const fn = networkId + '-' + getAddress(address);
    await writeFile(path.join(contractsDir, fn+'.sol'), sourceCode);

    const command = `manticore ${path.join(contractsDir, fn+'.sol')} --json ${path.join(contractsDir, fn+'.json')} --exclude-low --exclude-medium --exclude-informational --exclude-optimization --solc-disable-warnings`;
    // console.warn('Running', command);
    try {
        const { stdout, stderr } = await exec(command);
    } catch (error) {

    }
    // console.log(stdout, stderr)
    let rawResults = await readFile(path.join(contractsDir, fn+'.json'), {encoding: 'utf8'});
    let results = JSON.parse(rawResults.toString()) as SlitherOutput;

    if (results.success === true && results.results?.detectors != undefined && results.results.detectors.length>0){
        console.log('storeAndRun/foundIssue');
        return {foundIssue: true, data: results.results.detectors}
    }
    else {
        console.log('storeAndRun/Nothing Found');
        return {foundIssue: false, data: []}
    }

}

export async function testUsingManticore(network: lifejacketSupportedNetwork, address: string): Promise<TestResult<SlitherDetectors>> {

    const fn = network + '-' + getAddress(address);
    const reportAdd = path.join(__dirname, '../contracts', fn+'.json');
    if (existsSync(reportAdd)){
        let rawResults = await readFile(reportAdd, {encoding: 'utf8'});
        let results = JSON.parse(rawResults.toString()) as SlitherOutput;
        if (results.success === true && results.results?.detectors != undefined && results.results.detectors.length>0){
            return {cached: true, success: true, results: results.results.detectors, error: ""}
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
                        let slitherResp = await storeAndRun(network, address, sourceCode);
                        if (slitherResp.foundIssue) {
                            return {success: true, results: slitherResp.data, error: ''}
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
    // let resp = await testUsingSlither('mainnet', '0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf');
    let resp = await testUsingManticore('polygon-testnet', '0xe2fe619d0f3cf2a2cd3bf888d1ec79a16859988b');
    console.log('testrun', resp);
}
