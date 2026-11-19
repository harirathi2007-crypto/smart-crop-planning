const mongoose = require("mongoose");

const farmSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    location: {
      type: String,
      required: true
    },

    state: {
      type: String,
      required: true
    },

    district: {
      type: String,
      required: true
    },

    soilType: {
      type: String,
      required: true
    },

    soilPh: {
      type: Number,
      min: 0,
      max: 14
    },

    nitrogen: {
      type: Number
    },

    phosphorus: {
      type: Number
    },

    potassium: {
      type: Number
    },

    area: {
      type: Number,
      required: true,
      min: 0.01
    },

    areaUnit: {
      type: String,
      enum: ["acres", "hectares"],
      default: "acres"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Farm", farmSchema);