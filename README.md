# WebMTP
This is a proof-of-concept implementation of the MTP protocol over WebUSB. Works with all [browsers which support WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/USB)

## Setup

### Windows

Replace default MTP driver with WinUSB driver.

- Download [Zadig](https://zadig.akeo.ie/).
- Open Zadig and select `Options → List All Devices`.
- Select your MTP device from list of devices and install WinUSB driver by clicking `Replace Driver`

![](media/install_winusb_driver.png)

### Linux

Requires `udev` rule to be installed

Find Vendor ID and Product ID using `lsusb`

```bash
$ lsusb
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 001: ID 22b8:2e82 Motorola Device
```
Add a file `/etc/udev/rules.d/webmtp.rules` with the below content. Use your phone's Vendor ID & Product ID.
```
SUBSYSTEM=="usb", ATTRS{idVendor}=="22b8", ATTRS{idProduct}=="2e82", ACTION=="add", MODE="0666"
```
Reload `udev` rules
```bash
$ sudo udevadm control --reload-rules
```
## Supported Operations
- Reading list of storages and files.
- Downloading & uploading files.
- Deleting files.

## Known limitations
- Works with root folder only
- Renaming files not supporte
- Not tested with large files

___
### Stephen Kingston © 2020 