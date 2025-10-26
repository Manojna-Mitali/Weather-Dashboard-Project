import boto3
import json
from datetime import datetime

# Configure S3
s3 = boto3.client('s3', region_name='ap-south-1')
S3_BUCKET_NAME = "weather-dashboard-project-mitali "  # <-- replace this

def upload_to_s3(data, city):
    """
    Upload weather summary JSON to S3 bucket.
    """
    try:
        filename = f"{city}_summary_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename,
            Body=json.dumps(data, indent=2),
            ContentType='application/json'
        )
        print(f"✅ Uploaded weather summary for {city} to S3: {filename}")
        return True
    except Exception as e:
        print("❌ S3 upload failed:", e)
        return False
