const mongoose = require("mongoose");

const cropRecommendationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true
    },

    recommendedCrop: {
      type: String,
      required: true
    },

    suitability: {
      type: String
    },

    temperature: {
      type: Number
    },

    rainfall: {
      type: Number
    },

    humidity: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "CropRecommendation",
  cropRecommendationSchema
);