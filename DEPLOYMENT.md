# Deploying to Cloud Run

The app is a single container: Express serves the API and the built React SPA
from one process. Cloud Run injects `PORT`; the server binds it on `0.0.0.0`.

## Before you start

You need a Google Cloud project with billing enabled, and the `gcloud` CLI
authenticated locally (`gcloud auth login`).

```bash
export PROJECT_ID=your-project-id
export REGION=europe-west1          # closest standard region to Ghana
export REPOSITORY=hackkey
export SERVICE=hackkey-tech-store

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com

gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Hack-Key Tech Store images"
```

## First deploy (from your machine)

This builds the `Dockerfile` with Cloud Build and deploys the result:

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars NODE_ENV=production
```

The command prints the service URL. Check it:

```bash
curl -s "$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(status.url)')/api/health"
```

## Continuous deployment

Deployment runs from a Cloud Build trigger connected to this repository, which
builds the `Dockerfile` and deploys the image to Cloud Run. Configure it in the
Cloud Console (Cloud Build -> Triggers) or with `gcloud builds triggers create
github`, pointing it at this repo and the `main` branch.

The trigger's service account needs `roles/run.admin`,
`roles/artifactregistry.writer` and `roles/iam.serviceAccountUser`.

There is deliberately no GitHub Actions workflow in this repository: a second
pipeline would race the Cloud Build trigger and deploy twice on every push.

## Runtime configuration

| Variable | Effect |
| --- | --- |
| `PORT` | Set by Cloud Run. Defaults to 3000 locally. |
| `NODE_ENV` | Must be `production` in the deployed service, so the server serves `dist/` instead of starting Vite. |
| `ADMIN_TOKEN` | Optional. Unset in production, `/api/admin/data` returns 404. Set it, and the endpoint requires the same value in an `x-admin-token` header. |

To enable the admin endpoint on a deployed service:

```bash
gcloud run services update "$SERVICE" --region "$REGION" \
  --set-env-vars NODE_ENV=production,ADMIN_TOKEN="$(openssl rand -hex 32)"
```

## Firestore

The service reads and writes Firestore using Application Default Credentials,
so the Cloud Run **runtime service account needs `roles/datastore.user`**:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$(gcloud run services describe "$SERVICE" --region "$REGION" \
    --format='value(spec.template.spec.serviceAccountName)')" \
  --role=roles/datastore.user
```

Deploy the deny-all client rules once (the server's Admin SDK bypasses them):

```bash
gcloud firestore databases update --type=firestore-native
firebase deploy --only firestore:rules   # uses firestore.rules
```

Any `GOOGLE_SERVICE_ACCOUNT_*` or `GOOGLE_SHEETS_*` variables still set on the
service are obsolete and should be removed.

Populate the catalogue with `scripts/migrate-sheet-to-firestore.ts`, run by
hand from a machine with credentials — see `CLAUDE.md`.

## Customer document uploads

Turnitin submissions go to Cloud Storage in the same project. The Cloud Run
runtime service account needs `roles/storage.objectAdmin` on the bucket, and
`roles/iam.serviceAccountTokenCreator` on itself so it can sign URLs:

```bash
SA=$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')

gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_ID}.appspot.com" \
  --member="serviceAccount:${SA}" --role=roles/storage.objectAdmin

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:${SA}" --role=roles/iam.serviceAccountTokenCreator

firebase deploy --only storage   # uses storage.rules (deny-all, like Firestore)
```

Set `DOCUMENTS_BUCKET` if you use a bucket other than the project default.

**Retrieving submitted documents, until Phase 2.** The admin portal does not
exist yet, so uploaded files are read from the Firebase Storage browser in the
console, under `orders/<orderId>/`. This is expected for now, not missing
functionality. `GET /api/orders/:orderId/document` also returns a short-lived
signed link when `ADMIN_TOKEN` is set.

## Seeding priced services

Turnitin is defined in code, not in the workbook, so it is seeded rather than
migrated. A full migration run seeds it too; to seed on its own:

```bash
npm run seed -- --dry-run
npm run seed
```

## Payments (Paystack)

Store the secret key in Secret Manager and expose it to the service; it is
never in `dist/` and never in the repo:

```bash
printf 'sk_test_xxx' | gcloud secrets create paystack-secret-key --data-file=-
gcloud run services update "$SERVICE" --region "$REGION" \
  --set-secrets=PAYSTACK_SECRET_KEY=paystack-secret-key:latest \
  --set-env-vars PUBLIC_BASE_URL=https://store.hackeytech.com,SELLER_ALERT_EMAIL=you@hackeytech.com
```

The service **refuses to start** in production without `PAYSTACK_SECRET_KEY`.
Confirm which mode you are in — this is the step people skip:

```bash
curl -s "$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(status.url)')/api/health" | grep -o '"paymentMode":"[a-z]*"'
```

Register the webhook at `https://store.hackeytech.com/api/paystack/webhook` in
the Paystack dashboard. **Test and live have separate webhook settings** — set
both, at the right time. Paystack cannot reach `localhost`, so the webhook can
only be tested against a deployed URL.

### Email DNS — do this BEFORE switching to live keys

On `hackeytech.com` at Cloudflare. These are DNS-only records; the grey-cloud
rule for the `store` CNAME does not apply to them.

| Record | Where | Note |
| --- | --- | --- |
| SPF | `TXT` at the root | If one already exists, **edit it**. A second SPF record invalidates both. |
| DKIM | `CNAME`/`TXT` as the provider gives them | From the Resend dashboard. |
| DMARC | `TXT` at `_dmarc` | Start at `p=none`. |

Verify in the provider's dashboard before relying on it.

### Rollout order

1. Deploy with `sk_test_`, register the **test** webhook against the deployed URL.
2. Test-card a purchase end to end: order, redirect, return, webhook, licence,
   both emails.
3. Run `npm run test:e2e` against a Firestore emulator — the adversarial cases
   (wrong signature, replay, hand-edited return, failed transaction, tampered
   amount) must all pass.
4. Confirm `POST /api/orders/{orderId}/pay` returns **404**. It is gone.
5. Swap to `sk_live_`, update the webhook URL in the **live** dashboard,
   confirm `/api/health` reports `"paymentMode":"live"`, and buy something
   small and real.
6. Only then load licences into the pool.

### Converting existing order amounts

Orders created before Phase 2 store `amountGhs`. Convert them once:

```bash
npx tsx scripts/migrate-amounts-to-pesewas.ts --dry-run
npx tsx scripts/migrate-amounts-to-pesewas.ts
```

Idempotent, and it reports any fractional amounts it finds — those are the ones
float cedis would have put at risk.

## Instance count

`--max-instances 1` is no longer required for correctness: orders live in
Firestore and survive instance replacement, and licence assignment is
transactional, so several instances cannot hand out the same key. Raise the
ceiling when traffic justifies it.
