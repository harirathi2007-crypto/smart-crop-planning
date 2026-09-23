const mongoose = require("mongoose");

const marketSchema = new mongoose.Schema(
  {
    crop: {
      type: String,
      required: true
    },

    marketName: {
      type: String
    },

    price: {
      type: Number
    },

    demand: {
      type: String
    },

    location: {
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

module.exports = mongoose.model("Market", marketSchema);