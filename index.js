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
  process.env.BASE_URL || "https://tiktok21.onrender.com"
).replace(/\/$/, "");

const REDIRECT_URI =
  `${BASE_URL}/auth/tiktok/callback`;


/* =========================================================
   TIKTOK SITE VERIFICATION
   =========================================================

   TikTok provided this exact filename:

   tiktok-developers-site-verification=Yoxq0mIwsslltRqxMrlJeB2huPa7BJ8k.txt

   The route below makes Render return the exact verification
   content even when the TXT file is not being served by
   Express as a static file.
========================================================= */

const TIKTOK_VERIFICATION_FILENAME =
  "tiktok-developers-site-verification=Yoxq0mIwsslltRqxMrlJeB2huPa7BJ8k.txt";

const TIKTOK_VERIFICATION_CONTENT =
  "tiktok-developers-site-verification=Yoxq0mIwsslltRqxMrlJeB2huPa7BJ8k";


app.get(
  `/${TIKTOK_VERIFICATION_FILENAME}`,
  (req, res) => {

    res.status(200);

    res.set({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    });

    res.send(TIKTOK_VERIFICATION_CONTENT);
  }
);


/* =========================================================
   COMMON HTML
========================================================= */

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
  font-family: Arial, Helvetica, sans-serif;
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
  margin: 0 10px;
  font-weight: bold;
}

nav a:hover {
  text-decoration: underline;
}

.container {
  max-width: 900px;
  margin: 40px auto;
  padding: 30px;
  background: white;
  border-radius: 14px;
  box-shadow: 0 5px 25px rgba(0,0,0,0.08);
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
}

.button:hover {
  opacity: 0.9;
}

h1,
h2 {
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
  padding: 12px;
  background: #ecfdf5;
  border-radius: 8px;
  margin-top: 20px;
}

code {
  word-break: break-all;
}

</style>

</head>

<body>

<nav>

  <a href="/">Home</a>

  <a href="/privacy">
    Privacy Policy
  </a>

  <a href="/terms">
    Terms of Service
  </a>

  <a href="/health">
    Health
  </a>

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


/* =========================================================
   HOME PAGE
========================================================= */

app.get("/", (req, res) => {

  res.send(
    page(
      "Jontez TikTok Hub",
      `
      <div class="hero">

        <h1>Jontez TikTok Hub</h1>

        <p>
          A web application designed to connect with TikTok
          through TikTok's official developer APIs and Login Kit.
        </p>

        <a
          class="button"
          href="/auth/tiktok"
        >
          Continue with TikTok
        </a>

        <div class="status">

          <strong>Service status:</strong>
          Online

        </div>

      </div>
      `
    )
  );

});


/* =========================================================
   PRIVACY POLICY
========================================================= */

app.get("/privacy", (req, res) => {

  res.send(
    page(
      "Privacy Policy",
      `
      <h1>Privacy Policy</h1>

      <p>
        <strong>Last updated:</strong>
        September 20, 2026
      </p>

      <p>
        Jontez TikTok Hub ("we", "our", or "the application")
        respects your privacy and is committed to protecting
        information that you provide when using this website.
      </p>

      <h2>Information We May Receive</h2>

      <p>
        When you use TikTok Login or another authorized TikTok
        integration, we may receive information made available
        by TikTok according to the permissions that you authorize.
      </p>

      <p>
        Depending on the permissions approved for the application,
        this may include basic account information such as your
        TikTok user identifier and profile information.
      </p>

      <h2>How We Use Information</h2>

      <ul>

        <li>
          To authenticate users through TikTok.
        </li>

        <li>
          To provide requested application functionality.
        </li>

        <li>
          To maintain and improve the application.
        </li>

        <li>
          To protect the application against unauthorized use.
        </li>

      </ul>

      <h2>Data Sharing</h2>

      <p>
        We do not sell personal information.
        Information obtained through TikTok is not intentionally
        shared with third parties except where necessary to
        provide the requested service, comply with applicable law,
        or protect the security of the application.
      </p>

      <h2>Data Security</h2>

      <p>
        We take reasonable technical and organizational measures
        to protect information handled by the application.
        No internet service can guarantee absolute security.
      </p>

      <h2>Data Retention</h2>

      <p>
        Information is retained only for as long as reasonably
        necessary to provide the requested service or comply
        with legal obligations.
      </p>

      <h2>Deleting Your Data</h2>

      <p>
        If you would like information associated with your use of
        this application to be deleted, contact the application
        operator and provide enough information to identify the
        relevant account or data.
      </p>

      <h2>Changes to This Policy</h2>

      <p>
        This Privacy Policy may be updated when the application,
        applicable requirements, or data practices change.
      </p>

      <h2>Contact</h2>

      <p>
        For privacy questions or data deletion requests, contact
        the operator of Jontez TikTok Hub through the contact
        information associated with this application.
      </p>
      `
    )
  );

});


/* =========================================================
   TERMS OF SERVICE
========================================================= */

app.get("/terms", (req, res) => {

  res.send(
    page(
      "Terms of Service",
      `
      <h1>Terms of Service</h1>

      <p>
        <strong>Last updated:</strong>
        September 20, 2026
      </p>

      <p>
        These Terms of Service govern your use of
        Jontez TikTok Hub. By accessing or using the
        application, you agree to comply with these terms.
      </p>

      <h2>Use of the Application</h2>

      <p>
        You agree to use the application only for lawful purposes
        and in accordance with applicable laws and the rules of
        services that the application integrates with.
      </p>

      <h2>TikTok Integration</h2>

      <p>
        The application may use TikTok's official developer
        services and APIs. Your use of TikTok remains subject to
        TikTok's own terms, policies, and community guidelines.
      </p>

      <h2>User Accounts</h2>

      <p>
        You are responsible for maintaining the security of your
        accounts and for activities performed through your
        authorized account.
      </p>

      <h2>Prohibited Activities</h2>

      <p>
        You must not use the application to engage in unlawful
        activity, abuse the TikTok platform, bypass security
        controls, interfere with the service, or access data
        without authorization.
      </p>

      <h2>Availability</h2>

      <p>
        We may modify, suspend, or discontinue parts of the
        application when necessary for maintenance, security,
        development, or other operational reasons.
      </p>

      <h2>Third-Party Services</h2>

      <p>
        The application may depend on third-party services,
        including TikTok and hosting infrastructure. We are not
        responsible for outages or changes made by third-party
        providers.
      </p>

      <h2>Limitation of Liability</h2>

      <p>
        To the extent permitted by applicable law, the application
        is provided without guarantees that it will always be
        available, error-free, or uninterrupted.
      </p>

      <h2>Changes to These Terms</h2>

      <p>
        These Terms may be updated from time to time. Continued
        use of the application after an update constitutes
        acceptance of the revised terms.
      </p>

      <h2>Contact</h2>

      <p>
        Questions concerning these Terms may be directed to the
        operator of Jontez TikTok Hub through the contact
        information associated with this application.
      </p>
      `
    )
  );

});


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {

  res.status(200).json({

    status: "ok",

    service: "Jontez TikTok Hub",

    platform: "Render",

    timestamp: new Date().toISOString(),

    base_url: BASE_URL,

    redirect_uri: REDIRECT_URI,

    tiktok_client_key_configured:
      Boolean(CLIENT_KEY),

    tiktok_client_secret_configured:
      Boolean(CLIENT_SECRET)

  });

});


/* =========================================================
   TIKTOK LOGIN
========================================================= */

app.get("/auth/tiktok", (req, res) => {

  if (!CLIENT_KEY || !CLIENT_SECRET) {

    return res.status(500).send(

      page(
        "Configuration Error",
        `
        <h1>Configuration Error</h1>

        <p>
          TikTok credentials have not been configured
          on the server.
        </p>

        <p>
          Add the required environment variables in Render:
        </p>

        <ul>

          <li>TIKTOK_CLIENT_KEY</li>

          <li>TIKTOK_CLIENT_SECRET</li>

          <li>BASE_URL</li>

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
      maxAge: 10 * 60 * 1000
    }
  );


  const params =
    new URLSearchParams({

      client_key: CLIENT_KEY,

      response_type: "code",

      scope: "user.info.basic",

      redirect_uri: REDIRECT_URI,

      state: state

    });


  const authorizationURL =
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;


  res.redirect(authorizationURL);

});


/* =========================================================
   TIKTOK CALLBACK
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

        return res.status(400).send(

          page(
            "TikTok Authorization Error",
            `
            <h1>
              TikTok Authorization Error
            </h1>

            <p>
              <strong>Error:</strong>
              ${escapeHTML(error)}
            </p>

            <p>
              ${escapeHTML(
                error_description ||
                "Authorization was not completed."
              )}
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


      const savedState =
        req.cookies.tiktok_oauth_state;


      if (
        !state ||
        !savedState ||
        state !== savedState
      ) {

        return res.status(400).send(

          page(
            "Invalid OAuth State",
            `
            <h1>
              Authorization Error
            </h1>

            <p>
              The OAuth security state could not
              be verified.
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
              TikTok did not return an
              authorization code.
            </p>
            `
          )

        );

      }


      /* -----------------------------------------------
         Exchange authorization code for access token
      ------------------------------------------------ */

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


      const tokenData =
        await tokenResponse.json();


      if (
        !tokenResponse.ok ||
        tokenData.error
      ) {

        console.error(
          "TikTok token response:",
          tokenData
        );


        return res.status(400).send(

          page(
            "TikTok Token Error",
            `
            <h1>
              TikTok Token Error
            </h1>

            <p>
              TikTok authorization succeeded, but
              the server could not exchange the
              authorization code for a token.
            </p>

            <p>
              Check your TikTok Developer configuration
              and redirect URI.
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


      /*
        IMPORTANT:

        In a production application, store the returned
        token securely on the server/database.

        Do not expose access tokens in HTML,
        URLs, browser JavaScript, or logs.
      */


      res.clearCookie(
        "tiktok_oauth_state"
      );


      res.send(

        page(
          "TikTok Connected",
          `
          <div class="hero">

            <h1>
              TikTok Connected
            </h1>

            <p>
              Your TikTok authorization was
              successfully completed.
            </p>

            <div class="status">
              Authorization successful.
            </div>

            <a
              class="button"
              href="/"
            >
              Return Home
            </a>

          </div>
          `
        )

      );


    } catch (error) {

      console.error(
        "TikTok callback error:",
        error
      );


      res.status(500).send(

        page(
          "Server Error",
          `
          <h1>
            Server Error
          </h1>

          <p>
            An unexpected error occurred while
            processing TikTok authorization.
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

  }
);


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   404
========================================================= */

app.use((req, res) => {

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

});


/* =========================================================
   START SERVER
========================================================= */

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
      "Redirect URI:",
      REDIRECT_URI
    );

    console.log(
      "TikTok client configured:",
      Boolean(CLIENT_KEY)
    );

    console.log(
      "TikTok verification route:",
      `/${TIKTOK_VERIFICATION_FILENAME}`
    );

    console.log(
      "================================="
    );

  }
);
