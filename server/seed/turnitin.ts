import { Service } from '../../src/types';

/**
 * Turnitin, as a seeded `services` document.
 *
 * It was never a row in the Services tab — in the Apps Script system it lived
 * in script properties, read by getTurnitinConfig_() — so the migration had
 * nothing to carry across and nothing to warn about. It is defined here, in
 * code, so that seeding is reproducible and reviewable rather than hand-entered
 * in the Firestore console.
 *
 * Every historical Turnitin order is GHS 50.00, which is PLAG_AI, so that
 * option is listed first and preselected.
 */

/** Rendered verbatim wherever the customer chooses Turnitin, before purchase.
 *  Not paraphrased, shortened or reformatted: it manages a real expectation
 *  gap, and a customer whose similarity index differs from their university's
 *  will otherwise reasonably believe the check was wrong. */
export const TURNITIN_DISCLAIMER =
  'Important: The AI score you receive from us will be the same as the score you ' +
  'would receive through your institution. However, the Similarity Index may be ' +
  "slightly higher, lower, or the same as your institution's result. This is " +
  'because institutions may include private or local repositories in their ' +
  'Turnitin configuration that we do not have access to.';

/**
 * The submission form.
 *
 * UNCONFIRMED — the owner has not yet settled what this should collect. These
 * are exactly the fields docs/phase-1.5-priced-services.md §6 lists, with
 * nothing added or guessed. Treat the list as provisional: it is data in a
 * Firestore document, so changing it is a re-seed, not a code change.
 */
export const TURNITIN_FIELDS: Service['fields'] = [
  {
    key: 'submissionMethod',
    label: 'How would you like to send us your document?',
    type: 'radio',
    required: true,
    options: ['Upload it here', 'Send it on WhatsApp']
  },
  {
    key: 'document',
    label: 'Upload your document',
    type: 'file',
    required: true,
    // Hidden when the customer chooses WhatsApp, and the server-side validator
    // honours this too: a hidden upload is not a missing one.
    showIf: { field: 'submissionMethod', equals: 'Upload it here' },
    helper: 'PDF or Word document, up to 20 MB.'
  },
  { key: 'fullName', label: 'Full name', type: 'text', required: true },
  {
    key: 'phone',
    label: 'Phone / WhatsApp number',
    type: 'tel',
    required: true,
    helper: 'Use a number that is on WhatsApp.'
  },
  { key: 'email', label: 'Email address', type: 'email', required: true },
  { key: 'deadline', label: 'When do you need it by?', type: 'datetime', required: true },
  { key: 'notes', label: 'Anything else we should know?', type: 'textarea', required: false }
];

export const TURNITIN_SERVICE: Service = {
  serviceId: 'TURNITIN',
  name: 'Turnitin Plagiarism & AI Check',
  tagline: 'Check your work before you submit',
  description: 'Check your work before you submit',
  categoryId: 'SERVICE',
  fields: TURNITIN_FIELDS,
  ctaLabel: 'Buy a check',
  active: true,
  sortOrder: 0,
  minQty: 1,
  maxQty: 50,
  disclaimer: TURNITIN_DISCLAIMER,
  options: [
    // PLAG_AI first: it is what customers actually bought.
    {
      optionId: 'PLAG_AI',
      name: 'Plagiarism + AI Check',
      unitPriceGhs: 50.0,
      bulkPriceGhs: 47.5,
      bulkFromQty: 2,
      sortOrder: 1
    },
    {
      optionId: 'PLAG',
      name: 'Plagiarism Only',
      unitPriceGhs: 15.0,
      sortOrder: 2
    }
  ]
};

/** Every seeded service. Adding another priced service means adding it here. */
export const SEED_SERVICES: Service[] = [TURNITIN_SERVICE];
