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
OPENWEATHER_API_KEY = "1c4819e272c6555cc7f51f56418b835d"

# ----- Helper functions -----
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
        "sunset": data["sys"]["sunset"],
        "timezone": data["timezone"],
    }

def get_forecast(city):
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()

    # Hourly forecast
    hourly = [{
        "time": item["dt_txt"].split(" ")[1][:5],
        "temp": item["main"]["temp"],
        "feels_like": item["main"]["feels_like"],
        "icon": item["weather"][0]["icon"],
        "weather": item["weather"][0]["main"]
    } for item in data["list"][:12]]

    # Daily forecast
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

# ✅ Motivational, warm suggestions
def get_suggestions(weather, temp):
    w = weather.lower()
    if w in ["rain", "drizzle", "thunderstorm"]:
        return "Rain brings freshness 🌧 — take an umbrella and maybe dance a little in it."
    elif w == "snow":
        return "It's snowing ❄️ — grab a warm drink and soak in the calm beauty of winter."
    elif "mist" in w or "fog" in w or "haze" in w:
        return "It’s a little misty outside 🌫 — slow down, breathe deep, let the day unfold gently."
    elif temp > 35:
        return "It's quite hot 🥵 — stay hydrated, wear light clothes, and take breaks often."
    elif temp < 10:
        return "Chilly winds today 🧣 — stay warm, but don’t forget to step out and feel alive."
    elif w == "clouds":
        return "The sky’s overcast ☁️ — sometimes calm gray days are perfect for reflection."
    elif w == "clear":
        return "The sun’s smiling ☀️ — perfect time to step outside, move a little, or just enjoy the breeze."
    else:
        return "Good to go outside 🙂. Take kindness with you — it looks good on everyone."

# ----- API Route -----
@app.route("/api/weather")
def weather_api():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "City query parameter required"}), 400

    try:
        current = get_current_weather(city)
        hourly, daily = get_forecast(city)
        air = get_air_quality(current["lat"], current["lon"])
        suggestion = get_suggestions(current["weather"], current["temp"])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


    response = {
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "air_quality": air,
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

    upload_to_s3(data=response, city=current['city'])
    return jsonify(response)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
