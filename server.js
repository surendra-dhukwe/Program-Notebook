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

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "program-notebook-secret-2026";

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
// MONGODB
// =====================================================

let mongoConnectionPromise = null;

async function connectDatabase() {
  // Already connected
  if (
    mongoose.connection.readyState === 1
  ) {
    return true;
  }

  // Connection is already being attempted
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
// DATABASE AVAILABILITY CHECK
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

const User =
  mongoose.model(
    "User",
    userSchema
  );

const Note =
  mongoose.model(
    "Note",
    noteSchema
  );

// =====================================================
// HELPER
// =====================================================

function createToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
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

async function checkUser(req, res) {
  try {
    const name = String(
      req.body?.name ||
      req.body?.userName ||
      ""
    ).trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    let user =
      await User.findOne({
        name,
      });

    // -------------------------------------------------
    // USER DOES NOT EXIST
    // -------------------------------------------------

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        hasPassword: false,
      });
    }

    // -------------------------------------------------
    // USER WITHOUT PASSWORD
    // DELETE AUTOMATICALLY
    // -------------------------------------------------

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

    // -------------------------------------------------
    // VALID USER
    // -------------------------------------------------

    return res.json({
      success: true,
      exists: true,
      hasPassword: true,

      user: {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        createdAt: user.createdAt,
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
// REGISTER
// =====================================================

async function registerUser(req, res) {
  try {
    const name = String(
      req.body?.name ||
      req.body?.userName ||
      ""
    ).trim();

    const password = String(
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
        message: "User ID is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
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
        password: hashedPassword,
      });

    const token =
      createToken(user);

    const userData = {
      id: String(user._id),
      _id: String(user._id),
      name: user.name,
      createdAt: user.createdAt,
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
// =====================================================

async function loginUser(req, res) {
  try {
    const name = String(
      req.body?.name ||
      req.body?.userName ||
      ""
    ).trim();

    const password = String(
      req.body?.password || ""
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          "Password is required",
      });
    }

    const user =
      await User.findOne({
        name,
      });

    // -------------------------------------------------
    // USER NOT FOUND
    // -------------------------------------------------

    if (!user) {
      return res.status(404).json({
        success: false,
        exists: false,
        message:
          "User not found. Please create a new account.",
      });
    }

    // -------------------------------------------------
    // PASSWORDLESS USER
    // DELETE
    // -------------------------------------------------

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

    // -------------------------------------------------
    // PASSWORD
    // -------------------------------------------------

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

    // -------------------------------------------------
    // TOKEN
    // -------------------------------------------------

    const token =
      createToken(user);

    const userData = {
      id: String(user._id),
      _id: String(user._id),
      name: user.name,
      createdAt: user.createdAt,
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
// CREATE USER LEGACY
// =====================================================
//
// IMPORTANT:
// This route NO LONGER creates passwordless users.
// =====================================================

app.post(
  "/api/users",
  async (req, res) => {
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
//
// Current user's private notes
// +
// ALL users' public notes
//
// Other users' private notes NEVER returned.
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
// SUBJECTS - CURRENT USER
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

      // -------------------------------------------------
      // ONLY REAL USERS CAN CREATE NOTES
      // -------------------------------------------------

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
          subject: cleanSubject,

          question: cleanQuestion,

          answer: cleanAnswer,

          code: cleanCode,

          language: cleanLanguage,

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
// API 404
// IMPORTANT
// Never return index.html for an unknown API route.
// =====================================================

app.use(
  "/api",
  (req, res) => {
    return res.status(404).json({
      success: false,
      message:
        "API route not found",
      route: req.originalUrl,
    });
  }
);

// =====================================================
// FRONTEND FALLBACK
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
      "======================================"
    );
    console.log("");
  }
);