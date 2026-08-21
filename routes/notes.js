// =====================================================
// PROGRAM NOTEBOOK
// NOTES ROUTES
// =====================================================

const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const Note = require("../models/Note");
const User = require("../models/User");

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret-in-production";

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again.",
    });
  }
}

// =====================================================
// GET MY NOTES
// GET /api/notes?user=username
// =====================================================

router.get("/", requireAuth, async (req, res) => {
  try {
    const requestedUser = String(
      req.query.user || ""
    ).trim();

    const userName =
      requestedUser || req.user.name;

    // Normal user can only access own notes
    if (
      req.user.role !== "owner" &&
      userName !== req.user.name
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const notes = await Note.find({
      userName,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.json(notes);
  } catch (error) {
    console.error("GET NOTES ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// GET VISIBLE NOTES
// GET /api/visible-notes?user=username
// =====================================================

router.get(
  "/visible",
  requireAuth,
  async (req, res) => {
    try {
      const userName =
        String(req.query.user || "").trim() ||
        req.user.name;

      const notes = await Note.find({
        $or: [
          {
            userName,
          },
          {
            visibility: "public",
          },
        ],
      })
        .sort({
          createdAt: -1,
        })
        .lean();

      return res.json(notes);
    } catch (error) {
      console.error(
        "GET VISIBLE NOTES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server is currently unavailable. Please try again after some time. Thank you.",
      });
    }
  }
);

// =====================================================
// GET SUBJECTS
// GET /api/subjects?user=username
// =====================================================

router.get(
  "/subjects",
  requireAuth,
  async (req, res) => {
    try {
      const userName =
        String(req.query.user || "").trim() ||
        req.user.name;

      const notes = await Note.find({
        $or: [
          {
            userName,
          },
          {
            visibility: "public",
          },
        ],
      })
        .select("subject")
        .lean();

      const subjectMap = new Map();

      notes.forEach((note) => {
        const name = String(
          note.subject || "General"
        ).trim();

        if (!name) return;

        if (!subjectMap.has(name)) {
          subjectMap.set(name, 0);
        }

        subjectMap.set(
          name,
          subjectMap.get(name) + 1
        );
      });

      const subjects = [...subjectMap.entries()]
        .map(([name, count]) => ({
          name,
          count,
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );

      return res.json(subjects);
    } catch (error) {
      console.error(
        "GET SUBJECTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server is currently unavailable. Please try again after some time. Thank you.",
      });
    }
  }
);

// =====================================================
// CREATE NOTE
// POST /api/notes
// =====================================================

router.post("/", requireAuth, async (req, res) => {
  try {
    const subject = String(
      req.body.subject || ""
    ).trim();

    const question = String(
      req.body.question || ""
    ).trim();

    const answer = String(
      req.body.answer || ""
    );

    const code = String(
      req.body.code || ""
    );

    const language = String(
      req.body.language || "text"
    ).trim();

    const visibility =
      req.body.visibility === "public"
        ? "public"
        : "private";

    if (!subject || !question || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Subject, question and answer are required.",
      });
    }

    const note = await Note.create({
      subject,
      question,
      answer,
      code,
      language,
      userName: req.user.name,
      visibility,
    });

    return res.status(201).json({
      success: true,
      message: "Note saved successfully.",
      note,
    });
  } catch (error) {
    console.error("CREATE NOTE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// UPDATE NOTE
// PUT /api/notes/:id
// =====================================================

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(
      req.params.id
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found.",
      });
    }

    // Only note owner can edit
    if (
      note.userName !== req.user.name &&
      req.user.role !== "owner"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can edit only your own notes.",
      });
    }

    const subject = String(
      req.body.subject || ""
    ).trim();

    const question = String(
      req.body.question || ""
    ).trim();

    const answer = String(
      req.body.answer || ""
    );

    const code = String(
      req.body.code || ""
    );

    const language = String(
      req.body.language || "text"
    ).trim();

    const visibility =
      req.body.visibility === "public"
        ? "public"
        : "private";

    if (!subject || !question || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Subject, question and answer are required.",
      });
    }

    note.subject = subject;
    note.question = question;
    note.answer = answer;
    note.code = code;
    note.language = language;
    note.visibility = visibility;

    await note.save();

    return res.json({
      success: true,
      message: "Note updated successfully.",
      note,
    });
  } catch (error) {
    console.error("UPDATE NOTE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// DELETE NOTE
// DELETE /api/notes/:id?user=username
// =====================================================

router.delete(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const note = await Note.findById(
        req.params.id
      );

      if (!note) {
        return res.status(404).json({
          success: false,
          message: "Note not found.",
        });
      }

      // Owner can delete any note
      // Normal user can delete own note
      if (
        note.userName !== req.user.name &&
        req.user.role !== "owner"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can delete only your own notes.",
        });
      }

      await Note.findByIdAndDelete(
        req.params.id
      );

      return res.json({
        success: true,
        message: "Note deleted successfully.",
      });
    } catch (error) {
      console.error("DELETE NOTE ERROR:", error);

      return res.status(500).json({
        success: false,
        message:
          "Server is currently unavailable. Please try again after some time. Thank you.",
      });
    }
  }
);

// =====================================================
// USER LOCATION
// POST /api/user/location
// =====================================================

router.post(
  "/user/location",
  requireAuth,
  async (req, res) => {
    try {
      const latitude = Number(
        req.body.latitude
      );

      const longitude = Number(
        req.body.longitude
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid location.",
        });
      }

      await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            "location.latitude": latitude,
            "location.longitude": longitude,
            "location.updatedAt": new Date(),
          },
        }
      );

      return res.json({
        success: true,
        message: "Location saved.",
      });
    } catch (error) {
      console.error(
        "USER LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server is currently unavailable. Please try again after some time. Thank you.",
      });
    }
  }
);

module.exports = router;