import express from "express";
import "dotenv/config";
import axios from "axios";
import base64url from "base64url";

const router = express.Router();

// Endpoint for initiating the sign-in process
router.get("/initiate-signin", async (req, res) => {
  try {
    const encodedState = base64url.encode(
      JSON.stringify({
        response_path: req.query.responsepath,
        phone: req.query.phone,
      })
    );
    res.redirect(
      `https://orchestrator.grindery.org/oauth/authorize/?redirect_uri=${encodeURIComponent(
        `https://bot-auth-api.grindery.org/v1/bot-auth/update-user-information?code=&state=${encodedState}`
      )}&response_type=code&state=${encodedState}`
    );
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint for updating user information
router.get("/update-user-information", async (req, res) => {
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://orchestrator.grindery.org/oauth/token",
      {
        code: req.query.code,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Get user email using the access token
    const emailResponse = await axios.post(
      "https://orchestrator.grindery.org",
      {
        jsonrpc: "2.0",
        method: "or_getUserEmail",
        id: "some id",
        params: {},
      },
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const decodeState = JSON.parse(base64url.decode(String(req.query.state)));

    // Update user informations
    const updateUserResponse = await axios.post(
      "https://orchestrator.grindery.org",
      {
        jsonrpc: "2.0",
        method: "or_updateUserProps",
        id: "some id",
        params: {
          email: emailResponse.data.result || null,
          response_path: decodeState.response_path,
          phone: decodeState.phone,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    if (updateUserResponse.data.result) {
      res.redirect("https://ping.grindery.io/?patchwallet=1");
    } else {
      res.status(400).json({ error: "Hubspot information update failed" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
