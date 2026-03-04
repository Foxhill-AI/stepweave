# Responsive Web Template

A clean, modern, content-driven web platform template inspired by well-known content and community-based applications.

This template is designed to be a solid starting point for SaaS products, content platforms, or community-driven websites.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, CSS
- **Authentication & Database:** Supabase (Email/Password and OAuth with Google & Facebook)
- **Payments:** Stripe (Checkout and Subscriptions)
- **Email:** Resend (optional)
- **Features included:**  
  User authentication, user profiles, shopping cart, collections, search functionality, responsive layout, and accessible UI components.

---

## Setup & Run Guide

### 1. Prerequisites

Make sure you have the following installed on your machine:

- **Git** → used to clone the repository from GitHub  
- **Node.js** (includes **npm**) → used to install dependencies and run the app  
- *(Optional)* **Accounts for Supabase, Stripe, Google, and Facebook** → only required to obtain API keys for the `.env.local` file  

> You do **not** install Supabase or Stripe locally. They are cloud services.

---

### 2. Install Git

#### macOS

1. Open the **Terminal**.
2. Run:
   ```bash
   xcode-select --install
   ```

3. Accept the installation and wait for it to finish.
4. Verify the installation:

   ```bash
   git --version
   ```

If you see something like `git version 2.x.x`, Git is installed.

**Alternative (Homebrew):**

```bash
brew install git
git --version
```

#### Windows

1. Visit: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and run the installer.
3. Keep the default options.
4. Verify installation in **CMD** or **PowerShell**:

   ```bash
   git --version
   ```

#### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install git
git --version
```

---

### 3. Install Node.js and npm

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS (Recommended for Most Users)** version.
3. Run the installer.
4. Verify installation:

   ```bash
   node -v
   npm -v
   ```

You should see version numbers (for example `v20.x.x` and `10.x.x`).

> ⚠️ This project requires **Node.js 18 or higher**.
> npm comes bundled with Node.js—no separate installation is needed.

---

### 4. Clone the Repository

1. Open a terminal.
2. Navigate to the folder where you want the project:

   ```bash
   cd Documents
   ```
3. Clone the repository:

   ```bash
   git clone https://github.com/MitziVite/Template-1.git
   ```
4. Enter the project folder:

   ```bash
   cd Template-1
   ```

---

### 5. Install Dependencies

Inside the project folder, run:

```bash
npm install
```

This will install all required dependencies, including:

* `next`, `react`, `react-dom`
* `@supabase/ssr`, `@supabase/supabase-js`
* `stripe`, `resend`, `lucide-react`
* `typescript`, `@types/node`, `@types/react`, `@types/react-dom`

You do **not** need to install these individually.

---

### 6. Environment Variables (`.env.local`)

This project relies on third-party services. API keys and secrets must be stored in an environment file.

1. Create a file named `.env.local` in the project root.
2. Add the following variables (replace values with your own):

```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

NEXT_PUBLIC_SITE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

FACEBOOK_CLIENT_ID=YOUR_FACEBOOK_CLIENT_ID
FACEBOOK_CLIENT_SECRET=YOUR_FACEBOOK_CLIENT_SECRET

STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_STARTER_MONTHLY=STARTER_PRICE_ID
STRIPE_PRICE_PRO_MONTHLY=PRO_PRICE_ID

RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=your-sender-email@example.com

NEXT_PUBLIC_ENABLE_BLOG=true
NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED=true
NEXT_PUBLIC_ENABLE_NEWSLETTER=true
```

3. Retrieve values from:

   * **Supabase Dashboard** → Settings → API
   * **Stripe Dashboard** → Developers → API keys / Products / Prices
   * **Google Cloud Console** → OAuth Credentials
   * **Facebook for Developers** → App Settings → Facebook Login
   * **Resend Dashboard** → API Keys

> 🚨 **Do not commit `.env.local` to GitHub.**
> It contains sensitive credentials.

---

### 7. Run the App in Development Mode

1. Make sure you are inside the project folder:

   ```bash
   cd Template-1
   ```
2. Start the development server:

   ```bash
   npm run dev
   ```
3. Open your browser and visit:

   ```text
   http://localhost:3000
   ```

As long as the terminal is running, the app will be available locally.

---

### 8. Useful Commands

All commands should be run from the project root:

* **Install dependencies**

  ```bash
  npm install
  ```

* **Run development server**

  ```bash
  npm run dev
  ```

* **Build for production**

  ```bash
  npm run build
  ```

* **Start production server**

  ```bash
  npm start
  ```

* **Run linter**

  ```bash
  npm run lint
  ```

---

### 9. Quick Start (Team Summary)

1. Install **Git** and **Node.js**
2. Clone the repository:

   ```bash
   git clone https://github.com/MitziVite/Template-1.git
   cd Template-1
   ```
3. Install dependencies:

   ```bash
   npm install
   ```
4. Create `.env.local` and add all required API keys
5. Start the app:

   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000`

