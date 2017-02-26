import * as FS from 'fs';
import * as Path from 'path';

import { ExpectedError } from 'clime';
import fetch from 'node-fetch';
import * as v from 'villa';

import { renderTemplate } from '../util';

const TEMPLATES_DIR = Path.join(__dirname, `../../res/${process.platform}/script-templates`);
const APNIC_URL = 'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest';

export interface VPNScriptOptions {
  entry: string;
  username: string | undefined;
  password: string | undefined;
  phonebook: string | undefined;
  routeMetric: number;
  routeMinSize: number;
  dnsServers: string[] | undefined;
}

export type VPNScriptsGeneratingProgressHandler = (state: 'fetching' | 'generating', data?: any) => void;

export interface GeneratingProgressData {
  coverage: number;
  count: number;
}

export async function generateVPNScripts(options: VPNScriptOptions, progress: VPNScriptsGeneratingProgressHandler): Promise<string[]> {
  try {
    await v.call(FS.stat, TEMPLATES_DIR);
  } catch (error) {
    throw new ExpectedError(`Current platform "${process.platform}" is not supported`);
  }

  let { routeMinSize, ...data } = options;

  progress('fetching');

  let { coverage, routes } = await getChinaRoutes({
    minSize: routeMinSize
  });

  progress('generating', {
    coverage,
    count: routes.length
  } as GeneratingProgressData);

  let scriptNames = await v.call(FS.readdir, TEMPLATES_DIR);

  return v.map(scriptNames, async scriptName => {
    let templatePath = Path.join(TEMPLATES_DIR, scriptName);
    let targetPath = Path.resolve(scriptName);
    let templateData = Object.assign({ routes }, data);
    let content = await renderTemplate(templatePath, templateData);

    await v.call(FS.writeFile, targetPath, content);

    if (process.platform !== 'win32') {
      await v.call(FS.chmod, targetPath, 0o755);
    }

    return Path.relative('.', targetPath);
  });
}

interface Route {
  network: string;
  mask: string;
}

interface RawRoute {
  networkStr: string;
  network: number;
  size: number;
}

interface GetRoutesOptions {
  minSize: number;
}

interface RoutesInfo {
  coverage: number;
  routes: Route[];
}

async function getChinaRoutes({ minSize }: GetRoutesOptions): Promise<RoutesInfo> {
  let response = await fetch(APNIC_URL);
  let text = await response.text();
  let lines = text.match(/^apnic\|CN\|ipv4\|.+/mg) || [];

  let rawRoutes: RawRoute[] = [];

  for (let line of lines) {
    let parts = line.split('|');
    let networkStr = parts[3];
    let network = convertIPv4StringToInteger(networkStr);
    let size = Number(parts[4]);

    if (rawRoutes.length) {
      let lastRoute = rawRoutes[rawRoutes.length - 1];
      let lastAddressEnd = lastRoute.network + lastRoute.size;
      if (lastAddressEnd === network) {
        lastRoute.size += size;
        continue;
      }
    }

    rawRoutes.push({
      networkStr,
      network,
      size
    });
  }

  let total = 0;
  let covered = 0;

  let routes: Route[] = rawRoutes
    .filter(({ size }) => {
      total += size;
      if (size >= minSize) {
        covered += size;
        return true;
      } else {
        return false;
      }
    })
    .map(route => {
      return {
        network: route.networkStr,
        mask: convertIPv4IntegerToString(~(route.size - 1))
      };
    });

  return {
    coverage: covered / (total || 0),
    routes
  };
}

function convertIPv4StringToInteger(address: string): number {
  return address.split('.')
    .map((part, index) => Number(part) << 24 - index * 8 >>> 0)
    .reduce((sum, value) => sum + value);
}

function convertIPv4IntegerToString(address: number): string {
  return `${(address >>> 24)}.${address >>> 16 & 0xff}.${address >>> 8 & 0xff}.${address & 0xff}`;
}
