import { getFirestore } from '../server/firestore';
import type { Service } from '../src/types';

const service: Service = {
  serviceId: 'HUMANIZING',
  name: 'AI Humanising Service',
  tagline: 'Make AI-assisted writing sound natural and authentic.',
  description: 'Request a quote for humanising AI-assisted academic or professional writing.',
  categoryId: 'SERVICE',
  instructions: 'Share the current AI score, page count, and any important notes.',
  fields: [
    { key: 'aiScore', label: 'Current AI score (%)', type: 'number', required: false },
    { key: 'pages', label: 'Number of pages', type: 'number', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Tell us about the document and your target.' }
  ],
  ctaLabel: 'Get a quote',
  ctaNote: 'We will review your document requirements before confirming a price.',
  active: true,
  sortOrder: 30
};

const db = getFirestore();
await db.collection('services').doc(service.serviceId).set(service, { merge: true });
console.log(`Seeded ${service.serviceId}.`);
