// =====================================================
// PROGRAM NOTEBOOK
// ADMIN / OWNER ROUTES
// =====================================================

const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/User");
const Note = require("../models/Note");

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret-in-production";

// =====================================================
// AUTH
// =====================================================

function requireAuth(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token =
      authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        "Session expired. Please login again.",
    });
  }
}

// =====================================================
// OWNER ONLY
// =====================================================

function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Owner access required.",
    });
  }

  next();
}

// =====================================================
// GET ALL USERS
// GET /api/admin/users
// =====================================================

router.get(
  "/users",
  requireAuth,
  requireOwner,
  async (req, res) => {
    try {
      const users = await User.find({})
        .select(
          "name role location createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

      const userIds = users.map(
        (user) => user._id
      );

      const noteCounts =
        await Note.aggregate([
          {
            $match: {
              userName: {
                $in: users.map(
                  (user) => user.name
                ),
              },
            },
          },
          {
            $group: {
              _id: "$userName",
              count: {
                $sum: 1,
              },
            },
          },
        ]);

      const countMap = new Map();

      noteCounts.forEach((item) => {
        countMap.set(
          item._id,
          item.count
        );
      });

      const result = users.map((user) => ({
        _id: user._id,
        name: user.name,
        role: user.role,
        location: user.location,
        createdAt: user.createdAt,
        noteCount:
          countMap.get(user.name) || 0,
      }));

      return res.json({
        success: true,
        users: result,
      });
    } catch (error) {
      console.error(
        "ADMIN USERS ERROR:",
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
// GET USER NOTES
// GET /api/admin/users/:userName/notes
// =====================================================

router.get(
  "/users/:userName/notes",
  requireAuth,
  requireOwner,
  async (req, res) => {
    try {
      const userName = decodeURIComponent(
        req.params.userName
      );

      const user = await User.findOne({
        name: userName,
      })
        .select("name role")
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      const notes = await Note.find({
        userName,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

      return res.json({
        success: true,
        user,
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
          "Server is currently unavailable. Please try again after some time. Thank you.",
      });
    }
  }
);

// =====================================================
// DELETE USER
// DELETE /api/admin/users/:userId
// =====================================================

router.delete(
  "/users/:userId",
  requireAuth,
  requireOwner,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.params.userId
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Never allow owner to delete itself
      if (
        String(user._id) ===
        String(req.user.id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Owner account cannot delete itself.",
        });
      }

      // Also protect other owner accounts
      if (user.role === "owner") {
        return res.status(403).json({
          success: false,
          message:
            "Owner accounts cannot be deleted here.",
        });
      }

      await Note.deleteMany({
        userName: user.name,
      });

      await User.findByIdAndDelete(
        user._id
      );

      return res.json({
        success: true,
        message:
          "User and all notes deleted successfully.",
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE USER ERROR:",
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
// DELETE ANY NOTE
// DELETE /api/admin/notes/:noteId
// =====================================================

router.delete(
  "/notes/:noteId",
  requireAuth,
  requireOwner,
  async (req, res) => {
    try {
      const note = await Note.findById(
        req.params.noteId
      );

      if (!note) {
        return res.status(404).json({
          success: false,
          message: "Note not found.",
        });
      }

      await Note.findByIdAndDelete(
        req.params.noteId
      );

      return res.json({
        success: true,
        message:
          "Note deleted successfully.",
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE NOTE ERROR:",
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