import express from "express";
import "dotenv/config";
import axios from "axios";
import base64url from "base64url";

const router = express.Router();

// Endpoint for initiating the sign-in process
router.get("/auth", async (req, res) => {
  try {
    const encodedState = base64url.encode(
      JSON.stringify({
        response_path: req.query.responsepath,
        phone: req.query.phone,
      })
    );
    const currentDomain = `${req.protocol}://${req.get("host")}`;
    res.redirect(
      `https://orchestrator.grindery.org/oauth/authorize/?redirect_uri=${encodeURIComponent(
        `${currentDomain}/v1/bot-auth/update-user-information?code=`
      )}&response_type=code&state=${encodedState}`
    );
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint for updating user information
router.get("/callback", async (req, res) => {
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

    const access_token = tokenResponse.data.access_token;

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
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const decodeState = JSON.parse(base64url.decode(String(req.query.state)));

    // Get user PatchWallet address
    const patchWalletResponse = await axios.post(
      "https://paymagicapi.com/v1/resolver",
      {
        userIds: `tel:${decodeState.phone}`,
      }
    );

    const patchwalletAddress = patchWalletResponse.data.users[0].accountAddress;

    // Update user informations
    const updateUserResponse = await axios.post(
      "https://orchestrator.grindery.org",
      {
        jsonrpc: "2.0",
        method: "or_updateUserProps",
        id: "some id",
        params: {
          props: {
            email: emailResponse.data.result || null,
            response_path: decodeState.response_path,
            phone: decodeState.phone,
            patchwallet_phone: patchwalletAddress,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (updateUserResponse.data.result) {
      res.redirect(
        `https://ping.grindery.io/?patchwallet=${patchwalletAddress}`
      );
    } else {
      res.status(400).json({ error: "Hubspot information update failed" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
