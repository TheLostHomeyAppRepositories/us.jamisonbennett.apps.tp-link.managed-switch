# TP-Link Managed Switch App for Homey

Switch management that supports TP-Link managed switches

## Overview

The **TP-Link Managed Switch** app integrates TP-Link managed switches with your Homey smart home platform. This app allows you to control your network's managed switches directly from Homey, enabling you to automate and manage your network more efficiently.

### Features
- **Port Control**: Enable or disable individual ports on your TP-Link managed switch directly from the Homey app or through Homey flows.
- **Device Integration**: Seamlessly integrate with multiple TP-Link managed switch models.
- **Automation**: Create Homey flows to automate network management tasks based on your preferences or specific conditions.
- **Status Monitoring**: View the status of each port (enabled/disabled) within the Homey app.

## Supported Devices
- TP-Link TL-SG105E
- TP-Link TL-SG108E
- TP-Link TL-SG116E
- TP-Link TL-SG1024E
- Additional TP-Link easy smart switch devices

## Installation
1. **Install the App**: Search for "TP-Link Managed Switch" in the Homey app store and install it.
2. **Add a Device**: After installing, go to the Homey app and selecting the "TP-Link Managed Switch" app from the devices list.
3. **Configure Settings**: Enter the IP address, username, and password for your TP-Link managed switch to allow Homey to communicate with it.

## Usage

### Enabling/Disabling Ports
1. **Manual Control**:
   - Open the Homey app.
   - Select your TP-Link switch from the devices list.
   - Use the provided controls to enable or disable specific ports on the switch.

2. **Automated Control with Flows**:
   - Create a new flow in Homey.
   - Choose a trigger (e.g., time, device state).
   - Add an action to enable or disable a specific port on your TP-Link switch.
   - Save and activate the flow.

### Example Flows
- **Disable Guest Network at Night**: Automatically disable ports connected to guest network devices at night.
- **Enable Office Network During Working Hours**: Set up a flow to enable office network ports only during working hours.

## Troubleshooting
- **Connection Issues**: Ensure that your TP-Link managed switch is on the same network as your Homey and that the IP address, username, and password are correctly entered. If you are using an IP address, make sure your switch is configured to have a static IP address.
- **Port Control Not Working**: Verify that the switch model is supported and that the firmware is up to date.

## Known Issues
- **UI Session Logout**: The TP-Link managed switch hardware allows at most one active session. When the Homey app's connects to the switch any active sessions are logged out. This will occur on demand based on flow actions and also periodically in the background (hourly).

## Contributing
We welcome contributions to enhance this app! Please submit issues or pull requests on our [GitHub repository](https://github.com/jamisonbennett/homey-tp-link-managed-switch).

## Building

### Prepare the Environment

Install the necessary dependencies: `npm install`<br />
Create the app.json:
```
cp .homeycompose/app.json .
npx homey app build
```

### Run Unit Tests

Execute the unit tests using Jest: `npx jest`

### Run the App Locally

Launch the app in development mode: `npx homey app run`

### Install the App on Homey

Deploy and install the app on your Homey device: `npx homey app install`

## License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.

## Disclaimer
This app is an independent third-party application and is not affiliated with, endorsed by, or sponsored by TP-Link Technologies Co., Ltd. TP-Link is a registered trademark of TP-Link Technologies Co., Ltd. All product names, logos, and brands are property of their respective owners. The use of these names, logos, and brands does not imply any affiliation with or endorsement by them.
