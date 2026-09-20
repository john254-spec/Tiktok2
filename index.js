"use strict";

require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT || 10000);

const BASE_URL = (
  process.env.BASE_URL ||
  `http://localhost:${PORT}`
).replace(/\/$/, "");

const CLIENT_KEY =
  process.env.TIKTOK_CLIENT_KEY || "";

const CLIENT_SECRET =
  process.env.TIKTOK_CLIENT_SECRET || "";

const REDIRECT_URI =
  process.env.TIKTOK_REDIRECT_URI ||
  `${BASE_URL}/auth/tiktok/callback`;

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

/*
   IMPORTANT:

   Only request scopes that your TikTok application
   has actually been configured/approved for.

   Default:
   - user.info.basic
   - video.list

   If TikTok has approved additional scopes for your app,
   set TIKTOK_SCOPES in Render, for example:

   user.info.basic,user.info.profile,user.info.stats,video.list

*/

const REQUESTED_SCOPES = (
  process.env.TIKTOK_SCOPES ||
  "user.info.basic,video.list"
)
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);


/* =========================================================
   TIKTOK PRODUCTS
========================================================= */

const TIKTOK_PRODUCTS = [
  "Login Kit",
  "Share Kit",
  "Content Posting API",
  "Research API",
  "Display API",
  "Embed Videos",
  "Data Portability API",
  "Green Screen Kit",
  "Commercial Content API"
];


/* =========================================================
   DOCUMENTED SCOPES
========================================================= */

const ALL_DOCUMENTED_SCOPES = [

  "user.info.basic",
  "user.info.profile",
  "user.info.stats",

  "video.list",

  "video.publish",
  "video.upload",

  "portability.activity.ongoing",
  "portability.activity.single",

  "portability.all.ongoing",
  "portability.all.single",

  "portability.directmessages.ongoing",
  "portability.directmessages.single",

  "portability.postsandprofile.ongoing",
  "portability.postsandprofile.single",

  "research.data.basic",
  "research.data.u18eu",
  "research.data.vra",

  "research.adlib.basic",

  "local.product.manage",
  "local.shop.manage",
  "local.voucher.manage"
];


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  express.json({
    limit: "50mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb"
  })
);

app.use(cookieParser());


/* =========================================================
   SECURITY HEADERS
========================================================= */

app.use((req, res, next) => {

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  res.setHeader(
    "X-Frame-Options",
    "SAMEORIGIN"
  );

  next();

});


/* =========================================================
   SESSION STORAGE
=========================================================

   Temporary memory storage.

   If Render restarts the service, sessions disappear.

   For production, use Supabase/PostgreSQL/Redis.
========================================================= */

const sessions = new Map();


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function randomString(length = 32) {

  return crypto
    .randomBytes(length)
    .toString("hex");

}


function createState() {

  const value =
    randomString(32);

  const signature =
    crypto
      .createHmac(
        "sha256",
        SESSION_SECRET
      )
      .update(value)
      .digest("hex");

  return `${value}.${signature}`;

}


function verifyState(state) {

  if (!state) {
    return false;
  }

  const parts =
    state.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const value =
    parts[0];

  const signature =
    parts[1];

  const expected =
    crypto
      .createHmac(
        "sha256",
        SESSION_SECRET
      )
      .update(value)
      .digest("hex");

  if (
    signature.length !==
    expected.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

}


function escapeHTML(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function getSession(req) {

  const id =
    req.cookies.jontez_session;

  if (!id) {
    return null;
  }

  return sessions.get(id) || null;

}


function requireTikTok(req, res, next) {

  const session =
    getSession(req);

  if (
    !session ||
    !session.tiktok ||
    !session.tiktok.access_token
  ) {

    return res.status(401).json({
      error: "TikTok account is not connected."
    });

  }

  req.session = session;

  next();

}


/* =========================================================
   TIKTOK API HELPER
========================================================= */

async function tiktokAPI(
  endpoint,
  options = {},
  token
) {

  const headers = {
    ...(options.headers || {})
  };

  if (token) {

    headers.Authorization =
      `Bearer ${token}`;

  }

  if (
    options.body &&
    !headers["Content-Type"]
  ) {

    headers["Content-Type"] =
      "application/json";

  }

  const response =
    await fetch(
      `https://open.tiktokapis.com${endpoint}`,
      {
        ...options,
        headers
      }
    );

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw: text
    };

  }

  if (!response.ok) {

    const error =
      new Error(
        data?.error?.message ||
        data?.message ||
        `TikTok API error ${response.status}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;

  }

  return data;

}


/* =========================================================
   TOKEN REFRESH
========================================================= */

async function refreshToken(session) {

  if (
    !session.tiktok?.refresh_token
  ) {

    throw new Error(
      "No refresh token available."
    );

  }

  const body =
    new URLSearchParams({

      client_key:
        CLIENT_KEY,

      client_secret:
        CLIENT_SECRET,

      grant_type:
        "refresh_token",

      refresh_token:
        session.tiktok.refresh_token

    });

  const response =
    await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body

      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data.error_description ||
      data.error ||
      "Token refresh failed."
    );

  }

  session.tiktok.access_token =
    data.access_token;

  if (data.refresh_token) {

    session.tiktok.refresh_token =
      data.refresh_token;

  }

  session.tiktok.expires_at =
    Date.now() +
    Number(
      data.expires_in || 86400
    ) * 1000;

  return session.tiktok.access_token;

}


async function getToken(session) {

  const expiresAt =
    Number(
      session.tiktok?.expires_at || 0
    );

  if (
    expiresAt &&
    Date.now() >
      expiresAt - 5 * 60 * 1000
  ) {

    return refreshToken(session);

  }

  return session.tiktok.access_token;

}


/* =========================================================
   INLINE HTML
========================================================= */

function pageTemplate(
  title,
  content
) {

  return `<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<meta
  name="description"
  content="Jontez TikTok Creator Hub"
>

<meta
  name="google-adsense-account"
  content="ca-pub-4200131324754790"
>

<title>${escapeHTML(title)}</title>

<style>

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
  background:
    #0f0f0f;
  color:
    #ffffff;
}

nav {
  position:
    sticky;
  top:
    0;
  z-index:
    100;
  background:
    rgba(15,15,15,.96);
  border-bottom:
    1px solid #292929;
  padding:
    15px 5%;
  display:
    flex;
  justify-content:
    space-between;
  align-items:
    center;
}

.logo {
  font-size:
    22px;
  font-weight:
    800;
}

.logo span {
  color:
    #ff0050;
}

.nav-links {
  display:
    flex;
  gap:
    15px;
  flex-wrap:
    wrap;
}

.nav-links a {
  color:
    #ddd;
  text-decoration:
    none;
  font-size:
    14px;
}

.nav-links a:hover {
  color:
    #25f4ee;
}

.container {
  width:
    min(1100px, 92%);
  margin:
    auto;
}

.hero {
  min-height:
    70vh;
  display:
    flex;
  align-items:
    center;
  justify-content:
    center;
  text-align:
    center;
  padding:
    60px 20px;
}

.hero h1 {
  font-size:
    clamp(40px, 8vw, 78px);
  margin:
    0 0 20px;
}

.hero h1 span {
  color:
    #ff0050;
}

.hero p {
  max-width:
    700px;
  margin:
    auto;
  color:
    #bdbdbd;
  font-size:
    18px;
  line-height:
    1.7;
}

.buttons {
  display:
    flex;
  gap:
    12px;
  justify-content:
    center;
  flex-wrap:
    wrap;
  margin-top:
    30px;
}

.btn {
  display:
    inline-block;
  border:
    none;
  border-radius:
    999px;
  padding:
    14px 24px;
  cursor:
    pointer;
  text-decoration:
    none;
  font-weight:
    700;
  font-size:
    15px;
}

.btn-primary {
  background:
    #ff0050;
  color:
    white;
}

.btn-secondary {
  background:
    #25f4ee;
  color:
    #000;
}

.btn-dark {
  background:
    #272727;
  color:
    white;
}

.section {
  padding:
    60px 0;
}

.section h2 {
  font-size:
    34px;
  margin-bottom:
    15px;
}

.grid {
  display:
    grid;
  grid-template-columns:
    repeat(auto-fit, minmax(220px, 1fr));
  gap:
    18px;
}

.card {
  background:
    #181818;
  border:
    1px solid #292929;
  border-radius:
    18px;
  padding:
    24px;
}

.card h3 {
  margin-top:
    0;
}

.card p {
  color:
    #aaa;
  line-height:
    1.6;
}

.status {
  padding:
    15px;
  border-radius:
    12px;
  background:
    #202020;
  margin:
    15px 0;
}

.success {
  color:
    #25f4ee;
}

.danger {
  color:
    #ff4d6d;
}

.form {
  max-width:
    700px;
  margin:
    30px auto;
}

input,
textarea,
select {
  width:
    100%;
  padding:
    14px;
  margin:
    8px 0 15px;
  background:
    #111;
  border:
    1px solid #333;
  border-radius:
    10px;
  color:
    white;
}

textarea {
  min-height:
    130px;
}

footer {
  border-top:
    1px solid #292929;
  margin-top:
    50px;
  padding:
    30px 0;
  text-align:
    center;
  color:
    #888;
}

footer a {
  color:
    #25f4ee;
  margin:
    0 8px;
}

pre {
  white-space:
    pre-wrap;
  word-break:
    break-word;
  background:
    #090909;
  padding:
    15px;
  border-radius:
    10px;
  overflow:
    auto;
}

.hidden {
  display:
    none;
}

video {
  width:
    100%;
  max-width:
    700px;
  border-radius:
    15px;
}

@media(max-width:700px) {

  nav {
    align-items:
      flex-start;
    flex-direction:
      column;
    gap:
      12px;
  }

  .hero {
    min-height:
      60vh;
  }

}

</style>

</head>

<body>

<nav>

<div class="logo">
Jontez <span>TikTok Hub</span>
</div>

<div class="nav-links">

<a href="/">Home</a>

<a href="/privacy">
Privacy
</a>

<a href="/terms">
Terms
</a>

<a href="/api/tiktok/config">
API Config
</a>

</div>

</nav>

${content}

<footer>

<div>
© ${new Date().getFullYear()}
Jontez TikTok Creator Hub
</div>

<div style="margin-top:12px">

<a href="/privacy">
Privacy Policy
</a>

<a href="/terms">
Terms of Service
</a>

</div>

</footer>

<script>

async function api(url, options = {}) {

  const response =
    await fetch(url, options);

  const data =
    await response.json()
      .catch(() => ({
        error: "Invalid server response"
      }));

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Request failed"
    );
  }

  return data;
}


async function checkSession() {

  try {

    const data =
      await api(
        "/api/tiktok/session"
      );

    const status =
      document.getElementById(
        "connection-status"
      );

    if (!status) return;

    if (data.connected) {

      status.innerHTML =
        '<span class="success">● TikTok Connected</span>';

      const login =
        document.getElementById(
          "login-button"
        );

      if (login) {
        login.classList.add("hidden");
      }

      const logout =
        document.getElementById(
          "logout-button"
        );

      if (logout) {
        logout.classList.remove("hidden");
      }

    } else {

      status.innerHTML =
        '<span class="danger">● TikTok Not Connected</span>';

    }

  } catch (error) {

    console.error(error);

  }

}


async function logoutTikTok() {

  try {

    await api(
      "/api/logout",
      {
        method: "POST"
      }
    );

    window.location.reload();

  } catch (error) {

    alert(error.message);

  }

}


async function loadProfile() {

  const output =
    document.getElementById(
      "profile-output"
    );

  if (!output) return;

  output.textContent =
    "Loading...";

  try {

    const data =
      await api(
        "/api/tiktok/user"
      );

    output.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

  } catch (error) {

    output.textContent =
      error.message;

  }

}


async function loadVideos() {

  const output =
    document.getElementById(
      "videos-output"
    );

  if (!output) return;

  output.textContent =
    "Loading...";

  try {

    const data =
      await api(
        "/api/tiktok/video/list",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              max_count: 20
            })
        }
      );

    output.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

  } catch (error) {

    output.textContent =
      error.message;

  }

}


document.addEventListener(
  "DOMContentLoaded",
  checkSession
);

</script>

</body>

</html>`;

}


/* =========================================================
   HOME PAGE
========================================================= */

app.get("/", (req, res) => {

  const content = `

<section class="hero">

<div class="container">

<h1>
Jontez
<span>TikTok Hub</span>
</h1>

<p>
A creator dashboard for connecting your TikTok
account, viewing profile information, viewing videos,
and working with approved TikTok APIs.
</p>

<div id="connection-status"
     class="status">
Checking TikTok connection...
</div>

<div class="buttons">

<a
  id="login-button"
  class="btn btn-primary"
  href="/auth/tiktok"
>
Continue with TikTok
</a>

<button
  id="logout-button"
  class="btn btn-dark hidden"
  onclick="logoutTikTok()"
>
Logout
</button>

</div>

</div>

</section>


<section class="section">

<div class="container">

<h2>Creator Dashboard</h2>

<div class="grid">

<div class="card">

<h3>Connect TikTok</h3>

<p>
Secure OAuth login using TikTok Login Kit.
</p>

<a
  class="btn btn-primary"
  href="/auth/tiktok"
>
Connect
</a>

</div>


<div class="card">

<h3>Profile</h3>

<p>
Retrieve profile information from the
authorized TikTok account.
</p>

<button
  class="btn btn-secondary"
  onclick="loadProfile()"
>
Load Profile
</button>

</div>


<div class="card">

<h3>Videos</h3>

<p>
Retrieve videos available through the
authorized Display API scopes.
</p>

<button
  class="btn btn-secondary"
  onclick="loadVideos()"
>
Load Videos
</button>

</div>


<div class="card">

<h3>Developer API</h3>

<p>
View the configured products, redirect URI
and requested OAuth scopes.
</p>

<a
  class="btn btn-dark"
  href="/api/tiktok/products"
>
View API
</a>

</div>

</div>


<div class="card" style="margin-top:25px">

<h3>Profile Response</h3>

<pre id="profile-output">
Connect TikTok first.
</pre>

</div>


<div class="card" style="margin-top:25px">

<h3>Video Response</h3>

<pre id="videos-output">
Connect TikTok first.
</pre>

</div>

</div>

</section>

`;

  res.send(
    pageTemplate(
      "Jontez TikTok Creator Hub",
      content
    )
  );

});


/* =========================================================
   PRIVACY POLICY
========================================================= */

app.get("/privacy", (req, res) => {

  const content = `

<section class="section">

<div class="container">

<div class="card">

<h1>Privacy Policy</h1>

<p>
Last updated: September 20, 2026
</p>

<h2>1. Introduction</h2>

<p>
Jontez TikTok Creator Hub is a web application
designed to provide creator-related functionality
using TikTok's developer services.
</p>

<h2>2. Information We Process</h2>

<p>
When you authorize the application, TikTok may
provide information permitted by the scopes that
you approve.
</p>

<p>
Depending on the approved scopes, this may include
basic profile information and information about
TikTok videos.
</p>

<h2>3. TikTok Authorization</h2>

<p>
The application uses TikTok's OAuth authorization
process. You are redirected to TikTok to authenticate
and authorize the requested permissions.
</p>

<h2>4. Access Tokens</h2>

<p>
Access and refresh tokens are handled by the server
and are not intentionally displayed as part of the
public webpage.
</p>

<h2>5. Data Sharing</h2>

<p>
We do not intentionally sell personal information.
Information obtained through TikTok APIs is used
for the functionality of the application.
</p>

<h2>6. Data Retention</h2>

<p>
Temporary application sessions may be removed when
the server restarts. Production deployments may use
persistent storage where required.
</p>

<h2>7. Third-Party Services</h2>

<p>
This application uses TikTok developer services.
TikTok's own privacy practices also apply to
information processed by TikTok.
</p>

<h2>8. Revoking Access</h2>

<p>
You may revoke the application's access through
the relevant TikTok account settings.
</p>

<h2>9. Security</h2>

<p>
Reasonable technical measures are used to protect
application credentials and authorization data.
No internet service can guarantee absolute security.
</p>

<h2>10. Contact</h2>

<p>
For privacy questions, contact the administrator
through the contact information associated with
the application.
</p>

</div>

</div>

</section>

`;

  res.send(
    pageTemplate(
      "Privacy Policy - Jontez TikTok Hub",
      content
    )
  );

});


/* =========================================================
   TERMS OF SERVICE
========================================================= */

app.get("/terms", (req, res) => {

  const content = `

<section class="section">

<div class="container">

<div class="card">

<h1>Terms of Service</h1>

<p>
Last updated: September 20, 2026
</p>

<h2>1. Acceptance</h2>

<p>
By using Jontez TikTok Creator Hub, you agree
to these Terms of Service.
</p>

<h2>2. Service</h2>

<p>
The service provides creator-related functionality
through TikTok developer APIs and other application
features.
</p>

<h2>3. TikTok Account</h2>

<p>
You are responsible for maintaining the security
of your TikTok account and for authorizing only
applications you trust.
</p>

<h2>4. Authorization</h2>

<p>
You may be redirected to TikTok to authenticate
and grant permissions. You can decline requested
permissions.
</p>

<h2>5. Acceptable Use</h2>

<p>
You agree not to use the service for unlawful,
fraudulent, abusive, or unauthorized activities.
</p>

<h2>6. TikTok Rules</h2>

<p>
Use of TikTok functionality remains subject to
TikTok's applicable terms, policies, developer
requirements and API restrictions.
</p>

<h2>7. Availability</h2>

<p>
The service may be modified, interrupted or
temporarily unavailable.
</p>

<h2>8. No Guarantee</h2>

<p>
The service is provided without a guarantee that
all TikTok functionality will always be available.
API access can depend on TikTok approval,
permissions and platform changes.
</p>

<h2>9. Termination</h2>

<p>
Access to the service may be suspended or terminated
if these terms are violated or if required for
security or operational reasons.
</p>

<h2>10. Changes</h2>

<p>
These terms may be updated from time to time.
The updated version will be published on this page.
</p>

<h2>11. Contact</h2>

<p>
For questions regarding these terms, contact the
administrator through the contact information
associated with this application.
</p>

</div>

</div>

</section>

`;

  res.send(
    pageTemplate(
      "Terms of Service - Jontez TikTok Hub",
      content
    )
  );

});


/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {

  res.json({

    status:
      "online",

    service:
      "Jontez TikTok Creator Hub",

    timestamp:
      new Date().toISOString(),

    tiktokConfigured:
      Boolean(
        CLIENT_KEY &&
        CLIENT_SECRET
      ),

    redirect_uri:
      REDIRECT_URI,

    scopes:
      REQUESTED_SCOPES

  });

});


/* =========================================================
   PRODUCTS
========================================================= */

app.get(
  "/api/tiktok/products",
  (req, res) => {

    res.json({

      products:
        TIKTOK_PRODUCTS,

      documented_scopes:
        ALL_DOCUMENTED_SCOPES,

      requested_scopes:
        REQUESTED_SCOPES,

      redirect_uri:
        REDIRECT_URI,

      note:
        "Actual product and scope availability depends on TikTok configuration and approval."

    });

  }
);


/* =========================================================
   CONFIG
========================================================= */

app.get(
  "/api/tiktok/config",
  (req, res) => {

    res.json({

      client_configured:
        Boolean(CLIENT_KEY),

      redirect_uri:
        REDIRECT_URI,

      requested_scopes:
        REQUESTED_SCOPES,

      products:
        TIKTOK_PRODUCTS

    });

  }
);


/* =========================================================
   TIKTOK LOGIN
========================================================= */

app.get(
  "/auth/tiktok",
  (req, res) => {

    if (!CLIENT_KEY) {

      return res.status(500).send(
        pageTemplate(
          "TikTok Configuration Error",
          `
          <section class="section">
          <div class="container">
          <div class="card">
          <h1>Configuration Error</h1>
          <p>
          TIKTOK_CLIENT_KEY is missing from the
          Render environment variables.
          </p>
          </div>
          </div>
          </section>
          `
        )
      );

    }

    const state =
      createState();

    res.cookie(
      "tiktok_state",
      state,
      {
        httpOnly: true,
        secure:
          BASE_URL.startsWith("https://"),
        sameSite: "lax",
        maxAge:
          10 * 60 * 1000
      }
    );

    const params =
      new URLSearchParams({

        client_key:
          CLIENT_KEY,

        response_type:
          "code",

        scope:
          REQUESTED_SCOPES.join(","),

        redirect_uri:
          REDIRECT_URI,

        state

      });

    const url =
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    res.redirect(url);

  }
);


/* =========================================================
   OAUTH CALLBACK
========================================================= */

app.get(
  "/auth/tiktok/callback",
  async (req, res) => {

    try {

      const {
        code,
        state,
        error,
        error_description
      } = req.query;

      if (error) {

        throw new Error(
          error_description ||
          error
        );

      }

      if (!code) {

        throw new Error(
          "No authorization code received."
        );

      }

      const storedState =
        req.cookies.tiktok_state;

      if (
        !storedState ||
        !state ||
        storedState !== state ||
        !verifyState(state)
      ) {

        throw new Error(
          "Invalid OAuth state."
        );

      }

      const body =
        new URLSearchParams({

          client_key:
            CLIENT_KEY,

          client_secret:
            CLIENT_SECRET,

          code,

          grant_type:
            "authorization_code",

          redirect_uri:
            REDIRECT_URI

        });

      const response =
        await fetch(
          "https://open.tiktokapis.com/v2/oauth/token/",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/x-www-form-urlencoded"

            },

            body

          }
        );

      const token =
        await response.json();

      if (!response.ok) {

        throw new Error(
          token.error_description ||
          token.error ||
          "TikTok token exchange failed."
        );

      }

      const sessionId =
        randomString(32);

      sessions.set(
        sessionId,
        {

          createdAt:
            Date.now(),

          tiktok: {

            access_token:
              token.access_token,

            refresh_token:
              token.refresh_token,

            open_id:
              token.open_id,

            scope:
              token.scope,

            expires_at:
              Date.now() +
              Number(
                token.expires_in ||
                86400
              ) * 1000,

            refresh_expires_at:
              Date.now() +
              Number(
                token.refresh_expires_in ||
                31536000
              ) * 1000

          }

        }
      );

      res.cookie(
        "jontez_session",
        sessionId,
        {

          httpOnly:
            true,

          secure:
            BASE_URL.startsWith("https://"),

          sameSite:
            "lax",

          maxAge:
            7 *
            24 *
            60 *
            60 *
            1000

        }
      );

      res.clearCookie(
        "tiktok_state"
      );

      res.redirect(
        "/?tiktok=connected"
      );

    } catch (error) {

      console.error(
        "TikTok OAuth error:",
        error
      );

      res.status(400).send(
        pageTemplate(
          "TikTok Connection Failed",
          `
          <section class="section">

          <div class="container">

          <div class="card">

          <h1>TikTok Connection Failed</h1>

          <p class="danger">
          ${escapeHTML(error.message)}
          </p>

          <a
            class="btn btn-primary"
            href="/"
          >
            Return Home
          </a>

          </div>

          </div>

          </section>
          `
        )
      );

    }

  }
);


/* =========================================================
   SESSION
========================================================= */

app.get(
  "/api/tiktok/session",
  (req, res) => {

    const session =
      getSession(req);

    if (!session) {

      return res.json({
        connected: false
      });

    }

    res.json({

      connected:
        Boolean(
          session.tiktok
        ),

      open_id:
        session.tiktok?.open_id ||
        null,

      scopes:
        session.tiktok?.scope ||
        null,

      expires_at:
        session.tiktok?.expires_at ||
        null

    });

  }
);


/* =========================================================
   USER PROFILE
========================================================= */

app.get(
  "/api/tiktok/user",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      /*
       Only request basic fields by default.
       Additional fields require the corresponding
       approved scopes.
      */

      const fields = [
        "open_id",
        "union_id",
        "avatar_url",
        "display_name"
      ];

      const data =
        await tiktokAPI(
          `/v2/user/info/?fields=${fields.join(",")}`,
          {
            method: "GET"
          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   VIDEO LIST
========================================================= */

app.post(
  "/api/tiktok/video/list",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      const body = {

        max_count:
          Math.min(
            Number(
              req.body.max_count || 20
            ),
            20
          )

      };

      if (req.body.cursor) {

        body.cursor =
          Number(
            req.body.cursor
          );

      }

      const data =
        await tiktokAPI(
          "/v2/video/list/",
          {

            method:
              "POST",

            body:
              JSON.stringify(body)

          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   VIDEO QUERY
========================================================= */

app.post(
  "/api/tiktok/video/query",
  requireTikTok,
  async (req, res) => {

    try {

      const ids =
        Array.isArray(
          req.body.video_ids
        )
          ? req.body.video_ids
          : [];

      if (!ids.length) {

        return res.status(400).json({
          error:
            "video_ids is required."
        });

      }

      const token =
        await getToken(
          req.session
        );

      const data =
        await tiktokAPI(
          "/v2/video/query/",
          {

            method:
              "POST",

            body:
              JSON.stringify({

                filters: {
                  video_ids:
                    ids
                }

              })

          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   CREATOR INFO
========================================================= */

app.post(
  "/api/tiktok/creator-info",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      const data =
        await tiktokAPI(
          "/v2/post/publish/creator_info/query/",
          {
            method: "POST"
          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   DIRECT POST FROM VERIFIED URL
========================================================= */

app.post(
  "/api/tiktok/post/url",
  requireTikTok,
  async (req, res) => {

    try {

      const {
        video_url,
        title = "",
        privacy_level,
        disable_comment = false,
        disable_duet = false,
        disable_stitch = false
      } = req.body;

      if (!video_url) {

        return res.status(400).json({
          error:
            "video_url is required."
        });

      }

      if (!privacy_level) {

        return res.status(400).json({
          error:
            "privacy_level is required."
        });

      }

      const token =
        await getToken(
          req.session
        );

      const data =
        await tiktokAPI(
          "/v2/post/publish/video/init/",
          {

            method:
              "POST",

            body:
              JSON.stringify({

                post_info: {

                  title,

                  privacy_level,

                  disable_comment:
                    Boolean(
                      disable_comment
                    ),

                  disable_duet:
                    Boolean(
                      disable_duet
                    ),

                  disable_stitch:
                    Boolean(
                      disable_stitch
                    )

                },

                source_info: {

                  source:
                    "PULL_FROM_URL",

                  video_url

                }

              })

          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   VIDEO UPLOAD INITIALIZATION
========================================================= */

app.post(
  "/api/tiktok/upload/init",
  requireTikTok,
  async (req, res) => {

    try {

      const {
        video_size,
        chunk_size,
        total_chunk_count
      } = req.body;

      if (!video_size) {

        return res.status(400).json({
          error:
            "video_size is required."
        });

      }

      const token =
        await getToken(
          req.session
        );

      const data =
        await tiktokAPI(
          "/v2/post/publish/inbox/video/init/",
          {

            method:
              "POST",

            body:
              JSON.stringify({

                source_info: {

                  source:
                    "FILE_UPLOAD",

                  video_size:
                    Number(
                      video_size
                    ),

                  chunk_size:
                    Number(
                      chunk_size ||
                      video_size
                    ),

                  total_chunk_count:
                    Number(
                      total_chunk_count ||
                      1
                    )

                }

              })

          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   PUBLISH STATUS
========================================================= */

app.post(
  "/api/tiktok/publish/status",
  requireTikTok,
  async (req, res) => {

    try {

      if (!req.body.publish_id) {

        return res.status(400).json({
          error:
            "publish_id is required."
        });

      }

      const token =
        await getToken(
          req.session
        );

      const data =
        await tiktokAPI(
          "/v2/post/publish/status/fetch/",
          {

            method:
              "POST",

            body:
              JSON.stringify({

                publish_id:
                  req.body.publish_id

              })

          },
          token
        );

      res.json(data);

    } catch (error) {

      res.status(
        error.status || 500
      ).json({

        error:
          error.message,

        details:
          error.data || null

      });

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/logout",
  (req, res) => {

    const id =
      req.cookies.jontez_session;

    if (id) {

      sessions.delete(id);

    }

    res.clearCookie(
      "jontez_session"
    );

    res.json({
      success: true
    });

  }
);


/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    if (
      req.path.startsWith("/api/")
    ) {

      return res.status(404).json({
        error:
          "API endpoint not found."
      });

    }

    res.status(404).send(
      pageTemplate(
        "404 - Not Found",
        `
        <section class="section">

        <div class="container">

        <div class="card">

        <h1>404</h1>

        <p>
        The page you requested was not found.
        </p>

        <a
          class="btn btn-primary"
          href="/"
        >
          Go Home
        </a>

        </div>

        </div>

        </section>
        `
      )
    );

  }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(
      error.status || 500
    ).json({

      error:
        error.message ||
        "Internal server error."

    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "=========================================="
    );

    console.log(
      "JONTEZ TIKTOK CREATOR HUB"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Base URL: ${BASE_URL}`
    );

    console.log(
      `Redirect URI: ${REDIRECT_URI}`
    );

    console.log(
      `TikTok configured: ${Boolean(
        CLIENT_KEY &&
        CLIENT_SECRET
      )}`
    );

    console.log(
      "Requested scopes:"
    );

    console.log(
      REQUESTED_SCOPES.join(", ")
    );

    console.log(
      "=========================================="
    );

  }
);
