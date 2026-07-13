Vercel Deployment: https://nutri-agent-iota.vercel.app/

# 🥗 NutriBot — AI-Powered Nutrition Agent

**Powered by IBM Watsonx.ai Granite Models** | Flask + Bootstrap 5 | Indian Nutrition Specialist

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Real-time nutrition Q&A with IBM Granite |
| 📊 **Dashboard** | Live macro tracking with donut chart |
| 📓 **Meal Tracker** | Log meals + AI auto-fill via meal analysis |
| 📅 **Meal Planner** | AI-generated 1/3/7-day personalized plans |
| ⚖️ **BMI Calculator** | BMI, BMR, TDEE, and macro targets |
| 👨‍👩‍👧 **Family Planner** | Multi-member family nutrition plans |
| 💧 **Water Tracker** | Daily hydration monitoring |
| 🌙 **Dark Mode** | Full dark/light mode toggle |
| 📱 **Mobile Ready** | Fully responsive Bootstrap 5 UI |

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.9+
- IBM Cloud account with Watsonx.ai access
- IBM Cloud API Key
- Watsonx.ai Project ID

### 2. Clone / Setup

```bash
# Navigate to the project folder
cd nutrition-agent

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your actual credentials
notepad .env        # Windows
nano .env           # macOS/Linux
```

Fill in these values in `.env`:

```env
IBM_API_KEY=your_actual_api_key
IBM_PROJECT_ID=your_actual_project_id
IBM_URL=https://au-syd.ml.cloud.ibm.com
MODEL_ID=ibm/granite-3-3-8b-instruct
FLASK_SECRET_KEY=your-random-secret-key
```

### 4. Run the App

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🔑 Getting IBM Credentials

### IBM Cloud API Key
1. Go to [IBM Cloud IAM](https://cloud.ibm.com/iam/apikeys)
2. Click **"Create an IBM Cloud API key"**
3. Copy the key and paste in `.env` → `IBM_API_KEY`

### Watsonx.ai Project ID
1. Go to [IBM Watsonx.ai](https://dataplatform.cloud.ibm.com/)
2. Open or create a project
3. Go to **Manage → General → Project ID**
4. Copy and paste in `.env` → `IBM_PROJECT_ID`

---

## 🤖 Customizing the Agent (AGENT_INSTRUCTIONS)

Open `app.py` and find the `AGENT_INSTRUCTIONS` section at the top. You can customize:

```python
AGENT_NAME        : "NutriBot"          # Change agent name
AGENT_TONE        : "professional..."   # Adjust tone
DIET_PREFERENCES  : [...]               # Add/remove cuisine preferences
SAFETY_RULES      : [...]               # Modify safety guardrails
CALORIE_LOGIC     : [...]               # Adjust calorie calculations
RESPONSE_STYLE    : [...]               # Control response format
```

The `SYSTEM_PROMPT` variable (below AGENT_INSTRUCTIONS) is what actually gets sent to the model — edit it for precise control.

---

## 📁 Project Structure

```
nutrition-agent/
├── app.py                  # Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt        # Python dependencies
├── .env.example            # Environment template
├── .env                    # Your credentials (DO NOT COMMIT)
├── templates/
│   └── index.html          # Main HTML template
└── static/
    ├── css/
    │   └── style.css       # Custom styles (dark mode, animations)
    └── js/
        └── app.js          # Frontend logic (chat, tracker, BMI, etc.)
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send chat message to Granite |
| `POST` | `/api/bmi` | Calculate BMI, BMR, TDEE, macros |
| `POST` | `/api/meal-plan` | Generate AI meal plan |
| `POST` | `/api/analyze-meal` | Analyze meal nutrition |
| `POST` | `/api/family-plan` | Generate family nutrition plan |
| `GET`  | `/api/nutrition-tip` | Get daily nutrition tip |
| `POST` | `/api/tracker/log` | Log a meal |
| `GET`  | `/api/tracker/today` | Get today's log |
| `DELETE` | `/api/tracker/delete/<id>` | Delete a meal |
| `DELETE` | `/api/tracker/clear` | Clear all today's meals |

---

## 🚢 Deployment

### Option 1: Gunicorn (Production)

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option 2: Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

Build and run:
```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option 3: IBM Cloud Code Engine

```bash
# Install IBM Cloud CLI and Code Engine plugin
ibmcloud login
ibmcloud ce project create --name nutribot-project
ibmcloud ce app create \
  --name nutribot \
  --image your-registry/nutribot:latest \
  --port 5000 \
  --env-from-secret nutribot-secrets
```

### Option 4: Render / Railway / Fly.io

1. Push code to GitHub (ensure `.env` is in `.gitignore`)
2. Connect repo to Render/Railway
3. Add environment variables from `.env.example`
4. Set start command: `gunicorn app:app`

---

## ⚠️ Important Security Notes

- **NEVER** commit your `.env` file to version control
- Add `.env` to your `.gitignore`
- Use a strong `FLASK_SECRET_KEY` in production
- Set `FLASK_DEBUG=false` in production

---

## 📄 License

MIT License — Free to use and modify.

---

*Made with ❤️ using IBM Watsonx.ai Granite Models*
