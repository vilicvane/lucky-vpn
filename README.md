# Lucky VPN

Heavily inspired by [chnroutes](https://github.com/fivesheep/chnroutes).

Currently Windows only.

## Installation

```sh
npm install -g lucky-vpn
```

## Usage

```sh
lvpn generate "VPN Connection Name"

.\vpn-up.bat
.\vpn-down.bat

# Try following commands for more usage information
lvpn generate --help
lvpn route --help
```

Note that `vpn-up.bat` will automatically add routes, but `vpn-down.bat` won't delete routes added.
Run `.\route-delete.bat` manually if you wish.

It is recommanded to leave it there though, as it takes some time to add or remove.

### Phonebook

If you have a `.pbk` file from your VPN provider, you may try `-b` option.

### DNS Overriding

If you want to override DNS specified by the VPN provider, you may try `-d` option.
If there are multiple DNS servers to specify, use `,` to separate.

### Tips

- Use Lucky VPN (the goal is similar to [ChinaDNS](https://github.com/shadowsocks/ChinaDNS) but it's Windows-friendly) along with [Lucky DNS](https://github.com/vilic/lucky-dns) to get even better experience.
- Add a task to Task Scheduler to run `vpn-up.bat` or `route-add.bat` on network connection.
  > Check out the [task template](res/win32/tasks/task-connect.xml) you may import to Task Scheduler.

## Build

```sh
npm run build
```

## License

MIT License.
