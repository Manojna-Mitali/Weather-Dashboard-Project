from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
from datetime import datetime
from dynamo_helper import save_weather
from s3_helper import upload_to_s3

# ----- Flask setup -----
app = Flask(__name__, static_folder="../frontend")
CORS(app)

# ----- OpenWeather API key -----
OPENWEATHER_API_KEY = "1c4819e272c6555cc7f51f56418b835d"  # Replace with your actual key

# ===============================
# 🔹 Helper Functions
# ===============================

def get_current_weather(city):
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()

    return {
        "city": data["name"],
        "date": datetime.utcfromtimestamp(data["dt"]).strftime("%Y-%m-%d"),
        "day": datetime.utcfromtimestamp(data["dt"]).strftime("%A"),
        "temp": data["main"]["temp"],
        "feels_like": data["main"]["feels_like"],
        "weather": data["weather"][0]["main"],
        "description": data["weather"][0]["description"],
        "icon": data["weather"][0]["icon"],
        "wind": data["wind"]["speed"],
        "pressure": data["main"]["pressure"],
        "humidity": data["main"]["humidity"],
        "lat": data["coord"]["lat"],
        "lon": data["coord"]["lon"],
        "sunrise": data["sys"]["sunrise"],
        "sunset": data["sys"]["sunset"]
    }

def get_forecast(city):
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()

    # Hourly forecast (next 12 intervals)
    hourly = [{
        "time": item["dt_txt"].split(" ")[1][:5],
        "temp": item["main"]["temp"],
        "feels_like": item["main"]["feels_like"],
        "icon": item["weather"][0]["icon"],
        "weather": item["weather"][0]["main"]
    } for item in data["list"][:12]]

    # Daily forecast (7 days)
    daily = {}
    for item in data["list"]:
        date = item["dt_txt"].split(" ")[0]
        if date not in daily:
            daily[date] = {
                "temp_min": item["main"]["temp"],
                "temp_max": item["main"]["temp"],
                "icon": item["weather"][0]["icon"]
            }
        else:
            daily[date]["temp_min"] = min(daily[date]["temp_min"], item["main"]["temp"])
            daily[date]["temp_max"] = max(daily[date]["temp_max"], item["main"]["temp"])

    daily_list = []
    for date, vals in list(daily.items())[:7]:
        daily_list.append({
            "date": date,
            "temp_min": vals["temp_min"],
            "temp_max": vals["temp_max"],
            "icon": vals["icon"]
        })

    return hourly, daily_list

def get_air_quality(lat, lon):
    url = "https://api.openweathermap.org/data/2.5/air_pollution"
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY}
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    if "list" in data and len(data["list"]) > 0:
        aqi = data["list"][0]["main"]["aqi"]
        components = data["list"][0]["components"]
        return {"aqi": aqi, "components": components}
    return {}

def get_uv_index(lat, lon):
    """Fetch UV index for the given coordinates"""
    url = "https://api.openweathermap.org/data/2.5/uvi"
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY}
    r = requests.get(url, params=params)
    if r.status_code == 200:
        data = r.json()
        return {"uv_index": data.get("value")}
    return {}

def get_suggestions(weather, temp):
    weather = weather.lower()
    if weather in ["rain", "drizzle", "thunderstorm"]:
        return "Take umbrella ☂️"
    elif weather == "snow":
        return "Wear warm clothes ❄️"
    elif temp > 35:
        return "Stay hydrated 🥵"
    else:
        return "Good to go outside 🙂. Have a nice day <3"

# ===============================
# 🔹 API Routes
# ===============================

@app.route("/api/weather")
def weather_api():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "City query parameter required"}), 400

    try:
        current = get_current_weather(city)
        hourly, daily = get_forecast(city)
        air = get_air_quality(current["lat"], current["lon"])
        uv_data = get_uv_index(current["lat"], current["lon"])
        suggestion = get_suggestions(current["weather"], current["temp"])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    response = {
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "air_quality": air,
        "uv": uv_data,
        "suggestion": suggestion,
        "map": {"lat": current["lat"], "lon": current["lon"]}
    }

    # ✅ Log the data in DynamoDB
    save_weather(
        city=current['city'],
        temp=current['temp'],
        weather=current['weather'],
        humidity=current['humidity'],
        suggestion=suggestion
    )

    # ✅ Upload weather summary to S3
    upload_to_s3(data=response, city=current['city'])

    return jsonify(response)

@app.route("/api/suggest")
def suggest():
    """City name suggestions for search dropdown"""
    query = request.args.get("q", "")
    if not query:
        return jsonify([])
    try:
        url = "https://geodb-free-service.wirefreethought.com/v1/geo/cities"
        params = {"namePrefix": query, "limit": 5}
        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        suggestions = [city["city"] for city in data["data"]]
        return jsonify(suggestions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

# ===============================
# 🔹 Serve Frontend
# ===============================

@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# ===============================
# 🔹 Run Flask App
# ===============================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
