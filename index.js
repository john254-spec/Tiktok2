"use strict";

require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const BASE_URL =
  (process.env.BASE_URL ||
    `http://localhost:${PORT}`).replace(/\/$/, "");

const CLIENT_KEY =
  process.env.TIKTOK_CLIENT_KEY || "";

const CLIENT_SECRET =
  process.env.TIKTOK_CLIENT_SECRET || "";

const REDIRECT_URI =
  process.env.TIKTOK_REDIRECT_URI ||
  `${BASE_URL}/auth/tiktok/callback`;

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_SECRET";

/*
========================================================
TIKTOK PRODUCTS
========================================================

Current TikTok Developer products include:

- Login Kit
- Share Kit
- Content Posting API
- Research API
- Display API
- Embed Videos
- Data Portability API
- Green Screen Kit
- Commercial Content API

Some products are SDKs/tools rather than OAuth scopes,
so they cannot simply be enabled by putting a scope
string into the authorization URL.
*/

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

/*
========================================================
CURRENT DOCUMENTED SCOPES
========================================================

These are represented here so the application knows
about them.

IMPORTANT:
Do NOT assume all of these can be requested by every app.
TikTok requires the appropriate product/scope approval.

The default OAuth request below deliberately uses the
user/video scopes normally associated with the web API.
*/

const ALL_DOCUMENTED_SCOPES = [

  // User information
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",

  // Display / video
  "video.list",

  // Content Posting
  "video.publish",
  "video.upload",

  // Data Portability
  "portability.activity.ongoing",
  "portability.activity.single",

  "portability.all.ongoing",
  "portability.all.single",

  "portability.directmessages.ongoing",
  "portability.directmessages.single",

  "portability.postsandprofile.ongoing",
  "portability.postsandprofile.single",

  // Research
  "research.data.basic",
  "research.data.u18eu",
  "research.data.vra",

  // Research / Commercial Content
  "research.adlib.basic",

  // Local Service
  "local.product.manage",
  "local.shop.manage",
  "local.voucher.manage"
];

/*
========================================================
OAUTH SCOPES
========================================================

You can override these with:

TIKTOK_SCOPES=

in Render environment variables.

Do not put every documented scope into a real OAuth
request unless your TikTok app has those scopes enabled
and your use case has been approved.
*/

const REQUESTED_SCOPES = (
  process.env.TIKTOK_SCOPES ||
  [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.list",
    "video.publish",
    "video.upload"
  ].join(",")
)
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

/*
========================================================
DIRECTORIES
========================================================
*/

const PUBLIC_DIR =
  path.join(__dirname, "public");

const UPLOAD_DIR =
  path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(PUBLIC_DIR, {
  recursive: true
});

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true
});

/*
========================================================
MIDDLEWARE
========================================================
*/

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(cookieParser());

app.use(
  express.static(PUBLIC_DIR)
);

/*
========================================================
SECURITY HEADERS
========================================================
*/

app.use((req, res, next) => {

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  next();

});

/*
========================================================
UPLOAD
========================================================
*/

const storage =
  multer.diskStorage({

    destination(req, file, cb) {

      cb(null, UPLOAD_DIR);

    },

    filename(req, file, cb) {

      const extension =
        path.extname(
          file.originalname
        ).toLowerCase();

      const random =
        crypto
          .randomBytes(16)
          .toString("hex");

      cb(
        null,
        `${Date.now()}-${random}${extension}`
      );

    }

  });

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        100 * 1024 * 1024
    },

    fileFilter(req, file, cb) {

      const allowed = [
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ];

      if (
        allowed.includes(
          file.mimetype
        )
      ) {

        cb(null, true);

      } else {

        cb(
          new Error(
            "Only supported video files are allowed."
          )
        );

      }

    }

  });

/*
========================================================
TEMPORARY SESSION STORAGE
========================================================

For testing.

For permanent production deployment, store these
sessions/tokens in Supabase/PostgreSQL/Redis.
*/

const sessions =
  new Map();

/*
========================================================
HELPERS
========================================================
*/

function randomString(
  length = 32
) {

  return crypto
    .randomBytes(length)
    .toString("hex");

}

function sha256(value) {

  return crypto
    .createHash("sha256")
    .update(value)
    .digest();

}

function base64url(buffer) {

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

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

function verifyState(
  signedState
) {

  if (!signedState) {
    return false;
  }

  const parts =
    signedState.split(".");

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

/*
========================================================
SESSION
========================================================
*/

function getSession(req) {

  const id =
    req.cookies.jontez_session;

  if (!id) {
    return null;
  }

  return sessions.get(id) || null;

}

function requireTikTok(
  req,
  res,
  next
) {

  const session =
    getSession(req);

  if (
    !session ||
    !session.tiktok ||
    !session.tiktok.access_token
  ) {

    return res.status(401).json({

      error:
        "TikTok account is not connected."

    });

  }

  req.session =
    session;

  next();

}

/*
========================================================
TIKTOK API REQUEST
========================================================
*/

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

/*
========================================================
HOME
========================================================
*/

app.get(
  "/",
  (req, res) => {

    const index =
      path.join(
        PUBLIC_DIR,
        "index.html"
      );

    if (
      fs.existsSync(index)
    ) {

      return res.sendFile(
        index
      );

    }

    res.send(`
      <h1>Jontez TikTok Hub</h1>
      <p>public/index.html is missing.</p>
    `);

  }
);

/*
========================================================
HEALTH
========================================================
*/

app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "online",

      service:
        "Jontez TikTok Creator Hub",

      timestamp:
        new Date().toISOString(),

      tiktokConfigured:
        Boolean(
          CLIENT_KEY &&
          CLIENT_SECRET
        )

    });

  }
);

/*
========================================================
PRODUCTS + SCOPES
========================================================
*/

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

      note:
        "Availability and approval are controlled by TikTok."

    });

  }
);

/*
========================================================
OAUTH CONFIG
========================================================
*/

app.get(
  "/api/tiktok/config",
  (req, res) => {

    res.json({

      client_configured:
        Boolean(
          CLIENT_KEY
        ),

      redirect_uri:
        REDIRECT_URI,

      requested_scopes:
        REQUESTED_SCOPES,

      products:
        TIKTOK_PRODUCTS

    });

  }
);

/*
========================================================
TIKTOK LOGIN
========================================================
*/

app.get(
  "/auth/tiktok",
  (req, res) => {

    if (
      !CLIENT_KEY ||
      !CLIENT_SECRET
    ) {

      return res.status(500).send(
        "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET are required."
      );

    }

    /*
    -----------------------------------------------
    STATE
    -----------------------------------------------
    */

    const state =
      createState();

    res.cookie(
      "tiktok_state",
      state,
      {
        httpOnly: true,
        secure:
          BASE_URL.startsWith(
            "https://"
          ),
        sameSite: "lax",
        maxAge:
          10 * 60 * 1000
      }
    );

    /*
    -----------------------------------------------
    PKCE
    -----------------------------------------------
    */

    const codeVerifier =
      base64url(
        crypto.randomBytes(32)
      );

    const codeChallenge =
      base64url(
        sha256(codeVerifier)
      );

    res.cookie(
      "tiktok_code_verifier",
      codeVerifier,
      {
        httpOnly: true,
        secure:
          BASE_URL.startsWith(
            "https://"
          ),
        sameSite: "lax",
        maxAge:
          10 * 60 * 1000
      }
    );

    /*
    -----------------------------------------------
    AUTHORIZATION URL
    -----------------------------------------------
    */

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

        state,

        code_challenge:
          codeChallenge,

        code_challenge_method:
          "S256"

      });

    const url =
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    res.redirect(
      url
    );

  }
);

/*
========================================================
OAUTH CALLBACK
========================================================
*/

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
        storedState !== state
      ) {

        throw new Error(
          "Invalid OAuth state."
        );

      }

      const codeVerifier =
        req.cookies
          .tiktok_code_verifier;

      /*
      -----------------------------------------------
      TOKEN EXCHANGE
      -----------------------------------------------
      */

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

      /*
      PKCE verifier
      */

      if (codeVerifier) {

        body.set(
          "code_verifier",
          codeVerifier
        );

      }

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

      const token =
        await response.json();

      if (!response.ok) {

        throw new Error(
          token.error_description ||
          token.error ||
          "TikTok token exchange failed."
        );

      }

      /*
      -----------------------------------------------
      APPLICATION SESSION
      -----------------------------------------------
      */

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
              ) *
              1000,

            refresh_expires_at:
              Date.now() +
              Number(
                token.refresh_expires_in ||
                31536000
              ) *
              1000

          }

        }
      );

      res.cookie(
        "jontez_session",
        sessionId,
        {
          httpOnly: true,
          secure:
            BASE_URL.startsWith(
              "https://"
            ),
          sameSite: "lax",
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

      res.clearCookie(
        "tiktok_code_verifier"
      );

      res.redirect(
        "/?tiktok=connected"
      );

    } catch (error) {

      console.error(
        "TikTok OAuth error:",
        error
      );

      res.status(400).send(`
        <h1>TikTok connection failed</h1>
        <p>${escapeHTML(
          error.message
        )}</p>
        <a href="/">Return to Jontez Creator Hub</a>
      `);

    }

  }
);

/*
========================================================
CURRENT SESSION
========================================================
*/

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

/*
========================================================
REFRESH TOKEN
========================================================
*/

async function refreshToken(
  session
) {

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
        session.tiktok
          .refresh_token

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

  if (
    data.refresh_token
  ) {

    session.tiktok.refresh_token =
      data.refresh_token;

  }

  session.tiktok.expires_at =
    Date.now() +
    Number(
      data.expires_in ||
      86400
    ) *
    1000;

  return session.tiktok
    .access_token;

}

/*
========================================================
GET VALID TOKEN
========================================================
*/

async function getToken(
  session
) {

  const expiresAt =
    Number(
      session.tiktok
        ?.expires_at ||
      0
    );

  if (
    expiresAt &&
    Date.now() >
      expiresAt -
      5 * 60 * 1000
  ) {

    return refreshToken(
      session
    );

  }

  return session.tiktok
    .access_token;

}

/*
========================================================
USER PROFILE
========================================================
*/

app.get(
  "/api/tiktok/user",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      const fields = [
        "open_id",
        "union_id",
        "avatar_url",
        "display_name",
        "profile_deep_link",
        "bio_description",
        "is_verified",
        "username",
        "follower_count",
        "following_count",
        "likes_count",
        "video_count"
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

/*
========================================================
VIDEO LIST
========================================================
*/

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
              req.body.max_count ||
              20
            ),
            20
          )

      };

      if (
        req.body.cursor
      ) {

        body.cursor =
          Number(
            req.body.cursor
          );

      }

      const data =
        await tiktokAPI(
          "/v2/video/list/",
          {

            method: "POST",

            body:
              JSON.stringify(
                body
              )

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

/*
========================================================
VIDEO QUERY
========================================================
*/

app.post(
  "/api/tiktok/video/query",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

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

      const data =
        await tiktokAPI(
          "/v2/video/query/",
          {

            method: "POST",

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

/*
========================================================
CONTENT POSTING - CREATOR INFO
========================================================
*/

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

/*
========================================================
DIRECT POST FROM URL
========================================================
*/

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

            method: "POST",

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

/*
========================================================
DRAFT / UPLOAD INITIALIZATION
========================================================
*/

app.post(
  "/api/tiktok/upload/init",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

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

      const data =
        await tiktokAPI(
          "/v2/post/publish/inbox/video/init/",
          {

            method: "POST",

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

/*
========================================================
PUBLISH STATUS
========================================================
*/

app.post(
  "/api/tiktok/publish/status",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      if (!req.body.publish_id) {

        return res.status(400).json({

          error:
            "publish_id is required."

        });

      }

      const data =
        await tiktokAPI(
          "/v2/post/publish/status/fetch/",
          {

            method: "POST",

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

/*
========================================================
LOCAL MEDIA UPLOAD
========================================================
*/

app.post(
  "/api/upload",
  upload.single("video"),
  (req, res) => {

    if (!req.file) {

      return res.status(400).json({

        error:
          "No video uploaded."

      });

    }

    res.json({

      success: true,

      file: {

        filename:
          req.file.filename,

        size:
          req.file.size,

        type:
          req.file.mimetype,

        url:
          `${BASE_URL}/uploads/${req.file.filename}`

      }

    });

  }
);

/*
========================================================
DATA PORTABILITY ROUTES
========================================================

These routes provide a generic API gateway structure.
Actual portability access requires the relevant
Data Portability API approval/scopes.
========================================================
*/

app.post(
  "/api/tiktok/portability/request",
  requireTikTok,
  async (req, res) => {

    try {

      const token =
        await getToken(
          req.session
        );

      /*
      The exact portability request payload should be
      constructed according to the approved portability
      data categories and current TikTok endpoint docs.
      */

      const response =
        await tiktokAPI(
          "/v2/data/portability/create/",
          {

            method: "POST",

            body:
              JSON.stringify(
                req.body || {}
              )

          },
          token
        );

      res.json(response);

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

/*
========================================================
LOGOUT
========================================================
*/

app.post(
  "/api/logout",
  (req, res) => {

    const id =
      req.cookies.jontez_session;

    if (id) {

      sessions.delete(
        id
      );

    }

    res.clearCookie(
      "jontez_session"
    );

    res.json({
      success: true
    });

  }
);

/*
========================================================
ERROR HANDLER
========================================================
*/

app.use(
  (error, req, res, next) => {

    console.error(
      "ERROR:",
      error
    );

    res.status(500).json({

      error:
        error.message ||
        "Internal server error."

    });

  }
);

/*
========================================================
HTML ESCAPE
========================================================
*/

function escapeHTML(
  value
) {

  return String(
    value || ""
  )
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

/*
========================================================
START SERVER
========================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "JONTEZ TIKTOK CREATOR HUB"
    );

    console.log(
      "================================"
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
      "Products:"
    );

    console.log(
      TIKTOK_PRODUCTS.join(
        ", "
      )
    );

    console.log(
      "Requested scopes:"
    );

    console.log(
      REQUESTED_SCOPES.join(
        ", "
      )
    );

  }
);
