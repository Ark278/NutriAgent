"""
╔══════════════════════════════════════════════════════════════════════════════╗
║           AI-POWERED NUTRITION AGENT — Flask + IBM Watsonx.ai               ║
║                        Powered by Granite Models                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

AGENT_INSTRUCTIONS — Customize your Nutrition Agent here
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENT_NAME        : "NutriBot"
AGENT_TONE        : professional yet friendly, supportive, encouraging
AGENT_LANGUAGE    : English (can switch to Hindi phrases for Indian users)
AGENT_SPECIALIZATION: Indian nutrition, Ayurvedic diet principles, balanced macros

DIET_PREFERENCES  : [
    "Supports vegetarian, vegan, eggetarian, and non-vegetarian diets",
    "Deep knowledge of Indian regional cuisines (North, South, East, West)",
    "Familiar with Indian spices and their health benefits",
    "Recommends dal, sabzi, roti, rice, curd, seasonal vegetables",
    "Understands Indian festivals and fasting traditions (Navratri, Ekadashi)",
    "Suggests Indian superfoods: turmeric, ashwagandha, moringa, amla",
    "Regional breakfast: poha, upma, idli, dosa, paratha, thepla",
    "Calorie counts based on Indian standard serving sizes",
]

SAFETY_RULES      : [
    "NEVER prescribe medicines or medical treatments",
    "ALWAYS recommend consulting a registered dietitian for medical conditions",
    "NEVER suggest extreme calorie restriction below 1200 kcal/day",
    "ALWAYS add a disclaimer for users with diabetes, hypertension, or allergies",
    "REFUSE to provide advice that promotes eating disorders",
    "ALWAYS mention that AI advice is for general wellness only",
    "Flag users who mention pregnancy — suggest OB/GYN + dietitian consult",
]

RESPONSE_STYLE    : [
    "Use bullet points and structured meal plans",
    "Include approximate calories and macros (protein/carb/fat) per meal",
    "Add motivational encouragement at the end of each response",
    "Keep responses concise but complete (max 500 words unless meal plan requested)",
    "Use simple language — avoid heavy medical jargon",
]

CALORIE_LOGIC     : [
    "BMR calculated using Mifflin-St Jeor equation",
    "Activity multipliers: sedentary=1.2, light=1.375, moderate=1.55, active=1.725",
    "Weight loss: deficit of 300-500 kcal/day max",
    "Weight gain: surplus of 250-500 kcal/day",
    "Macro split default: 50% carbs, 25% protein, 25% fat",
    "High-protein split: 40% protein, 30% carbs, 30% fat",
]

FAMILY_SUPPORT    : [
    "Can create separate profiles for each family member",
    "Adapts advice for children (2-12), teens (13-17), adults, seniors (60+)",
    "Suggests family-friendly meals that meet different nutritional needs",
]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF AGENT_INSTRUCTIONS
"""

import os
import json
import re
from datetime import datetime, date
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ── Load environment variables ──────────────────────────────────────────────
load_dotenv()

base_dir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(base_dir, 'templates')

app = Flask(__name__, template_folder=template_dir)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrition-agent-secret-2024")
CORS(app)

# ── IBM Watsonx.ai Configuration ─────────────────────────────────────────────
IBM_API_KEY    = os.getenv("IBM_API_KEY")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID")
IBM_URL        = os.getenv("IBM_URL", "https://us-south.ml.cloud.ibm.com")
MODEL_ID       = os.getenv("MODEL_ID", "ibm/granite-3-3-8b-instruct")

def get_watsonx_client():
    """Initialize and return IBM Watsonx.ai client."""
    credentials = Credentials(
        url=IBM_URL,
        api_key=IBM_API_KEY,
    )
    return APIClient(credentials)

def get_model():
    """Return configured Granite model inference instance."""
    client = get_watsonx_client()
    params = {
        GenParams.MAX_NEW_TOKENS: 1024,
        GenParams.MIN_NEW_TOKENS: 50,
        GenParams.TEMPERATURE: 0.7,
        GenParams.TOP_P: 0.9,
        GenParams.TOP_K: 50,
        GenParams.REPETITION_PENALTY: 1.1,
    }
    return ModelInference(
        model_id=MODEL_ID,
        credentials=Credentials(url=IBM_URL, api_key=IBM_API_KEY),
        project_id=IBM_PROJECT_ID,
        params=params,
    )

def get_json_model():
    """Model optimized for structured JSON output."""
    params = {
        GenParams.MAX_NEW_TOKENS: 300,
        GenParams.MIN_NEW_TOKENS: 20,
        GenParams.TEMPERATURE: 0,
        GenParams.TOP_P: 1,
        GenParams.TOP_K: 1,
        GenParams.REPETITION_PENALTY: 1.2,
    }

    return ModelInference(
        model_id=MODEL_ID,
        credentials=Credentials(
            url=IBM_URL,
            api_key=IBM_API_KEY,
        ),
        project_id=IBM_PROJECT_ID,
        params=params,
    )

# ── System Prompt (derived from AGENT_INSTRUCTIONS above) ──────────────────
SYSTEM_PROMPT = """You are NutriBot, an expert AI Nutrition Agent powered by IBM Granite.

PERSONALITY & TONE:
- Professional yet warm and encouraging
- Supportive, never judgmental about food choices
- Use simple language, avoid heavy medical jargon

YOUR SPECIALIZATIONS:
- Indian cuisine expertise (North, South, East, West regional foods)
- Ayurvedic diet principles and Indian superfoods
- Vegetarian, vegan, eggetarian, and non-vegetarian diet plans
- Indian festival fasting traditions (Navratri, Ekadashi, etc.)
- Familiar with Indian foods: dal, sabzi, roti, rice, curd, poha, upma, idli, dosa, paratha

WHAT YOU DO:
1. Create personalized daily/weekly nutrition plans
2. Calculate calorie needs using Mifflin-St Jeor BMR equation
3. Analyze meals and provide calorie + macro breakdowns (protein/carb/fat/fiber)
4. Suggest healthy Indian and international meal options
5. Provide family diet recommendations for different age groups
6. Recommend Indian superfoods: turmeric, moringa, amla, ashwagandha

RESPONSE FORMAT:
- Use bullet points and structured sections
- Include approximate calories and macros per meal
- Keep responses under 500 words unless a full meal plan is requested
- End with a short motivational message 💪

STRICT SAFETY RULES (NEVER VIOLATE):
- NEVER prescribe medicines or medical treatments
- NEVER recommend calorie intake below 1200 kcal/day
- ALWAYS recommend consulting a dietitian for medical conditions
- ALWAYS add disclaimer for diabetes, hypertension, allergies
- REFUSE advice that could promote eating disorders
- For pregnancy mentions, always suggest OB/GYN + dietitian consult
- All advice is for general wellness only, not medical treatment

CALORIE CALCULATION:
- BMR (Men): 10×weight(kg) + 6.25×height(cm) − 5×age + 5
- BMR (Women): 10×weight(kg) + 6.25×height(cm) − 5×age − 161
- Multiply by activity factor for TDEE
- Weight loss: max 500 kcal deficit/day
- Default macro split: 50% carbs, 25% protein, 25% fat"""


# ── Nutrition Calculation Helpers ────────────────────────────────────────────
def calculate_bmr(weight_kg, height_cm, age, gender):
    if gender.lower() in ["male", "m"]:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

def calculate_tdee(bmr, activity_level):
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    return bmr * multipliers.get(activity_level, 1.55)

def calculate_bmi(weight_kg, height_cm):
    height_m = height_cm / 100
    bmi = weight_kg / (height_m ** 2)
    if bmi < 18.5:
        category = "Underweight"
        color = "warning"
    elif bmi < 25:
        category = "Normal weight"
        color = "success"
    elif bmi < 30:
        category = "Overweight"
        color = "warning"
    else:
        category = "Obese"
        color = "danger"
    return round(bmi, 1), category, color

def calculate_macros(calories, split="balanced"):
    splits = {
        "balanced":    {"carbs": 0.50, "protein": 0.25, "fat": 0.25},
        "high_protein":{"carbs": 0.30, "protein": 0.40, "fat": 0.30},
        "keto":        {"carbs": 0.05, "protein": 0.30, "fat": 0.65},
        "low_carb":    {"carbs": 0.25, "protein": 0.35, "fat": 0.40},
    }
    s = splits.get(split, splits["balanced"])
    return {
        "carbs_g":   round((calories * s["carbs"]) / 4),
        "protein_g": round((calories * s["protein"]) / 4),
        "fat_g":     round((calories * s["fat"]) / 9),
        "carbs_pct":   int(s["carbs"] * 100),
        "protein_pct": int(s["protein"] * 100),
        "fat_pct":     int(s["fat"] * 100),
    }


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint — sends user message to Granite model."""
    data = request.get_json()
    user_message = data.get("message", "").strip()
    chat_history = data.get("history", [])
    user_profile = data.get("profile", {})

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Build context from user profile
    profile_context = ""
    if user_profile:
        profile_context = f"""
Current User Profile:
- Name: {user_profile.get('name', 'User')}
- Age: {user_profile.get('age', 'Not specified')}
- Gender: {user_profile.get('gender', 'Not specified')}
- Weight: {user_profile.get('weight', 'Not specified')} kg
- Height: {user_profile.get('height', 'Not specified')} cm
- Goal: {user_profile.get('goal', 'General wellness')}
- Diet Type: {user_profile.get('diet_type', 'Not specified')}
- Activity Level: {user_profile.get('activity_level', 'moderate')}
- Allergies/Restrictions: {user_profile.get('allergies', 'None')}
"""

    # Build conversation history
    history_text = ""
    for msg in chat_history[-6:]:  # last 6 messages for context
        role = "User" if msg["role"] == "user" else "NutriBot"
        history_text += f"{role}: {msg['content']}\n"

    full_prompt = f"""{SYSTEM_PROMPT}

{profile_context}

Conversation History:
{history_text}
User: {user_message}
NutriBot:"""

    try:
        model = get_model()
        response = model.generate_text(prompt=full_prompt)
        bot_reply = response.strip() if isinstance(response, str) else response

        return jsonify({
            "reply": bot_reply,
            "timestamp": datetime.now().strftime("%I:%M %p"),
        })
    except Exception as e:
        return jsonify({"error": f"Model error: {str(e)}"}), 500


@app.route("/api/bmi", methods=["POST"])
def bmi_calculator():
    """Calculate BMI, BMR, TDEE and macro targets."""
    data = request.get_json()
    try:
        weight   = float(data["weight"])
        height   = float(data["height"])
        age      = int(data["age"])
        gender   = data.get("gender", "male")
        activity = data.get("activity", "moderate")
        goal     = data.get("goal", "maintain")
        split    = data.get("macro_split", "balanced")

        bmi, category, color = calculate_bmi(weight, height)
        bmr  = round(calculate_bmr(weight, height, age, gender))
        tdee = round(calculate_tdee(bmr, activity))

        # Adjust calories based on goal
        if goal == "lose":
            target_calories = max(1200, tdee - 400)
        elif goal == "gain":
            target_calories = tdee + 350
        else:
            target_calories = tdee

        macros = calculate_macros(target_calories, split)

        return jsonify({
            "bmi": bmi,
            "category": category,
            "color": color,
            "bmr": bmr,
            "tdee": tdee,
            "target_calories": target_calories,
            "macros": macros,
        })
    except (KeyError, ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400


@app.route("/api/meal-plan", methods=["POST"])
def generate_meal_plan():
    """Generate a personalized meal plan using Granite."""
    data = request.get_json()
    calories    = data.get("calories", 2000)
    diet_type   = data.get("diet_type", "vegetarian")
    days        = data.get("days", 1)
    preferences = data.get("preferences", "Indian")
    goal        = data.get("goal", "maintain weight")
    allergies   = data.get("allergies", "none")

    prompt = f"""{SYSTEM_PROMPT}

Generate a detailed {days}-day meal plan for:
- Calorie Target: {calories} kcal/day
- Diet Type: {diet_type}
- Cuisine Preference: {preferences}
- Goal: {goal}
- Allergies/Restrictions: {allergies}

Format each day as:
🌅 BREAKFAST (calories + macros)
☀️ MID-MORNING SNACK
🍽️ LUNCH (calories + macros)
🍎 EVENING SNACK
🌙 DINNER (calories + macros)
💧 Hydration tip

Include approximate calories for each meal and daily totals.
End with a brief nutrition tip."""

    try:
        model = get_model()
        plan  = model.generate_text(prompt=prompt)
        return jsonify({"plan": plan.strip(), "generated_at": datetime.now().isoformat()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze-meal", methods=["POST"])
def analyze_meal():
    """Analyze a meal description and return structured nutrition JSON."""
    data = request.get_json()
    meal_description = data.get("meal", "").strip()

    if not meal_description:
        return jsonify({"error": "No meal provided"}), 400

    prompt = f"""
You are a JSON API.

Your ONLY purpose is to return ONE valid JSON object.

Rules:
- Return exactly ONE JSON object.
- Stop immediately after the closing }}.
- Never repeat the JSON.
- Never explain.
- Never output markdown.
- Never output ```json.
- Never output text before the JSON.
- Never output text after the JSON.

Meal:

{meal_description}

Assume one standard serving.

Return ONLY this JSON object (fill in the numeric values and analysis):

{{
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "analysis": "One short sentence describing the nutritional quality."
}}
"""

    try:
        print("=" * 80)
        print("MODEL:", MODEL_ID)
        print("=" * 80)

        print("=" * 80)
        print("PROMPT:")
        print(prompt)
        print("=" * 80)
        model = get_json_model()
        response = model.generate_text(prompt=prompt).strip()

        # Remove markdown fences if the model adds them
        if response.startswith("```"):
            response = (
                response.replace("```json", "")
                        .replace("```", "")
                        .strip()
            )
        print("=" * 80)
        print(response)
        print("=" * 80)

        decoder = json.JSONDecoder()

        start = response.find("{")

        if start == -1:
            raise ValueError("No JSON object found")

        nutrition, _ = decoder.raw_decode(response[start:])

        # Always set meal from the original input so special characters in the
        # description never corrupt the JSON the model returns.
        nutrition["meal"] = meal_description

        # Sanity check: calories should roughly match macros
        estimated = (
            nutrition["protein"] * 4 +
            nutrition["carbs"] * 4 +
            nutrition["fat"] * 9
        )

        if abs(estimated - nutrition["calories"]) > 100:
            nutrition["calories"] = estimated

        return jsonify(nutrition)

    except json.JSONDecodeError as e:
        return jsonify({
            "error": str(e),
            "raw": response
        }), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    """Generate nutrition recommendations for a family."""
    data    = request.get_json()
    members = data.get("members", [])
    cuisine = data.get("cuisine", "Indian")

    if not members:
        return jsonify({"error": "No family members provided"}), 400

    members_text = "\n".join([
        f"- {m.get('name', 'Member')}: Age {m.get('age')}, "
        f"{m.get('gender', 'M')}, {m.get('activity', 'moderate')} activity, "
        f"Goal: {m.get('goal', 'healthy living')}, Diet: {m.get('diet', 'vegetarian')}"
        for m in members
    ])

    prompt = f"""{SYSTEM_PROMPT}

Create a family nutrition plan for:
{members_text}

Cuisine preference: {cuisine}

For each family member provide:
1. Daily calorie target
2. Key nutritional needs based on age group
3. Recommended foods and portions
4. Foods to avoid

Then suggest 3 family-friendly meals that work for everyone's needs.
Be specific about Indian family meal traditions and healthy adaptations."""

    try:
        model = get_model()
        plan  = model.generate_text(prompt=prompt)
        return jsonify({"plan": plan.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/nutrition-tip", methods=["GET"])
def daily_tip():
    """Get a daily nutrition tip."""
    today = date.today().strftime("%B %d")
    prompt = f"""{SYSTEM_PROMPT}

Give one concise, actionable Indian nutrition tip for {today}.
Focus on a seasonal food, spice, or healthy eating habit.
Keep it under 3 sentences. Be specific and practical."""

    try:
        model = get_model()
        tip   = model.generate_text(prompt=prompt)
        return jsonify({"tip": tip.strip(), "date": today})
    except Exception as e:
        return jsonify({"tip": "Stay hydrated! Aim for 8 glasses of water daily. 💧", "date": today})


@app.route("/api/tracker/log", methods=["POST"])
def log_meal():
    """Log a meal to the session-based tracker."""
    data = request.get_json()
    if "tracker" not in session:
        session["tracker"] = []

    entry = {
        "id":       len(session["tracker"]) + 1,
        "meal":     data.get("meal", ""),
        "calories": data.get("calories", 0),
        "protein":  data.get("protein", 0),
        "carbs":    data.get("carbs", 0),
        "fat":      data.get("fat", 0),
        "fiber":    data.get("fiber", 0),
        "time":     data.get("time", datetime.now().strftime("%I:%M %p")),
        "date":     date.today().isoformat(),
    }
    tracker = session["tracker"]
    tracker.append(entry)
    session["tracker"] = tracker
    session.modified  = True
    return jsonify({"success": True, "entry": entry})


@app.route("/api/tracker/today", methods=["GET"])
def get_today_log():
    """Get today's meal log with totals."""
    tracker = session.get("tracker", [])
    today   = date.today().isoformat()
    today_meals = [m for m in tracker if m.get("date") == today]

    totals = {
        "calories": sum(m["calories"] for m in today_meals),
        "protein":  sum(m["protein"]  for m in today_meals),
        "carbs":    sum(m["carbs"]    for m in today_meals),
        "fat":      sum(m["fat"]      for m in today_meals),
        "fiber":    sum(m["fiber"]    for m in today_meals),
    }
    return jsonify({"meals": today_meals, "totals": totals})


@app.route("/api/tracker/delete/<int:meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    """Delete a meal from tracker."""
    tracker = session.get("tracker", [])
    session["tracker"] = [m for m in tracker if m["id"] != meal_id]
    session.modified   = True
    return jsonify({"success": True})


@app.route("/api/tracker/clear", methods=["DELETE"])
def clear_tracker():
    session["tracker"] = []
    session.modified   = True
    return jsonify({"success": True})


if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print("🥗 NutriBot — AI Nutrition Agent starting...")
    print(f"   Model  : {MODEL_ID}")
    print(f"   URL    : http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
