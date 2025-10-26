import boto3
from datetime import datetime

# DynamoDB setup
dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
table = dynamodb.Table('WeatherLogs')

def save_weather(city, temp, weather, humidity, suggestion):
    """
    Save weather data into DynamoDB table
    """
    try:
        table.put_item(Item={
            'city': city,
            'timestamp': datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            'temperature': str(temp),
            'weather': weather,
            'humidity': str(humidity),
            'suggestion': suggestion
        })
        print(f"✅ Logged weather data for {city} in DynamoDB.")
        return True
    except Exception as e:
        print("❌ DynamoDB insert failed:", e)
        return False
