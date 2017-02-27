import * as FS from 'fs';
import * as Path from 'path';

import { ExpectedError } from 'clime';
import fetch from 'node-fetch';
import * as v from 'villa';

import { renderTemplate } from '../util';

const MODULE_PATH = Path.join(__dirname, '../..');
const RESOURCES_DIR = Path.join(MODULE_PATH, 'res');
const PLATFORM_RESOURCES_DIR = Path.join(RESOURCES_DIR, process.platform);
const UNIVERSAL_RESOURCES_DIR = Path.join(RESOURCES_DIR, 'universal');
const SCRIPT_TEMPLATES_DIR = Path.join(PLATFORM_RESOURCES_DIR, '/script-templates');
const FILE_TEMPLATES_DIR = Path.join(UNIVERSAL_RESOURCES_DIR, '/file-templates');

const APNIC_URL = 'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest';

export interface VPNScriptsOptions {
  entry: string;
  username: string | undefined;
  password: string | undefined;
  phonebook: string | undefined;
  routeMetric: number;
  routeMinSize: number;
  dnsServers: string[] | undefined;
}

export type FileGeneratingProgressHandler = (state: 'fetching' | 'generating', data?: any) => void;

export interface GeneratingProgressData {
  coverage: number;
  count: number;
}

export async function generateFiles(options: VPNScriptsOptions, progress: FileGeneratingProgressHandler): Promise<string[]> {
  let { routeMinSize, ...data } = options;

  progress('fetching');

  let { coverage, routes } = await getChinaRoutes({
    minSize: routeMinSize
  });

  progress('generating', {
    coverage,
    count: routes.length
  } as GeneratingProgressData);

  let scriptNames = await v.call(FS.readdir, SCRIPT_TEMPLATES_DIR).catch(() => { }) || [];
  let fileNames = await v.call(FS.readdir, FILE_TEMPLATES_DIR).catch(() => { }) || [];

  return v.map([
    ...scriptNames.map(createTemplateInfoTransformer(SCRIPT_TEMPLATES_DIR, true)),
    ...fileNames.map(createTemplateInfoTransformer(FILE_TEMPLATES_DIR, false))
  ], async ({ targetPath, templatePath, script }) => {
    let templateData = Object.assign({
      cliPath: Path.join(MODULE_PATH, 'bld/cli.js'),
      routes,
      routesFile: Path.resolve('routes.txt')
    }, data);
    let content = await renderTemplate(templatePath, templateData);

    await v.call(FS.writeFile, targetPath, content);

    if (script && process.platform !== 'win32') {
      await v.call(FS.chmod, targetPath, 0o755);
    }

    return Path.relative('.', targetPath);
  });

  function createTemplateInfoTransformer(dir: string, script: boolean) {
    return (fileName: string) => {
      return {
        templatePath: Path.join(dir, fileName),
        targetPath: Path.resolve(fileName),
        script
      };
    }
  }
}

interface Route {
  network: string;
  cidr: number;
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

    rawRoutes.push({
      networkStr,
      network,
      size
    });
  }

  let total = 0;
  let covered = 0;

  let routes: Route[] = lines
    .map(line => {
      let parts = line.split('|');
      let networkStr = parts[3];
      let network = convertIPv4StringToInteger(networkStr);
      let size = Number(parts[4]);

      return {
        networkStr,
        network,
        size
      };
    })
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
        cidr: 32 - Math.log2(route.size)
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
