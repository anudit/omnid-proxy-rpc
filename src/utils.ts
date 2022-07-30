require('dotenv').config({ path: '.env' })
import { supportedEnvVars } from "./types";

export const getEnv = (envVar: supportedEnvVars) => {
    const resp = process.env[envVar];
    if(resp === undefined) throw new Error(`'${envVar}' Environment Variable is Not Defined`);
    else return resp as string;
}
