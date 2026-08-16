require("dotenv").config();

const dns = require("dns");

// Force Node.js MongoDB DNS lookup through Google DNS
dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// MONGODB
// =====================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error(
      "MongoDB connection error:",
      err.message
    );
  });

// =====================================================
// USER SCHEMA
// =====================================================

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// =====================================================
// NOTE SCHEMA
// =====================================================

const noteSchema = new mongoose.Schema({
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

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model(
  "User",
  userSchema
);

const Note = mongoose.model(
  "Note",
  noteSchema
);

// =====================================================
// API STATUS
// =====================================================

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    server: "Program Notebook",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    time: new Date(),
  });
});

// =====================================================
// CREATE / GET USER
// =====================================================

app.post("/api/users", async (req, res) => {
  try {
    console.log("=================================");
    console.log("POST /api/users RECEIVED");
    console.log("BODY:", req.body);
    console.log("=================================");

    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    // Find existing user
    let user = await User.findOne({ name: name });

    // Create if doesn't exist
    if (!user) {
      user = new User({
        name: name
      });

      await user.save();
    }

    console.log("USER:", user);

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        createdAt: user.createdAt
      }
    });

  } catch (error) {

    console.error("=================================");
    console.error("CREATE USER ERROR");
    console.error(error);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================================
// GET NOTES
// =====================================================

app.get("/api/notes", async (req, res) => {
  try {
    const userName = String(
      req.query.user || ""
    ).trim();

    if (!userName) {
      return res.status(400).json({
        message: "User name is required",
      });
    }

    const notes = await Note.find({
      userName,
    }).sort({
      createdAt: -1,
    });

    res.json(notes);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// =====================================================
// GET SUBJECTS
// =====================================================

app.get(
  "/api/subjects",
  async (req, res) => {
    try {
      const userName = String(
        req.query.user || ""
      ).trim();

      if (!userName) {
        return res.status(400).json({
          message: "User name is required",
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

      res.json(
        subjects.map((item) => ({
          name: item._id,
          count: item.count,
        }))
      );
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

// =====================================================
// CREATE NOTE
// =====================================================

app.post("/api/notes", async (req, res) => {
  try {
    const {
      subject,
      question,
      answer,
      code,
      language,
      userName,
    } = req.body;

    if (
      !subject ||
      !question ||
      !answer ||
      !userName
    ) {
      return res.status(400).json({
        message:
          "Subject, question, answer and user name are required",
      });
    }

    const note = await Note.create({
      subject: String(subject).trim(),

      question: String(question).trim(),

      answer: String(answer),

      code: String(code || ""),

      language: String(
        language || "text"
      ),

      userName: String(
        userName
      ).trim(),

      createdAt: new Date(),

      updatedAt: new Date(),
    });

    res.status(201).json(note);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// =====================================================
// UPDATE NOTE
// =====================================================

app.put(
  "/api/notes/:id",
  async (req, res) => {
    try {
      const id = req.params.id;

      const {
        subject,
        question,
        answer,
        code,
        language,
        userName,
      } = req.body;

      if (
        !subject ||
        !question ||
        !answer ||
        !userName
      ) {
        return res.status(400).json({
          message:
            "Subject, question, answer and user name are required",
        });
      }

      const note =
        await Note.findOneAndUpdate(
          {
            _id: id,
            userName:
              String(userName).trim(),
          },

          {
            subject:
              String(subject).trim(),

            question:
              String(question).trim(),

            answer:
              String(answer),

            code:
              String(code || ""),

            language:
              String(
                language || "text"
              ),

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
          message:
            "Note not found or permission denied",
        });
      }

      res.json(note);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

// =====================================================
// DELETE NOTE
// =====================================================

app.delete(
  "/api/notes/:id",
  async (req, res) => {
    try {
      const id = req.params.id;

      const userName = String(
        req.query.user || ""
      ).trim();

      if (!userName) {
        return res.status(400).json({
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
          message:
            "Note not found or permission denied",
        });
      }

      res.json({
        message:
          "Note deleted successfully",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

// =====================================================
// FRONTEND FALLBACK
// =====================================================

// IMPORTANT:
// Do NOT use app.get("*") with Express 5.

app.use((req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
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
  console.log("Status: ONLINE");
  console.log(
    "======================================"
  );
  console.log("");
});