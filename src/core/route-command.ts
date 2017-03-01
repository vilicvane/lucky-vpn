import { exec, spawn } from 'child_process';
import * as Path from 'path';
import { createInterface } from 'readline';

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
  abstract async add(routes: string[], options: RouteCommandAddOptions): Promise<void>;
  abstract async delete(routes: string[]): Promise<void>;

  static getCommand(): RouteCommand {
    switch (process.platform) {
      case 'win32':
        return new WindowsRouteCommand();
      default:
        throw new ExpectedError(`This feature is not available on platform "${process.platform}"`);
    }
  }
}

class WindowsRouteCommand implements RouteCommand {
  private spawn(command: string): Promise<void> {
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

  async operate(operation: 'add' | 'delete', routes: string[]): Promise<void> {
    let cp = spawn('cscript', ['/nologo', NSETROUTE_SCRIPT_PATH, operation]);

    cp.stdout.pipe(process.stdout);
    cp.stdin.end(routes.join('\n'));

    await v.awaitable(cp);
  }

  async add(routes: string[], options: RouteCommandAddOptions): Promise<void> {
    let destinationSet = await WindowsRouteCommand.getExistingDestinationSet();

    routes = routes
      .map(route => {
        let parts = route.split('/');
        return {
          destination: parts[0],
          cidr: Number(parts[1])
        };
      })
      .filter(route => !destinationSet.has(route.destination))
      .sort((a, b) => a.cidr - b.cidr)
      .map(route => `${route.destination}/${route.cidr}`);

    await this.operate('add', routes);
  }

  async delete(routes: string[]): Promise<void> {
    let destinationSet = await WindowsRouteCommand.getExistingDestinationSet();
    routes = routes.filter(route => destinationSet.has(route.split('/')[0]));
    await this.operate('delete', routes);
  }

  static async getExistingDestinationSet(): Promise<Set<string>> {
    let buffers: Buffer[] = [];

    let cp = spawn('cscript', ['/nologo', NSETROUTE_SCRIPT_PATH, 'print']);
    cp.stdout.on('data', (buffer: Buffer) => buffers.push(buffer));
    await v.awaitable(cp);

    let output = Buffer.concat(buffers).toString();

    return new Set(output.match(/.+/mg) || []);
  }
}
