import Web3 from "web3";
import express from "express";
import "dotenv/config";
import ERC20 from "./abi/ERC20.json" assert { type: "json" };

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(ERC20, req.body.contractAddress);

    const targetFunction = contract.methods[req.body.function];
    if (!targetFunction) {
      res.status(400).json({ error: "Function not found in contract ABI." });
      return;
    }

    const inputArguments = req.body.inputs || [];

    res
      .status(200)
      .json({ encodedData: targetFunction(...inputArguments).encodeABI() });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred." });
  }
});

export default router;
