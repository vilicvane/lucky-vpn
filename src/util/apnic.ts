import fetch from 'node-fetch';

const APNIC_URL = 'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest';

export interface Route {
  network: string;
  mask: string;
}

export async function getChinaRoutes(): Promise<Route[]> {
  let response = await fetch(APNIC_URL);
  let text = await response.text();
  let chinaRouteRegex = /^apnic\|CN\|ipv4\|.+/mg;
  return (text.match(chinaRouteRegex) || [])
    .map(line => {
      let parts = line.split('|');
      return {
        network: parts[3],
        mask: convertIPv4IntegerToString(~(Number(parts[4]) - 1))
      };
    });
}

function convertIPv4IntegerToString(value: number): string {
  return `${(value >>> 24)}.${value >>> 16 & 0xff}.${value >>> 8 & 0xff}.${value & 0xff}`;
}
