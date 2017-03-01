import * as FS from 'fs';
import * as Net from 'net';
import * as OS from 'os';
import * as Path from 'path';

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

const LOCK_FILE_PATH = Path.join(OS.tmpdir(), 'lucky-route-operation.lock');
const LOCK_TIMEOUT = 30 * 60 * 1000;

export class RouteOptions extends Options {
  @option({
    flag: 'm',
    description: 'Routing metric',
    default: 5
  })
  routeMetric: number;

  @option({
    description: 'Ignore operation lock and continue anyway',
    toggle: true
  })
  force: boolean;
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

    options: RouteOptions
  ) {
    await file.assert();

    let routes = (await file.text('ascii')).match(/.+/mg) || [];

    let lockStats: FS.Stats | undefined;

    try {
      lockStats = await v.call(FS.stat, LOCK_FILE_PATH);
    } catch (error) { }

    if (lockStats) {
      if (lockStats.mtime.getTime() + LOCK_TIMEOUT < Date.now()) {
        await v.call(FS.unlink, LOCK_FILE_PATH);
      } else if (!options.force) {
        throw new ExpectedError('Route operation locked');
      }
    }

    await v.call(FS.writeFile, LOCK_FILE_PATH, '');

    try {
      let routeCommand = RouteCommand.getCommand();

      switch (operation) {
        case 'add':
          await routeCommand.add(routes, { metric: options.routeMetric }, createProgressLogger('add'));
          break;
        case 'delete':
          await routeCommand.delete(routes, createProgressLogger('delete'));
          break;
      }
    } finally {
      await v.call(FS.unlink, LOCK_FILE_PATH);
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
