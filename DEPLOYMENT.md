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

## Instance count

`--max-instances 1` is no longer required for correctness: orders live in
Firestore and survive instance replacement, and licence assignment is
transactional, so several instances cannot hand out the same key. Raise the
ceiling when traffic justifies it.
