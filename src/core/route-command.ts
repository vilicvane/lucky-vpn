import { exec, spawn } from 'child_process';
import * as Path from 'path';

import { ExpectedError } from 'clime';
import * as v from 'villa';

const WINDOWS_OPERATION_CONCURRENCY = 1;
const WINDOWS_OPERATION_GROUP_SIZE = 100;

const NSETROUTE_SCRIPT_PATH = Path.join(__dirname, '../../res/win32/scripts/nsetroute.js');

export type RouteCommandProgressHandler = (done: number, total: number) => void;

export interface RouteCommandAddOptions {
  metric: number;
}

export abstract class RouteCommand {
  abstract async add(routes: string[], options: RouteCommandAddOptions, progress: RouteCommandProgressHandler): Promise<void>;
  abstract async delete(routes: string[], progress: RouteCommandProgressHandler): Promise<void>;

  static getCommand(): RouteCommand {
    switch (process.platform) {
      case 'win32':
        return new WindowsRouteCommand();
      default:
        throw new ExpectedError(`This feature is not available on platform "${process.platform}"`);
    }
  }
}

interface RouteTableInfo {
  existingNetworkSet: Set<string>;
  gateway: string | undefined;
}

class WindowsRouteCommand implements RouteCommand {
  private execute(command: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error && stdout && !stderr) {
          reject(new ExpectedError('Error executing command, try run as administrator'));
          return;
        }

        process.stderr.write(stderr);
        resolve();
      });
    });
  }

  private async batchExecute(commands: string[], progress: RouteCommandProgressHandler): Promise<void> {
    let done = 0;
    let total = commands.length;
    await v.parallel(commands, async (command, index) => {
      await this.execute(command);
      progress(++done, total);
    }, WINDOWS_OPERATION_CONCURRENCY);
  }

  private async operate(routes: string[], transformer: (route: string) => string, progress: RouteCommandProgressHandler): Promise<void> {
    let singleTotal = routes.length;

    routes = routes.concat();

    let commands: string[] = [];
    while (routes.length) {
      let commandStrs = routes
        .splice(0, WINDOWS_OPERATION_GROUP_SIZE)
        .map(route => transformer(route));
      commands.push(commandStrs.join(' & '));
    }

    progress(0, singleTotal);

    await this.batchExecute(commands, (groupDone, groupTotal) => {
      let doneStart = (groupDone - 1) * WINDOWS_OPERATION_GROUP_SIZE;
      let doneEnd = Math.min(groupDone * WINDOWS_OPERATION_GROUP_SIZE, singleTotal);
      for (let i = doneStart + 1; i <= doneEnd; i++) {
        progress(i, singleTotal);
      }
    });
  }

  async add(routes: string[], options: RouteCommandAddOptions, progress: RouteCommandProgressHandler): Promise<void> {
    let { existingNetworkSet, gateway } = await WindowsRouteCommand.getRouteTableInfo();

    if (!gateway) {
      throw new ExpectedError('Failed to query gateway');
    }

    routes = routes
      .map(route => {
        let parts = route.split('/');
        return {
          network: parts[0],
          cidr: Number(parts[1])
        };
      })
      .filter(route => !existingNetworkSet.has(route.network))
      .sort((a, b) => a.cidr - b.cidr)
      .map(route => `${route.network}/${route.cidr}`);

    await this.operate(routes, route => `route add ${route} ${gateway} metric ${options.metric}`, progress);
  }

  async delete(routes: string[], progress: RouteCommandProgressHandler): Promise<void> {
    let { existingNetworkSet } = await WindowsRouteCommand.getRouteTableInfo();
    routes = routes.filter(route => existingNetworkSet.has(route.split('/')[0]));
    await this.operate(routes, route => `route delete ${route}`, progress);
  }

  static async getRouteTableInfo(): Promise<RouteTableInfo> {
    let json = '';

    let cp = spawn('cscript', ['/nologo', NSETROUTE_SCRIPT_PATH, 'print']);
    cp.stdout.on('data', (data: Buffer) => json += data.toString());

    await v.awaitable(cp);

    let data = JSON.parse(json);

    return {
      existingNetworkSet: new Set<string>(data.destinations),
      gateway: data.gateway
    };
  }
}
