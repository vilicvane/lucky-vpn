/*

  https://github.com/ashi009/bestroutetb/blob/npm/util/setroutes.js

  The MIT License (MIT)

  Copyright (c) 2015 Xiaoyi Shi

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

*/

Array.prototype.forEach = function (fn, self) {
  for (var i = 0; i < this.length; i++) {
    fn.call(self, this[i], i, this);
  }
};

var console = {
  log: function (s, args) {
    if (typeof s === 'string' && args !== undefined) {
      args = [].slice.call(arguments, 1);
      var i = 0;
      s = s.replace(/%[sd]/g, function () {
        return args[i++];
      });
      while (i < args.length) {
        s += ', ' + args[i++];
      }
      WSH.echo(s);
    } else {
      WSH.echo(s);
    }
  }
};

var process = {
  exit: function() {
    WSH.quit();
  },
  argv: function (args, namedArgs) {
    var res = new Array(args.length);
    for (var i = 0; i < res.length; i++) {
      res[i] = args.item(i);
    }
    for (var it = new Enumerator(namedArgs); !it.atEnd(); it.moveNext()) {
      res[it.item().toLowerCase()] = namedArgs.item(it.item());
    }
    return res;
  }(WScript.arguments.unnamed, WScript.arguments.named)
};

// operation add is not working somehow, using only print in this script.
// routes | nsetroute.js add [/m:metric]
// routes | nsetroute.js delete
// nsetroute.js print

var action = process.argv[0];
var wmi = GetObject('winmgmts:{impersonationLevel=impersonate}');

if (action === 'add') {
  operationAdd(Number(process.argv.m) || 5);
} else if (action === 'delete') {
  operationDelete();
} else if (action === 'print') {
  operationPrint();
}

function operationAdd(metric) {
  var routes = readRoutes();

  var defaultRoute = getDefaultRoute();
  var gateway = defaultRoute && defaultRoute.nextHop;

  if (!gateway) {
    console.log('Failed to detect gateway');
    process.exit(1);
  }

  var total = routes.length;

  var progress = createProgressLogger('add');

  progress(0, total);

  routes.forEach(function (data, index) {
    var route = defaultRoute.clone_();

    route.destination = data.destination;
    route.mask = data.mask;
    route.nextHop = gateway;
    route.metric1 += metric;

    try {
      route.put_();
    } catch(e) {
      console.log('\nFailed to add %s mask %s gateway %s', data.destination, data.mask, gateway);
      console.log(e.message);
    }

    progress(index + 1, total);
  });
}

function operationDelete() {
  var routes = readRoutes();
  var routeSet = {};

  routes.forEach(function (data) {
    routeSet[data.destination] = true;
  });

  var existingRoutes = wmi.instancesOf('Win32_IP4RouteTable');

  var progress = createProgressLogger('delete');

  var done = 0;
  var total = routes.length;

  progress(done, total);

  for (var it = new Enumerator(existingRoutes); !it.atEnd(); it.moveNext()) {
    var route = it.item();
    if (route.destination in routeSet) {
      route.delete_();
      progress(++done, total);
    }
  }

  if (done < total) {
    progress(total, total);
  }
}

function operationPrint() {
  var routes = wmi.instancesOf('Win32_IP4RouteTable');

  var ageSum = 0;
  var count = 0;
  var defaults = [];
  var validRoutes = [];

  for (var it = new Enumerator(routes); !it.atEnd(); it.moveNext()) {
    var item = it.item();
    var destination = item.destination;
    if (destination === '0.0.0.0') {
      ageSum += item.age;
      count++;
      defaults.push(item);
    } else {
      validRoutes.push([destination, item.nextHop]);
    }
  }

  var ageAvg = ageSum / count;

  var defaultRoute;

  defaults.forEach(function (item) {
    if (item.age >= ageAvg)
      defaultRoute = item;
  });

  var stdout = WScript.stdout;

  var gatewayJSON = defaultRoute ? '"' + defaultRoute.nextHop + '"' : 'null';
  var routeStrs = [];

  for (var i = 0; i < validRoutes.length; i++) {
    routeStrs.push('["' + validRoutes[i][0] + '","' + validRoutes[i][1] + '"]');
  }

  var routesJSON = '[' + routeStrs.join(',') + ']';

  stdout.write('{');
  stdout.write('"gateway":' + gatewayJSON + ',');
  stdout.write('"routes":' + routesJSON);
  stdout.write('}');
}

function createProgressLogger(operation) {
  var verb = operation === 'add' ? 'Added' : 'Deleted';
  var stdout = WScript.stdout;

  return function (done, total) {
    var output = '';

    if (done) {
      output += '\r';
    }

    if (!(done % 10) || done === total) {
      output += verb + ' ' + done + '/' + total + '...';
    }

    if (done === total) {
      output += '\n';
    }

    stdout.write(output);
  };
}

function getDefaultRoute() {
  var routes = wmi.instancesOf('Win32_IP4RouteTable');

  var ageSum = 0;
  var count = 0;
  var defaults = [];

  for (var it = new Enumerator(routes); !it.atEnd(); it.moveNext()) {
    var item = it.item();
    if (item.destination === '0.0.0.0') {
      ageSum += item.age;
      count++;
      defaults.push(item);
    }
  }

  var ageAvg = ageSum / count;

  var defaultRoute;

  defaults.forEach(function (item) {
    if (item.age >= ageAvg)
      defaultRoute = item;
  });

  return defaultRoute;
}

function readRoutes() {
  var routes = [];

  var stdin = WScript.stdin;

  while (!stdin.atEndOfStream) {
    var line = stdin.readLine();
    var parts = line.split('/');
    var destination = parts[0];
    var mask = cidrToMask(Number(parts[1]));
    routes.push({
      destination: destination,
      mask: mask
    });
  }

  return routes;
}

function cidrToMask(cidr) {
  var mask = ~((1 << 32 - cidr) - 1);
  return (mask >>> 24) + '.' + (mask >>> 16 & 0xff) + '.' + (mask >>> 8 & 0xff) + '.' + (mask & 0xff);
}
