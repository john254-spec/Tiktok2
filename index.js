const express = require("express");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 10000;

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const BASE_URL = (
  process.env.BASE_URL ||
  "https://tiktok21.onrender.com"
).replace(/\/+$/, "");

/*
=========================================================
TIKTOK OAUTH CALLBACK
=========================================================
*/

const REDIRECT_URI =
  `${BASE_URL}/auth/tiktok/callback`;


/*
=========================================================
TIKTOK WEBHOOK CALLBACK
=========================================================
*/

const WEBHOOK_CALLBACK_URL =
  `${BASE_URL}/webhooks/tiktok`;


/*
=========================================================
SESSION STORAGE
=========================================================

For production, use Redis or a database.
Render restarts clear RAM sessions.
=========================================================
*/

const sessions = new Map();

const SESSION_MAX_AGE =
  7 * 24 * 60 * 60 * 1000;

const OAUTH_STATE_MAX_AGE =
  10 * 60 * 1000;


/*
=========================================================
TIKTOK SITE VERIFICATION
=========================================================
*/

const TIKTOK_VERIFICATION_FILENAME =
  "tiktokYoxq0mIwsslltRqxMrlJeB2huPa7BJ8k.txt";

const TIKTOK_VERIFICATION_CONTENT =
  "tiktok-developers-site-verification=Yoxq0mIwsslltRqxMrlJeB2huPa7BJ8k";

app.get(
  `/${TIKTOK_VERIFICATION_FILENAME}`,
  (req, res) => {

    res
      .status(200)
      .type("text/plain")
      .send(TIKTOK_VERIFICATION_CONTENT);

  }
);


/*
=========================================================
HTML ESCAPE
=========================================================
*/

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/*
=========================================================
COMMON HTML PAGE
=========================================================
*/

function page(title, content) {

  return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${escapeHTML(title)}</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
  background: #f5f7fb;
  color: #222;
}

nav {
  background: #111827;
  padding: 16px;
  text-align: center;
}

nav a {
  color: white;
  text-decoration: none;
  margin: 0 8px;
  font-weight: bold;
}

nav a:hover {
  text-decoration: underline;
}

.container {
  max-width: 1000px;
  margin: 30px auto;
  padding: 30px;
  background: white;
  border-radius: 14px;
  box-shadow:
    0 5px 25px rgba(0,0,0,0.08);
}

.hero {
  text-align: center;
  padding: 35px 15px;
}

.hero h1 {
  font-size: 38px;
  margin-bottom: 10px;
}

.hero p {
  font-size: 18px;
  color: #555;
  line-height: 1.6;
}

.button {
  display: inline-block;
  padding: 14px 24px;
  background: #111827;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  margin-top: 15px;
  font-weight: bold;
  border: none;
  cursor: pointer;
}

.button:hover {
  opacity: 0.9;
}

.logout {
  background: #dc2626;
}

.green {
  background: #059669;
}

.blue {
  background: #2563eb;
}

h1,
h2,
h3 {
  color: #111827;
}

p,
li {
  line-height: 1.7;
}

footer {
  text-align: center;
  padding: 30px;
  color: #666;
}

.status {
  padding: 14px;
  background: #ecfdf5;
  border-radius: 8px;
  margin-top: 20px;
  color: #065f46;
}

.error {
  padding: 14px;
  background: #fef2f2;
  border-radius: 8px;
  margin-top: 20px;
  color: #991b1b;
}

.warning {
  padding: 14px;
  background: #fffbeb;
  border-radius: 8px;
  margin-top: 20px;
  color: #92400e;
}

.profile {
  text-align: center;
}

.profile img {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  object-fit: cover;
  margin: 15px;
}

.card {
  background: #f9fafb;
  padding: 20px;
  border-radius: 10px;
  margin-top: 20px;
}

.card h2 {
  margin-top: 0;
}

.code-box {
  background: #111827;
  color: white;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  word-break: break-all;
}

.small {
  color: #666;
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(230px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.product {
  border: 1px solid #e5e7eb;
  padding: 20px;
  border-radius: 12px;
  background: white;
}

.product h3 {
  margin-top: 0;
}

.badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  background: #e5e7eb;
  font-size: 12px;
  font-weight: bold;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  padding: 12px;
  text-align: left;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
}

form {
  margin-top: 15px;
}

input,
textarea,
select {
  width: 100%;
  padding: 12px;
  margin-top: 7px;
  margin-bottom: 15px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
}

textarea {
  min-height: 120px;
}

.center {
  text-align: center;
}

</style>

</head>

<body>

<nav>

<a href="/">Home</a>

<a href="/dashboard">Dashboard</a>

<a href="/products">Products</a>

<a href="/privacy">Privacy</a>

<a href="/terms">Terms</a>

<a href="/health">Health</a>

</nav>

<div class="container">

${content}

</div>

<footer>

© ${new Date().getFullYear()}
Jontez TikTok Hub

</footer>

</body>

</html>
`;

}


/*
=========================================================
SESSION HELPERS
=========================================================
*/

function createSession(user) {

  const sessionId =
    crypto.randomBytes(32).toString("hex");

  sessions.set(
    sessionId,
    {
      user,
      createdAt: Date.now(),
      expiresAt:
        Date.now() + SESSION_MAX_AGE
    }
  );

  return sessionId;

}


function getSession(req) {

  const sessionId =
    req.cookies.tiktok_session;

  if (!sessionId) {
    return null;
  }

  const session =
    sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (
    Date.now() >
    session.expiresAt
  ) {

    sessions.delete(sessionId);

    return null;

  }

  return {
    id: sessionId,
    ...session
  };

}


/*
=========================================================
REQUIRE LOGIN
=========================================================
*/

function requireSession(req, res, next) {

  const session =
    getSession(req);

  if (!session) {

    return res.redirect(
      "/auth/tiktok"
    );

  }

  req.tiktokSession =
    session;

  next();

}


/*
=========================================================
HOME
=========================================================
*/

app.get("/", (req, res) => {

  const session =
    getSession(req);

  if (session) {

    return res.send(
      page(
        "Jontez TikTok Hub",
        `

        <div class="hero">

          <h1>
            Welcome to Jontez TikTok Hub
          </h1>

          <p>
            You are logged in with TikTok.
          </p>

          <a
            class="button"
            href="/dashboard"
          >
            Open Dashboard
          </a>

          <br>

          <a
            class="button green"
            href="/products"
          >
            TikTok Products
          </a>

          <br>

          <a
            class="button logout"
            href="/logout"
          >
            Logout
          </a>

        </div>

        `
      )
    );

  }


  res.send(
    page(
      "Jontez TikTok Hub",
      `

      <div class="hero">

        <h1>
          Jontez TikTok Hub
        </h1>

        <p>
          Connect your TikTok account using
          TikTok Login Kit.
        </p>

        <a
          class="button"
          href="/auth/tiktok"
        >
          Continue with TikTok
        </a>

        <div class="status">

          <strong>
            Service status:
          </strong>

          Online

        </div>

      </div>

      `
    )
  );

});


/*
=========================================================
PRIVACY POLICY
=========================================================
*/

app.get("/privacy", (req, res) => {

  res.send(
    page(
      "Privacy Policy",
      `

      <h1>
        Privacy Policy
      </h1>

      <p>
        <strong>Last updated:</strong>
        September 20, 2026
      </p>

      <p>
        Jontez TikTok Hub ("we", "our", or "the application")
        respects your privacy and is committed to protecting
        information that you provide when using this website.
      </p>

      <h2>
        Information We May Receive
      </h2>

      <p>
        When you use TikTok Login or another authorized TikTok
        integration, we may receive information made available
        by TikTok according to the permissions you authorize.
      </p>

      <p>
        Depending on the permissions approved for the application,
        this may include basic account information, profile
        information, statistics, and information related to
        authorized TikTok content features.
      </p>

      <h2>
        How We Use Information
      </h2>

      <ul>

        <li>
          Authenticate users through TikTok.
        </li>

        <li>
          Provide requested application functionality.
        </li>

        <li>
          Display authorized TikTok account information.
        </li>

        <li>
          Provide authorized video/content functionality.
        </li>

        <li>
          Maintain and improve the application.
        </li>

        <li>
          Protect the application against unauthorized use.
        </li>

      </ul>

      <h2>
        Data Sharing
      </h2>

      <p>
        We do not sell personal information.
        Information obtained through TikTok is not intentionally
        shared with third parties except where necessary to
        provide the requested service, comply with applicable law,
        or protect the security of the application.
      </p>

      <h2>
        Data Security
      </h2>

      <p>
        We take reasonable technical and organizational measures
        to protect information handled by the application.
        No internet service can guarantee absolute security.
      </p>

      <h2>
        Data Retention
      </h2>

      <p>
        Information is retained only for as long as reasonably
        necessary to provide the requested service or comply
        with legal obligations.
      </p>

      <h2>
        Deleting Your Data
      </h2>

      <p>
        You may request deletion of information associated with
        your use of this application by contacting the application
        operator.
      </p>

      <h2>
        Changes to This Policy
      </h2>

      <p>
        This Privacy Policy may be updated when the application,
        applicable requirements, or data practices change.
      </p>

      <h2>
        Contact
      </h2>

      <p>
        For privacy questions or data deletion requests, contact
        the operator of Jontez TikTok Hub through the contact
        information associated with this application.
      </p>

      `
    )
  );

});


/*
=========================================================
TERMS
=========================================================
*/

app.get("/terms", (req, res) => {

  res.send(
    page(
      "Terms of Service",
      `

      <h1>
        Terms of Service
      </h1>

      <p>
        <strong>Last updated:</strong>
        September 20, 2026
      </p>

      <p>
        These Terms of Service govern your use of
        Jontez TikTok Hub.
      </p>

      <h2>
        Use of the Application
      </h2>

      <p>
        You agree to use the application only for lawful purposes
        and in accordance with applicable laws and the rules of
        services that the application integrates with.
      </p>

      <h2>
        TikTok Integration
      </h2>

      <p>
        The application uses TikTok developer services and APIs.
        Your use of TikTok remains subject to TikTok's terms,
        policies and community guidelines.
      </p>

      <h2>
        User Accounts
      </h2>

      <p>
        You are responsible for maintaining the security of your
        accounts and authorized sessions.
      </p>

      <h2>
        Content
      </h2>

      <p>
        You are responsible for content that you choose to upload,
        publish, or otherwise process through the application.
      </p>

      <h2>
        Prohibited Activities
      </h2>

      <p>
        You must not use the application to engage in unlawful
        activity, abuse TikTok, bypass security controls,
        interfere with the service, or access data without
        authorization.
      </p>

      <h2>
        Availability
      </h2>

      <p>
        We may modify, suspend, or discontinue parts of the
        application for maintenance, security, development,
        or operational reasons.
      </p>

      <h2>
        Third-Party Services
      </h2>

      <p>
        The application depends on third-party services,
        including TikTok and hosting infrastructure.
      </p>

      <h2>
        Changes
      </h2>

      <p>
        These Terms may be updated from time to time.
      </p>

      `
    )
  );

});


/*
=========================================================
PRODUCTS PAGE
=========================================================
*/

app.get(
  "/products",
  requireSession,
  (req, res) => {

    res.send(

      page(
        "TikTok Products",
        `

        <h1>
          TikTok Integration
        </h1>

        <p>
          Jontez TikTok Hub supports the following
          TikTok developer products and scopes.
        </p>

        <div class="grid">

          <div class="product">

            <span class="badge">
              Login Kit
            </span>

            <h3>
              TikTok Login
            </h3>

            <p>
              Authenticate users with their TikTok account.
            </p>

            <a
              class="button"
              href="/dashboard"
            >
              Open Login Dashboard
            </a>

          </div>


          <div class="product">

            <span class="badge">
              Content Posting API
            </span>

            <h3>
              Content Posting
            </h3>

            <p>
              Provides the application interface for
              authorized TikTok content publishing.
            </p>

            <a
              class="button blue"
              href="/content-posting"
            >
              Open Content Posting
            </a>

          </div>


          <div class="product">

            <span class="badge">
              Share Kit
            </span>

            <h3>
              Share to TikTok
            </h3>

            <p>
              Provides a web location for TikTok sharing
              functionality and integration information.
            </p>

            <a
              class="button"
              href="/share-kit"
            >
              Open Share Kit
            </a>

          </div>


          <div class="product">

            <span class="badge">
              Webhooks
            </span>

            <h3>
              TikTok Webhooks
            </h3>

            <p>
              Receives authorized webhook events from TikTok.
            </p>

            <a
              class="button"
              href="/webhook-status"
            >
              Webhook Status
            </a>

          </div>

        </div>

        <div class="card">

          <h2>
            Enabled Scopes
          </h2>

          <ul>

            <li>
              user.info.basic
            </li>

            <li>
              user.info.profile
            </li>

            <li>
              user.info.stats
            </li>

            <li>
              video.list
            </li>

            <li>
              video.publish
            </li>

            <li>
              video.upload
            </li>

          </ul>

        </div>

        `
      )

    );

  }
);


/*
=========================================================
DASHBOARD
=========================================================
*/

app.get(
  "/dashboard",
  requireSession,
  (req, res) => {

    const user =
      req.tiktokSession.user;

    const avatar =
      user.avatar_url
        ? `
          <img
            src="${escapeHTML(user.avatar_url)}"
            alt="TikTok profile image"
          >
          `
        : "";

    res.send(

      page(
        "TikTok Dashboard",
        `

        <div class="profile">

          <h1>
            TikTok Dashboard
          </h1>

          ${avatar}

          <h2>
            ${escapeHTML(
              user.display_name
            )}
          </h2>

          <div class="status">

            <strong>
              Login successful
            </strong>

          </div>

        </div>


        <div class="card">

          <h2>
            Account Information
          </h2>

          <p>
            <strong>
              Display name:
            </strong>

            ${escapeHTML(
              user.display_name
            )}
          </p>

          <p>
            <strong>
              Open ID:
            </strong>

            ${escapeHTML(
              user.open_id
            )}
          </p>

          <p>
            <strong>
              Union ID:
            </strong>

            ${escapeHTML(
              user.union_id
            )}
          </p>

          <p>
            <strong>
              Scope:
            </strong>

            ${escapeHTML(
              user.scope
            )}
          </p>

        </div>


        <div class="grid">

          <div class="product">

            <h3>
              Profile
            </h3>

            <p>
              Read authorized TikTok profile information.
            </p>

            <a
              class="button"
              href="/api/tiktok/profile"
            >
              View Profile API
            </a>

          </div>


          <div class="product">

            <h3>
              Statistics
            </h3>

            <p>
              Request authorized TikTok account statistics.
            </p>

            <a
              class="button"
              href="/api/tiktok/stats"
            >
              View Statistics
            </a>

          </div>


          <div class="product">

            <h3>
              Videos
            </h3>

            <p>
              Request the user's public TikTok videos.
            </p>

            <a
              class="button"
              href="/api/tiktok/videos"
            >
              View Videos
            </a>

          </div>

        </div>


        <div class="card">

          <p>
            Your TikTok access token is stored server-side
            and is not displayed here.
          </p>

        </div>


        <div class="center">

          <a
            class="button logout"
            href="/logout"
          >
            Logout
          </a>

        </div>

        `
      )

    );

  }
);


/*
=========================================================
START TIKTOK AUTHORIZATION
=========================================================
*/

app.get(
  "/auth/tiktok",
  (req, res) => {

    if (
      !CLIENT_KEY ||
      !CLIENT_SECRET
    ) {

      return res.status(500).send(

        page(
          "Configuration Error",
          `

          <h1>
            Configuration Error
          </h1>

          <p>
            TikTok credentials are not configured.
          </p>

          <ul>

            <li>
              TIKTOK_CLIENT_KEY
            </li>

            <li>
              TIKTOK_CLIENT_SECRET
            </li>

            <li>
              BASE_URL
            </li>

          </ul>

          `
        )

      );

    }


    const state =
      crypto.randomBytes(32).toString("hex");


    res.cookie(
      "tiktok_oauth_state",
      state,
      {

        httpOnly: true,

        secure: true,

        sameSite: "lax",

        maxAge:
          OAUTH_STATE_MAX_AGE,

        path: "/"

      }
    );


    /*
    Request ALL selected scopes.

    TikTok may still limit these according
    to Sandbox/App Review approval.
    */

    const requestedScopes = [
      "user.info.basic",
      "user.info.profile",
      "user.info.stats",
      "video.list",
      "video.publish",
      "video.upload"
    ].join(",");


    const params =
      new URLSearchParams({

        client_key:
          CLIENT_KEY,

        response_type:
          "code",

        scope:
          requestedScopes,

        redirect_uri:
          REDIRECT_URI,

        state:
          state

      });


    const authorizationURL =
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;


    console.log(
      "Starting TikTok authorization"
    );

    console.log(
      "Redirect URI:",
      REDIRECT_URI
    );

    console.log(
      "Requested scopes:",
      requestedScopes
    );


    res.redirect(
      authorizationURL
    );

  }
);


/*
=========================================================
TIKTOK CALLBACK
=========================================================
*/

app.get(
  "/auth/tiktok/callback",
  async (req, res) => {

    try {

      const {
        code,
        state,
        error,
        error_description,
        log_id
      } = req.query;


      console.log(
        "TikTok callback received"
      );

      console.log(
        "Has code:",
        Boolean(code)
      );

      console.log(
        "Has state:",
        Boolean(state)
      );

      console.log(
        "TikTok error:",
        error || "none"
      );


      if (log_id) {

        console.log(
          "TikTok log_id:",
          log_id
        );

      }


      if (error) {

        return res.status(400).send(

          page(
            "TikTok Authorization Error",
            `

            <h1>
              TikTok Authorization Error
            </h1>

            <div class="error">

              <p>
                <strong>
                  Error:
                </strong>

                ${escapeHTML(error)}

              </p>

              <p>
                <strong>
                  Error type:
                </strong>

                ${escapeHTML(
                  req.query.error_type ||
                  "Not provided"
                )}

              </p>

              <p>
                ${escapeHTML(
                  error_description ||
                  "TikTok did not complete authorization."
                )}
              </p>

              ${
                log_id
                  ? `
                    <p class="small">
                      TikTok log ID:
                      ${escapeHTML(log_id)}
                    </p>
                    `
                  : ""
              }

            </div>

            <a
              class="button"
              href="/"
            >
              Return Home
            </a>

            `
          )

        );

      }


      const savedState =
        req.cookies.tiktok_oauth_state;


      if (
        !state ||
        !savedState ||
        state !== savedState
      ) {

        console.error(
          "OAuth state verification failed"
        );

        return res.status(400).send(

          page(
            "Invalid OAuth State",
            `

            <h1>
              Authorization Error
            </h1>

            <p>
              The OAuth security state could not be verified.
            </p>

            <a
              class="button"
              href="/auth/tiktok"
            >
              Try Again
            </a>

            `
          )

        );

      }


      if (!code) {

        return res.status(400).send(

          page(
            "Missing Authorization Code",
            `

            <h1>
              Authorization Error
            </h1>

            <p>
              TikTok did not return an authorization code.
            </p>

            `
          )

        );

      }


      /*
      =====================================================
      TOKEN EXCHANGE
      =====================================================
      */

      console.log(
        "Exchanging TikTok authorization code..."
      );


      const tokenResponse =
        await fetch(
          "https://open.tiktokapis.com/v2/oauth/token/",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/x-www-form-urlencoded"

            },

            body:
              new URLSearchParams({

                client_key:
                  CLIENT_KEY,

                client_secret:
                  CLIENT_SECRET,

                code:
                  code,

                grant_type:
                  "authorization_code",

                redirect_uri:
                  REDIRECT_URI

              }).toString()

          }
        );


      const tokenText =
        await tokenResponse.text();


      let tokenData;

      try {

        tokenData =
          JSON.parse(tokenText);

      } catch {

        tokenData = {
          raw: tokenText
        };

      }


      console.log(
        "TikTok token HTTP status:",
        tokenResponse.status
      );

      console.log(
        "TikTok token response:",
        JSON.stringify(
          tokenData,
          null,
          2
        )
      );


      if (
        !tokenResponse.ok ||
        tokenData.error
      ) {

        return res.status(400).send(

          page(
            "TikTok Token Error",
            `

            <h1>
              TikTok Token Error
            </h1>

            <div class="error">

<pre>
${escapeHTML(
  JSON.stringify(
    tokenData,
    null,
    2
  )
)}
</pre>

            </div>

            `
          )

        );

      }


      const accessToken =
        tokenData.access_token;

      const refreshToken =
        tokenData.refresh_token;


      if (!accessToken) {

        return res.status(400).send(

          page(
            "Missing Access Token",
            `

            <h1>
              TikTok Login Error
            </h1>

            <p>
              TikTok did not return an access token.
            </p>

            `
          )

        );

      }


      /*
      =====================================================
      USER INFORMATION
      =====================================================
      */

      console.log(
        "Requesting TikTok user information..."
      );


      const userInfoResponse =
        await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified",
          {

            method: "GET",

            headers: {

              Authorization:
                `Bearer ${accessToken}`

            }

          }
        );


      const userInfoText =
        await userInfoResponse.text();


      let userInfoData;

      try {

        userInfoData =
          JSON.parse(userInfoText);

      } catch {

        userInfoData = {
          raw: userInfoText
        };

      }


      console.log(
        "TikTok user info HTTP status:",
        userInfoResponse.status
      );

      console.log(
        "TikTok user info response:",
        JSON.stringify(
          userInfoData,
          null,
          2
        )
      );


      if (!userInfoResponse.ok) {

        return res.status(400).send(

          page(
            "TikTok User Info Error",
            `

            <h1>
              TikTok User Info Error
            </h1>

            <div class="error">

<pre>
${escapeHTML(
  JSON.stringify(
    userInfoData,
    null,
    2
  )
)}
</pre>

            </div>

            `
          )

        );

      }


      const tiktokUser =
        userInfoData?.data?.user;


      if (!tiktokUser) {

        return res.status(400).send(

          page(
            "TikTok Profile Error",
            `

            <h1>
              TikTok Profile Error
            </h1>

            <p>
              TikTok authorization succeeded, but no user
              profile was returned.
            </p>

            `
          )

        );

      }


      /*
      =====================================================
      CREATE SESSION
      =====================================================
      */

      const user = {

        open_id:
          tiktokUser.open_id || null,

        union_id:
          tiktokUser.union_id || null,

        display_name:
          tiktokUser.display_name ||
          "TikTok User",

        avatar_url:
          tiktokUser.avatar_url ||
          null,

        bio_description:
          tiktokUser.bio_description ||
          null,

        profile_deep_link:
          tiktokUser.profile_deep_link ||
          null,

        is_verified:
          tiktokUser.is_verified ||
          false,

        access_token:
          accessToken,

        refresh_token:
          refreshToken ||
          null,

        scope:
          tokenData.scope ||
          "",

        expires_in:
          tokenData.expires_in ||
          null,

        refresh_expires_in:
          tokenData.refresh_expires_in ||
          null

      };


      const sessionId =
        createSession(user);


      res.clearCookie(
        "tiktok_oauth_state",
        {
          path: "/"
        }
      );


      res.cookie(
        "tiktok_session",
        sessionId,
        {

          httpOnly: true,

          secure: true,

          sameSite: "lax",

          maxAge:
            SESSION_MAX_AGE,

          path: "/"

        }
      );


      console.log(
        "TikTok login successful"
      );

      console.log(
        "TikTok open_id:",
        user.open_id
      );

      console.log(
        "TikTok display name:",
        user.display_name
      );


      return res.redirect(
        "/dashboard"
      );


    } catch (error) {

      console.error(
        "TikTok callback exception:",
        error
      );


      return res.status(500).send(

        page(
          "Server Error",
          `

          <h1>
            Server Error
          </h1>

          <p>
            An unexpected error occurred while processing
            TikTok authorization.
          </p>

          <div class="error">

${escapeHTML(
  error.message ||
  String(error)
)}

          </div>

          `
        )

      );

    }

  }
);


/*
=========================================================
PROFILE API
=========================================================
*/

app.get(
  "/api/tiktok/profile",
  requireSession,
  async (req, res) => {

    try {

      const token =
        req.tiktokSession.user.access_token;


      const response =
        await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified",
          {

            headers: {

              Authorization:
                `Bearer ${token}`

            }

          }
        );


      const data =
        await response.json();


      res.status(
        response.status
      ).json(data);


    } catch (error) {

      res.status(500).json({

        error:
          "profile_request_failed",

        message:
          error.message

      });

    }

  }
);


/*
=========================================================
STATISTICS API
=========================================================
*/

app.get(
  "/api/tiktok/stats",
  requireSession,
  async (req, res) => {

    try {

      const token =
        req.tiktokSession.user.access_token;


      const response =
        await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
          {

            headers: {

              Authorization:
                `Bearer ${token}`

            }

          }
        );


      const data =
        await response.json();


      res.status(
        response.status
      ).json(data);


    } catch (error) {

      res.status(500).json({

        error:
          "stats_request_failed",

        message:
          error.message

      });

    }

  }
);


/*
=========================================================
VIDEO LIST API
=========================================================
*/

app.get(
  "/api/tiktok/videos",
  requireSession,
  async (req, res) => {

    try {

      const token =
        req.tiktokSession.user.access_token;


      const response =
        await fetch(
          "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,embed_link",
          {

            method: "POST",

            headers: {

              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json"

            },

            body: JSON.stringify({

              max_count: 20

            })

          }
        );


      const data =
        await response.json();


      res.status(
        response.status
      ).json(data);


    } catch (error) {

      res.status(500).json({

        error:
          "video_list_request_failed",

        message:
          error.message

      });

    }

  }
);


/*
=========================================================
CONTENT POSTING PAGE
=========================================================
*/

app.get(
  "/content-posting",
  requireSession,
  (req, res) => {

    res.send(

      page(
        "Content Posting API",
        `

        <h1>
          Content Posting API
        </h1>

        <div class="warning">

          <strong>
            Important:
          </strong>

          TikTok controls which posting capabilities
          are available to the application through
          product approval and authorization.

        </div>


        <div class="card">

          <h2>
            Direct Post
          </h2>

          <p>
            Your Developer Portal has selected
            <strong>video.publish</strong>.
          </p>

          <p>
            This application can be extended with the
            TikTok Content Posting API after the required
            product permissions are available.
          </p>

        </div>


        <div class="card">

          <h2>
            Upload / Draft
          </h2>

          <p>
            Your Developer Portal has selected
            <strong>video.upload</strong>.
          </p>

          <p>
            This capability can be used to send authorized
            video content to TikTok as a draft where supported.
          </p>

        </div>

        `
      )

    );

  }
);


/*
=========================================================
SHARE KIT PAGE
=========================================================
*/

app.get(
  "/share-kit",
  requireSession,
  (req, res) => {

    res.send(

      page(
        "Share Kit",
        `

        <h1>
          TikTok Share Kit
        </h1>

        <p>
          Share Kit provides TikTok sharing functionality
          for supported platforms and application flows.
        </p>

        <div class="card">

          <h2>
            Integration
          </h2>

          <p>
            This web application provides the official
            website location required by the TikTok
            Developer configuration.
          </p>

          <p>
            Web/Desktop URL:
          </p>

          <div class="code-box">

${escapeHTML(BASE_URL)}

          </div>

        </div>

        `
      )

    );

  }
);


/*
=========================================================
WEBHOOK STATUS PAGE
=========================================================
*/

app.get(
  "/webhook-status",
  (req, res) => {

    res.send(

      page(
        "TikTok Webhooks",
        `

        <h1>
          TikTok Webhooks
        </h1>

        <p>
          Webhook callback URL:
        </p>

        <div class="code-box">

${escapeHTML(
  WEBHOOK_CALLBACK_URL
)}

        </div>

        <div class="status">

          Webhook endpoint is available.

        </div>

        `
      )

    );

  }
);


/*
=========================================================
TIKTOK WEBHOOK RECEIVER
=========================================================
*/

app.post(
  "/webhooks/tiktok",
  (req, res) => {

    console.log(
      "TikTok webhook received:"
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );


    /*
    IMPORTANT:
    Verify TikTok webhook signatures according
    to TikTok's current webhook security
    requirements before trusting events.
    */


    return res.status(200).json({

      success: true

    });

  }
);


/*
=========================================================
SESSION API
=========================================================
*/

app.get(
  "/api/session",
  (req, res) => {

    const session =
      getSession(req);


    if (!session) {

      return res.json({

        logged_in:
          false

      });

    }


    res.json({

      logged_in:
        true,

      user: {

        open_id:
          session.user.open_id,

        union_id:
          session.user.union_id,

        display_name:
          session.user.display_name,

        avatar_url:
          session.user.avatar_url,

        scope:
          session.user.scope

      }

    });

  }
);


/*
=========================================================
LOGOUT
=========================================================
*/

app.get(
  "/logout",
  (req, res) => {

    const sessionId =
      req.cookies.tiktok_session;


    if (sessionId) {

      sessions.delete(
        sessionId
      );

    }


    res.clearCookie(
      "tiktok_session",
      {
        path: "/"
      }
    );


    res.redirect(
      "/"
    );

  }
);


/*
=========================================================
HEALTH
=========================================================
*/

app.get(
  "/health",
  (req, res) => {

    res.status(200).json({

      status:
        "ok",

      service:
        "Jontez TikTok Hub",

      platform:
        "Render",

      timestamp:
        new Date().toISOString(),

      base_url:
        BASE_URL,

      oauth_redirect_uri:
        REDIRECT_URI,

      webhook_callback_url:
        WEBHOOK_CALLBACK_URL,

      tiktok_client_key_configured:
        Boolean(CLIENT_KEY),

      tiktok_client_secret_configured:
        Boolean(CLIENT_SECRET),

      products: [

        "Login Kit",

        "Content Posting API",

        "Share Kit",

        "Webhooks"

      ],

      scopes: [

        "user.info.basic",

        "user.info.profile",

        "user.info.stats",

        "video.list",

        "video.publish",

        "video.upload"

      ],

      verification_filename:
        TIKTOK_VERIFICATION_FILENAME,

      verification_url:
        `${BASE_URL}/${TIKTOK_VERIFICATION_FILENAME}`

    });

  }
);


/*
=========================================================
404
=========================================================
*/

app.use(
  (req, res) => {

    res.status(404).send(

      page(
        "Page Not Found",
        `

        <h1>
          404
        </h1>

        <p>
          The page you requested could not be found.
        </p>

        <a
          class="button"
          href="/"
        >
          Return Home
        </a>

        `
      )

    );

  }
);


/*
=========================================================
START SERVER
=========================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================="
    );

    console.log(
      "Jontez TikTok Hub"
    );

    console.log(
      "Server running on port:",
      PORT
    );

    console.log(
      "Base URL:",
      BASE_URL
    );

    console.log(
      "OAuth Redirect URI:",
      REDIRECT_URI
    );

    console.log(
      "Webhook Callback URL:",
      WEBHOOK_CALLBACK_URL
    );

    console.log(
      "TikTok client configured:",
      Boolean(CLIENT_KEY)
    );

    console.log(
      "TikTok secret configured:",
      Boolean(CLIENT_SECRET)
    );

    console.log(
      "TikTok verification filename:",
      TIKTOK_VERIFICATION_FILENAME
    );

    console.log(
      "TikTok verification URL:",
      `${BASE_URL}/${TIKTOK_VERIFICATION_FILENAME}`
    );

    console.log(
      "Products:"
    );

    console.log(
      "Login Kit"
    );

    console.log(
      "Content Posting API"
    );

    console.log(
      "Share Kit"
    );

    console.log(
      "Webhooks"
    );

    console.log(
      "Scopes:"
    );

    console.log(
      "user.info.basic"
    );

    console.log(
      "user.info.profile"
    );

    console.log(
      "user.info.stats"
    );

    console.log(
      "video.list"
    );

    console.log(
      "video.publish"
    );

    console.log(
      "video.upload"
    );

    console.log(
      "================================="
    );

  }
);
