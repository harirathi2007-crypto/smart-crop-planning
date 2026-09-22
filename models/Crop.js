const mongoose = require("mongoose");

const cropSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    season: {
      type: String
    },

    soilType: {
      type: String
    },

    description: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Crop", cropSchema);