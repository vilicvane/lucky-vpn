import { exec } from 'child_process';

import { ExpectedError } from 'clime';
import * as v from 'villa';

const WINDOWS_OPERATION_CONCURRENCY = 1;
const WINDOWS_OPERATION_GROUP_SIZE = 100;

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
  addedNetworkSet: Set<string>;
  gateway: string | undefined;
}

class WindowsRouteCommand implements RouteCommand {
  private execute(command: string): Promise<void> {
    return new Promise<void>(resolve => {
      exec(command, (error, stdout, stderr) => {
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
    let { addedNetworkSet, gateway } = await WindowsRouteCommand.getRouteTableInfo();

    if (!gateway) {
      throw new ExpectedError('Failed to query gateway');
    }

    routes = routes.filter(route => !addedNetworkSet.has(route.split('/')[0]));
    await this.operate(routes, route => `route add ${route} ${gateway} metric ${options.metric}`, progress);
  }

  async delete(routes: string[], progress: RouteCommandProgressHandler): Promise<void> {
    let { addedNetworkSet } = await WindowsRouteCommand.getRouteTableInfo();
    routes = routes.filter(route => addedNetworkSet.has(route.split('/')[0]));
    await this.operate(routes, route => `route delete ${route}`, progress);
  }

  static async getRouteTableInfo(): Promise<RouteTableInfo> {
    let routeTableOutput = await v.call(exec, 'route print');
    let networkRegex = /^\s*\d+(?:\.\d+){3}/mg;
    let gatewayRegex = /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+(?:\.\d+){3})/m;
    let addedNetworks = (routeTableOutput.match(networkRegex) || []).map(network => network.trim());
    let gateway = (routeTableOutput.match(gatewayRegex) || [])[1];
    return {
      addedNetworkSet: new Set(addedNetworks),
      gateway
    };
  }
}
