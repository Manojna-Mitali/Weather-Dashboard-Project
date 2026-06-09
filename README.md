# Cloud-Integrated Weather Dashboard

A cloud-native, real-time weather dashboard demonstrating end-to-end integration between a frontend web interface and AWS cloud services. 

## 🏗️ Architecture & Technologies

This project is divided into a decoupled frontend and backend, showcasing modular cloud development:

* **Frontend:** HTML, CSS, and vanilla JavaScript (`app.js`). Designed to be statically hosted via **AWS S3**.
* **Backend:** Python (Flask) application (`app.py`) acting as the API layer.
* **Cloud Integration (AWS Boto3):**
  * `dynamo_helper.py`: Handles data persistence, storing and retrieving historical weather queries from **Amazon DynamoDB**.
  * `s3_helper.py`: Manages object storage interactions with **Amazon S3**.

## 📂 Repository Structure

```text
├── backend/
│   ├── app.py                 # Main Flask application routing
│   ├── dynamo_helper.py       # AWS DynamoDB integration logic
│   ├── s3_helper.py           # AWS S3 integration logic
│   └── requirements.txt       # Python dependencies (Boto3, Flask, etc.)
├── frontend/
│   ├── index.html             # Main dashboard UI
│   ├── styles.css             # UI styling
│   └── app.js                 # Client-side logic and API calls
├── .gitignore
└── README.md