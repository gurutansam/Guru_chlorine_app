# Guru Chlorine & Mosquito Surveillance Application Suite

A full-stack, cross-platform solution integrating React Native mobile applications, a Vite React web management dashboard, an Express.js backend API, and a Python AI computer-vision inference engine for real-time chlorine ppm prediction and vector surveillance.

---

## 🏛 Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │                 Client Apps                  │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       │                              │                              │
                       ▼                              ▼                              ▼
             ┌───────────────────┐          ┌───────────────────┐          ┌───────────────────┐
             │   Web Dashboard   │          │  TS Mobile App    │          │  JS Mobile App    │
             │(dph_mos_water_app_│          │  (dph_ts_app_cd)  │          │(dph_mob_app_mosq) │
             │      dash)        │          │                   │          │                   │
             │    Port: 5173     │          │    Port: 8081     │          │    Port: 8081     │
             └─────────┬─────────┘          └─────────┬─────────┘          └─────────┬─────────┘
                       │                              │                              │
                       │                              ├──────────────────────────────┤
                       │                              │                              │
                       ▼                              ▼                              │
             ┌──────────────────────────────────────────────────┐                    │
             │           Node.js Express Backend API            │                    │
             │           (dph_mos_water_app_dash/backend)       │                    │
             │                   Port: 3000                     │                    │
             └─────────────┬──────────────────────┬─────────────┘                    │
                           │                      │                                  │
                           ▼                      ▼                                  │
                    ┌──────────────┐      ┌──────────────┐                           │
                    │ MySQL (3306) │      │ Redis (6379) │                           │
                    └──────────────┘      └──────────────┘                           │
                                                                                     │
                                  Direct AI Inference Request ───────────────────────┘
                                  (Image upload for ppm / tube analysis)
                                                     │
                                                     ▼
                                  ┌─────────────────────────────────────┐
                                  │      Python AI Prediction Engine    │
                                  │(dph_mos_water_app_dash/guru_backend)│
                                  │             Port: 5100              │
                                  └─────────────────────────────────────┘
```

---

## 📁 Repository Structure

| Folder | Technology | Description |
|---|---|---|
| **`dph_ts_app_cd/`** | React Native, TypeScript, Expo Router | Primary mobile application for field surveys, larva data entry, and chlorine water quality analysis. |
| **`dph_mob_app_mosqito/`** | React Native, JavaScript, Expo | Mobile application variant for mosquito and chlorine inspection workflows. |
| **`dph_mos_water_app_dash/`** | React 19, Vite, MUI, Bootstrap | Administrative analytics web dashboard for state, corporation, and district officers. |
| **`dph_mos_water_app_dash/backend/`** | Node.js, Express, MySQL, Redis | Authentication, role-based access control, survey data collection, and inspection planning APIs. |
| **`dph_mos_water_app_dash/guru_backend_ai/`** | Python, Flask / FastAPI, PyTorch, ONNX, YOLOv8 | Computer vision backend predicting chlorine ppm levels and detecting testing tubes in images. |

---

## ⚙️ Prerequisites

Before getting started, make sure you have the following installed on your machine:

- **Node.js**: `v18.x` or `v20.x+` (with `npm` installed)
- **Python**: `3.10` or `3.11` (with `pip` and virtual environment support)
- **Database Services**:
  - **MySQL Server** (running on port `3306`)
  - **Redis Server** (running on port `6379`)
- **Mobile Development Tools** (Choose based on your testing method):
  - **Expo Go App**: Installed on physical Android or iOS device from Google Play Store or Apple App Store.
  - **Android Studio**: With Android SDK & Virtual Device (AVD) configured for emulator testing.

---

## 🚀 Quick Start Guide

To run the complete system, start the components in the following order:
1. **Node.js Backend API** (`Port 3000`)
2. **Python AI Service** (`Port 5100`)
3. **Web Dashboard** (`Port 5173`)
4. **Mobile Application** (`Expo Go`, `Android Emulator`, or `Web`)

---

### Step 1: Start the Node.js Express Backend API

1. Navigate to the backend directory:
   ```bash
   cd dph_mos_water_app_dash/backend
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   # On Windows PowerShell:
   # Copy-Item .env.example .env
   ```
   Verify and update database credentials in `.env`:
   ```ini
   PORT=3000
   NODE_ENV=development

   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password

   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_DB=0

   JWT_SECRET=localdevsecretkey999
   JWT_EXPIRES_IN=15m
   SESSION_IDLE_TIMEOUT=900000
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. *(Optional)* Seed initial users if initializing a fresh database:
   ```bash
   node scripts/seed-admin.js
   node scripts/seed-developer.js
   node scripts/seed-zet-users.js
   ```

5. Start the server:
   ```bash
   npm run dev
   # or
   npm start
   ```
   The backend will start on: **`http://localhost:3000`**

---

### Step 2: Start the Python AI Prediction Backend

The AI service handles image processing, tube detection, and chlorine ppm prediction using YOLOv8 and ONNX models.

1. Navigate to the AI directory:
   ```bash
   cd dph_mos_water_app_dash/guru_backend_ai
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the AI inference service:
   - **Flask option:**
     ```bash
     python app.py
     ```
   - **FastAPI option (Alternative high-throughput):**
     ```bash
     python main.py
     # or: uvicorn main:app --host 0.0.0.0 --port 5100
     ```

   The AI service will listen on: **`http://localhost:5100`**  
   - Health check: `http://localhost:5100/health`  
   - Prediction endpoint: `http://localhost:5100/vfive_predict`

---

### Step 3: Start the Web Dashboard

1. Navigate to the web frontend directory:
   ```bash
   cd dph_mos_water_app_dash
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser:
   Visit **`http://localhost:5173`** to access the web dashboard.

---

### Step 4: Configure and Run the Mobile Application

The primary TypeScript Expo app is located in **`dph_ts_app_cd`** (the JavaScript version in `dph_mob_app_mosqito` follows identical execution patterns).

#### ⚠️ Crucial Step: Configure API Server IP Address

Mobile devices and emulators cannot connect to `localhost` because `localhost` points to the device itself.

1. Find your computer's local Wi-Fi / LAN IP address:
   - **Windows:** Run `ipconfig` (look for `IPv4 Address`, e.g., `192.168.1.145`)
   - **macOS / Linux:** Run `ifconfig` or `ip a`

2. Update the endpoints:
   - In `dph_ts_app_cd/services/api.ts`:
     ```typescript
     // If using Expo Go or Physical Device: use your machine's Wi-Fi IP
     export const BASE_URL = 'http://<YOUR_LOCAL_IP>:3000';
     export const CHLORINE_PREDICT_URL = 'http://<YOUR_LOCAL_IP>:5100/vfive_predict';

     // If using Android Studio Emulator exclusively: you can use 10.0.2.2
     // export const BASE_URL = 'http://10.0.2.2:3000';
     // export const CHLORINE_PREDICT_URL = 'http://10.0.2.2:5100/vfive_predict';
     ```

3. Install mobile dependencies:
   ```bash
   cd dph_ts_app_cd
   npm install
   ```

---

#### 📱 Method A: Run in Expo Go (Physical Android or iOS Device)

1. Connect your mobile phone to the **same Wi-Fi network** as your development computer.
2. Start the Expo development server:
   ```bash
   npx expo start
   ```
3. Open the app:
   - **Android**: Open the **Expo Go** app and tap **"Scan QR code"**, then scan the QR code displayed in your terminal.
   - **iOS**: Open the native **Camera** app, scan the QR code, and tap the prompt to open in Expo Go.

---

#### 🤖 Method B: Run on Android Studio Emulator

1. **Launch the Emulator**:
   - Open **Android Studio**.
   - Go to **Tools** ➜ **Device Manager** (or **Virtual Device Manager**).
   - Launch your configured Android Virtual Device (AVD) (e.g. Pixel 7 / Android 13/14).
   - Wait until the emulator is fully booted to the home screen.

2. **Verify ADB Connection**:
   ```bash
   adb devices
   ```
   You should see your emulator listed (e.g., `emulator-5554 device`).

3. **Start the App on Android Emulator**:
   ```bash
   cd dph_ts_app_cd
   npx expo start --android
   # or
   npm run android
   ```
   *(Alternatively, if `npx expo start` is already running in your terminal, simply press `a` to launch the app directly in the emulator).*

> **Tip for Emulator Networking**: Android Studio Emulator maps `10.0.2.2` directly to your host machine's `127.0.0.1`. If your local Wi-Fi IP changes frequently, you can set `BASE_URL = 'http://10.0.2.2:3000'` and `CHLORINE_PREDICT_URL = 'http://10.0.2.2:5100/vfive_predict'`.

---

#### 🌐 Method C: Run Mobile App in Web Browser

To test the mobile UI and layouts in a desktop browser:

```bash
cd dph_ts_app_cd
npx expo start --web
# or
npm run web
```
The app will automatically bundle and launch at **`http://localhost:8081`** in your default web browser.

---

## 🔌 Default Ports Summary

| Component | Port | Address |
|---|---|---|
| **Node.js Express API** | `3000` | `http://localhost:3000` |
| **Python AI Prediction** | `5100` | `http://localhost:5100` |
| **Web Dashboard** | `5173` | `http://localhost:5173` |
| **Expo Metro Bundler** | `8081` | `http://localhost:8081` |
| **MySQL Server** | `3306` | `127.0.0.1:3306` |
| **Redis Server** | `6379` | `127.0.0.1:6379` |

---

## 🛠️ Common Troubleshooting

### 1. "Network request failed" or "Cannot reach AI Prediction Server" in Mobile App
- **Cause**: The phone/emulator is trying to connect to `localhost` or an unreachable IP.
- **Fix**:
  - Run `ipconfig` or `ifconfig` and replace the IP address in `dph_ts_app_cd/services/api.ts`.
  - Ensure Windows Defender Firewall allows incoming connections on port `3000` and `5100`.
  - For Expo Go: ensure PC and phone are on the exact same Wi-Fi network and AP isolation is disabled.

### 2. Expo Metro Bundler cache issues
- Clear Expo cache by running:
  ```bash
  npx expo start -c
  ```

### 3. Android Emulator command fails with `device offline` or `adb not found`
- Add Android SDK platform-tools to your system PATH:
  `%LOCALAPPDATA%\Android\Sdk\platform-tools`
- Restart ADB server:
  ```bash
  adb kill-server
  adb start-server
  ```

### 4. Database Connection Errors on Backend Start
- Ensure MySQL and Redis services are active:
  - Windows: Check Services (`services.msc`) for `MySQL80` / `Redis` or start Docker container if using containerized databases.
  - Verify credentials in `dph_mos_water_app_dash/backend/.env`.

---

© 2026 TANSAM - Directorate of Public Health and Preventive Medicine
