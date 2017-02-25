import * as FS from 'fs';

import * as Handlebars from 'handlebars';
import * as v from 'villa';

Handlebars.registerHelper('route-progress', function (this: any, index: number, options: any) {
  return !index || index % 100 ? '' : options.fn(this);
});

export async function renderTemplate(path: string, data: object): Promise<string> {
  let template = await v.call<string>(FS.readFile, path, 'utf-8');
  let renderer = Handlebars.compile(template);
  return renderer(data);
}
