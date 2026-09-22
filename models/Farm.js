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

    soilType: {
      type: String,
      required: true
    },

    soilPh: {
      type: Number
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
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Farm", farmSchema);