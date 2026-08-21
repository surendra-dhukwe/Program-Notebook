// =====================================================
// PROGRAM NOTEBOOK
// AUTH ROUTES
// =====================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/User");

// =====================================================
// ENV
// =====================================================

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret-in-production";

// =====================================================
// HELPERS
// =====================================================

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
}

function safeUser(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    location: user.location,
  };
}

// =====================================================
// CHECK USER
// POST /api/auth/check
// =====================================================

router.post("/check", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findOne({
      name,
    }).lean();

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        hasPassword: false,
      });
    }

    return res.json({
      success: true,
      exists: true,
      hasPassword: Boolean(user.password),
      role: user.role || "user",
    });
  } catch (error) {
    console.error("AUTH CHECK ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// REGISTER
// POST /api/auth/register
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    const password = String(req.body.password || "");

    const confirmPassword = String(
      req.body.confirmPassword || ""
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const existingUser = await User.findOne({
      name,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User ID already exists. Please login.",
      });
    }

    // -------------------------------------------------
    // HASH PASSWORD
    // -------------------------------------------------

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    // -------------------------------------------------
    // NORMAL USERS ARE CREATED AS USER
    // -------------------------------------------------

    const user = await User.create({
      name,
      password: hashedPassword,
      role: "user",
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Notebook created successfully.",
      token,
      user: safeUser(user),
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    // Duplicate name protection
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User ID already exists. Please login.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// LOGIN
// POST /api/auth/login
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    const password = String(req.body.password || "");

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    const user = await User.findOne({
      name,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid User ID or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid User ID or password.",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser(user),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server is currently unavailable. Please try again after some time. Thank you.",
    });
  }
});

// =====================================================
// LOCATION
// POST /api/auth/location
// =====================================================

router.post("/location", async (req, res) => {
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

    const latitude = Number(req.body.latitude);

    const longitude = Number(req.body.longitude);

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
      decoded.id,
      {
        $set: {
          "location.latitude": latitude,
          "location.longitude": longitude,
          "location.updatedAt": new Date(),
        },
      },
      {
        new: true,
      }
    );

    return res.json({
      success: true,
      message: "Location updated.",
    });
  } catch (error) {
    console.error("LOCATION ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Unable to update location.",
    });
  }
});

module.exports = router;