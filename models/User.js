// =====================================================
// PROGRAM NOTEBOOK
// USER MODEL
// =====================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "owner"],
      default: "user",
    },

    location: {
      latitude: {
        type: Number,
        default: null,
      },

      longitude: {
        type: Number,
        default: null,
      },

      updatedAt: {
        type: Date,
        default: null,
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

module.exports = mongoose.model("User", userSchema);