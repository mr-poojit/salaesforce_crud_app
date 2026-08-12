# Salesforce CRUD Web Application (Python FastAPI + React)

A full-stack web application designed for the **Associate Software Engineer** assignment. It connects directly to Salesforce via **OAuth 2.0 (External Client App)** to execute dynamic CRUD operations on 5 core Salesforce standard objects (**Account**, **Opportunity**, **Lead**, **Contact**, and **Case**).

---

## 🌟 Key Features

1. **OAuth 2.0 Salesforce Authorization**: Secure web server authentication flow via Salesforce External Client App.
2. **5 Core Standard Objects**: Dynamic selection for `Account`, `Opportunity`, `Lead`, `Contact`, and `Case`.
3. **Dynamic Field Rendering**: Automatically renders 8 distinct, relevant fields for each selected Salesforce object.
4. **Infinite Scroll Pagination**: Automatically loads records in chunks of 20 as you scroll.
5. **Full CRUD Suite**:
   - **Create**: Add new records directly to Salesforce org via REST APIs.
   - **Read/View**: Detailed modal inspection of object fields.
   - **Update**: Edit existing record attributes in real-time.
   - **Delete**: Safe delete operations directly communicating with Salesforce REST endpoints.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React (Vite), Glassmorphism UI, Lucide Icons, Custom CSS Design Tokens
- **Backend**: Python (FastAPI), Uvicorn, Requests, Pydantic
- **Salesforce Integration**: OAuth 2.0 Authorization Code Grant, Salesforce REST API (`v58.0`)

---

## 🚀 Setup & Execution Instructions

### 1. Prerequisites
- Python 3.9+
- Node.js & npm

### 2. Backend Setup (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup (React)
```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Salesforce External Client App Configuration

1. Log into your **Salesforce Developer Org** (`developer.salesforce.com/signup`).
2. Go to **Setup** -> **App Manager** (or **External Client Apps**).
3. Create a new **External Client App** / **Connected App**.
4. Enable **OAuth Settings**:
   - Callback URL / Redirect URI: `http://localhost:5173/`
   - Selected OAuth Scopes: `Access and manage your data (api)`, `Perform requests on your behalf at any time (refresh_token, offline_access)`
5. Copy the **Consumer Key (Client ID)** and **Consumer Secret**.
6. Enter these keys into the web app's **App Settings** modal or create a `.env` file in the `backend/` directory:
   ```env
   SALESFORCE_CLIENT_ID=your_consumer_key
   SALESFORCE_CLIENT_SECRET=your_consumer_secret
   SALESFORCE_REDIRECT_URI=http://localhost:5173
   ```
