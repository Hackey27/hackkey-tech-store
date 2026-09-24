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

export function installationGuideForOrder(order: Order): InstallationGuideDefinition | null {
  if (order.paymentStatus !== 'paid' || order.macViaParallels) return null;
  const identity = `${order.productId || ''} ${order.productName}`.toLowerCase();
  const mac = /mac|os x/i.test(order.deliveryOs);
  if (/smart\s?pls|\bpls\b/.test(identity)) return mac ? smartPlsMac(order) : smartPlsWindows;
  if (/nvivo|\bnv\b/.test(identity)) return mac ? nvivoMac : nvivoWindows;
  return null;
}
