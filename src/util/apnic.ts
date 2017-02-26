import fetch from 'node-fetch';

const APNIC_URL = 'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest';

export interface Route {
  network: string;
  mask: string;
}

interface RawRoute {
  networkStr: string;
  network: number;
  count: number;
}

export async function getChinaRoutes(): Promise<Route[]> {
  let response = await fetch(APNIC_URL);
  let text = await response.text();
  let lines = text.match(/^apnic\|CN\|ipv4\|.+/mg) || [];

  let routes: RawRoute[] = [];

  for (let line of lines) {
    let parts = line.split('|');
    let networkStr = parts[3];
    let network = convertIPv4StringToInteger(networkStr);
    let count = Number(parts[4]);

    if (routes.length) {
      let lastRoute = routes[routes.length - 1];
      let lastAddressEnd = lastRoute.network + lastRoute.count;
      if (lastAddressEnd === network) {
        lastRoute.count += count;
        continue;
      }
    }

    routes.push({
      networkStr,
      network,
      count
    });
  }

  return routes.map(route => {
    return {
      network: route.networkStr,
      mask: convertIPv4IntegerToString(~(route.count - 1))
    };
  });
}

function convertIPv4StringToInteger(address: string): number {
  return address.split('.')
    .map((part, index) => Number(part) << 24 - index * 8 >>> 0)
    .reduce((sum, value) => sum + value);
}

function convertIPv4IntegerToString(address: number): string {
  return `${(address >>> 24)}.${address >>> 16 & 0xff}.${address >>> 8 & 0xff}.${address & 0xff}`;
}
