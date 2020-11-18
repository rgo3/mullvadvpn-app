# Split tunneling

Split tunneling allows excluding some apps from the VPN tunnel. These apps will communicate
with the internet as if Mullvad VPN was disconnected or not even running.

## DNS

DNS is a bit problematic to split properly. Ideally DNS requests from/for excluded apps would
always go outside the tunnel, because that's what they would have done if Mullvad was disconnected
or not running. But this is very hard/impossible to achieve on most platforms.
The reason for this is that on most operating systems programs call some system service
for name resolution, this system service will then perform the actual DNS lookup.
Since all DNS requests then originate from the same process/system service, it becomes hard
to know which ones are for excluded apps and not.

* **In tunnel** - DNS requests are sent in the VPN tunnel. Firewall rules ensure they
    are not allowed outside the tunnel.
* **Outside tunnel** - DNS requests are sent outside the VPN tunnel. Firewall rules ensure
    they cannot go inside the tunnel.
* **LAN** - Same as **Outside tunnel** with the addition that the firewall rules ensure
    the destination can only be in private non-routable IP ranges.

* **Default DNS** - Custom DNS is disabled. The app uses the VPN relay server (default gateway)
    as the DNS resolver.
* **Private custom DNS** - Custom DNS is enabled and the resolver IP is in a private IP range.
* **Public custom DNS** - Custom DNS is enabled and the resolver IP is in a non-private IP
    range.

### Windows

| In-app DNS setting | Normal & Excluded app |
|-|-|
| **Default DNS** | In tunnel to relay |
| **Private custom DNS** (e.g. 10.0.1.1) | LAN (to 10.0.1.1) |
| **Public custom DNS** (e.g. 8.8.8.8) | In tunnel (to 8.8.8.8) |

### Linux

| In-app DNS setting | Normal app | Excluded app |
|-|-|-|
| **Default DNS** | In tunnel to relay | In tunnel to relay |
| **Private custom DNS** (e.g. 10.0.1.1) | LAN (to 10.0.1.1) | LAN (to 10.0.1.1) |
| **Public custom DNS** (e.g. 8.8.8.8) | In tunnel (to 8.8.8.8) | Outside tunnel\[1\] (to 8.8.8.8) |

\[1\]: Only if a local DNS resolver, such as systemd-resolved is **not in use**. Because if a
local DNS resolver is in use the requests will go there and that resolver in turn will then
send requests in the tunnel.

### Android
