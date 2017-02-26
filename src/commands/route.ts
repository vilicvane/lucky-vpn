import * as Net from 'net';
import * as Path from 'path';
import * as Readline from 'readline';

import {
  Command,
  ExpectedError,
  Object as ClimeObject,
  Options,
  command,
  option,
  param
} from 'clime';

import * as v from 'villa';

import { RouteCommand, RouteCommandProgressHandler } from '../core';

export class RouteOptions extends Options {
  @option({
    flag: 'm',
    description: 'Routing metric',
    default: 5
  })
  routeMetric: number;
}

@command({
  description: 'Add or delete based on routes file'
})
export default class extends Command {
  async execute(
    @param({
      description: 'Operation name, could be either "add" or "delete"',
      required: true,
      validator: /^(add|delete)$/
    })
    operation: string,

    @param({
      description: 'Routes file',
      required: true
    })
    file: ClimeObject.File,

    @param({
      description: 'Gateway',
      validator: {
        validate(address: string) {
          if (!Net.isIPv4(address)) {
            throw new ExpectedError('Invalid gateway');
          }
        }
      }
    })
    gateway: string,

    options: RouteOptions
  ) {
    if (operation === 'add' && !gateway) {
      throw new ExpectedError('Gateway is required for operation "add"');
    }

    await file.assert();

    let routes = (await file.text('ascii')).match(/.+/mg) || [];

    let routeCommand = RouteCommand.getCommand();

    switch (operation) {
      case 'add':
        await routeCommand.add(routes, { gateway, metric: options.routeMetric }, createProgressLogger('add'));
        break;
      case 'delete':
        await routeCommand.delete(routes, createProgressLogger('delete'));
        break;
    }
  }
}

function createProgressLogger(operation: 'add' | 'delete'): RouteCommandProgressHandler {
  return (done, total) => {
    if (done % 100 && done !== total) {
      return;
    }

    let stdout = process.stdout;

    if (done) {
      stdout.write('\r');
    }

    switch (operation) {
      case 'add':
        stdout.write(`Added ${done}/${total}...`);
        break;
      case 'delete':
        stdout.write(`Deleted ${done}/${total}...`);
        break;
    }

    if (done === total) {
      stdout.write('\n');
    }
  };
}
