const mongoose = require("mongoose");

const weatherSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: true
    },

    temperature: {
      type: Number
    },

    humidity: {
      type: Number
    },

    rainfall: {
      type: Number
    },

    weatherCondition: {
      type: String
    },

    recordedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Weather", weatherSchema);