import * as FS from 'fs';
import * as Path from 'path';

import { ExpectedError } from 'clime';
import * as v from 'villa';

import { getChinaRoutes, renderTemplate } from '../util';

const TEMPLATES_DIR = Path.join(__dirname, `../../res/${process.platform}/script-templates`);

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
  try {
    await v.call(FS.stat, TEMPLATES_DIR);
  } catch (error) {
    throw new ExpectedError(`Current platform "${process.platform}" is not supported`);
  }

  progress('fetching');

  let routes = await getChinaRoutes();

  progress('generating');

  let data = Object.assign({ routes }, options);

  let scriptNames = await v.call(FS.readdir, TEMPLATES_DIR);

  return v.map(scriptNames, async scriptName => {
    let templatePath = Path.join(TEMPLATES_DIR, scriptName);
    let targetPath = Path.resolve(scriptName);
    let content = await renderTemplate(templatePath, data);

    await v.call(FS.writeFile, targetPath, content);

    if (process.platform !== 'win32') {
      await v.call(FS.chmod, targetPath, 0o755);
    }

    return Path.relative('.', targetPath);
  });
}
