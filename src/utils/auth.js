import axios from "axios";
import jwt_decode from "jwt-decode";

export const checkToken = async (token, workspaceKey) => {
  try {
    await axios.post(
      "https://orchestrator.grindery.org",
      {
        jsonrpc: "2.0",
        method: "or_listWorkflows",
        id: new Date(),
        params: {
          ...(typeof workspaceKey !== "undefined" && {workspaceKey}),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (err) {
    throw new Error(
      (err && err.response && err.response.data && err.response.data.message) ||
        err.message ||
        "Invalid token"
    );
  }
};

export const isRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({message: "No credentials sent"});
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(403).json({message: "Wrong authentication method"});
  }

  const token = authHeader.substring(7, authHeader.length);
  try {
    await checkToken(token);
  } catch (err) {
    return res.status(401).json({
      message:
        (err &&
          err.response &&
          err.response.data &&
          err.response.data.message) ||
        err.message,
    });
  }
  const user = jwt_decode(token);
  res.locals.userId = user.sub;
  res.locals.workspaceId = user.workspace;

  next();
};
