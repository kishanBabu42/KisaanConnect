# Google Cloud Run Deployment Script
# Prerequisites: gcloud CLI installed and authenticated

# Variables - REPLACE WITH YOURS
$PROJECT_ID = "your-gcp-project-id"
$REGION = "us-central1"
$SERVICE_NAME = "kisaan-backend"

# 1. Enable APIs
gcloud services enable artifactregistry.googleapis.com run.googleapis.com

# 2. Build and push image to Artifact Registry
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 3. Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME `
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --port 3000

Write-Host "✅ Deployment Complete!"
