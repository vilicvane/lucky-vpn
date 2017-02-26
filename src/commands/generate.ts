import * as Net from 'net';
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

import { GeneratingProgressData, generateFiles } from '../core';

export class GenerateOptions extends Options {
  @option({
    flag: 'm',
    description: 'Routing metric',
    default: 5
  })
  routeMetric: number;

  @option({
    flag: 's',
    description: 'Filter route rules by minimum size',
    default: 0
  })
  routeMinSize: number;

  @option({
    flag: 'b',
    description: 'Phonebook file'
  })
  phonebook: ClimeObject.File;

  @option({
    flag: 'u',
    description: 'VPN username'
  })
  username: string;

  @option({
    flag: 'p',
    description: 'VPN password'
  })
  password: string;

  @option({
    name: 'dns',
    flag: 'd',
    description: 'Override VPN DNS with given servers'
  })
  dnsServers: ClimeObject.CommaSeperatedStrings;
}

@command({
  description: 'Generate new BAT files under current directory'
})
export default class extends Command {
  async execute(
    @param({
      description: 'VPN entry name',
      required: true
    })
    entry: string,

    options: GenerateOptions
  ) {
    let phonebook = options.phonebook;
    let phonebookPath: string | undefined;

    if (phonebook) {
      await phonebook.assert();
      phonebookPath = phonebook.fullName;
    }

    let dnsServers = options.dnsServers;

    if (dnsServers) {
      for (let server of dnsServers) {
        if (!Net.isIPv4(server)) {
          throw new ExpectedError(`Invalid DNS server format "${server}"`);
        }
      }
    }

    let generatedFileNames = await generateFiles({
      entry,
      username: options.username,
      password: options.password,
      phonebook: phonebookPath,
      routeMetric: options.routeMetric,
      routeMinSize: options.routeMinSize,
      dnsServers
    }, (state, data?: GeneratingProgressData) => {
      switch (state) {
        case 'fetching':
          console.log('Fetching new routes data from APNIC...');
          break;
        case 'generating':
          let { coverage, count } = data!;
          let coveragePercentage = (coverage * 100).toFixed(2) + '%';
          console.log(`Generating ${count} route rules in total after filtering (coverage: ${coveragePercentage})...`);
          break;
      }
    });

    console.log('Generated:');
    for (let fileName of generatedFileNames) {
      console.log(`  ${fileName}`);
    }
  }
}
