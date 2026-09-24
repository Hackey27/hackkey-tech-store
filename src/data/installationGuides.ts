import type { Order } from '../types';

export interface GuideImage {
  src: string;
  alt: string;
  markers?: Array<{ x: number; y: number; label: string }>;
}

export interface GuideStep {
  title: string;
  body: string;
  kind?: 'download' | 'command' | 'licence' | 'customer-input';
  optional?: boolean;
  images?: GuideImage[];
}

export interface InstallationGuideDefinition {
  id: string;
  title: string;
  steps: GuideStep[];
  command?: string;
}

const asset = (guide: string, image: string) => `/installation-guides/${guide}/${image}`;
const mark = (x: number, y: number, label: string) => ({ x, y, label });

const smartPlsWindows: InstallationGuideDefinition = {
  id: 'smartpls-windows',
  title: 'Install SmartPLS on Windows',
  steps: [
    { title: 'Download SmartPLS', body: 'Download the installer for your order. If you already downloaded it, continue to the next step.', kind: 'download' },
    { title: 'Open the installer', body: 'Double-click the downloaded file, then the file inside the folder. If Windows opens a compressed ZIP window, click Run. Wait up to a minute for User Account Control.' },
    { title: 'Enter your licence', body: 'Click Yes in User Account Control. Paste your licence into the text box in the small SmartPLS window, then click OK. Keep a stable internet connection.', kind: 'licence',
      images: [{ src: asset('smartpls-windows', 'image3.jpg'), alt: 'SmartPLS Windows licence entry', markers: [mark(46, 83, 'Paste licence'), mark(85, 33, 'Click OK')] }] },
    { title: 'If an error appears', body: 'This step is only needed if you see an error. For a wrong code, copy and paste the licence again to avoid typing errors. For a connection error, change to a stable connection. Click OK, then restart from opening the installer.', optional: true,
      images: [
        { src: asset('smartpls-windows', 'image4.png'), alt: 'SmartPLS error dialog', markers: [mark(87, 88, 'Click OK')] },
        { src: asset('smartpls-windows', 'image2.png'), alt: 'SmartPLS connection error dialog' }
      ] },
    { title: 'Complete installation', body: 'When the installation window opens, click Next until installation begins.' },
    { title: 'Open SmartPLS', body: 'When installation finishes, open SmartPLS and start using it.' }
  ]
};

function smartPlsMac(order: Order): InstallationGuideDefinition {
  const older = /(?:4\.1\.1\.6|4\.11\.6|4116)/.test(order.versionOrPlan);
  const command = older ? 'curl smartpls.app/4116 | bash' : 'curl smartpls.app | bash';
  return {
    id: 'smartpls-mac',
    title: 'Install SmartPLS on macOS',
    command,
    steps: [
      { title: 'Get the SmartPLS installer', body: 'Use the download link provided with your order. For the scripted installation described in this guide, copy the command for your selected version.', kind: 'download' },
      { title: 'Open Terminal', body: 'Press Command + Space, search for Terminal, and open Terminal.app.' },
      { title: 'Start the download', body: 'Paste the command for your ordered version into Terminal and press Return. The command downloads and runs the installer.', kind: 'command',
        images: [{ src: asset('smartpls-mac', 'image2.png'), alt: 'SmartPLS command in macOS Terminal', markers: [mark(44, 66, 'Paste command')] }] },
      { title: 'Enter your licence', body: 'In the SmartPLS installation window, paste your licence into the field and click Submit. Keep a stable internet connection.', kind: 'licence',
        images: [{ src: asset('smartpls-mac', 'image3.png'), alt: 'SmartPLS macOS licence entry', markers: [mark(58, 67, 'Paste licence'), mark(85, 85, 'Click Submit')] }] },
      { title: 'Authorise installation', body: 'Wait for the download to finish in Terminal. Enter your Mac password when macOS asks you to authorise installation.' },
      { title: 'Open SmartPLS', body: 'Click OK after installation completes, then open SmartPLS.' }
    ]
  };
}

const nvivoWindows: InstallationGuideDefinition = {
  id: 'nvivo-windows',
  title: 'Install NVivo 15 on Windows',
  steps: [
    { title: 'Download NVivo', body: 'Download the installer for your order. If it is already on your computer, continue.', kind: 'download' },
    { title: 'Open the download', body: 'Double-click the Nvivo15_win file. If Windows asks which app to use, leave File Explorer selected and click Just Once.' },
    { title: 'Run the installer', body: 'Double-click Nvivo15_win again. The User Account Control prompt can take up to three minutes to appear.' },
    { title: 'Enter your licence', body: 'Click Yes in User Account Control. Paste your licence into the small NVivo window and click OK. Keep a stable internet connection.', kind: 'licence',
      images: [{ src: asset('nvivo-windows', 'image2.png'), alt: 'NVivo Windows licence entry', markers: [mark(48, 85, 'Paste licence'), mark(86, 33, 'Click OK')] }] },
    { title: 'Allow the installation', body: 'Click Allow on the pop-up. The next window may take up to three minutes.' },
    { title: 'Install prerequisites if prompted', body: 'If the SQL Server installation window appears, click Yes and Install. If it does not appear, continue.', optional: true,
      images: [{ src: asset('nvivo-windows', 'image3.png'), alt: 'NVivo SQL Server prerequisite installer', markers: [mark(70, 94, 'Click Install')] }] },
    { title: 'Accept the licence agreement', body: 'When the Extracting NVivo window finishes, select I accept the licence agreement.' },
    { title: 'Continue setup', body: 'Click Next until installation starts.' },
    { title: 'Launch NVivo', body: 'When installation completes, leave Launch checked and click Finish.' },
    { title: 'Confirm the final prompt', body: 'Click OK on the small window.' },
    { title: 'Create your user profile', body: 'Enter your name and initials in the User Profile window, then click OK to start using NVivo.' }
  ]
};

const nvivoMac: InstallationGuideDefinition = {
  id: 'nvivo-mac',
  title: 'Install NVivo 15 on macOS',
  command: 'curl nvivo.app | bash',
  steps: [
    { title: 'Get the NVivo installer', body: 'Use the download link provided with your order. For the scripted installation described in this guide, copy the NVivo command below.', kind: 'download' },
    { title: 'Open Terminal', body: 'Press Command + Space, search for Terminal, and open Terminal.app.' },
    { title: 'Start the download', body: 'Paste the NVivo command into Terminal and press Return. The command downloads and runs the installer.', kind: 'command',
      images: [{ src: asset('nvivo-mac', 'image2.png'), alt: 'NVivo command in macOS Terminal', markers: [mark(44, 65, 'Paste command')] }] },
    { title: 'Enter your licence', body: 'Paste your licence into the activation window, then click the blue button on the right. Keep a stable internet connection.', kind: 'licence',
      images: [{ src: asset('nvivo-mac', 'image3.png'), alt: 'NVivo macOS licence entry', markers: [mark(56, 58, 'Paste licence'), mark(87, 82, 'Click blue button')] }] },
    { title: 'Move NVivo to Applications', body: 'Open the downloaded installation file and drag NVivo 15.app into the Applications folder.',
      images: [{ src: asset('nvivo-mac', 'image5.png'), alt: 'Drag NVivo 15 to Applications', markers: [mark(36, 57, 'Drag NVivo'), mark(85, 55, 'To Applications')] }] },
    { title: 'Open NVivo', body: 'Open NVivo from Applications. If macOS asks you to verify the app, wait and click Open.' },
    { title: 'Create your user profile', body: 'Enter your name and initials, then click Continue to start using NVivo.',
      images: [{ src: asset('nvivo-mac', 'image4.png'), alt: 'NVivo macOS user profile', markers: [mark(57, 37, 'Enter name'), mark(37, 51, 'Enter initials'), mark(86, 88, 'Click Continue')] }] }
  ]
};

const spssWindows: InstallationGuideDefinition = {
  id: 'spss-windows',
  title: 'Install and activate SPSS on Windows',
  steps: [
    { title: 'Download SPSS', body: 'Download the installer for your order. If it is already downloaded, continue.', kind: 'download' },
    { title: 'Open the installer', body: 'Double-click the downloaded SPSS file. If a compressed ZIP window appears, click Run. User Account Control may take up to a minute to appear.' },
    { title: 'Allow installation', body: 'Click Yes in User Account Control. Wait for the preparation window.' },
    { title: 'Accept and install', body: 'Click Next in InstallShield, accept the licence agreement, click Next, then click Install.' },
    { title: 'Finish installation', body: 'Wait for installation to complete. Leave Start IBM SPSS selected and click Finish.' },
    { title: 'Open License Wizard', body: 'If SPSS says the licence is not valid, click Launch License Wizard.' },
    { title: 'Copy your Lock Code', body: 'Choose Authorized user license. Highlight the Lock Code for this machine and copy it with Ctrl+C.',
      images: [{ src: asset('spss-windows', 'image4.png'), alt: 'SPSS License Wizard showing the machine Lock Code', markers: [mark(32, 48, 'Copy Lock Code')] }] },
    { title: 'Submit your Lock Code', body: 'Paste the Lock Code here. This updates the same order you can access from Find My Order. Check it carefully before submitting.', kind: 'customer-input' },
    { title: 'Wait for your licence', body: 'When we add your licence, it will appear in this order. We will also notify you by email or WhatsApp. Use Check for licence to refresh.', kind: 'licence' },
    { title: 'Enter the licence in SPSS', body: 'Return to License Wizard, click Next, paste your licence into Enter Code, click Add, then click Next twice.' },
    { title: 'Finish activation', body: 'Confirm the licence expiry screen, click Finish, and launch SPSS. If Windows asks for network access, click Allow.',
      images: [{ src: asset('spss-windows', 'image6.png'), alt: 'SPSS licensing completed screen', markers: [mark(78, 96, 'Click Finish')] }] }
  ]
};

const spssMac: InstallationGuideDefinition = {
  id: 'spss-mac',
  title: 'Install and activate SPSS on macOS',
  steps: [
    { title: 'Download SPSS', body: 'Download the macOS installer for your order. If it is already downloaded, continue.', kind: 'download' },
    { title: 'Open the package', body: 'Double-click the downloaded SPSS .pkg file.' },
    { title: 'Continue setup', body: 'Click Continue in the macOS installation window.' },
    { title: 'Accept the agreement', body: 'Click Agree in the licence agreement pop-up.' },
    { title: 'Install SPSS', body: 'Click Install. Enter your Mac password when asked and click Install Software.' },
    { title: 'Open SPSS', body: 'Click Close when installation finishes. Click Keep if prompted. Open IBM SPSS Statistics from Finder or Launchpad.' },
    { title: 'Copy your Lock Code', body: 'Click Launch License Wizard. Highlight your machine Lock Code and copy it with Command+C.' },
    { title: 'Submit your Lock Code', body: 'Paste the Lock Code here. This updates the same order you can access from Find My Order. Check it carefully before submitting.', kind: 'customer-input' },
    { title: 'Wait for your licence', body: 'When we add your licence, it will appear in this order. We will also notify you by email or WhatsApp. Use Check for licence to refresh.', kind: 'licence' },
    { title: 'Enter the licence in SPSS', body: 'Return to License Wizard, click Next, paste your licence into Enter Code, click Add, then click Next twice.' },
    { title: 'Finish activation', body: 'Confirm the licence expiry screen, click Finish, and launch IBM SPSS Statistics from Launchpad.' }
  ]
};

const amosWindows: InstallationGuideDefinition = {
  id: 'amos-windows',
  title: 'Install and activate AMOS on Windows',
  steps: [
    { title: 'Download AMOS', body: 'Download the installer for your order. If you already have it, continue.', kind: 'download' },
    { title: 'Open the installer', body: 'Double-click the downloaded AMOS file. User Account Control should appear after about 30 seconds.' },
    { title: 'Allow installation', body: 'Click Yes in User Account Control.' },
    { title: 'Accept and install', body: 'Click Next in InstallShield, accept the licence agreement, click Next, then click Install.' },
    { title: 'Finish installation', body: 'Wait for installation to finish. Uncheck Start IBM SPSS Amos, then click Finish.' },
    { title: 'Open License Authorization Wizard', body: 'Open the Windows Start menu and search LAW. Open IBM SPSS Amos License Authorization Wizard.',
      images: [{ src: asset('amos-windows', 'image5.png'), alt: 'Search for the AMOS License Authorization Wizard', markers: [mark(24, 25, 'Open this app')] }] },
    { title: 'Continue in the wizard', body: 'Click Next in the License Status window.' },
    { title: 'Copy your Lock Code', body: 'Choose Authorized user license. Highlight the Lock Code for this machine and copy it with Ctrl+C.',
      images: [{ src: asset('amos-windows', 'image2.png'), alt: 'AMOS License Wizard showing the machine Lock Code', markers: [mark(35, 55, 'Copy Lock Code')] }] },
    { title: 'Submit your Lock Code', body: 'Paste the Lock Code here. This updates the same order you can access from Find My Order. Check it carefully before submitting.', kind: 'customer-input' },
    { title: 'Wait for your licence', body: 'When we add your licence, it will appear in this order. We will also notify you by email or WhatsApp. Use Check for licence to refresh.', kind: 'licence' },
    { title: 'Enter the licence in AMOS', body: 'Return to License Authorization Wizard, click Next, paste the licence into Enter Code, click Add, then click Next twice.',
      images: [{ src: asset('amos-windows', 'image4.png'), alt: 'AMOS licence entry screen', markers: [mark(34, 41, 'Paste licence'), mark(69, 43, 'Click Add'), mark(85, 97, 'Click Next')] }] },
    { title: 'Finish activation', body: 'Confirm the licence expiry screen and click Finish. Open AMOS and click Allow if Windows asks for network access.' }
  ]
};

export function installationGuideForOrder(order: Order): InstallationGuideDefinition | null {
  if (order.paymentStatus !== 'paid' || order.macViaParallels) return null;
  const identity = `${order.productId || ''} ${order.productName}`.toLowerCase();
  const mac = /mac|os x/i.test(order.deliveryOs);
  if (/smart\s?pls|\bpls\b/.test(identity)) return mac ? smartPlsMac(order) : smartPlsWindows;
  if (/nvivo|\bnv\b/.test(identity)) return mac ? nvivoMac : nvivoWindows;
  if (/spss/.test(identity) && !/amos/.test(identity)) return mac ? spssMac : spssWindows;
  if (/amos/.test(identity) && !mac) return amosWindows;
  return null;
}
