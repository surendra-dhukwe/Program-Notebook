require("dotenv").config();

const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// ENV
// =====================================================

const OWNER_USER_ID = process.env.OWNER_USER_ID;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "program-notebook-secret-2026";

// =====================================================
// GEMINI AI
// =====================================================

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// =====================================================
// MONGODB CONNECTION
// =====================================================

let mongoConnectionPromise = null;

async function connectDatabase() {
  if (
    mongoose.connection.readyState === 1
  ) {
    return true;
  }

  if (mongoConnectionPromise) {
    try {
      await mongoConnectionPromise;

      return (
        mongoose.connection.readyState === 1
      );
    } catch {
      mongoConnectionPromise = null;
      return false;
    }
  }

  try {
    if (!process.env.MONGO_URI) {
      console.error(
        "MONGO_URI is missing in .env"
      );

      return false;
    }

    mongoConnectionPromise =
      mongoose.connect(
        process.env.MONGO_URI,
        {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        }
      );

    await mongoConnectionPromise;

    console.log(
      "======================================"
    );

    console.log(
      "MongoDB connected successfully"
    );

    console.log(
      "======================================"
    );

    return true;
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    );

    return false;
  } finally {
    mongoConnectionPromise = null;
  }
}

// =====================================================
// DATABASE AVAILABILITY
// =====================================================

const DATABASE_DOWN_MESSAGE =
  "Server is currently unavailable. Please try again after some time. Thank you.";

async function requireDatabase(
  req,
  res,
  next
) {
  try {
    const connected =
      await connectDatabase();

    if (!connected) {
      return res.status(503).json({
        success: false,
        serverUnavailable: true,
        message:
          DATABASE_DOWN_MESSAGE,
      });
    }

    next();
  } catch (error) {
    console.error(
      "DATABASE MIDDLEWARE ERROR:",
      error.message
    );

    return res.status(503).json({
      success: false,
      serverUnavailable: true,
      message:
        DATABASE_DOWN_MESSAGE,
    });
  }
}

// =====================================================
// USER SCHEMA
// =====================================================

const userSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
      },

      password: {
        type: String,
        required: true,
      },

      location: {
        latitude: {
          type: Number,
        },

        longitude: {
          type: Number,
        },

        updatedAt: {
          type: Date,
        },
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      collection: "users",
    }
  );

// =====================================================
// NOTE SCHEMA
// =====================================================

const noteSchema =
  new mongoose.Schema(
    {
      subject: {
        type: String,
        required: true,
        trim: true,
      },

      question: {
        type: String,
        required: true,
        trim: true,
      },

      answer: {
        type: String,
        required: true,
      },

      code: {
        type: String,
        default: "",
      },

      language: {
        type: String,
        default: "text",
      },

      userName: {
        type: String,
        required: true,
        trim: true,
      },

      visibility: {
        type: String,
        enum: [
          "public",
          "private",
        ],
        default: "private",
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      collection: "notes",
    }
  );

// =====================================================
// MODELS
// =====================================================

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

const Note =
  mongoose.models.Note ||
  mongoose.model(
    "Note",
    noteSchema
  );

// =====================================================
// JWT TOKEN
// =====================================================

function createUserToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      name: user.name,
      role: "user",
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function createOwnerToken() {
  return jwt.sign(
    {
      name: OWNER_USER_ID,
      role: "owner",
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

function verifyToken(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization || "";

    const token =
      authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired session. Please login again.",
    });
  }
}

// Alias
const requireAuth = verifyToken;

// =====================================================
// OWNER MIDDLEWARE
// =====================================================

function requireOwner(
  req,
  res,
  next
) {
  if (
    !req.user ||
    req.user.role !== "owner"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Owner access required",
    });
  }

  next();
}

// =====================================================
// API STATUS
// =====================================================

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      success: true,
      status: "online",
      server: "Program Notebook",
      database:
        mongoose.connection.readyState === 1
          ? "connected"
          : "disconnected",
      time: new Date(),
    });
  }
);

// =====================================================
// CHECK USER
// =====================================================

async function checkUser(
  req,
  res
) {
  try {
    const name =
      String(
        req.body?.name ||
        req.body?.userName ||
        ""
      ).trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required",
      });
    }

    // Owner account exists through .env
    if (
      OWNER_USER_ID &&
      name === OWNER_USER_ID
    ) {
      return res.json({
        success: true,
        exists: true,
        hasPassword: true,
        isOwner: true,

        user: {
          id: "owner",
          _id: "owner",
          name: OWNER_USER_ID,
          role: "owner",
        },
      });
    }

    const user =
      await User.findOne({
        name,
      });

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        hasPassword: false,
      });
    }

    if (
      !user.password ||
      typeof user.password !== "string"
    ) {
      await User.deleteOne({
        _id: user._id,
      });

      return res.json({
        success: true,
        exists: false,
        hasPassword: false,
        deleted: true,
      });
    }

    return res.json({
      success: true,
      exists: true,
      hasPassword: true,

      user: {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        role: "user",
        createdAt:
          user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "CHECK USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to check user",
    });
  }
}

app.post(
  "/api/auth/check",
  requireDatabase,
  checkUser
);

app.post(
  "/api/users/check",
  requireDatabase,
  checkUser
);

// =====================================================
// REGISTER USER
// =====================================================

async function registerUser(
  req,
  res
) {
  try {
    const name =
      String(
        req.body?.name ||
        req.body?.userName ||
        ""
      ).trim();

    const password =
      String(
        req.body?.password || ""
      );

    const confirmPassword =
      String(
        req.body?.confirmPassword ||
        req.body?.confirm ||
        ""
      );

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required",
      });
    }

    // Owner ID cannot be registered
    if (
      OWNER_USER_ID &&
      name === OWNER_USER_ID
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This User ID is reserved.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          "Password is required",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 4 characters",
      });
    }

    if (
      password !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Passwords do not match",
      });
    }

    const existingUser =
      await User.findOne({
        name,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        exists: true,
        message:
          "This User ID already exists. Please login.",
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await User.create({
        name,
        password:
          hashedPassword,
      });

    const token =
      createUserToken(user);

    const userData = {
      id: String(user._id),
      _id: String(user._id),
      name: user.name,
      role: "user",
      createdAt:
        user.createdAt,
    };

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully",

      token,

      user: userData,

      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        exists: true,
        message:
          "This User ID already exists. Please login.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Registration failed",
    });
  }
}

app.post(
  "/api/auth/register",
  requireDatabase,
  registerUser
);

app.post(
  "/api/users/register",
  requireDatabase,
  registerUser
);

// =====================================================
// LOGIN
// IMPORTANT:
// OWNER LOGIN + NORMAL USER LOGIN
// SAME ROUTE
// =====================================================

async function loginUser(
  req,
  res
) {
  try {
    const name =
      String(
        req.body?.name ||
        req.body?.userName ||
        ""
      ).trim();

    const password =
      String(
        req.body?.password || ""
      );

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          "Password is required",
      });
    }

    // =================================================
    // OWNER LOGIN
    // =================================================

    if (
      OWNER_USER_ID &&
      OWNER_PASSWORD &&
      name === OWNER_USER_ID &&
      password === OWNER_PASSWORD
    ) {
      const token =
        createOwnerToken();

      console.log(
        "OWNER LOGIN SUCCESS:",
        OWNER_USER_ID
      );

      return res.status(200).json({
        success: true,

        message:
          "Owner login successful",

        token,

        user: {
          name: OWNER_USER_ID,
          role: "owner",
        },

        data: {
          token,

          user: {
            name: OWNER_USER_ID,
            role: "owner",
          },
        },
      });
    }

    // =================================================
    // NORMAL USER LOGIN
    // =================================================

    const user =
      await User.findOne({
        name,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        exists: false,
        message:
          "User not found. Please create a new account.",
      });
    }

    if (
      !user.password ||
      typeof user.password !== "string"
    ) {
      await User.deleteOne({
        _id: user._id,
      });

      return res.status(404).json({
        success: false,
        exists: false,
        deleted: true,
        message:
          "This User ID was removed because it had no password.",
      });
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Incorrect password",
      });
    }

    const token =
      createUserToken(user);

    const userData = {
      id: String(user._id),
      _id: String(user._id),
      name: user.name,
      role: "user",
      createdAt:
        user.createdAt,
    };

    console.log(
      "LOGIN SUCCESS:",
      user.name
    );

    return res.status(200).json({
      success: true,

      message:
        "Login successful",

      token,

      user: userData,

      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Login failed",
    });
  }
}

app.post(
  "/api/auth/login",
  requireDatabase,
  loginUser
);

app.post(
  "/api/users/login",
  requireDatabase,
  loginUser
);

// =====================================================
// LEGACY CREATE USER
// =====================================================

app.post(
  "/api/users",
  (req, res) => {
    return res.status(400).json({
      success: false,
      message:
        "Please use /api/auth/register to create an account.",
    });
  }
);

// =====================================================
// GET MY NOTES
// =====================================================

app.get(
  "/api/notes",
  requireDatabase,
  async (req, res) => {
    try {
      const userName =
        String(
          req.query.user || ""
        ).trim();

      if (!userName) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }

      const notes =
        await Note.find({
          userName,
        }).sort({
          createdAt: -1,
        });

      return res.json(notes);
    } catch (error) {
      console.error(
        "GET NOTES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// GET PUBLIC NOTES
// =====================================================

app.get(
  "/api/public-notes",
  requireDatabase,
  async (req, res) => {
    try {
      const notes =
        await Note.find({
          visibility: "public",
        })
          .sort({
            createdAt: -1,
          })
          .limit(200)
          .lean();

      return res.json(notes);
    } catch (error) {
      console.error(
        "PUBLIC NOTES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// VISIBLE NOTES
// =====================================================

app.get(
  "/api/visible-notes",
  requireDatabase,
  async (req, res) => {
    try {
      const userName =
        String(
          req.query.user || ""
        ).trim();

      if (!userName) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }

      const notes =
        await Note.find({
          $or: [
            {
              userName,
              visibility: "private",
            },
            {
              visibility: "public",
            },
          ],
        })
          .sort({
            createdAt: -1,
          })
          .limit(300)
          .lean();

      return res.json(notes);
    } catch (error) {
      console.error(
        "VISIBLE NOTES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// SUBJECTS
// =====================================================

app.get(
  "/api/subjects",
  requireDatabase,
  async (req, res) => {
    try {
      const userName =
        String(
          req.query.user || ""
        ).trim();

      if (!userName) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }

      const subjects =
        await Note.aggregate([
          {
            $match: {
              userName,
            },
          },

          {
            $group: {
              _id: "$subject",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },
        ]);

      return res.json(
        subjects.map(
          (item) => ({
            name: item._id,
            count: item.count,
          })
        )
      );
    } catch (error) {
      console.error(
        "SUBJECTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// PUBLIC SUBJECTS
// =====================================================

app.get(
  "/api/public-subjects",
  requireDatabase,
  async (req, res) => {
    try {
      const subjects =
        await Note.aggregate([
          {
            $match: {
              visibility: "public",
            },
          },

          {
            $group: {
              _id: "$subject",
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },
        ]);

      return res.json(
        subjects.map(
          (item) => ({
            name: item._id,
            count: item.count,
          })
        )
      );
    } catch (error) {
      console.error(
        "PUBLIC SUBJECTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// CREATE NOTE
// =====================================================

app.post(
  "/api/notes",
  requireDatabase,
  async (req, res) => {
    try {
      const {
        subject,
        question,
        answer,
        code,
        language,
        userName,
        visibility,
      } = req.body;

      const cleanUserName =
        String(
          userName || ""
        ).trim();

      const cleanSubject =
        String(
          subject || ""
        ).trim();

      const cleanQuestion =
        String(
          question || ""
        ).trim();

      const cleanAnswer =
        String(
          answer || ""
        );

      const cleanCode =
        String(
          code || ""
        );

      const cleanLanguage =
        String(
          language || "text"
        );

      const noteVisibility =
        visibility === "public"
          ? "public"
          : "private";

      if (
        !cleanSubject ||
        !cleanQuestion ||
        !cleanAnswer ||
        !cleanUserName
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Subject, question, answer and user name are required",
        });
      }

      const user =
        await User.findOne({
          name: cleanUserName,
        });

      if (
        !user ||
        !user.password
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Valid logged-in user required",
        });
      }

      const note =
        await Note.create({
          subject:
            cleanSubject,

          question:
            cleanQuestion,

          answer:
            cleanAnswer,

          code:
            cleanCode,

          language:
            cleanLanguage,

          userName:
            cleanUserName,

          visibility:
            noteVisibility,

          createdAt:
            new Date(),

          updatedAt:
            new Date(),
        });

      return res.status(201).json(
        note
      );
    } catch (error) {
      console.error(
        "CREATE NOTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// UPDATE NOTE
// =====================================================

app.put(
  "/api/notes/:id",
  requireDatabase,
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const {
        subject,
        question,
        answer,
        code,
        language,
        userName,
        visibility,
      } = req.body;

      const cleanUserName =
        String(
          userName || ""
        ).trim();

      if (
        !subject ||
        !question ||
        !answer ||
        !cleanUserName
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Subject, question, answer and user name are required",
        });
      }

      const note =
        await Note.findOneAndUpdate(
          {
            _id: id,
            userName:
              cleanUserName,
          },

          {
            subject:
              String(
                subject
              ).trim(),

            question:
              String(
                question
              ).trim(),

            answer:
              String(
                answer
              ),

            code:
              String(
                code || ""
              ),

            language:
              String(
                language ||
                "text"
              ),

            visibility:
              visibility ===
              "public"
                ? "public"
                : "private",

            updatedAt:
              new Date(),
          },

          {
            new: true,
            runValidators: true,
          }
        );

      if (!note) {
        return res.status(404).json({
          success: false,
          message:
            "Note not found or permission denied",
        });
      }

      return res.json(
        note
      );
    } catch (error) {
      console.error(
        "UPDATE NOTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// CHANGE VISIBILITY
// =====================================================

app.patch(
  "/api/notes/:id/visibility",
  requireDatabase,
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const userName =
        String(
          req.body?.userName ||
          ""
        ).trim();

      const visibility =
        req.body?.visibility;

      if (!userName) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }

      if (
        ![
          "public",
          "private",
        ].includes(
          visibility
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Visibility must be public or private",
        });
      }

      const note =
        await Note.findOneAndUpdate(
          {
            _id: id,
            userName,
          },

          {
            visibility,
            updatedAt:
              new Date(),
          },

          {
            new: true,
          }
        );

      if (!note) {
        return res.status(404).json({
          success: false,
          message:
            "Note not found or permission denied",
        });
      }

      return res.json({
        success: true,
        message:
          `Note is now ${visibility}`,
        note,
      });
    } catch (error) {
      console.error(
        "VISIBILITY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// DELETE NOTE
// =====================================================

app.delete(
  "/api/notes/:id",
  requireDatabase,
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const userName =
        String(
          req.query.user || ""
        ).trim();

      if (!userName) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }

      const note =
        await Note.findOneAndDelete({
          _id: id,
          userName,
        });

      if (!note) {
        return res.status(404).json({
          success: false,
          message:
            "Note not found or permission denied",
        });
      }

      return res.json({
        success: true,
        message:
          "Note deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE NOTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =====================================================
// PERSONAL ASSISTANT
// =====================================================

app.post(
  "/api/assistant",
  requireAuth,
  async (req, res) => {
    try {
      console.log(
        "======================================"
      );

      console.log(
        "PA REQUEST RECEIVED"
      );

      console.log(
        "======================================"
      );

      const message =
        String(
          req.body?.message || ""
        ).trim();

      const userName =
        String(
          req.user?.name || ""
        ).trim();

      if (!message) {
        return res.status(400).json({
          success: false,
          message:
            "Message is required",
        });
      }

      if (
        !process.env.GEMINI_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          message:
            "GEMINI_API_KEY is not configured on the server.",
        });
      }

      if (!gemini) {
        return res.status(500).json({
          success: false,
          message:
            "Gemini AI could not be initialized.",
        });
      }

      let userNotes = [];

      if (
        userName &&
        req.user.role !== "owner"
      ) {
        const databaseConnected =
          await connectDatabase();

        if (databaseConnected) {
          try {
            userNotes =
              await Note.find({
                userName,
              })
                .sort({
                  createdAt: -1,
                })
                .limit(50)
                .lean();
          } catch (dbError) {
            console.error(
              "PA NOTE FETCH ERROR:",
              dbError.message
            );

            userNotes = [];
          }
        }
      }

      const notebookContext =
        userNotes.length > 0
          ? userNotes
              .map(
                (
                  note,
                  index
                ) => `
NOTE ${index + 1}

Subject: ${note.subject}

Question: ${note.question}

Answer: ${note.answer}

Code:
${note.code || "No code"}

Language:
${note.language || "text"}
`
              )
              .join(
                "\n--------------------\n"
              )
          : "No notebook notes are currently available.";

      const systemInstruction = `
You are PA Mode, the Personal Assistant
of Program Notebook.

User name:
${userName || "User"}

You are helpful, friendly and intelligent.

Support:
- Hindi
- English
- Hinglish

You can help with:
- Programming
- Coding
- Debugging
- Learning
- General knowledge
- Questions about the user's notebook

If the user asks in Hindi or Hinglish,
reply in Hindi or Hinglish.

If code is needed, provide proper,
complete and readable code.

USER'S NOTEBOOK:

${notebookContext}
`;

      console.log(
        "Sending request to Gemini..."
      );

      const response =
        await gemini.models.generateContent(
          {
            model:
              "gemini-3.6-flash",

            contents:
              message,

            config: {
              systemInstruction,
              temperature: 0.7,
            },
          }
        );

      console.log(
        "Gemini response received"
      );

      const answer =
        response.text ||
        "Sorry, I could not generate a response.";

      return res.status(200).json({
        success: true,
        answer,
      });
    } catch (error) {
      console.error(
        "PA MODE ERROR:",
        error
      );

      if (
        error.status === 429
      ) {
        return res.status(429).json({
          success: false,
          quotaExceeded: true,
          message:
            "AI is currently busy or the free limit has been reached. Please wait for a few seconds and try again.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Personal Assistant failed. Please try again later.",

        error:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : String(error),
      });
    }
  }
);

// =====================================================
// OWNER ADMIN
// =====================================================

// GET ALL USERS

app.get(
  "/api/admin/users",
  requireDatabase,
  verifyToken,
  requireOwner,
  async (req, res) => {
    try {
      const users =
        await User.find(
          {},
          {
            password: 0,
          }
        ).sort({
          createdAt: -1,
        });

      const usersWithStats =
        await Promise.all(
          users.map(
            async (user) => {
              const noteCount =
                await Note.countDocuments({
                  userName:
                    user.name,
                });

              return {
                _id: user._id,

                name:
                  user.name,

                createdAt:
                  user.createdAt,

                location:
                  user.location ||
                  null,

                noteCount,
              };
            }
          )
        );

      return res.json({
        success: true,
        users:
          usersWithStats,
      });
    } catch (error) {
      console.error(
        "ADMIN USERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load users",
      });
    }
  }
);

// =====================================================
// GET PARTICULAR USER NOTES
// =====================================================

app.get(
  "/api/admin/users/:userName/notes",
  requireDatabase,
  verifyToken,
  requireOwner,
  async (req, res) => {
    try {
      const userName =
        String(
          req.params.userName ||
          ""
        ).trim();

      const notes =
        await Note.find({
          userName,
        }).sort({
          createdAt: -1,
        });

      return res.json({
        success: true,
        notes,
      });
    } catch (error) {
      console.error(
        "ADMIN USER NOTES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load user notes",
      });
    }
  }
);

// =====================================================
// ADMIN UPDATE NOTE
// =====================================================

app.put(
  "/api/admin/notes/:id",
  requireDatabase,
  verifyToken,
  requireOwner,
  async (req, res) => {
    try {
      const {
        subject,
        question,
        answer,
        code,
        language,
        visibility,
      } = req.body;

      const note =
        await Note.findByIdAndUpdate(
          req.params.id,

          {
            subject:
              String(
                subject || ""
              ).trim(),

            question:
              String(
                question || ""
              ).trim(),

            answer:
              String(
                answer || ""
              ),

            code:
              String(
                code || ""
              ),

            language:
              String(
                language ||
                "text"
              ),

            visibility:
              visibility ===
              "public"
                ? "public"
                : "private",

            updatedAt:
              new Date(),
          },

          {
            new: true,
            runValidators: true,
          }
        );

      if (!note) {
        return res.status(404).json({
          success: false,
          message:
            "Note not found",
        });
      }

      return res.json({
        success: true,
        note,
      });
    } catch (error) {
      console.error(
        "ADMIN UPDATE NOTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update note",
      });
    }
  }
);

// =====================================================
// ADMIN DELETE NOTE
// =====================================================

app.delete(
  "/api/admin/notes/:id",
  requireDatabase,
  verifyToken,
  requireOwner,
  async (req, res) => {
    try {
      const note =
        await Note.findByIdAndDelete(
          req.params.id
        );

      if (!note) {
        return res.status(404).json({
          success: false,
          message:
            "Note not found",
        });
      }

      return res.json({
        success: true,
        message:
          "Note deleted successfully",
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE NOTE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete note",
      });
    }
  }
);

// =====================================================
// ADMIN DELETE USER
// =====================================================

app.delete(
  "/api/admin/users/:id",
  requireDatabase,
  verifyToken,
  requireOwner,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      // Delete user's notes first

      await Note.deleteMany({
        userName:
          user.name,
      });

      // Delete user

      await User.findByIdAndDelete(
        req.params.id
      );

      return res.json({
        success: true,
        message:
          "User and all notes deleted",
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE USER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete user",
      });
    }
  }
);

// =====================================================
// USER LOCATION
// =====================================================

app.post(
  "/api/user/location",
  requireDatabase,
  verifyToken,
  async (req, res) => {
    try {
      // Owner location not required

      if (
        req.user.role ===
        "owner"
      ) {
        return res.json({
          success: true,
        });
      }

      const {
        latitude,
        longitude,
      } = req.body;

      if (
        typeof latitude !==
          "number" ||
        typeof longitude !==
          "number"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid location",
        });
      }

      if (!req.user.userId) {
        return res.status(401).json({
          success: false,
          message:
            "User ID missing from token",
        });
      }

      await User.findByIdAndUpdate(
        req.user.userId,

        {
          location: {
            latitude,
            longitude,
            updatedAt:
              new Date(),
          },
        }
      );

      return res.json({
        success: true,
        message:
          "Location updated",
      });
    } catch (error) {
      console.error(
        "LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save location",
      });
    }
  }
);

// =====================================================
// API 404
// IMPORTANT:
// THIS MUST BE AFTER ALL API ROUTES
// =====================================================

app.use(
  "/api",
  (req, res) => {
    return res.status(404).json({
      success: false,
      message:
        "API route not found",
      route:
        req.originalUrl,
    });
  }
);

// =====================================================
// FRONTEND FALLBACK
// IMPORTANT:
// THIS MUST BE AFTER ALL API ROUTES
// =====================================================

app.use(
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "       PROGRAM NOTEBOOK SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      "Status: ONLINE"
    );

    console.log(
      `Owner ID: ${
        OWNER_USER_ID
          ? "Configured"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Gemini: ${
        process.env.GEMINI_API_KEY
          ? "Configured"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      "======================================"
    );

    console.log("");
  }
);