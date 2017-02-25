import * as FS from 'fs';
import * as Path from 'path';

import * as v from 'villa';

import { getChinaRoutes, renderTemplate } from '../util';

const TEMPLATES_DIR = Path.join(__dirname, '../../res/windows/script-templates');

export interface VPNScriptOptions {
  entry: string;
  username: string | undefined;
  password: string | undefined;
  phonebook: string | undefined;
  metric: number;
  dnsServers: string[] | undefined;
}

export type VPNScriptsGeneratingProgressHandler = (state: 'fetching' | 'generating') => void;

export async function generateVPNScripts(options: VPNScriptOptions, progress: VPNScriptsGeneratingProgressHandler): Promise<string[]> {
  progress('fetching');

  let routes = await getChinaRoutes();

  progress('generating');

  let data = Object.assign({ routes }, options);

  let scriptNames = ['vpn-up.bat', 'vpn-down.bat'];

  return v.map(scriptNames, async scriptName => {
    let templatePath = Path.join(TEMPLATES_DIR, scriptName);
    let targetPath = Path.resolve(scriptName);
    let content = await renderTemplate(templatePath, data);

    await v.call(FS.writeFile, targetPath, content);

    return Path.relative('.', targetPath);
  });
}
